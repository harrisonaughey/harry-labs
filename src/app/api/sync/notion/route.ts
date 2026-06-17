/**
 * POST /api/sync/notion  — manual trigger from the Campaign Calendar UI
 * GET  /api/sync/notion  — Vercel cron trigger (requires Authorization: Bearer CRON_SECRET)
 *
 * Reads the Year Campaign Calendar Notion page, parses all 12 monthly tables,
 * and upserts upcoming campaigns into content_calendar (insert-only, existing
 * entries are never overwritten).
 */

import { NextRequest, NextResponse } from "next/server";
import { syncNotionCalendar } from "@/lib/notion-sync";

const PAGE_ID = process.env.NOTION_CALENDAR_PAGE_ID ?? "373f24ce64eb80029910f6e9f9b82a05";

// ── Cron (GET) ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth     = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;

  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runSync();
}

// ── Manual trigger (POST) ──────────────────────────────────────────────────────

export async function POST() {
  return runSync();
}

// ── Core ───────────────────────────────────────────────────────────────────────

async function runSync() {
  const token = process.env.NOTION_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "NOTION_TOKEN environment variable is not set. Add it in Vercel → Settings → Environment Variables." },
      { status: 500 }
    );
  }

  try {
    const result = await syncNotionCalendar(token, PAGE_ID);

    const newWord = result.inserted === 1 ? "campaign" : "campaigns";
    const message = result.inserted > 0
      ? `${result.inserted} new ${newWord} imported from Notion${result.skipped > 0 ? ` · ${result.skipped} already existed` : ""}`
      : result.skipped > 0
        ? `All ${result.skipped} upcoming campaigns already in calendar`
        : "No upcoming campaigns found to import";

    return NextResponse.json({
      ok:       true,
      inserted: result.inserted,
      skipped:  result.skipped,
      total:    result.total,
      errors:   result.errors,
      message,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
