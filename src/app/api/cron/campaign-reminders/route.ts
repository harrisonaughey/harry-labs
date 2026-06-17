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
export async function POST() {
  return runReminders();
}

async function runReminders() {
  try {
    // ── Find campaigns exactly 10 days from today (AEST-aware) ──
    //
    // AEST = UTC+10. To find campaigns that send "10 days from today in AEST"
    // we compute today's AEST date, add 10 days, then query the UTC range
    // covering that full AEST day (i.e. targetDate 14:00 UTC → targetDate+1 14:00 UTC,
    // because AEST midnight = 14:00 UTC previous day).
    //
    const AEST_OFFSET_MS = 10 * 60 * 60 * 1000; // 10 hours in ms

    // "Now" expressed in AEST by shifting UTC timestamp
    const nowAEST = new Date(Date.now() + AEST_OFFSET_MS);

    // Target AEST date: today AEST + 10 days (use UTC methods on the shifted date)
    const targetAEST = new Date(Date.UTC(
      nowAEST.getUTCFullYear(),
      nowAEST.getUTCMonth(),
      nowAEST.getUTCDate() + 10,
    ));

    // Convert AEST date boundaries back to UTC for the query
    // 00:00 AEST on targetDate = (targetDate - 1 day) 14:00 UTC
    const windowStart = new Date(targetAEST.getTime() - AEST_OFFSET_MS);
    const windowEnd   = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

    console.log(`[campaign-reminders] Checking for campaigns sending on ${
      targetAEST.toISOString().slice(0, 10)
    } AEST (UTC window: ${windowStart.toISOString()} → ${windowEnd.toISOString()})`);

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
