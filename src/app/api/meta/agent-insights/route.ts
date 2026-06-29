import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STORE_ID = process.env.STORE_ID ?? "50f89d8a-ae07-4999-9ec7-4304a2f6c51b";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET() {
  const supabase = db();

  const [actionsRes, adSnapshotsRes] = await Promise.all([
    supabase
      .from("action_log")
      .select("*")
      .eq("store_id", STORE_ID)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("ad_snapshots")
      .select("*")
      .eq("store_id", STORE_ID)
      .order("date", { ascending: false })
      .limit(200),
  ]);

  // Aggregate ad snapshots — latest snapshot per ad
  const adMap: Record<string, any> = {};
  for (const row of adSnapshotsRes.data ?? []) {
    if (!adMap[row.ad_id]) adMap[row.ad_id] = row;
  }
  const ads = Object.values(adMap).sort((a: any, b: any) => (b.roas ?? 0) - (a.roas ?? 0));

  // Split action log
  const actions = actionsRes.data ?? [];
  const pending   = actions.filter((a) => a.severity === "recommend" && a.approved === null && a.slack_ts);
  const recent    = actions.filter((a) => a.executed === true).slice(0, 20);

  return NextResponse.json({ ads, pending, recent, error: actionsRes.error?.message ?? adSnapshotsRes.error?.message ?? null });
}
