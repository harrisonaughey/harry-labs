/**
 * Klaviyo Monthly Report Engine
 *
 * Pulls campaign + flow metrics for a given calendar month from Klaviyo,
 * generates rule-based recommendations, and builds the full HTML report.
 */

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const REVISION     = "2024-10-15";
const PLACED_ORDER = "SWryYh"; // Placed Order metric ID

// ─── Klaviyo helpers ─────────────────────────────────────────────────────────

function klaviyoHeaders() {
  return {
    Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`,
    revision:       REVISION,
    "Content-Type": "application/json",
    Accept:         "application/json",
  };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function kFetch(input: RequestInfo, init?: RequestInit, retries = 4): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(input, init);
    if (res.status === 429) {
      const wait = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s
      console.warn(`[klaviyo-report] 429 throttled — retrying in ${wait}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`Klaviyo ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error("Klaviyo rate limit exceeded after retries");
}

async function kGet(path: string) {
  return kFetch(`${KLAVIYO_BASE}${path}`, { headers: klaviyoHeaders() });
}

async function kPost(path: string, body: object) {
  return kFetch(`${KLAVIYO_BASE}${path}`, {
    method:  "POST",
    headers: klaviyoHeaders(),
    body:    JSON.stringify(body),
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampaignRow {
  id:        string;
  name:      string;
  delivered: number;
  opens:     number;
  clicks:    number;
  openRate:  number;
  clickRate: number;
  unsubs:    number;
  revenue:   number;
  rpr:       number;
}

export interface FlowRow {
  id:        string;
  name:      string;
  delivered: number;
  opens:     number;
  clicks:    number;
  openRate:  number;
  clickRate: number;
  unsubs:    number;
  revenue:   number;
  rpr:       number;
}

export interface MonthlyMetrics {
  reportMonth:       string;   // "2026-09"
  reportLabel:       string;   // "September 2026"
  campaigns:         CampaignRow[];
  flows:             FlowRow[];
  // Aggregates
  totalDelivered:    number;
  totalRevenue:      number;
  totalClicks:       number;
  totalOpens:        number;
  totalUnsubs:       number;
  avgOpenRate:       number;
  avgClickRate:      number;
  avgRPR:            number;
  // Previous month aggregates (for MoM)
  prevDelivered:     number;
  prevRevenue:       number;
  prevOpenRate:      number;
  prevClickRate:     number;
  prevUnsubs:        number;
  // List size
  listSize:          number;
}

export interface Recommendation {
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  title:    string;
  detail:   string;
  action:   string;
  impact:   string;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchCampaignMetrics(start: string, end: string): Promise<{rows: CampaignRow[], names: Record<string,string>}> {
  const [metricsResp, campaignsResp] = await Promise.all([
    kPost("/campaign-values-reports/", {
      data: {
        type: "campaign-values-report",
        attributes: {
          timeframe:             { start, end },
          conversion_metric_id:  PLACED_ORDER,
          statistics: ["delivered","opens_unique","clicks_unique","open_rate","click_rate","unsubscribes","conversion_value"],
        },
      },
    }),
    kGet("/campaigns/?filter=equals(messages.channel,'email')&sort=-created_at"),
  ]);

  const names: Record<string, string> = {};
  for (const c of metricsResp?.data ?? []) names[c.id] = c.attributes?.name ?? c.id;
  for (const c of campaignsResp?.data ?? []) names[c.id] = c.attributes?.name ?? c.id;

  const results: any[] = metricsResp?.data?.attributes?.results ?? [];
  const rows: CampaignRow[] = results.map((r: any) => {
    const cid  = r.campaign_id ?? r.groupings?.campaign_id ?? "?";
    const s    = r.statistics ?? r;
    const del  = Number(s.delivered ?? 0);
    const rev  = Number(s.conversion_value ?? 0);
    return {
      id:        cid,
      name:      names[cid] ?? cid,
      delivered: del,
      opens:     Number(s.opens_unique ?? 0),
      clicks:    Number(s.clicks_unique ?? 0),
      openRate:  Number(s.open_rate ?? 0),
      clickRate: Number(s.click_rate ?? 0),
      unsubs:    Number(s.unsubscribes ?? 0),
      revenue:   rev,
      rpr:       del > 0 ? rev / del : 0,
    };
  });

  return { rows, names };
}

async function fetchFlowMetrics(start: string, end: string): Promise<FlowRow[]> {
  const [metricsResp, flowsResp] = await Promise.all([
    kPost("/flow-values-reports/", {
      data: {
        type: "flow-values-report",
        attributes: {
          timeframe:            { start, end },
          conversion_metric_id: PLACED_ORDER,
          statistics: ["delivered","opens_unique","clicks_unique","open_rate","click_rate","unsubscribes","conversion_value"],
        },
      },
    }),
    kGet("/flows/?filter=equals(status,'live')&fields[flow]=name,status,trigger_type"),
  ]);

  const flowNames: Record<string, string> = {};
  for (const f of flowsResp?.data ?? []) flowNames[f.id] = f.attributes?.name ?? f.id;

  const results: any[] = metricsResp?.data?.attributes?.results ?? [];
  const agg: Record<string, FlowRow> = {};
  for (const r of results) {
    const fid = r.flow_id ?? r.groupings?.flow_id ?? "?";
    const s   = r.statistics ?? r;
    if (!agg[fid]) {
      agg[fid] = { id: fid, name: flowNames[fid] ?? fid, delivered: 0, opens: 0, clicks: 0, openRate: 0, clickRate: 0, unsubs: 0, revenue: 0, rpr: 0 };
    }
    const a = agg[fid];
    a.delivered += Number(s.delivered ?? 0);
    a.opens     += Number(s.opens_unique ?? 0);
    a.clicks    += Number(s.clicks_unique ?? 0);
    a.unsubs    += Number(s.unsubscribes ?? 0);
    a.revenue   += Number(s.conversion_value ?? 0);
  }
  // Compute rates after aggregation
  for (const f of Object.values(agg)) {
    f.openRate  = f.delivered > 0 ? f.opens  / f.delivered : 0;
    f.clickRate = f.delivered > 0 ? f.clicks / f.delivered : 0;
    f.rpr       = f.delivered > 0 ? f.revenue / f.delivered : 0;
  }

  return Object.values(agg).sort((a, b) => b.revenue - a.revenue);
}

async function fetchListSize(): Promise<number> {
  try {
    const resp = await kGet("/lists/");
    // Sum the profile count of the primary opted-in list (XhxTa9 = Email List)
    const primary = resp?.data?.find((l: any) => l.id === "XhxTa9");
    return Number(primary?.attributes?.profile_count ?? 0);
  } catch { return 0; }
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchMonthlyMetrics(year: number, month: number): Promise<MonthlyMetrics> {
  // month is 1-indexed (1 = January)
  const pad = (n: number) => String(n).padStart(2, "0");

  const start    = `${year}-${pad(month)}-01T00:00:00+00:00`;
  const endDate  = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1);
  const end      = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-01T00:00:00+00:00`;

  const prevM    = month === 1 ? 12 : month - 1;
  const prevY    = month === 1 ? year - 1 : year;
  const prevStart = `${prevY}-${pad(prevM)}-01T00:00:00+00:00`;
  const prevEnd   = start;

  const MONTH_LABELS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const reportLabel  = `${MONTH_LABELS[month - 1]} ${year}`;
  const reportMonth  = `${year}-${pad(month)}`;

  // Serialize the two reporting calls to avoid Klaviyo's per-second rate limit,
  // then fetch flows + list size in parallel (different endpoints, safe to batch).
  const current  = await fetchCampaignMetrics(start, end);
  await sleep(1200);
  const prevData = await fetchCampaignMetrics(prevStart, prevEnd);
  await sleep(1200);
  const [flows, listSize] = await Promise.all([
    fetchFlowMetrics(start, end),
    fetchListSize(),
  ]);

  const campaigns = current.rows.sort((a, b) => b.revenue - a.revenue);

  // Aggregates — current month
  const totalDelivered = campaigns.reduce((s, c) => s + c.delivered, 0);
  const totalRevenue   = campaigns.reduce((s, c) => s + c.revenue, 0)
                       + flows.reduce((s, f) => s + f.revenue, 0);
  const totalClicks    = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalOpens     = campaigns.reduce((s, c) => s + c.opens, 0);
  const totalUnsubs    = campaigns.reduce((s, c) => s + c.unsubs, 0)
                       + flows.reduce((s, f) => s + f.unsubs, 0);
  const avgOpenRate    = totalDelivered > 0 ? totalOpens / totalDelivered : 0;
  const avgClickRate   = totalDelivered > 0 ? totalClicks / totalDelivered : 0;
  const avgRPR         = totalDelivered > 0 ? totalRevenue / totalDelivered : 0;

  // Aggregates — previous month
  const prevDelivered  = prevData.rows.reduce((s, c) => s + c.delivered, 0);
  const prevRevenue    = prevData.rows.reduce((s, c) => s + c.revenue, 0);
  const prevClicks     = prevData.rows.reduce((s, c) => s + c.clicks, 0);
  const prevOpens      = prevData.rows.reduce((s, c) => s + c.opens, 0);
  const prevUnsubs     = prevData.rows.reduce((s, c) => s + c.unsubs, 0);
  const prevOpenRate   = prevDelivered > 0 ? prevOpens  / prevDelivered : 0;
  const prevClickRate  = prevDelivered > 0 ? prevClicks / prevDelivered : 0;

  return {
    reportMonth, reportLabel, campaigns, flows,
    totalDelivered, totalRevenue, totalClicks, totalOpens, totalUnsubs,
    avgOpenRate, avgClickRate, avgRPR,
    prevDelivered, prevRevenue, prevOpenRate, prevClickRate, prevUnsubs,
    listSize,
  };
}

// ─── Recommendation engine ────────────────────────────────────────────────────

export function generateRecommendations(m: MonthlyMetrics): Recommendation[] {
  const recs: Recommendation[] = [];

  // ── Click rate crisis ─────────────────────────────────────────────────────
  if (m.avgClickRate < 0.003) {
    recs.push({
      priority: "CRITICAL",
      category: "Campaigns",
      title:    `Click rate ${pct(m.avgClickRate)} — body is failing, not subject lines`,
      detail:   `${m.totalOpens.toLocaleString()} opens produced only ${m.totalClicks} clicks (${pct(m.avgClickRate)} CR). Benchmark is 1–2%. The email body design or CTA copy isn't converting curiosity into action.`,
      action:   "A/B test your next campaign as a text-only personal email. 50% designed / 50% text. Measure click rate as the primary metric. Also audit all CTA button copy — replace 'Shop Now' with offer-specific copy ('Save 20% Before Midnight').`",
      impact:   "3–5× click rate improvement if text format wins",
    });
  } else if (m.avgClickRate < 0.008) {
    recs.push({
      priority: "HIGH",
      category: "Campaigns",
      title:    `Click rate ${pct(m.avgClickRate)} — below 1% benchmark`,
      detail:   "Click-to-open ratio is below 5%. Offer clarity and CTA specificity need improvement.",
      action:   "Ensure every campaign CTA button copy names the specific offer. Add a second CTA button at the bottom of each email. Test subject line + CTA combinations.",
      impact:   "Target: 1%+ click rate",
    });
  }

  // ── Zero-revenue campaigns ────────────────────────────────────────────────
  const zeroRev = m.campaigns.filter(c => c.revenue === 0 && c.delivered > 800);
  if (zeroRev.length >= 2) {
    recs.push({
      priority: "HIGH",
      category: "Campaigns",
      title:    `${zeroRev.length} campaigns sent with $0 revenue`,
      detail:   `${zeroRev.map(c => c.name).join(", ")} — all generated $0 despite reasonable open rates. Campaigns without a specific offer + deadline consistently fail to convert.`,
      action:   "Before scheduling any campaign: confirm it has a specific $ or % discount, a hard deadline (day + time + AEST), and offer-specific CTA button copy. If it has none of these, don't send it.",
      impact:   "Prevents list erosion from non-converting sends",
    });
  }

  // ── Unsubscribe spike ─────────────────────────────────────────────────────
  const avgUnsubRate = m.totalDelivered > 0 ? m.totalUnsubs / m.totalDelivered : 0;
  if (avgUnsubRate > 0.008) {
    recs.push({
      priority: "CRITICAL",
      category: "List Health",
      title:    `Unsubscribe rate ${pct(avgUnsubRate)} — above the 0.2% danger threshold`,
      detail:   `${m.totalUnsubs} unsubscribes from ${m.totalDelivered.toLocaleString()} sends. Sustained rates above 0.5% signal that emails feel irrelevant or over-frequent to recipients.`,
      action:   "Audit campaigns for offer specificity. Reduce send frequency for disengaged segments. Add a 60-day re-engagement filter to prevent sending to cold profiles.",
      impact:   "Protecting the list is protecting future revenue",
    });
  } else if (avgUnsubRate > 0.003) {
    recs.push({
      priority: "MEDIUM",
      category: "List Health",
      title:    `Unsubscribe rate ${pct(avgUnsubRate)} — worth watching`,
      detail:   `${m.totalUnsubs} unsubscribes this month. Benchmark is under 0.2%.`,
      action:   "Monitor the next 2 sends closely. If the rate holds above 0.3%, segment the list and suppress profiles inactive for 120+ days.",
      impact:   "Early intervention prevents irreversible list damage",
    });
  }

  // ── MoM revenue drop ──────────────────────────────────────────────────────
  if (m.prevRevenue > 0) {
    const revChange = (m.totalRevenue - m.prevRevenue) / m.prevRevenue;
    if (revChange < -0.3) {
      recs.push({
        priority: "HIGH",
        category: "Revenue",
        title:    `Revenue down ${Math.abs(Math.round(revChange * 100))}% vs last month`,
        detail:   `$${m.totalRevenue.toFixed(2)} this month vs $${m.prevRevenue.toFixed(2)} last month. A revenue drop of this size usually indicates fewer urgency-frame campaigns or a missing sale period.`,
        action:   "Review the campaign calendar. At minimum, schedule one urgency-frame campaign this month: an 'ending tonight' or 'last 48 hours' style push. These consistently outperform launch-style emails 3–5×.",
        impact:   `Recover ~$${Math.round(m.prevRevenue - m.totalRevenue)} in email-attributed revenue`,
      });
    }
  }

  // ── Abandoned checkout volume ─────────────────────────────────────────────
  const abandFlow = m.flows.find(f => /abandon.*check|check.*abandon/i.test(f.name));
  if (abandFlow) {
    if (abandFlow.delivered < 50) {
      recs.push({
        priority: "CRITICAL",
        category: "Flows",
        title:    `Abandoned Checkout flow: only ${abandFlow.delivered} emails sent — trigger is blocked`,
        detail:   `With an RPR of $${abandFlow.rpr.toFixed(3)}, this is your highest-value automated sequence. But ${abandFlow.delivered} sends in a month is near-zero for a Shopify store at your sales volume. A trigger filter is blocking most entries.`,
        action:   "Klaviyo → Flows → Abandoned Checkout → Check trigger conditions. Remove any 'has never placed order' filter or overly narrow time window. Verify the Shopify abandoned_checkout metric fires correctly in Live Feed.",
        impact:   `At 150 monthly sends: ~$${Math.round(150 * abandFlow.rpr)}/month from this flow alone`,
      });
    } else if (abandFlow.delivered < 100) {
      recs.push({
        priority: "HIGH",
        category: "Flows",
        title:    `Abandoned Checkout volume low (${abandFlow.delivered} sends) — room to scale`,
        detail:   `Flow is working at ${pct(abandFlow.clickRate)} CR and $${abandFlow.rpr.toFixed(3)} RPR. Volume should be higher relative to your store's cart activity.`,
        action:   "Check Shopify → Analytics → Behaviour for cart abandonment rate. Loosen flow trigger or qualification window to capture more events.",
        impact:   `Doubling volume = ~$${Math.round(abandFlow.delivered * abandFlow.rpr * 2)}/month`,
      });
    }
  } else {
    recs.push({
      priority: "CRITICAL",
      category: "Flows",
      title:    "Abandoned Checkout flow has no data — verify it is live",
      detail:   "No abandoned checkout metrics recorded this month. The flow may be paused or the Shopify trigger may not be firing.",
      action:   "Klaviyo → Flows → Abandoned Checkout → Confirm status is Live. Test with a real cart abandonment.",
      impact:   "Abandoned cart flows typically generate $200–600/month for stores at your volume",
    });
  }

  // ── Browse abandonment revenue gap ───────────────────────────────────────
  const browseFlow = m.flows.find(f => /browse.*aband|aband.*browse/i.test(f.name));
  if (browseFlow && browseFlow.clicks > 0 && browseFlow.revenue === 0) {
    recs.push({
      priority: "HIGH",
      category: "Flows",
      title:    `Browse Abandonment: ${pct(browseFlow.clickRate)} CR but $0 revenue — tracking gap`,
      detail:   `People are clicking (${browseFlow.clicks} clicks) but no orders are attributed. UTM tracking is likely broken or attribution window is too short.`,
      action:   "Check the flow's UTM parameters on the CTA link. Set Klaviyo attribution window to 7 days. Cross-reference clicks vs sessions in Shopify Analytics for the same dates.",
      impact:   "Likely already generating revenue — just not tracked",
    });
  }

  // ── Order confirmation upsell ─────────────────────────────────────────────
  const confirmFlow = m.flows.find(f => /order.*confirm|confirm.*order|upsell/i.test(f.name));
  if (confirmFlow && confirmFlow.delivered > 50 && confirmFlow.revenue === 0) {
    recs.push({
      priority: "MEDIUM",
      category: "Flows",
      title:    `Order Confirmation upsell (${pct(confirmFlow.openRate)} OR) is not converting`,
      detail:   `${confirmFlow.delivered} sends at ${pct(confirmFlow.openRate)} open rate — the most-read email you send. But the upsell offer isn't generating orders.`,
      action:   "Replace generic upsell copy with a 'buy for a friend' angle: 'Know someone who'd love this? Gift them one for $5 off — use GIFT5 at checkout. Valid 48 hours.' Include a countdown urgency element.",
      impact:   `${Math.round(confirmFlow.delivered * 0.02)} extra orders/month at 2% conversion`,
    });
  }

  // ── Welcome series ────────────────────────────────────────────────────────
  const welcomeFlow = m.flows.find(f => /welcome/i.test(f.name));
  if (!welcomeFlow || welcomeFlow.delivered < 10) {
    recs.push({
      priority: "HIGH",
      category: "Flows",
      title:    "Welcome Series needs activation — new subscribers get no first purchase offer",
      detail:   "Welcome emails are the highest-converting automated sequence in ecommerce. New subscribers are at peak interest when they join.",
      action:   "Activate Welcome Series in Klaviyo. Email 1 must go out within 10 minutes of sign-up with a discount code (10% off, 48-hour expiry). Add Email 2 at Day 3 with social proof. Email 3 at Day 7 with a final urgency push.",
      impact:   "3–5% of new subscribers convert to first-time buyers within 7 days",
    });
  }

  // ── Affordability (Afterpay) messaging ───────────────────────────────────
  if (m.avgClickRate < 0.005) {
    recs.push({
      priority: "MEDIUM",
      category: "Conversion",
      title:    "Add Afterpay split-pay messaging to all sale campaign CTAs",
      detail:   "At $49.95, framing purchases as '4 payments of $12.49 — no interest' reduces perceived price friction and can lift conversion rate by 15–25% for a single-SKU product.",
      action:   "Add 'Split it 4 ways with Afterpay — from $12.49/fortnight' as a sub-headline below every CTA button. Include the Afterpay logo where possible. Test on next urgency campaign.",
      impact:   "Lowers perceived price barrier; lifts conversion on fence-sitters",
    });
  }

  // ── Send frequency ────────────────────────────────────────────────────────
  const sendsPerWeek = m.campaigns.length / 4.3;
  if (sendsPerWeek > 3) {
    recs.push({
      priority: "MEDIUM",
      category: "List Health",
      title:    `Send frequency high (${m.campaigns.length} campaigns this month — ${sendsPerWeek.toFixed(1)}/week)`,
      detail:   "Over-sending to the full list without segmentation accelerates unsubscribes and trains subscribers to ignore emails.",
      action:   "Cap full-list sends at 2/week maximum. Use Klaviyo segments for extra sends — 'Engaged 90 Days' segment can receive more frequent contact without damaging the broader list.",
      impact:   "Reduces unsubscribe rate and improves per-email engagement",
    });
  }

  return recs.sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return order[a.priority] - order[b.priority];
  });
}

// ─── Seasonal content calendar ───────────────────────────────────────────────

export function getSeasonalCalendar(year: number, month: number): { event: string; date: string; type: string; ideas: string[] }[] {
  const CALENDAR: Record<number, { event: string; date: string; type: string; ideas: string[] }[]> = {
    1: [
      { event: "New Year", date: "Jan 1", type: "Sale", ideas: ["New Year, New Game Night — kick off with 15% off", "Fresh start for families — our most-played card game"] },
      { event: "Australia Day", date: "Jan 26", type: "Sale", ideas: ["Aussie families play Thinkle — long weekend sale", "The game made for backyard BBQ conversations"] },
    ],
    2: [
      { event: "Valentine's Day", date: "Feb 14", type: "Gift Guide", ideas: ["The gift that gets everyone off their phones — for couples and families", "A Valentine's pick that lasts longer than flowers"] },
      { event: "Afterpay Day", date: "Late Feb", type: "Sale", ideas: ["Afterpay Day — split Thinkle into 4 payments from $12.49", "Game night from $12.49/fortnight — Afterpay Day sale"] },
    ],
    3: [
      { event: "Summer End Sale", date: "Mar", type: "Sale", ideas: ["Last chance summer clearance — 20% off before autumn", "Autumn is game night season — start with 15% off"] },
      { event: "Harmony Week", date: "Mar 21", type: "Brand", ideas: ["Games that bring families together — Harmony Week"] },
    ],
    4: [
      { event: "Easter", date: "Apr 18–21", type: "Sale", ideas: ["Easter long weekend — the game everyone plays at the family table", "4-day weekend sale — Easter deal ends Monday midnight AEST"] },
      { event: "ANZAC Day", date: "Apr 25", type: "Brand", ideas: ["A quiet moment of connection — ANZAC Day reflection + family game night"] },
    ],
    5: [
      { event: "Mother's Day", date: "May 11", type: "Gift Guide", ideas: ["Mum will love this more than a gift card", "The Mother's Day gift that brings the family to the table — ends Sunday midnight AEST", "Last chance: Mother's Day delivery cut-off is today"] },
    ],
    6: [
      { event: "EOFY Sale", date: "Jun 30", type: "Sale", ideas: ["EOFY Sale — last chance for $10 off before midnight June 30", "24 hours left: EOFY sale ends tonight at midnight AEST", "3 days to go — EOFY offer ends June 30"] },
    ],
    7: [
      { event: "School Holidays", date: "Jul", type: "Content", ideas: ["School holidays are back — here's how to survive two weeks without screens", "The game our customers play every day of school holidays"] },
      { event: "Afterpay Day", date: "Late Jul", type: "Sale", ideas: ["Afterpay Day final hours — ends midnight AEST tonight", "Afterpay Day is live — split into 4 from $12.49"] },
    ],
    8: [
      { event: "Father's Day", date: "Sep 7 (first Sun of Sep)", type: "Gift Guide", ideas: ["Dad deserves something better than a gift card", "Father's Day gift guide — the game he'll actually want to play", "Father's Day: last chance for express delivery"] },
      { event: "End of Holidays", date: "Late Aug", type: "Content", ideas: ["Back to school = back to game night — 15% off this week only"] },
    ],
    9: [
      { event: "Father's Day", date: "Sep 7", type: "Gift Guide", ideas: ["Still need a Father's Day gift? We've got you — last 48 hours", "Father's Day sale ends Sunday midnight AEST"] },
      { event: "Spring Equinox", date: "Sep 22", type: "Content", ideas: ["Spring is game night weather — 15% off this week only", "Longer evenings = more game nights — spring sale"] },
    ],
    10: [
      { event: "Halloween", date: "Oct 31", type: "Sale", ideas: ["Trick or Treat yourself — 15% off this Halloween weekend 🎃", "Last chance to claim your Halloween deal — ends midnight AEST"] },
      { event: "Early Christmas", date: "Oct", type: "Gift Guide", ideas: ["Getting in early for Christmas? Here's the gift that always lands"] },
    ],
    11: [
      { event: "Black Friday", date: "Nov 28", type: "Sale", ideas: ["Black Friday: 25% off — ends midnight AEST Sunday", "Our biggest discount of the year — Black Friday ends tonight", "Cyber Monday is your last chance — 25% off Thinkle"] },
      { event: "Christmas Gift Guide", date: "Nov", type: "Gift Guide", ideas: ["The Christmas gift guide for families who have everything", "Order by Dec 18 for pre-Christmas delivery — here's what to get"] },
    ],
    12: [
      { event: "Christmas", date: "Dec 25", type: "Sale", ideas: ["Last chance for Christmas delivery — order today", "Merry Christmas from Thinkle — here's a Boxing Day preview", "Boxing Day Sale — 25% off starts now"] },
      { event: "Boxing Day", date: "Dec 26", type: "Sale", ideas: ["Boxing Day Sale is LIVE — 25% off ends midnight Sunday", "Post-Christmas gaming — treat yourself or someone you love"] },
    ],
  };

  return CALENDAR[month] ?? [];
}

// ─── HTML report builder ─────────────────────────────────────────────────────

function pct(rate: number, decimals = 2): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-AU");
}

function fmtRev(n: number): string {
  return `$${n.toFixed(2)}`;
}

function arrow(current: number, prev: number): string {
  if (prev === 0) return "";
  const change = (current - prev) / prev;
  if (Math.abs(change) < 0.03) return `<span style="color:#9896A0">≈ flat</span>`;
  const pctStr = `${Math.abs(change * 100).toFixed(0)}%`;
  return change > 0
    ? `<span style="color:#16A34A">↑ ${pctStr}</span>`
    : `<span style="color:#DC2626">↓ ${pctStr}</span>`;
}

function priBadge(p: Recommendation["priority"]): string {
  const map = { CRITICAL: "#DC2626", HIGH: "#B45309", MEDIUM: "#6366F1", LOW: "#9896A0" };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;background:${map[p]}22;color:${map[p]};font-family:'IBM Plex Mono',monospace">${p}</span>`;
}

export function buildReportHtml(m: MonthlyMetrics, recs: Recommendation[], seasonal: { event: string; date: string; type: string; ideas: string[] }[]): string {
  const zeroRevCount    = m.campaigns.filter(c => c.revenue === 0).length;
  const topCampaigns    = m.campaigns.slice(0, 5);
  const campaignRevenue = m.campaigns.reduce((s, c) => s + c.revenue, 0);
  const flowRevenue     = m.flows.reduce((s, f) => s + f.revenue, 0);

  const nextMonth = m.reportMonth.split("-");
  const nextMonthLabel = new Date(Number(nextMonth[0]), Number(nextMonth[1]), 1)
    .toLocaleString("en-AU", { month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thinkle Email Report — ${m.reportLabel}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0}
  body{font-family:'IBM Plex Sans',system-ui,sans-serif;background:#F5F4F2;color:#0E0E12;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .wrap{max-width:900px;margin:0 auto;padding:0 24px 80px}
  .header{background:#6366F1;padding:36px 24px 32px}
  .header .inner{max-width:900px;margin:0 auto}
  .eyebrow{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:10px}
  h1{font-family:'Fraunces',Georgia,serif;font-size:clamp(26px,5vw,42px);font-weight:700;line-height:1.1;color:#fff;margin-bottom:8px}
  h1 em{font-style:italic;font-weight:300;opacity:.85}
  .meta{font-size:13px;color:rgba(255,255,255,.6);margin-top:16px;display:flex;gap:24px;flex-wrap:wrap}
  .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.4);margin-right:6px;vertical-align:middle}
  .kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#E2E0DC;border:1px solid #E2E0DC;border-radius:10px;overflow:hidden;margin-top:28px;box-shadow:0 1px 3px rgba(14,14,18,.06),0 4px 16px rgba(14,14,18,.04)}
  @media(min-width:600px){.kpi-grid{grid-template-columns:repeat(4,1fr)}}
  .kpi{background:#fff;padding:22px 20px}
  .kpi-label{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#9896A0;margin-bottom:8px}
  .kpi-value{font-family:'Fraunces',Georgia,serif;font-size:clamp(24px,3.5vw,34px);font-weight:600;line-height:1;font-variant-numeric:tabular-nums;margin-bottom:4px}
  .kpi-change{font-size:12px;color:#9896A0}
  .section-title{font-family:'Fraunces',Georgia,serif;font-size:21px;font-weight:600;margin:44px 0 4px;display:flex;align-items:baseline;gap:12px}
  .section-count{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:400;color:#9896A0}
  .section-desc{font-size:13px;color:#5A5864;margin-bottom:18px;max-width:64ch}
  .table-wrap{overflow-x:auto;border-radius:10px;border:1px solid #E2E0DC;box-shadow:0 1px 3px rgba(14,14,18,.06),0 4px 16px rgba(14,14,18,.04);background:#fff}
  table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
  thead tr{border-bottom:1px solid #E2E0DC}
  th{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9896A0;padding:12px 16px;text-align:left;white-space:nowrap;background:#F0EFF0}
  th:not(:first-child){text-align:right}
  td{padding:12px 16px;font-size:13px;color:#5A5864;border-bottom:1px solid #E2E0DC;vertical-align:middle}
  td:not(:first-child){text-align:right;font-family:'IBM Plex Mono',monospace}
  tbody tr:last-child td{border-bottom:none}
  .td-name{font-family:'IBM Plex Sans',sans-serif;font-weight:500;color:#0E0E12;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rev-pos{color:#16A34A;font-weight:600}
  .rev-zero{color:#9896A0}
  .row-top{background:#f0fdf4}
  .row-warn{background:#fffbeb}
  .flag-red{color:#DC2626;font-weight:600}
  .flag-amber{color:#B45309}
  .crisis{background:#FEF2F2;border-left:3px solid #DC2626;border-radius:0 8px 8px 0;padding:22px 26px;margin-top:32px}
  .crisis h3{font-family:'Fraunces',Georgia,serif;font-size:19px;font-weight:600;color:#DC2626;margin-bottom:8px}
  .crisis p{font-size:13.5px;color:#5A5864;max-width:66ch;line-height:1.65}
  .ok-block{background:#F0FDF4;border-left:3px solid #16A34A;border-radius:0 8px 8px 0;padding:18px 24px;margin-top:16px}
  .ok-block p{font-size:13.5px;color:#5A5864}
  .flow-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-top:6px}
  .flow-card{background:#fff;border:1px solid #E2E0DC;border-radius:10px;padding:18px;box-shadow:0 1px 3px rgba(14,14,18,.06),0 4px 16px rgba(14,14,18,.04);position:relative;overflow:hidden}
  .flow-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:#E2E0DC}
  .flow-best::before{background:#16A34A}.flow-gap::before{background:#B45309}.flow-miss::before{background:#DC2626}.flow-ok::before{background:#6366F1}
  .flow-name{font-weight:600;font-size:13px;margin-bottom:2px}
  .flow-trigger{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#9896A0;margin-bottom:14px}
  .flow-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .fs-label{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#9896A0;margin-bottom:2px}
  .fs-value{font-family:'Fraunces',Georgia,serif;font-size:21px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
  .fs-green{color:#16A34A}.fs-red{color:#DC2626}.fs-amber{color:#B45309}
  .flow-note{margin-top:12px;padding-top:12px;border-top:1px solid #E2E0DC;font-size:12px;color:#5A5864;line-height:1.5}
  .rec-list{display:flex;flex-direction:column;gap:14px;margin-top:6px}
  .rec{background:#fff;border:1px solid #E2E0DC;border-radius:10px;padding:18px 22px;display:grid;grid-template-columns:36px 1fr;gap:0 14px;box-shadow:0 1px 3px rgba(14,14,18,.06),0 4px 16px rgba(14,14,18,.04)}
  .rec-num{font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:700;line-height:1;color:#6366F1;opacity:.3}
  .rec-pri{margin-bottom:4px}
  .rec-title{font-family:'Fraunces',Georgia,serif;font-size:16px;font-weight:600;line-height:1.3;margin-bottom:6px}
  .rec-detail{font-size:13px;color:#5A5864;line-height:1.65;max-width:62ch;margin-bottom:8px}
  .rec-action-block{background:#EEF0FE;border-radius:6px;padding:10px 14px;font-size:12.5px;color:#4447C4;line-height:1.55;margin-bottom:6px}
  .rec-impact{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#16A34A;font-weight:600}
  .seasonal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:6px}
  .seasonal-card{background:#fff;border:1px solid #E2E0DC;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(14,14,18,.06)}
  .seasonal-event{font-weight:600;font-size:13px;margin-bottom:2px}
  .seasonal-date{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#9896A0;margin-bottom:10px}
  .seasonal-type{display:inline-block;padding:2px 8px;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;background:#EEF0FE;color:#4447C4;margin-bottom:8px}
  .seasonal-idea{font-size:12px;color:#5A5864;line-height:1.5;padding:4px 0;border-top:1px solid #E2E0DC}
  .summary-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1px;background:#E2E0DC;border:1px solid #E2E0DC;border-radius:10px;overflow:hidden;margin-top:44px}
  .summary-cell{background:#F0EFF0;padding:16px 18px}
  .s-label{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#9896A0;margin-bottom:4px}
  .s-val{font-family:'Fraunces',Georgia,serif;font-size:19px;font-weight:600;font-variant-numeric:tabular-nums}
  .footnote{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#9896A0;margin-top:28px;letter-spacing:.03em}
  hr{border:none;border-top:1px solid #E2E0DC;margin:40px 0 0}
</style>
</head>
<body>

<div class="header">
  <div class="inner">
    <div class="eyebrow">Monthly Email Report</div>
    <h1>Thinkle <em>·</em> ${m.reportLabel}</h1>
    <div class="meta">
      <span><span class="dot"></span>${m.campaigns.length} campaigns sent</span>
      <span><span class="dot"></span>${fmt(m.totalDelivered)} delivered</span>
      <span><span class="dot"></span>${m.flows.length} active flows</span>
      <span><span class="dot"></span>List: ${fmt(m.listSize)} subscribers</span>
    </div>
  </div>
</div>

<div class="wrap">

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Open Rate</div>
      <div class="kpi-value" style="color:${m.avgOpenRate > 0.2 ? '#16A34A' : '#B45309'}">${pct(m.avgOpenRate, 1)}</div>
      <div class="kpi-change">${arrow(m.avgOpenRate, m.prevOpenRate)} vs last month</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Click Rate</div>
      <div class="kpi-value" style="color:${m.avgClickRate > 0.01 ? '#16A34A' : m.avgClickRate > 0.005 ? '#B45309' : '#DC2626'}">${pct(m.avgClickRate)}</div>
      <div class="kpi-change">${arrow(m.avgClickRate, m.prevClickRate)} vs last month</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total Revenue</div>
      <div class="kpi-value">${fmtRev(m.totalRevenue)}</div>
      <div class="kpi-change">${arrow(m.totalRevenue, m.prevRevenue)} vs last month</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Unsubscribes</div>
      <div class="kpi-value" style="color:${m.totalUnsubs > 100 ? '#DC2626' : m.totalUnsubs > 50 ? '#B45309' : '#0E0E12'}">${m.totalUnsubs}</div>
      <div class="kpi-change">${arrow(m.prevUnsubs, m.totalUnsubs)} vs last month</div>
    </div>
  </div>

  ${m.avgOpenRate >= 0.2 ? `
  <div class="ok-block">
    <p><strong>Open rates are healthy at ${pct(m.avgOpenRate, 1)}</strong> — subject lines are working. The opportunity is converting those opens into clicks and revenue.</p>
  </div>` : `
  <div class="crisis">
    <h3>Open rate below benchmark — subject lines need attention</h3>
    <p>Open rate ${pct(m.avgOpenRate, 1)} is below the 20% ecommerce benchmark. Focus on shorter subject lines (under 45 chars), urgency framing ("Ending tonight / Last 48 hours"), and avoid vague benefit language.</p>
  </div>`}

  ${m.avgClickRate < 0.005 ? `
  <div class="crisis">
    <h3>Click rate ${pct(m.avgClickRate)} — the body is not converting opens to clicks</h3>
    <p>${fmt(m.totalOpens)} opens produced only ${m.totalClicks} clicks. At a 1% benchmark that should be ~${fmt(Math.round(m.totalDelivered * 0.01))} clicks. Test text-only format and ensure every CTA button has offer-specific copy, not "Shop Now".</p>
  </div>` : ""}

  <h2 class="section-title">Campaign Performance <span class="section-count">${m.campaigns.length} sent</span></h2>
  <p class="section-desc">Sorted by revenue. ${zeroRevCount > 0 ? `${zeroRevCount} of ${m.campaigns.length} campaigns generated $0.` : "All campaigns generated revenue this month."}</p>

  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Campaign</th>
        <th>Delivered</th>
        <th>Open Rate</th>
        <th>Click Rate</th>
        <th>Unsubs</th>
        <th>Revenue</th>
      </tr></thead>
      <tbody>
        ${m.campaigns.map((c, i) => `
        <tr class="${i < 3 && c.revenue > 0 ? 'row-top' : c.unsubs > 20 && c.revenue === 0 ? 'row-warn' : ''}">
          <td class="td-name">${c.name}</td>
          <td>${fmt(c.delivered)}</td>
          <td>${pct(c.openRate, 1)}</td>
          <td class="${c.clickRate < 0.001 ? 'flag-red' : c.clickRate < 0.005 ? 'flag-amber' : ''}">${pct(c.clickRate)}</td>
          <td class="${c.unsubs > 20 ? 'flag-red' : c.unsubs > 12 ? 'flag-amber' : ''}">${c.unsubs}</td>
          <td class="${c.revenue > 0 ? 'rev-pos' : 'rev-zero'}">${fmtRev(c.revenue)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>

  <h2 class="section-title">Automated Flows <span class="section-count">${m.flows.length} active</span></h2>
  <p class="section-desc">Flows run every day and compound over time — this is where consistent monthly revenue comes from.</p>

  <div class="flow-grid">
    ${m.flows.map(f => {
      let cls = "flow-ok";
      if (f.revenue > 0 && f.rpr > 0.5) cls = "flow-best";
      else if (f.delivered > 30 && f.revenue === 0 && f.clicks > 0) cls = "flow-gap";
      else if (f.delivered < 20) cls = "flow-miss";
      return `
    <div class="flow-card ${cls}">
      <div class="flow-name">${f.name}</div>
      <div class="flow-trigger">Automated</div>
      <div class="flow-stats">
        <div><div class="fs-label">Delivered</div><div class="fs-value ${f.delivered < 30 ? 'fs-red' : ''}">${fmt(f.delivered)}</div></div>
        <div><div class="fs-label">Revenue</div><div class="fs-value ${f.revenue > 0 ? 'fs-green' : 'fs-amber'}">${fmtRev(f.revenue)}</div></div>
        <div><div class="fs-label">Open Rate</div><div class="fs-value">${pct(f.openRate, 1)}</div></div>
        <div><div class="fs-label">Click Rate</div><div class="fs-value ${f.clickRate > 0.02 ? 'fs-green' : f.clickRate > 0.01 ? '' : 'fs-amber'}">${pct(f.clickRate)}</div></div>
      </div>
      ${f.rpr > 0 ? `<div class="flow-note"><strong>RPR $${f.rpr.toFixed(3)}</strong> · ${fmt(f.delivered)} sends · ${f.clicks} clicks</div>` : `<div class="flow-note">${f.clicks > 0 ? `${f.clicks} clicks but no attributed revenue — check UTM tracking.` : `Low click volume — review email body and CTA copy.`}</div>`}
    </div>`;
    }).join("")}
    ${m.flows.length === 0 ? `<div class="flow-card flow-miss"><div class="flow-name">No active flows</div><div class="flow-note">No flow data recorded this month. Ensure Welcome Series, Abandoned Checkout, and Browse Abandonment are live in Klaviyo.</div></div>` : ""}
  </div>

  <h2 class="section-title">Priority Actions</h2>
  <p class="section-desc">Generated from this month's data. Ranked by revenue impact.</p>

  <div class="rec-list">
    ${recs.map((r, i) => `
    <div class="rec">
      <div class="rec-num">${i + 1}</div>
      <div>
        <div class="rec-pri">${priBadge(r.priority)} <span style="font-size:11px;color:#9896A0;margin-left:6px;font-family:'IBM Plex Mono',monospace;letter-spacing:.04em">${r.category}</span></div>
        <div class="rec-title">${r.title}</div>
        <div class="rec-detail">${r.detail}</div>
        <div class="rec-action-block">→ ${r.action}</div>
        <div class="rec-impact">↑ ${r.impact}</div>
      </div>
    </div>`).join("")}
    ${recs.length === 0 ? `<div class="rec"><div class="rec-num">✓</div><div><div class="rec-title">Strong month — no critical issues detected</div><div class="rec-detail">All key metrics are within acceptable ranges. Keep the current cadence and continue testing new formats.</div></div></div>` : ""}
  </div>

  ${seasonal.length > 0 ? `
  <h2 class="section-title">Campaign Ideas for ${nextMonthLabel}</h2>
  <p class="section-desc">Australian ecommerce calendar + Thinkle-specific angles. Use these as brief seeds for your next campaigns.</p>

  <div class="seasonal-grid">
    ${seasonal.map(s => `
    <div class="seasonal-card">
      <div class="seasonal-event">${s.event}</div>
      <div class="seasonal-date">${s.date}</div>
      <div class="seasonal-type">${s.type}</div>
      ${s.ideas.map(idea => `<div class="seasonal-idea">${idea}</div>`).join("")}
    </div>`).join("")}
  </div>` : ""}

  <hr>

  <div class="summary-row">
    <div class="summary-cell"><div class="s-label">Campaign Revenue</div><div class="s-val">${fmtRev(campaignRevenue)}</div></div>
    <div class="summary-cell"><div class="s-label">Flow Revenue</div><div class="s-val">${fmtRev(flowRevenue)}</div></div>
    <div class="summary-cell"><div class="s-label">Combined</div><div class="s-val" style="color:#6366F1">${fmtRev(m.totalRevenue)}</div></div>
    <div class="summary-cell"><div class="s-label">Avg RPR</div><div class="s-val">$${m.avgRPR.toFixed(4)}</div></div>
    <div class="summary-cell"><div class="s-label">List Size</div><div class="s-val">${fmt(m.listSize)}</div></div>
  </div>

  <p class="footnote">Generated ${new Date().toLocaleDateString("en-AU", { day:"numeric", month:"long", year:"numeric" })} · Klaviyo API · Conversion metric: Placed Order · ${m.reportLabel} only</p>

</div>
</body>
</html>`;
}
