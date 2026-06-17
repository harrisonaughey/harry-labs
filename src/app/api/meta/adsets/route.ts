import { NextRequest, NextResponse } from "next/server";

const META_BASE = "https://graph.facebook.com/v19.0";

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  const preset     = req.nextUrl.searchParams.get("preset") ?? "last_30d";
  const token      = process.env.META_ACCESS_TOKEN ?? "";

  if (!campaignId || !token) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const fields = [
    "name",
    "status",
    "daily_budget",
    "lifetime_budget",
    `insights.date_preset(${preset}){spend,impressions,clicks,ctr,cpc,reach,actions,action_values}`,
  ].join(",");

  const qs  = new URLSearchParams({ fields, limit: "50", access_token: token });
  const res = await fetch(`${META_BASE}/${campaignId}/adsets?${qs}`);
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data?.error?.message ?? "Meta API error" }, { status: 500 });
  }

  const adsets = (data.data ?? []).map((as: any) => {
    const ins          = as.insights?.data?.[0] ?? {};
    const purchases    = ins.actions?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
    const purchaseValue = ins.action_values?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
    const spend        = parseFloat(ins.spend ?? "0");
    return {
      id:            as.id,
      name:          as.name,
      status:        as.status,
      dailyBudget:   as.daily_budget    ? parseInt(as.daily_budget)    / 100 : null,
      lifetimeBudget: as.lifetime_budget ? parseInt(as.lifetime_budget) / 100 : null,
      spend,
      impressions:   parseInt(ins.impressions ?? "0"),
      reach:         parseInt(ins.reach       ?? "0"),
      clicks:        parseInt(ins.clicks      ?? "0"),
      ctr:           parseFloat(ins.ctr       ?? "0"),
      cpc:           parseFloat(ins.cpc       ?? "0"),
      purchases:     parseInt(purchases),
      purchaseValue: parseFloat(purchaseValue),
      roas:          spend > 0 ? parseFloat(purchaseValue) / spend : 0,
    };
  });

  return NextResponse.json({ adsets });
}
