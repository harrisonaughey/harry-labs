/**
 * POST /api/agent/build-campaign-entry
 *
 * Immediately builds a single campaign entry end-to-end:
 *   1. Upserts the entry to content_calendar (create or update)
 *   2. Calls Claude to generate full email HTML
 *   3. Creates a Klaviyo template + campaign draft, links them
 *   4. Writes both IDs back to the DB, marks status "done"
 *
 * Used by the "Build Now" button in the campaign entry modal.
 * No look-ahead date filter — builds immediately regardless of send_at.
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
import { matchDesignRule, buildDesignRulesPrompt, type DesignRule } from "@/lib/design-rules";

const STORE_ID = "50f89d8a-ae07-4999-9ec7-4304a2f6c51b";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseHtml(raw: string): string {
  const m = raw.match(/```html\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : "";
}

function parseSubject(raw: string): string {
  const block = raw.match(/## Subject Line Variants\s*([\s\S]*?)(?=\n## |$)/i)?.[1] ?? "";
  const lines = block
    .split("\n")
    .filter((l) => /^\d\./.test(l.trim()))
    .map((l) => l.replace(/^\d\.\s*/, "").replace(/\[.*?—.*?\]\s*/, "").trim())
    .filter(Boolean);
  return lines[0] ?? "";
}

function parsePreviewText(raw: string): string {
  return (
    raw.match(/## Preview Text\s*([\s\S]*?)(?=\n## |$)/i)?.[1] ?? ""
  ).trim().split("\n")[0].trim();
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    entryId,
    name,
    brief,
    templateType,
    listId,
    sendDate,
    sendTime,
    destinationUrl,
  } = body as {
    entryId?: string;
    name?: string;
    brief?: string;
    templateType?: string;
    listId?: string;
    sendDate?: string;
    sendTime?: string;
    destinationUrl?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }

  const supabase   = db();
  const briefText  = brief?.trim() || `${name}. CTA URL: ${destinationUrl ?? "https://thinkle.com.au"}`;

  // Build send_at from date + time fields
  let send_at: string | null = null;
  if (sendDate) {
    const t = sendTime || "09:00";
    send_at = new Date(`${sendDate}T${t}:00`).toISOString();
  }

  // ── 1. Upsert to content_calendar ─────────────────────────────────────────
  let id = entryId;

  if (id) {
    await supabase.from("content_calendar").update({
      name:            name.trim(),
      brief:           brief?.trim()      || null,
      send_at,
      list_id:         listId             || null,
      destination_url: destinationUrl     || null,
      template_type:   templateType       || null,
      status:          "generating",
      error_message:   null,
      updated_at:      new Date().toISOString(),
    }).eq("id", id);
  } else {
    const { data: newEntry, error } = await supabase
      .from("content_calendar")
      .insert({
        store_id:        STORE_ID,
        name:            name.trim(),
        brief:           brief?.trim()   || null,
        send_at,
        list_id:         listId          || null,
        destination_url: destinationUrl  || null,
        template_type:   templateType    || null,
        status:          "generating",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    id = newEntry.id as string;
  }

  // ── 2. Fetch design rules + find match ───────────────────────────────────
  let matchedRule: DesignRule | null = null;
  try {
    const { data: rulesData } = await supabase
      .from("campaign_design_rules")
      .select("*")
      .eq("store_id", STORE_ID)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    matchedRule = matchDesignRule(name.trim(), briefText, (rulesData ?? []) as DesignRule[]);
  } catch (e) {
    console.warn("[build-campaign-entry] Could not fetch design rules:", e);
  }

  // ── 3. Select email type (rule template_type > manual selection > auto-detect) ──
  type EmailType = keyof typeof TEMPLATE_META;
  const VALID_TYPES = new Set(Object.keys(TEMPLATE_META));
  const resolvedTemplateType = matchedRule?.template_type || templateType;
  const emailType: EmailType =
    resolvedTemplateType && VALID_TYPES.has(resolvedTemplateType)
      ? (resolvedTemplateType as EmailType)
      : detectEmailType(briefText);

  const tmplMeta = TEMPLATE_META[emailType];
  const tmplHtml = getTemplate(emailType);

  try {
    // ── 4. Fetch + match images ──────────────────────────────────────────────
    const klaviyoImages = await fetchKlaviyoImages();
    let imageCat: string;
    let imagesMeta: string = "";
    if (klaviyoImages.length > 0) {
      const matched = matchImagesToSlots(klaviyoImages, emailType, briefText);
      imageCat   = buildKlaviyoImageCatalogue(matched, emailType);
      imagesMeta = matched.map((m) => `${m.slot}: ${m.image.name}`).join(", ");
    } else {
      const driveImages = selectImages(briefText);
      imageCat          = buildImageCatalogueText(driveImages);
      imagesMeta        = driveImages.map((i) => i.filename).join(", ");
    }

    // ── 5. Build Claude user message ─────────────────────────────────────────
    const colorPrimary = matchedRule?.color_primary ?? "#6366f1";
    const colorAccent  = matchedRule?.color_accent  ?? "#f59e0b";

    const userMessage = [
      `Campaign name: ${name.trim()}`,
      listId         ? `Target Klaviyo list ID: ${listId}` : null,
      send_at        ? `Send date: ${new Date(send_at).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}` : null,
      destinationUrl ? `CTA destination URL: ${destinationUrl}` : null,
      `Brand colours — Primary: ${colorPrimary} | Secondary: #818cf8 | Accent: ${colorAccent}`,
      ``,
      `Brief: ${briefText}`,
      ``,
      // Inject design rules BEFORE template selection guidance
      ...(matchedRule ? [buildDesignRulesPrompt(matchedRule), ``] : []),
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

    // ── 6. Call Claude ────────────────────────────────────────────────────────
    const msg = await anthropic.messages.create({
      model:      "claude-opus-4-7",
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

    if (!html) throw new Error("Claude returned no HTML block — check the brief and try again");

    // ── 7. Create Klaviyo template + campaign (template is linked in createCampaign) ──
    const finalListId = listId || process.env.KLAVIYO_DEFAULT_LIST_ID || "";
    const { campaignId, templateId } = await createCampaign({
      name:        name.trim(),
      subject:     subject || name.trim(),
      fromEmail:   "hello@thinkle.com.au",
      fromName:    "Thinkle",
      listId:      finalListId,
      html,
      previewText,
      scheduledAt: send_at ?? undefined,
    });

    // ── 8. Write results to DB ────────────────────────────────────────────────
    await supabase.from("content_calendar").update({
      klaviyo_campaign_id: campaignId,
      klaviyo_template_id: templateId ?? null,
      status:              "done",
      updated_at:          new Date().toISOString(),
    }).eq("id", id!);

    // ── 9. Log to agent_actions ───────────────────────────────────────────────
    await supabase.from("agent_actions").insert({
      store_id:            STORE_ID,
      agent_name:          "campaign-designer",
      calendar_entry_id:   id,
      klaviyo_campaign_id: campaignId,
      klaviyo_template_id: templateId ?? null,
      prompt_snapshot:     `[${emailType}] ${briefText}`.slice(0, 2000),
      response_snapshot:   raw.slice(0, 4000),
      status:              "success",
    });

    return NextResponse.json({
      ok:          true,
      entryId:     id,
      campaignId,
      templateId,
      emailType,
      subject:     subject || name.trim(),
      previewText,
      imagesUsed:  imagesMeta,
      designRule:  matchedRule?.name ?? null,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    await supabase.from("content_calendar").update({
      status:        "error",
      error_message: message,
      updated_at:    new Date().toISOString(),
    }).eq("id", id!);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
