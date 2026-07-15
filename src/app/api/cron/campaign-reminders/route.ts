/**
 * GET /api/cron/campaign-reminders
 *
 * Runs daily at 23:00 UTC (= 9:00 AM AEST).
 * Finds all content_calendar campaigns scheduled to send in exactly 10 days
 * and fires a rich Slack DM to Harrison with campaign details + Shopify checklist.
 *
 * Vercel cron schedule: "0 23 * * *"
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCampaignReminder, type ReminderEntry } from "@/lib/slack-campaign-reminder";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  // ── Cron auth ──
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runReminders();
}

// Also allow manual POST trigger from the dashboard (no auth — internal use only)
// Optional body: { "targetDate": "2026-07-15" } to force a specific send date
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const targetDate = body.targetDate ?? null;
  return runReminders(targetDate);
}

async function runReminders(forcedTargetDate: string | null = null) {
  try {
    // ── Find campaigns on the target send date (AEST-aware) ──
    let windowStart: Date;
    let windowEnd:   Date;

    if (forcedTargetDate) {
      // Manual override: treat the provided date as the send date to query
      const d = new Date(forcedTargetDate + "T00:00:00+10:00"); // midnight AEST
      windowStart = new Date(d.getTime() - 60 * 60 * 1000);    // ±1h buffer
      windowEnd   = new Date(d.getTime() + 25 * 60 * 60 * 1000);
    } else {
      // AEST = UTC+10. Find campaigns sending in exactly 10 days from now (AEST).
      const AEST_OFFSET_MS = 10 * 60 * 60 * 1000;
      const nowAEST        = new Date(Date.now() + AEST_OFFSET_MS);
      const targetAEST     = new Date(Date.UTC(
        nowAEST.getUTCFullYear(),
        nowAEST.getUTCMonth(),
        nowAEST.getUTCDate() + 10,
      ));
      windowStart = new Date(targetAEST.getTime() - AEST_OFFSET_MS);
      windowEnd   = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);
    }

    console.log(`[campaign-reminders] UTC window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

    const { data: entries, error } = await db()
      .from("content_calendar")
      .select("id, name, brief, send_at, status, klaviyo_campaign_id, list_id")
      .gte("send_at", windowStart.toISOString())
      .lt("send_at",  windowEnd.toISOString())
      .in("status",  ["planned", "generating", "done"])
      .order("send_at", { ascending: true });

    if (error) {
      console.error("[campaign-reminders] DB error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!entries || entries.length === 0) {
      console.log("[campaign-reminders] No campaigns in 10 days — no reminder sent");
      return NextResponse.json({
        ok:      true,
        sent:    0,
        message: "No campaigns scheduled in 10 days — no reminder sent",
      });
    }

    await sendCampaignReminder(entries as ReminderEntry[]);

    const names = entries.map((e) => e.name).join(", ");
    console.log(`[campaign-reminders] Slack reminder sent for: ${names}`);

    return NextResponse.json({
      ok:      true,
      sent:    entries.length,
      message: `Slack reminder sent for ${entries.length} campaign${entries.length > 1 ? "s" : ""}: ${names}`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[campaign-reminders] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
