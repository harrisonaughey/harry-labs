const GOOGLE_ADS_BASE = "https://googleads.googleapis.com/v24";

export function isGoogleConnected() {
  return !!(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  );
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth failed: ${data.error_description ?? "unknown"}`);
  return data.access_token;
}

async function gaqlQuery(query: string) {
  const accessToken   = await getAccessToken();
  const customerId    = (process.env.GOOGLE_ADS_CUSTOMER_ID       ?? "").replace(/-/g, "");
  const loginCustId   = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/-/g, "");

  const headers: Record<string, string> = {
    Authorization:     `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    "Content-Type":    "application/json",
  };
  if (loginCustId) headers["login-customer-id"] = loginCustId;

  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Google Ads API ${res.status}`);
  return data.results ?? [];
}

// ─── Account-level summary ────────────────────────────────────────────────────
export async function getGoogleAccountStats(days = 30) {
  const rows = await gaqlQuery(`
    SELECT
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.conversions_value,
      metrics.cost_per_conversion
    FROM customer
    WHERE segments.date DURING LAST_${days}_DAYS
  `);
  const r = rows[0]?.metrics ?? {};
  const spend = (r.costMicros ?? 0) / 1_000_000;
  const convValue = r.conversionsValue ?? 0;
  return {
    spend,
    impressions:      r.impressions        ?? 0,
    clicks:           r.clicks             ?? 0,
    ctr:              (r.ctr               ?? 0) * 100,
    avgCpc:           (r.averageCpc        ?? 0) / 1_000_000,
    conversions:      r.conversions        ?? 0,
    conversionValue:  convValue,
    costPerConv:      (r.costPerConversion ?? 0) / 1_000_000,
    roas:             spend > 0 ? convValue / spend : 0,
  };
}

// ─── Campaign breakdown ───────────────────────────────────────────────────────
export async function getGoogleCampaigns(days = 30) {
  const rows = await gaqlQuery(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.conversions_value,
      metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date DURING LAST_${days}_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `);

  return rows.map((row: any) => {
    const c = row.campaign ?? {};
    const m = row.metrics  ?? {};
    const spend = (m.costMicros ?? 0) / 1_000_000;
    return {
      id:             c.id,
      name:           c.name,
      status:         c.status,
      channelType:    c.advertisingChannelType,
      spend,
      impressions:    m.impressions      ?? 0,
      clicks:         m.clicks           ?? 0,
      ctr:            (m.ctr             ?? 0) * 100,
      avgCpc:         (m.averageCpc      ?? 0) / 1_000_000,
      conversions:    m.conversions      ?? 0,
      convValue:      m.conversionsValue ?? 0,
      costPerConv:    (m.costPerConversion ?? 0) / 1_000_000,
      roas:           spend > 0 ? (m.conversionsValue ?? 0) / spend : 0,
    };
  });
}

// ─── Daily spend trend ────────────────────────────────────────────────────────
export async function getGoogleDailySpend(days = 30) {
  const rows = await gaqlQuery(`
    SELECT
      segments.date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM customer
    WHERE segments.date DURING LAST_${days}_DAYS
    ORDER BY segments.date ASC
  `);
  return rows.map((row: any) => ({
    date:        row.segments?.date,
    spend:       (row.metrics?.costMicros ?? 0) / 1_000_000,
    impressions: row.metrics?.impressions  ?? 0,
    clicks:      row.metrics?.clicks       ?? 0,
    conversions: row.metrics?.conversions  ?? 0,
  }));
}
