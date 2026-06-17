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

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30");

  try {
    const [account, prevAccount, campaigns, daily] = await Promise.all([
      getGoogleAccountStats(days),
      getGooglePreviousStats(days),
      getGoogleCampaigns(days),
      getGoogleDailySpend(days),
    ]);
    return NextResponse.json({ connected: true, account, prevAccount, campaigns, daily });
  } catch (e: any) {
    return NextResponse.json({ connected: true, error: e.message }, { status: 500 });
  }
}
