import { NextRequest, NextResponse } from "next/server";
import { isMetaConnected, getMetaAccountInsights, getMetaCampaigns, getMetaDailySpend } from "@/lib/meta";

export async function GET(req: NextRequest) {
  if (!isMetaConnected()) {
    return NextResponse.json({ connected: false });
  }
  const preset = req.nextUrl.searchParams.get("preset") ?? "last_30d";
  const days   = parseInt(req.nextUrl.searchParams.get("days") ?? "30");

  try {
    const [account, campaigns, daily] = await Promise.all([
      getMetaAccountInsights(preset),
      getMetaCampaigns(preset),
      getMetaDailySpend(days),
    ]);
    return NextResponse.json({ connected: true, account, campaigns, daily });
  } catch (e: any) {
    return NextResponse.json({ connected: true, error: e.message }, { status: 500 });
  }
}
