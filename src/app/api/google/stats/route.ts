import { NextRequest, NextResponse } from "next/server";
import {
  isGoogleConnected,
  getGoogleAccountStats,
  getGoogleCampaigns,
  getGoogleDailySpend,
  getGooglePreviousStats,
} from "@/lib/googleAds";

export async function GET(req: NextRequest) {
  if (!isGoogleConnected()) return NextResponse.json({ connected: false });

  const p = req.nextUrl.searchParams;
  let since = p.get("since") ?? "";
  let until = p.get("until") ?? "";
  if (!since || !until) {
    const days  = parseInt(p.get("days") ?? "30");
    const today = new Date();
    until = today.toISOString().slice(0, 10);
    const start = new Date(today); start.setDate(start.getDate() - days + 1);
    since = start.toISOString().slice(0, 10);
  }

  try {
    const [account, prevAccount, campaigns, daily] = await Promise.all([
      getGoogleAccountStats({ since, until }),
      getGooglePreviousStats({ since, until }),
      getGoogleCampaigns({ since, until }),
      getGoogleDailySpend({ since, until }),
    ]);
    return NextResponse.json({ connected: true, account, prevAccount, campaigns, daily });
  } catch (e: any) {
    console.error("[google/stats]", e?.message ?? e);
    return NextResponse.json({ connected: true, error: e.message }, { status: 500 });
  }
}
