const BASE = "https://business-api.tiktok.com/open_api/v1.3";

export function isTikTokConnected() {
  return !!(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_ID);
}

function headers() {
  return {
    "Access-Token": process.env.TIKTOK_ACCESS_TOKEN ?? "",
    "Content-Type": "application/json",
  };
}

function dateRange(days: number): { start: string; end: string } {
  const end   = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function num(v: string | number | undefined) {
  return parseFloat(String(v ?? 0)) || 0;
}

// Fetch integrated report — account or campaign level
async function report(params: Record<string, string | string[]>) {
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID ?? "";
  const qs = new URLSearchParams();
  qs.set("advertiser_id", advertiserId);
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, Array.isArray(v) ? JSON.stringify(v) : v);
  }
  qs.set("page_size", "1000");

  const res = await fetch(`${BASE}/report/integrated/get/?${qs}`, { headers: headers() });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message ?? `TikTok API error ${json.code}`);
  return (json.data?.list ?? []) as any[];
}

// Fetch campaign metadata (names, status, budget, objective)
async function getCampaigns() {
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID ?? "";
  const qs = new URLSearchParams({
    advertiser_id: advertiserId,
    fields: JSON.stringify(["campaign_id", "campaign_name", "status", "budget", "budget_mode", "objective_type"]),
    page_size: "100",
  });
  const res = await fetch(`${BASE}/campaign/get/?${qs}`, { headers: headers() });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message ?? `TikTok API error ${json.code}`);
  return (json.data?.list ?? []) as any[];
}

export async function getTikTokStats(days: number) {
  const { start, end } = dateRange(days);

  const ACCOUNT_METRICS = [
    "spend", "impressions", "clicks", "ctr", "cpc",
    "conversions", "cost_per_conversion", "conversion_rate",
    "real_time_conversion_value",
    "video_play_actions", "video_watched_2s", "video_watched_6s",
    "average_video_play", "reach", "frequency",
  ];

  const CAMPAIGN_METRICS = [
    "spend", "impressions", "clicks", "ctr", "cpc",
    "conversions", "cost_per_conversion",
    "real_time_conversion_value",
    "video_play_actions", "video_watched_2s",
    "average_video_play", "reach", "frequency",
  ];

  const [acctRows, campaignRows, dailyRows, campaigns] = await Promise.all([
    report({
      report_type: "BASIC",
      data_level: "AUCTION_ADVERTISER",
      dimensions: ["advertiser_id"],
      metrics: ACCOUNT_METRICS,
      start_date: start, end_date: end,
    }),
    report({
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: ["campaign_id"],
      metrics: CAMPAIGN_METRICS,
      start_date: start, end_date: end,
    }),
    report({
      report_type: "BASIC",
      data_level: "AUCTION_ADVERTISER",
      dimensions: ["stat_time_day"],
      metrics: ["spend", "impressions", "clicks", "conversions", "real_time_conversion_value"],
      start_date: start, end_date: end,
    }),
    getCampaigns(),
  ]);

  // Account totals
  const acct = acctRows[0]?.metrics ?? {};
  const account = {
    spend:              num(acct.spend),
    impressions:        num(acct.impressions),
    clicks:             num(acct.clicks),
    ctr:                num(acct.ctr),
    cpc:                num(acct.cpc),
    conversions:        num(acct.conversions),
    costPerConversion:  num(acct.cost_per_conversion),
    conversionRate:     num(acct.conversion_rate),
    conversionValue:    num(acct.real_time_conversion_value),
    videoPlays:         num(acct.video_play_actions),
    watched2s:          num(acct.video_watched_2s),
    watched6s:          num(acct.video_watched_6s),
    avgPlaySec:         num(acct.average_video_play),
    reach:              num(acct.reach),
    frequency:          num(acct.frequency),
    roas:               num(acct.spend) > 0 ? num(acct.real_time_conversion_value) / num(acct.spend) : 0,
  };

  // Campaign name/status map
  const metaMap = new Map(campaigns.map((c: any) => [String(c.campaign_id), c]));

  // Campaign rows
  const campaignList = campaignRows.map((row: any) => {
    const cid = String(row.dimensions?.campaign_id ?? "");
    const m   = row.metrics ?? {};
    const meta = metaMap.get(cid) ?? {};
    const spend = num(m.spend);
    const cv    = num(m.real_time_conversion_value);
    return {
      id:               cid,
      name:             meta.campaign_name ?? `Campaign ${cid}`,
      status:           meta.status ?? "UNKNOWN",
      objectiveType:    meta.objective_type ?? "",
      budget:           num(meta.budget),
      spend,
      impressions:      num(m.impressions),
      clicks:           num(m.clicks),
      ctr:              num(m.ctr),
      cpc:              num(m.cpc),
      conversions:      num(m.conversions),
      costPerConv:      num(m.cost_per_conversion),
      conversionValue:  cv,
      videoPlays:       num(m.video_play_actions),
      watched2s:        num(m.video_watched_2s),
      avgPlaySec:       num(m.average_video_play),
      reach:            num(m.reach),
      frequency:        num(m.frequency),
      roas:             spend > 0 ? cv / spend : 0,
    };
  }).sort((a: any, b: any) => b.spend - a.spend);

  // Daily chart data
  const daily = dailyRows
    .map((row: any) => ({
      date:        row.dimensions?.stat_time_day ?? "",
      spend:       num(row.metrics?.spend),
      impressions: num(row.metrics?.impressions),
      clicks:      num(row.metrics?.clicks),
      conversions: num(row.metrics?.conversions),
      revenue:     num(row.metrics?.real_time_conversion_value),
    }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  return { account, campaigns: campaignList, daily };
}
