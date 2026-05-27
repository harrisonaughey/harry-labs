import { NextRequest, NextResponse } from "next/server";
import { isMetaConnected, setCampaignStatus, setCampaignBudget } from "@/lib/meta";

export async function POST(req: NextRequest) {
  if (!isMetaConnected()) {
    return NextResponse.json({ error: "Meta Ads not connected" }, { status: 401 });
  }

  const { action, campaignId, status, dailyBudget } = await req.json();

  try {
    if (action === "set_status" && campaignId && status) {
      const result = await setCampaignStatus(campaignId, status);
      return NextResponse.json({ success: true, result });
    }
    if (action === "set_budget" && campaignId && dailyBudget) {
      const result = await setCampaignBudget(campaignId, Math.round(dailyBudget * 100));
      return NextResponse.json({ success: true, result });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
