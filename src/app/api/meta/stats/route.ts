import { NextRequest, NextResponse } from "next/server";
import {
  isMetaConnected,
  getMetaAccountInsights,
  getMetaCampaigns,
  getMetaDailySpend,
  getMetaPreviousInsights,
  getMetaMonthSpend,
} from "@/lib/meta";

export async function GET(req: NextRequest) {
  if (!isMetaConnected()) return NextResponse.json({ connected: false });

  const preset = req.nextUrl.searchParams.get("preset") ?? "last_30d";
  const days   = parseInt(req.nextUrl.searchParams.get("days") ?? "30");

  try {
    const [account, prevAccount, campaigns, daily, monthSpend] = await Promise.all([
      getMetaAccountInsights(preset),
      getMetaPreviousInsights(days),
      getMetaCampaigns(preset),
      getMetaDailySpend(days),
      getMetaMonthSpend(),
    ]);
    return NextResponse.json({ connected: true, account, prevAccount, campaigns, daily, monthSpend });
  } catch (e: any) {
    return NextResponse.json({ connected: true, error: e.message }, { status: 500 });
  }
}
