/**
 * Campaign Designer Agent
 *
 * Reads upcoming content_calendar entries → generates email HTML via Claude →
 * creates a Klaviyo template + campaign draft → writes both IDs back to DB →
 * logs every action to agent_actions.
 *
 * Corrections vs. the original spec:
 * - Klaviyo's public REST API does NOT support embedding HTML directly in
 *   campaign-messages. The correct flow is:
 *     1. createTemplate() → Klaviyo template (holds the HTML)
 *     2. createCampaign() → Klaviyo campaign draft (holds subject/from/list)
 *   Both IDs are written back to content_calendar.
 * - brand_color_* on products falls back to Thinkle defaults if columns
 *   are not yet seeded.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCampaign } from "@/lib/klaviyo";
import { detectEmailType, getTemplate, TEMPLATE_META } from "../email-build/templates";
import { selectImages, buildImageCatalogueText } from "../email-build/imageAssets";
import { EMAIL_SYSTEM_PROMPT } from "../email-build/systemPrompt";
import {
  fetchKlaviyoImages,
  matchImagesToSlots,
  buildKlaviyoImageCatalogue,
} from "@/lib/klaviyo-images";
import { matchDesignRule, buildDesignRulesPrompt, buildBrandStandardsPrompt, type DesignRule } from "@/lib/design-rules";

const LOOK_AHEAD_DAYS = 7; // process entries scheduled in the next N days

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseHtml(raw: string): string {
  const m = raw.match(/```html\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : "";
}

function parseSubject(raw: string): string {
  const block = raw.match(/## Subject Line(?:\s*Variants?)?\s*([\s\S]*?)(?=\n## |$)/i)?.[1] ?? "";

  const candidates = block
    .split("\n")
    .filter((l) => /^[\d\-\*•]/.test(l.trim()))
    .map((l) => {
      let s = l.replace(/^[\d\.\-\*•]+\s*/, "");
      s = s.replace(/\*\*(.*?)\*\*/g, "$1");
      s = s.replace(/\s*\(\d+\s*chars?\).*$/i, "");
      s = s.replace(/\s*—\s*(Primary|Secondary|Urgency|Curiosity|Offer|Deadline).*$/i, "");
      s = s.replace(/\[.*?\]/g, "");
      return s.trim();
    })
    .filter((s) => s.length > 0 && s.length <= 80);

  return candidates[0] ?? "";
}

function parsePreviewText(raw: string): string {
  return (raw.match(/## Preview Text\s*([\s\S]*?)(?=\n## |$)/i)?.[1] ?? "").trim().split("\n")[0].trim();
}

// ─── Core agent logic ─────────────────────────────────────────────────────────

async function runAgent(storeId?: string) {
  const supabase = db();
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + LOOK_AHEAD_DAYS);

  // 1. Fetch upcoming entries that haven't been designed yet (idempotent)
  let query = supabase
    .from("content_calendar")
    .select("*, products(id,title,brand_color_primary,brand_color_secondary,brand_color_accent,image_url)")
    .is("klaviyo_campaign_id", null)
    .neq("status", "generating") // skip anything already in-flight
    .lte("send_at", horizon.toISOString())
    .order("send_at", { ascending: true });

  if (storeId) query = query.eq("store_id", storeId);

  const { data: entries, error: fetchErr } = await query;
  if (fetchErr) throw new Error(`content_calendar fetch: ${fetchErr.message}`);

  // 2. No-op if nothing to process
  if (!entries || entries.length === 0) {
    return { processed: 0, skipped: 0, errors: 0, message: "No upcoming entries to design — nothing to do." };
  }

  // 2b. Fetch design rules once for the whole run
  let designRules: DesignRule[] = [];
  try {
    const { data: rulesData } = await supabase
      .from("campaign_design_rules")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    designRules = (rulesData ?? []) as DesignRule[];
  } catch (e) {
    console.warn("[campaign-designer] Could not fetch design rules:", e);
  }

  const results = { processed: 0, skipped: 0, errors: 0, entries: [] as any[] };

  for (const entry of entries) {
    const entryId = entry.id as string;
    const sid = (entry.store_id ?? storeId) as string;

    // Mark as generating (prevents double-processing on concurrent runs)
    await supabase
      .from("content_calendar")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", entryId);

    try {
      // 3. Build brand context from linked product (fallback to Thinkle brand colours)
      const product        = entry.products as any;
      const productTitle   = product?.title ?? "Thinkle";

      const brief = entry.brief
        ? entry.brief
        : `${entry.name}. CTA URL: ${entry.destination_url ?? "https://thinkle.com.au"}`;

      // 4. Match design rule + select template type
      //    Priority: matched rule template_type > manual override > auto-detect
      const matchedRule = matchDesignRule(entry.name, brief, designRules);

      type EmailType = keyof typeof TEMPLATE_META;
      const VALID_TYPES = new Set(Object.keys(TEMPLATE_META));
      const resolvedType = matchedRule?.template_type || entry.template_type;
      const emailType: EmailType =
        resolvedType && VALID_TYPES.has(resolvedType)
          ? (resolvedType as EmailType)
          : detectEmailType(brief);
      const tmplMeta    = TEMPLATE_META[emailType];
      const tmplHtml    = getTemplate(emailType);

      // Prefer Klaviyo image library; fall back to Drive
      const klaviyoImages = await fetchKlaviyoImages();
      let imageCat: string;
      if (klaviyoImages.length > 0) {
        const matched = matchImagesToSlots(klaviyoImages, emailType, brief);
        imageCat = buildKlaviyoImageCatalogue(matched, emailType);
      } else {
        imageCat = buildImageCatalogueText(selectImages(brief));
      }

      // Brand standards + design rule are ALWAYS injected — Thinkle colours,
      // logo, fonts, and performance best-practices are applied to every email.
      const designBlock = matchedRule
        ? buildDesignRulesPrompt(matchedRule)
        : buildBrandStandardsPrompt();

      const userMessage = [
        `Campaign name: ${entry.name}`,
        entry.list_id ? `Target Klaviyo list ID: ${entry.list_id}` : null,
        entry.send_at
          ? `Send date: ${new Date(entry.send_at).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`
          : null,
        entry.destination_url ? `CTA destination URL: ${entry.destination_url}` : null,
        `Product: ${productTitle}`,
        ``,
        `Brief: ${brief}`,
        ``,
        // Brand standards + design rule always injected BEFORE template guidance
        designBlock,
        ``,
        `## Email type selected`,
        `Based on ${matchedRule ? `the matched design rule (${matchedRule.name})` : "this brief"}, the system has selected: **${tmplMeta.name}**`,
        `Best for: ${tmplMeta.bestFor}`,
        `Performance benchmark: ${tmplMeta.performanceBenchmark}`,
        ``,
        imageCat,
        ``,
        `## HTML template to use`,
        `Start with this template and fill in all {{PLACEHOLDER}} tokens with copy, URLs, and image URLs from the catalogue above.`,
        `Do NOT change the table structure or inline CSS — only replace the placeholder tokens and Klaviyo merge tags.`,
        ``,
        tmplHtml,
      ]
        .filter((l): l is string => l !== null)
        .join("\n");

      // 5. Call Claude (non-streaming — background agent)
      const msg = await anthropic.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 8192,
        system: [{ type: "text", text: EMAIL_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMessage }],
      });

      const raw = msg.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      const html        = parseHtml(raw);
      const subject     = parseSubject(raw);
      const previewText = parsePreviewText(raw);

      if (!html) throw new Error("Claude response contained no HTML block");

      // 6. Create Klaviyo template + campaign (corrected flow — see file header)
      const listId = entry.list_id ?? process.env.KLAVIYO_DEFAULT_LIST_ID ?? "";
      const { campaignId, templateId } = await createCampaign({
        name:        entry.name,
        subject:     subject || entry.name,
        fromEmail:   "hello@thinkle.com.au",
        fromName:    "Thinkle",
        listId,
        html,
        previewText,
        scheduledAt: entry.send_at ?? undefined,
      });

      // 7. Write both IDs back to content_calendar (idempotent guard for next run)
      await supabase
        .from("content_calendar")
        .update({
          klaviyo_campaign_id: campaignId,
          klaviyo_template_id: templateId,
          status: "done",
          updated_at: new Date().toISOString(),
        })
        .eq("id", entryId);

      // 8. Log to agent_actions
      await supabase.from("agent_actions").insert({
        store_id:            sid,
        agent_name:          "campaign-designer",
        calendar_entry_id:   entryId,
        klaviyo_campaign_id: campaignId,
        klaviyo_template_id: templateId,
        prompt_snapshot:     `[${emailType}${matchedRule ? ` / rule:${matchedRule.name}` : ""}] ${brief}`.slice(0, 2000),
        response_snapshot:   raw.slice(0, 4000),
        status:              "success",
      });

      results.processed++;
      results.entries.push({ id: entryId, name: entry.name, campaignId, templateId, status: "done" });

    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";

      // Mark entry as error
      await supabase
        .from("content_calendar")
        .update({ status: "error", error_message: msg, updated_at: new Date().toISOString() })
        .eq("id", entryId);

      // Log failure
      await supabase.from("agent_actions").insert({
        store_id:          sid,
        agent_name:        "campaign-designer",
        calendar_entry_id: entryId,
        status:            "error",
        error_message:     msg,
      });

      results.errors++;
      results.entries.push({ id: entryId, name: entry.name, status: "error", error: msg });
    }
  }

  return results;
}

// ─── API route ────────────────────────────────────────────────────────────────

// GET  — cron trigger (requires Authorization: Bearer <CRON_SECRET>)
// POST — manual trigger from dashboard UI (no auth required in production;
//        relies on Vercel project-level protection)

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const storeId = req.nextUrl.searchParams.get("store_id") ?? undefined;
  try {
    const result = await runAgent(storeId);
    return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const storeId = body.store_id ?? undefined;
  try {
    const result = await runAgent(storeId);
    return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
