import { NextRequest, NextResponse } from "next/server";
import { isGoogleConnected, getGoogleAccountStats, getGoogleCampaigns, getGoogleDailySpend } from "@/lib/googleAds";

export async function GET(req: NextRequest) {
  if (!isGoogleConnected()) {
    return NextResponse.json({ connected: false });
  }
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30");

  try {
    const [account, campaigns, daily] = await Promise.all([
      getGoogleAccountStats(days),
      getGoogleCampaigns(days),
      getGoogleDailySpend(days),
    ]);
    return NextResponse.json({ connected: true, account, campaigns, daily });
  } catch (e: any) {
    return NextResponse.json({ connected: true, error: e.message }, { status: 500 });
  }
}
