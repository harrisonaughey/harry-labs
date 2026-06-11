import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

export function parseScore(report: string): number | null {
  const m = report.match(/OVERALL SCORE:\s+(\d+)\/100/);
  return m ? parseInt(m[1], 10) : null;
}

export function parseDecision(report: string): string {
  // Look inside the PASS / KILL DECISION section first
  const section = report.match(/PASS \/ KILL DECISION([\s\S]*?)(?=━━|$)/i)?.[1] ?? "";
  const target = section || report;
  if (target.includes("GREEN LIGHT")) return "green_light";
  if (target.includes("AMBER")) return "amber";
  // REWORK is in RED territory
  if (target.includes("REWORK") || (target.includes("RED") && !target.includes("KILL")))
    return "red";
  if (target.includes("KILL")) return "kill";
  return "unknown";
}

export function parseHookType(report: string): string | null {
  const m = report.match(/Hook type:\s*(.+)/i);
  return m ? m[1].trim().toLowerCase() : null;
}

// ── GET — list all audits ─────────────────────────────────────────────

export async function GET() {
  try {
    const sb = serviceClient();
    const { data, error } = await sb
      .from("content_audits")
      .select(
        "id,created_at,title,content_type,platforms,duration_s,mode,score,decision,hook_type,status,report"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch {
    // Table may not exist yet — return empty so UI degrades gracefully
    return NextResponse.json([]);
  }
}

// ── POST — save a completed audit ─────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    title,
    content_type,
    platforms,
    duration_s,
    file_url,
    drive_file_id,
    aov,
    context,
    mode,
    report,
  } = body as {
    title: string;
    content_type?: string;
    platforms?: string[];
    duration_s?: number;
    file_url?: string;
    drive_file_id?: string;
    aov?: number;
    context?: string;
    mode: string;
    report: string;
  };

  if (!title || !report) {
    return NextResponse.json({ error: "title and report are required" }, { status: 400 });
  }

  const score    = parseScore(report);
  const decision = parseDecision(report);
  const hook_type = parseHookType(report);

  try {
    const sb = serviceClient();
    const { data, error } = await sb
      .from("content_audits")
      .insert({
        title,
        content_type: content_type ?? null,
        platforms: platforms ?? null,
        duration_s: duration_s ?? null,
        file_url: file_url ?? null,
        drive_file_id: drive_file_id ?? null,
        aov: aov ?? null,
        context: context ?? null,
        mode,
        score,
        decision,
        hook_type,
        report,
        status: "completed",
      })
      .select("id,created_at,title,content_type,platforms,duration_s,mode,score,decision,hook_type,status,report")
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch {
    // Return a synthetic record so the UI can still show the result locally
    return NextResponse.json(
      {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        title,
        content_type: content_type ?? null,
        platforms: platforms ?? null,
        duration_s: duration_s ?? null,
        mode,
        score,
        decision,
        hook_type,
        report,
        status: "completed",
        _local: true,
      },
      { status: 201 }
    );
  }
}
