import { NextRequest, NextResponse } from "next/server";

const META_BASE = "https://graph.facebook.com/v19.0";

export async function GET(req: NextRequest) {
  const adsetId = req.nextUrl.searchParams.get("adsetId");
  const account = req.nextUrl.searchParams.get("account") === "true";
  const since   = req.nextUrl.searchParams.get("since");
  const until   = req.nextUrl.searchParams.get("until");
  const preset  = req.nextUrl.searchParams.get("preset") ?? "last_30d";
  const token   = process.env.META_ACCESS_TOKEN ?? "";

  if ((!adsetId && !account) || !token) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const insightDateParam = since && until
    ? `insights.time_range(${JSON.stringify({ since, until })})`
    : `insights.date_preset(${preset})`;

  const fields = [
    "name",
    "status",
    "creative{id,name,thumbnail_url,object_story_spec,asset_feed_spec}",
    `${insightDateParam}{spend,impressions,reach,clicks,ctr,cpc,frequency,actions,action_values}`,
  ].join(",");

  const rawAccountId = (process.env.META_AD_ACCOUNT_ID ?? "").replace("act_", "");
  const endpoint     = account
    ? `${META_BASE}/act_${rawAccountId}/ads`
    : `${META_BASE}/${adsetId}/ads`;

  const qs  = new URLSearchParams({ fields, limit: account ? "200" : "50", access_token: token });
  const res = await fetch(`${endpoint}?${qs}`);
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data?.error?.message ?? "Meta API error" }, { status: 500 });
  }

  const ads = (data.data ?? []).map((ad: any) => {
    const ins           = ad.insights?.data?.[0] ?? {};
    const creative      = ad.creative ?? {};
    const purchases     = ins.actions?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
    const purchaseValue = ins.action_values?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
    const spend         = parseFloat(ins.spend ?? "0");
    return {
      id:            ad.id,
      name:          ad.name,
      status:        ad.status,
      creativeName:  creative.name    ?? null,
      thumbnailUrl:  creative.thumbnail_url ?? null,
      spend,
      impressions:   parseInt(ins.impressions ?? "0"),
      reach:         parseInt(ins.reach       ?? "0"),
      clicks:        parseInt(ins.clicks      ?? "0"),
      ctr:           parseFloat(ins.ctr       ?? "0"),
      cpc:           parseFloat(ins.cpc       ?? "0"),
      frequency:     parseFloat(ins.frequency ?? "0"),
      purchases:     parseInt(purchases),
      purchaseValue: parseFloat(purchaseValue),
      roas:          spend > 0 ? parseFloat(purchaseValue) / spend : 0,
    };
  });

  return NextResponse.json({ ads });
}
