const META_BASE = "https://graph.facebook.com/v19.0";

function token() {
  return process.env.META_ACCESS_TOKEN ?? "";
}

function accountId() {
  const id = process.env.META_AD_ACCOUNT_ID ?? "";
  return id.startsWith("act_") ? id : `act_${id}`;
}

export function isMetaConnected() {
  return !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

/** Live token check — call server-side only. Returns null on success, error string on failure. */
export async function checkMetaToken(): Promise<string | null> {
  if (!isMetaConnected()) return "not configured";
  try {
    const r = await fetch(`${META_BASE}/me?fields=id&access_token=${token()}`);
    if (r.ok) return null;
    const d = await r.json();
    const e = d?.error;
    return e ? `${e.message} (code ${e.code})` : `HTTP ${r.status}`;
  } catch {
    return "network error";
  }
}

async function metaGet(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ ...params, access_token: token() }).toString();
  const res = await fetch(`${META_BASE}${path}?${qs}`);
  if (!res.ok) {
    const err = await res.json();
    const e = err?.error ?? {};
    const detail = [e.message, e.type && `type=${e.type}`, e.code && `code=${e.code}`, e.error_subcode && `subcode=${e.error_subcode}`].filter(Boolean).join(" | ");
    throw new Error(detail || `Meta API ${res.status}`);
  }
  return res.json();
}

async function metaPost(path: string, body: Record<string, any> = {}) {
  const res = await fetch(`${META_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Meta API ${res.status}`);
  return data;
}

// ─── Account-level insights ───────────────────────────────────────────────────
export async function getMetaAccountInsights(datePreset = "last_30d") {
  const data = await metaGet(`/${accountId()}/insights`, {
    fields: "spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values,frequency",
    date_preset: datePreset,
    level: "account",
  });
  const row = data.data?.[0] ?? {};
  const purchases = row.actions?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
  const purchaseValue = row.action_values?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
  return {
    spend:          parseFloat(row.spend        ?? "0"),
    impressions:    parseInt(row.impressions     ?? "0"),
    reach:          parseInt(row.reach           ?? "0"),
    clicks:         parseInt(row.clicks          ?? "0"),
    ctr:            parseFloat(row.ctr           ?? "0"),
    cpc:            parseFloat(row.cpc           ?? "0"),
    cpm:            parseFloat(row.cpm           ?? "0"),
    frequency:      parseFloat(row.frequency     ?? "0"),
    purchases:      parseInt(purchases),
    purchaseValue:  parseFloat(purchaseValue),
    roas: parseFloat(row.spend ?? "0") > 0
      ? parseFloat(purchaseValue) / parseFloat(row.spend ?? "1")
      : 0,
  };
}

// ─── Campaign list + insights ─────────────────────────────────────────────────
export async function getMetaCampaigns(datePreset = "last_30d") {
  const data = await metaGet(`/${accountId()}/campaigns`, {
    fields: `name,status,objective,insights.date_preset(${datePreset}){spend,impressions,clicks,ctr,cpc,actions,action_values}`,
    limit: "50",
  });
  return (data.data ?? []).map((c: any) => {
    const ins = c.insights?.data?.[0] ?? {};
    const purchases = ins.actions?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
    const purchaseValue = ins.action_values?.find((a: any) => a.action_type === "purchase")?.value ?? "0";
    const spend = parseFloat(ins.spend ?? "0");
    return {
      id:           c.id,
      name:         c.name,
      status:       c.status,
      objective:    c.objective,
      spend,
      impressions:  parseInt(ins.impressions ?? "0"),
      clicks:       parseInt(ins.clicks      ?? "0"),
      ctr:          parseFloat(ins.ctr       ?? "0"),
      cpc:          parseFloat(ins.cpc       ?? "0"),
      purchases:    parseInt(purchases),
      purchaseValue:parseFloat(purchaseValue),
      roas:         spend > 0 ? parseFloat(purchaseValue) / spend : 0,
    };
  });
}

// ─── Daily spend trend ────────────────────────────────────────────────────────
export async function getMetaDailySpend(days = 30) {
  const data = await metaGet(`/${accountId()}/insights`, {
    fields: "spend,impressions,clicks,actions",
    date_preset: `last_${days}d`,
    time_increment: "1",
    level: "account",
  });
  return (data.data ?? []).map((row: any) => ({
    date:        row.date_start,
    spend:       parseFloat(row.spend        ?? "0"),
    impressions: parseInt(row.impressions    ?? "0"),
    clicks:      parseInt(row.clicks         ?? "0"),
    purchases:   parseInt(row.actions?.find((a: any) => a.action_type === "purchase")?.value ?? "0"),
  }));
}

// ─── Campaign actions (pause / activate / set budget) ────────────────────────
export async function setCampaignStatus(campaignId: string, status: "ACTIVE" | "PAUSED") {
  return metaPost(`/${campaignId}`, { status });
}

export async function setCampaignBudget(campaignId: string, dailyBudgetCents: number) {
  return metaPost(`/${campaignId}`, { daily_budget: String(dailyBudgetCents) });
}
