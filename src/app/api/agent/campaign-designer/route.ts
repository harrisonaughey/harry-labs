/**
 * Campaign Designer Agent
 *
 * Reads upcoming content_calendar entries → creates a Klaviyo campaign draft
 * using the AI Template (no HTML generation) → writes IDs back to DB →
 * logs every action to agent_actions.
 *
 * Audience is left empty so Harrison can select the segment manually in Klaviyo.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCampaign } from "@/lib/klaviyo";

export const maxDuration = 60;

const LOOK_AHEAD_DAYS = 14;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Core agent logic ─────────────────────────────────────────────────────────

export async function runAgent(storeId?: string) {
  const supabase = db();
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + LOOK_AHEAD_DAYS);

  // 1. Fetch upcoming entries that haven't been designed yet (idempotent)
  let query = supabase
    .from("content_calendar")
    .select("*")
    .is("klaviyo_campaign_id", null)
    .neq("status", "generating")
    .lte("send_at", horizon.toISOString())
    .order("send_at", { ascending: true });

  if (storeId) query = query.eq("store_id", storeId);

  const { data: entries, error: fetchErr } = await query;
  if (fetchErr) throw new Error(`content_calendar fetch: ${fetchErr.message}`);

  if (!entries || entries.length === 0) {
    return { processed: 0, skipped: 0, errors: 0, message: "No upcoming entries to design — nothing to do." };
  }

  const results = { processed: 0, skipped: 0, errors: 0, entries: [] as any[] };

  for (const entry of entries) {
    const entryId = entry.id as string;
    const sid = (entry.store_id ?? storeId) as string;

    await supabase
      .from("content_calendar")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", entryId);

    try {
      // Create Klaviyo campaign using AI Template — audience left empty for manual selection
      const { campaignId, templateId } = await createCampaign({
        name:        entry.name,
        subject:     entry.name,
        fromEmail:   "info@thinkle.com.au",
        fromName:    "Thinkle",
        audienceIds: [],
        scheduledAt: entry.send_at ?? undefined,
      });

      await supabase
        .from("content_calendar")
        .update({
          klaviyo_campaign_id: campaignId,
          klaviyo_template_id: templateId,
          status:              "done",
          updated_at:          new Date().toISOString(),
        })
        .eq("id", entryId);

      await supabase.from("agent_actions").insert({
        store_id:            sid,
        agent_name:          "campaign-designer",
        calendar_entry_id:   entryId,
        klaviyo_campaign_id: campaignId,
        klaviyo_template_id: templateId,
        prompt_snapshot:     entry.name.slice(0, 2000),
        status:              "success",
      });

      results.processed++;
      results.entries.push({ id: entryId, name: entry.name, campaignId, templateId, status: "done" });

    } catch (err: any) {
      const message = err?.message ?? "Unknown error";

      await supabase
        .from("content_calendar")
        .update({ status: "error", error_message: message, updated_at: new Date().toISOString() })
        .eq("id", entryId);

      await supabase.from("agent_actions").insert({
        store_id:          sid,
        agent_name:        "campaign-designer",
        calendar_entry_id: entryId,
        status:            "error",
        error_message:     message,
      });

      results.errors++;
      results.entries.push({ id: entryId, name: entry.name, status: "error", error: message });
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
