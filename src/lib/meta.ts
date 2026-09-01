const META_BASE = "https://graph.facebook.com/v19.0";

function token() { return process.env.META_ACCESS_TOKEN ?? ""; }

function accountId() {
  const id = process.env.META_AD_ACCOUNT_ID ?? "";
  return id.startsWith("act_") ? id : `act_${id}`;
}

export function isMetaConnected() {
  return !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

export type DateFilter =
  | { type: "preset"; preset: string }
  | { type: "range"; since: string; until: string };

function dateParams(f: DateFilter): Record<string, string> {
  return f.type === "preset"
    ? { date_preset: f.preset }
    : { time_range: JSON.stringify({ since: f.since, until: f.until }) };
}

export async function checkMetaToken(): Promise<string | null> {
  if (!isMetaConnected()) return "not configured";
  try {
    const r = await fetch(`${META_BASE}/me?fields=id&access_token=${token()}`);
    if (r.ok) return null;
    const d = await r.json();
    const e = d?.error;
    return e ? `${e.message} (code ${e.code})` : `HTTP ${r.status}`;
  } catch { return "network error"; }
}

async function metaGet(path: string, params: Record<string, string> = {}) {
  const qs  = new URLSearchParams({ ...params, access_token: token() }).toString();
  const res = await fetch(`${META_BASE}${path}?${qs}`);
  if (!res.ok) {
    const err = await res.json();
    const e   = err?.error ?? {};
    const detail = [e.message, e.type && `type=${e.type}`, e.code && `code=${e.code}`, e.error_subcode && `subcode=${e.error_subcode}`]
      .filter(Boolean).join(" | ");
    throw new Error(detail || `Meta API ${res.status}`);
  }
  return res.json();
}

async function metaPost(path: string, body: Record<string, any> = {}) {
  const res  = await fetch(`${META_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Meta API ${res.status}`);
  return data;
}

// ─── Account-level insights ───────────────────────────────────────────────────
export async function getMetaAccountInsights(filter: DateFilter = { type: "preset", preset: "last_30d" }) {
  const data = await metaGet(`/${accountId()}/insights`, {
    fields: "spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values,frequency",
    level: "account",
    ...dateParams(filter),
  });
  const row          = data.data?.[0] ?? {};
  const purchases    = row.actions?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
  const purchaseValue = row.action_values?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
  return {
    spend:         parseFloat(row.spend       ?? "0"),
    impressions:   parseInt(row.impressions   ?? "0"),
    reach:         parseInt(row.reach         ?? "0"),
    clicks:        parseInt(row.clicks        ?? "0"),
    ctr:           parseFloat(row.ctr         ?? "0"),
    cpc:           parseFloat(row.cpc         ?? "0"),
    cpm:           parseFloat(row.cpm         ?? "0"),
    frequency:     parseFloat(row.frequency   ?? "0"),
    purchases:     parseInt(purchases),
    purchaseValue: parseFloat(purchaseValue),
    roas: parseFloat(row.spend ?? "0") > 0
      ? parseFloat(purchaseValue) / parseFloat(row.spend ?? "1")
      : 0,
  };
}

// ─── Campaign list + insights + budgets ──────────────────────────────────────
export async function getMetaCampaigns(filter: DateFilter = { type: "preset", preset: "last_30d" }) {
  const insightFields = `spend,impressions,reach,clicks,ctr,cpc,actions,action_values,frequency`;
  const insightParam  = filter.type === "preset"
    ? `insights.date_preset(${filter.preset}){${insightFields}}`
    : `insights.time_range(${JSON.stringify({ since: filter.since, until: filter.until })}){${insightFields}}`;

  const data = await metaGet(`/${accountId()}/campaigns`, {
    fields: `name,status,objective,daily_budget,lifetime_budget,bid_strategy,insights{spend}`,
    limit:  "50",
  });

  // Fetch insights separately with the date filter
  const insightsData = await metaGet(`/${accountId()}/campaigns`, {
    fields: `id,${insightParam}`,
    limit:  "50",
  });

  const insightsMap: Record<string, any> = {};
  for (const c of insightsData.data ?? []) {
    insightsMap[c.id] = c.insights?.data?.[0] ?? {};
  }

  return (data.data ?? []).map((c: any) => {
    const ins           = insightsMap[c.id] ?? {};
    const purchases     = ins.actions?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
    const purchaseValue = ins.action_values?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
    const spend         = parseFloat(ins.spend ?? "0");
    return {
      id:             c.id,
      name:           c.name,
      status:         c.status,
      objective:      c.objective,
      dailyBudget:    c.daily_budget    ? parseInt(c.daily_budget)    / 100 : null,
      lifetimeBudget: c.lifetime_budget ? parseInt(c.lifetime_budget) / 100 : null,
      bidStrategy:    c.bid_strategy ?? null,
      spend,
      impressions:    parseInt(ins.impressions ?? "0"),
      reach:          parseInt(ins.reach       ?? "0"),
      clicks:         parseInt(ins.clicks      ?? "0"),
      ctr:            parseFloat(ins.ctr       ?? "0"),
      cpc:            parseFloat(ins.cpc       ?? "0"),
      frequency:      parseFloat(ins.frequency ?? "0"),
      purchases:      parseInt(purchases),
      purchaseValue:  parseFloat(purchaseValue),
      roas:           spend > 0 ? parseFloat(purchaseValue) / spend : 0,
    };
  });
}

// ─── Daily spend trend ────────────────────────────────────────────────────────
export async function getMetaDailySpend(filter: DateFilter = { type: "preset", preset: "last_30d" }) {
  const data = await metaGet(`/${accountId()}/insights`, {
    fields:         "spend,impressions,clicks,actions",
    time_increment: "1",
    level:          "account",
    ...dateParams(filter),
  });
  return (data.data ?? []).map((row: any) => ({
    date:        row.date_start,
    spend:       parseFloat(row.spend        ?? "0"),
    impressions: parseInt(row.impressions    ?? "0"),
    clicks:      parseInt(row.clicks         ?? "0"),
    purchases:   parseInt(row.actions?.find((a: any) => a.action_type === "purchase")?.value ?? "0"),
  }));
}

// ─── Previous period comparison ───────────────────────────────────────────────
export async function getMetaPreviousInsights(days: number) {
  const until = new Date();
  until.setDate(until.getDate() - days - 1);
  const since = new Date(until);
  since.setDate(since.getDate() - days + 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const data = await metaGet(`/${accountId()}/insights`, {
    fields:      "spend,impressions,reach,clicks,ctr,cpc,actions,action_values",
    time_range:  JSON.stringify({ since: fmt(since), until: fmt(until) }),
    level:       "account",
  });
  const row           = data.data?.[0] ?? {};
  const purchases     = row.actions?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
  const purchaseValue = row.action_values?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
  const spend         = parseFloat(row.spend ?? "0");
  return {
    spend,
    impressions:   parseInt(row.impressions ?? "0"),
    reach:         parseInt(row.reach       ?? "0"),
    clicks:        parseInt(row.clicks      ?? "0"),
    ctr:           parseFloat(row.ctr       ?? "0"),
    cpc:           parseFloat(row.cpc       ?? "0"),
    purchases:     parseInt(purchases),
    purchaseValue: parseFloat(purchaseValue),
    roas:          spend > 0 ? parseFloat(purchaseValue) / spend : 0,
  };
}

// ─── Month-to-date spend ──────────────────────────────────────────────────────
export async function getMetaMonthSpend(): Promise<number> {
  try {
    const data = await metaGet(`/${accountId()}/insights`, {
      fields: "spend", date_preset: "this_month", level: "account",
    });
    return parseFloat(data.data?.[0]?.spend ?? "0");
  } catch { return 0; }
}

// ─── Campaign / ad set actions ────────────────────────────────────────────────
export async function setEntityStatus(entityId: string, status: "ACTIVE" | "PAUSED") {
  return metaPost(`/${entityId}`, { status });
}

export async function setEntityDailyBudget(entityId: string, dailyBudgetCents: number) {
  return metaPost(`/${entityId}`, { daily_budget: String(dailyBudgetCents) });
}

export async function setEntityBidCap(entityId: string, bidCapCents: number) {
  return metaPost(`/${entityId}`, { bid_amount: String(bidCapCents) });
}

// Keep old names as aliases for backward compat
export const setCampaignStatus = setEntityStatus;
export const setCampaignBudget = (id: string, cents: number) => setEntityDailyBudget(id, cents);
