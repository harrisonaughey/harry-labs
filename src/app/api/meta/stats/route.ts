import { NextRequest, NextResponse } from "next/server";
import {
  isMetaConnected,
  getMetaAccountInsights,
  getMetaCampaigns,
  getMetaDailySpend,
  getMetaPreviousInsights,
  getMetaMonthSpend,
  type DateFilter,
} from "@/lib/meta";

export async function GET(req: NextRequest) {
  if (!isMetaConnected()) return NextResponse.json({ connected: false });

  const since  = req.nextUrl.searchParams.get("since");
  const until  = req.nextUrl.searchParams.get("until");
  const preset = req.nextUrl.searchParams.get("preset") ?? "last_30d";
  const days   = parseInt(req.nextUrl.searchParams.get("days") ?? "30");

  const filter: DateFilter = since && until
    ? { type: "range", since, until }
    : { type: "preset", preset };

  try {
    const [account, prevAccount, campaigns, daily, monthSpend] = await Promise.all([
      getMetaAccountInsights(filter),
      getMetaPreviousInsights(days),
      getMetaCampaigns(filter),
      getMetaDailySpend(filter),
      getMetaMonthSpend(),
    ]);
    return NextResponse.json({ connected: true, account, prevAccount, campaigns, daily, monthSpend });
  } catch (e: any) {
    return NextResponse.json({ connected: true, error: e.message }, { status: 500 });
  }
}
