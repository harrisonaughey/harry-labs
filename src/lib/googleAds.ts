const GOOGLE_ADS_BASE = "https://googleads.googleapis.com/v24";

// Warm-instance cache — avoids re-running auto-discovery on every request
// within the same serverless function instance.
let _resolvedCustomerId: string | null = null;
let _resolvedLoginId:    string | null = null;

export function isGoogleConnected() {
  return !!(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  );
}

async function getAccessToken(): Promise<string> {
  const clientId     = process.env.GOOGLE_ADS_CLIENT_ID     ?? "";
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("Google Ads CLIENT_ID and CLIENT_SECRET are not configured");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`OAuth failed: ${data.error_description ?? data.error ?? "unknown"}`);
  }
  return data.access_token;
}

function gaqlDateRange(since: string, until: string): string {
  return `BETWEEN '${since}' AND '${until}'`;
}

async function rawSearch(
  query:       string,
  accessToken: string,
  customerId:  string,
  loginId:     string,
): Promise<{ ok: boolean; data: any }> {
  const headers: Record<string, string> = {
    Authorization:     `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    "Content-Type":    "application/json",
  };
  if (loginId) headers["login-customer-id"] = loginId;
  const res = await fetch(
    `${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:search`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );
  const data = await res.json();
  return { ok: res.ok, data };
}

// Returns all customer IDs the OAuth user has access to — used for auto-discovery.
export async function listAccessibleCustomers(): Promise<string[]> {
  const accessToken = await getAccessToken();
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization:     `Bearer ${accessToken}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    },
  });
  const data = await res.json();
  if (!res.ok) return [];
  return (data.resourceNames ?? []).map((r: string) => r.replace("customers/", ""));
}

// Core query runner with automatic customer ID resolution.
// On PERMISSION_DENIED: calls listAccessibleCustomers and tries each candidate
// both as a direct account and as a client-under-MCC, so the right combo is
// found even when GOOGLE_ADS_CUSTOMER_ID points to the wrong account type.
async function gaqlQuery(query: string): Promise<any[]> {
  const accessToken     = await getAccessToken();
  const configuredId    = (process.env.GOOGLE_ADS_CUSTOMER_ID       ?? "").replace(/-/g, "");
  const configuredLogin = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/-/g, "");

  // Use cached IDs from a previous successful call in this warm instance
  const custId  = _resolvedCustomerId ?? configuredId;
  const loginId = _resolvedLoginId    ?? configuredLogin;

  const { ok, data } = await rawSearch(query, accessToken, custId, loginId);

  if (ok) {
    _resolvedCustomerId = custId;
    _resolvedLoginId    = loginId;
    return data.results ?? [];
  }

  const errMsg = data?.error?.message ?? `Google Ads API ${data?.error?.code ?? "error"}`;
  const isPermissionError =
    data?.error?.code === 403 || errMsg.toLowerCase().includes("permission");

  // On permission error — auto-discover which customer ID actually works
  if (isPermissionError) {
    console.error("[google] Permission denied for customer", custId, "— running auto-discovery");
    const accessibleIds = await listAccessibleCustomers();
    console.error("[google] Accessible customer IDs:", accessibleIds);

    for (const candidateId of accessibleIds) {
      // Case 1: configured ID is an MCC, candidate is a client account under it
      if (configuredId && candidateId !== configuredId) {
        const { ok: ok2, data: d2 } = await rawSearch(query, accessToken, candidateId, configuredId);
        if (ok2) {
          _resolvedCustomerId = candidateId;
          _resolvedLoginId    = configuredId;
          console.error("[google] Resolved: customer", candidateId, "via MCC login", configuredId);
          return d2.results ?? [];
        }
      }
      // Case 2: candidate is a standalone account — no login-customer-id needed
      const { ok: ok3, data: d3 } = await rawSearch(query, accessToken, candidateId, "");
      if (ok3) {
        _resolvedCustomerId = candidateId;
        _resolvedLoginId    = "";
        console.error("[google] Resolved: customer", candidateId, "direct");
        return d3.results ?? [];
      }
    }

    const hint = accessibleIds.length
      ? `Accessible accounts: ${accessibleIds.join(", ")}. Update GOOGLE_ADS_CUSTOMER_ID in Vercel env vars.`
      : "No accessible accounts found — verify GOOGLE_ADS_DEVELOPER_TOKEN is approved for production use.";
    throw new Error(`${errMsg}. ${hint}`);
  }

  throw new Error(errMsg);
}

// ─── Sum raw metric fields across all rows ────────────────────────────────────
function sumMetrics(rows: any[]): Record<string, number> {
  return rows.reduce((acc: Record<string, number>, row: any) => {
    const m = row.metrics ?? {};
    acc.costMicros       = (acc.costMicros       ?? 0) + (m.costMicros       ?? 0);
    acc.impressions      = (acc.impressions       ?? 0) + (m.impressions       ?? 0);
    acc.clicks           = (acc.clicks            ?? 0) + (m.clicks            ?? 0);
    acc.conversions      = (acc.conversions       ?? 0) + (m.conversions       ?? 0);
    acc.conversionsValue = (acc.conversionsValue  ?? 0) + (m.conversionsValue  ?? 0);
    return acc;
  }, {});
}

// ─── Previous period (for % change comparison) ───────────────────────────────
export async function getGooglePreviousStats({ since, until }: { since: string; until: string }) {
  const startDate = new Date(since + "T00:00:00");
  const endDate   = new Date(until + "T00:00:00");
  const spanDays  = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  const prevEnd   = new Date(startDate); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);   prevStart.setDate(prevStart.getDate() - (spanDays - 1));
  const fmt       = (d: Date) => d.toISOString().split("T")[0];

  const rows = await gaqlQuery(`
    SELECT
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM customer
    WHERE segments.date BETWEEN '${fmt(prevStart)}' AND '${fmt(prevEnd)}'
  `);
  const t         = sumMetrics(rows);
  const spend     = (t.costMicros ?? 0) / 1_000_000;
  const convValue = t.conversionsValue ?? 0;
  const clicks    = t.clicks ?? 0;
  const impr      = t.impressions ?? 0;
  return {
    spend,
    impressions:     impr,
    clicks,
    ctr:             impr   > 0 ? (clicks / impr) * 100 : 0,
    avgCpc:          clicks > 0 ? spend / clicks         : 0,
    conversions:     t.conversions ?? 0,
    conversionValue: convValue,
    roas:            spend  > 0 ? convValue / spend      : 0,
  };
}

// ─── Spend for a specific date range (used by P&L) ───────────────────────────
export async function getGoogleSpendRange(since: string, until: string): Promise<number> {
  const rows = await gaqlQuery(`
    SELECT metrics.cost_micros
    FROM customer
    WHERE segments.date BETWEEN '${since}' AND '${until}'
  `);
  return rows.reduce((sum: number, r: any) => sum + (r.metrics?.costMicros ?? 0), 0) / 1_000_000;
}

// ─── Account-level summary ────────────────────────────────────────────────────
export async function getGoogleAccountStats({ since, until }: { since: string; until: string }) {
  const rows = await gaqlQuery(`
    SELECT
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM customer
    WHERE segments.date ${gaqlDateRange(since, until)}
  `);
  const t         = sumMetrics(rows);
  const spend     = (t.costMicros ?? 0) / 1_000_000;
  const convValue = t.conversionsValue ?? 0;
  const clicks    = t.clicks ?? 0;
  const impr      = t.impressions ?? 0;
  const convs     = t.conversions ?? 0;
  return {
    spend,
    impressions:     impr,
    clicks,
    ctr:             impr   > 0 ? (clicks / impr) * 100 : 0,
    avgCpc:          clicks > 0 ? spend / clicks         : 0,
    conversions:     convs,
    conversionValue: convValue,
    costPerConv:     convs  > 0 ? spend / convs          : 0,
    roas:            spend  > 0 ? convValue / spend      : 0,
  };
}

// ─── Campaign breakdown ───────────────────────────────────────────────────────
export async function getGoogleCampaigns({ since, until }: { since: string; until: string }) {
  const rows = await gaqlQuery(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date ${gaqlDateRange(since, until)}
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `);
  return rows.map((row: any) => {
    const c      = row.campaign ?? {};
    const m      = row.metrics  ?? {};
    const spend  = (m.costMicros ?? 0) / 1_000_000;
    const clicks = m.clicks ?? 0;
    const impr   = m.impressions ?? 0;
    const convs  = m.conversions ?? 0;
    return {
      id:          c.id,
      name:        c.name,
      status:      c.status,
      channelType: c.advertisingChannelType,
      spend,
      impressions: impr,
      clicks,
      ctr:         impr   > 0 ? (clicks / impr) * 100 : 0,
      avgCpc:      clicks > 0 ? spend / clicks         : 0,
      conversions: convs,
      convValue:   m.conversionsValue ?? 0,
      costPerConv: convs  > 0 ? spend / convs          : 0,
      roas:        spend  > 0 ? (m.conversionsValue ?? 0) / spend : 0,
    };
  });
}

// ─── Daily spend trend ────────────────────────────────────────────────────────
export async function getGoogleDailySpend({ since, until }: { since: string; until: string }) {
  const rows = await gaqlQuery(`
    SELECT
      segments.date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM customer
    WHERE segments.date ${gaqlDateRange(since, until)}
    ORDER BY segments.date ASC
  `);
  return rows.map((row: any) => ({
    date:        row.segments?.date,
    spend:       (row.metrics?.costMicros ?? 0) / 1_000_000,
    impressions:  row.metrics?.impressions  ?? 0,
    clicks:       row.metrics?.clicks       ?? 0,
    conversions:  row.metrics?.conversions  ?? 0,
  }));
}
