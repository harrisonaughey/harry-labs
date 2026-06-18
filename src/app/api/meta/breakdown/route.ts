import { NextRequest, NextResponse } from "next/server";

const META_BASE = "https://graph.facebook.com/v19.0";

function accountId() {
  const id = process.env.META_AD_ACCOUNT_ID ?? "";
  return id.startsWith("act_") ? id : `act_${id}`;
}

export async function GET(req: NextRequest) {
  const type   = req.nextUrl.searchParams.get("type") ?? "placement";
  const since  = req.nextUrl.searchParams.get("since");
  const until  = req.nextUrl.searchParams.get("until");
  const preset = req.nextUrl.searchParams.get("preset") ?? "last_30d";
  const token  = process.env.META_ACCESS_TOKEN ?? "";

  if (!token) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  let breakdowns: string;
  let fields: string;
  if (type === "demographic") {
    breakdowns = "age,gender";
    fields     = "age,gender,spend,impressions,clicks,ctr,cpc,actions,action_values";
  } else {
    breakdowns = "publisher_platform,platform_position";
    fields     = "publisher_platform,platform_position,spend,impressions,clicks,ctr,cpc,actions,action_values";
  }

  const baseParams: Record<string, string> = { fields, breakdowns, level: "account", access_token: token };
  if (since && until) baseParams.time_range = JSON.stringify({ since, until });
  else baseParams.date_preset = preset;

  const qs  = new URLSearchParams(baseParams);

  const res  = await fetch(`${META_BASE}/${accountId()}/insights?${qs}`);
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data?.error?.message ?? "Meta API error" }, { status: 500 });
  }

  const rows = (data.data ?? []).map((row: any) => {
    const purchases     = row.actions?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
    const purchaseValue = row.action_values?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
    const spend         = parseFloat(row.spend ?? "0");
    return {
      label:         type === "demographic"
        ? `${row.age} / ${row.gender}`
        : `${row.publisher_platform} — ${row.platform_position}`,
      platform:      row.publisher_platform ?? row.age ?? "",
      position:      row.platform_position  ?? row.gender ?? "",
      spend,
      impressions:   parseInt(row.impressions ?? "0"),
      clicks:        parseInt(row.clicks      ?? "0"),
      ctr:           parseFloat(row.ctr       ?? "0"),
      cpc:           parseFloat(row.cpc       ?? "0"),
      purchases:     parseInt(purchases),
      purchaseValue: parseFloat(purchaseValue),
      roas:          spend > 0 ? parseFloat(purchaseValue) / spend : 0,
    };
  }).sort((a: any, b: any) => b.spend - a.spend);

  return NextResponse.json({ rows });
}
