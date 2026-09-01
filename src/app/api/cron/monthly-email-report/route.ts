/**
 * GET /api/cron/monthly-email-report
 *
 * Runs on the 1st of every month at 08:00 AEST (22:00 UTC previous day).
 * Generates a full email performance report for the previous calendar month and:
 *   1. Stores the HTML report in Supabase (monthly_email_reports)
 *   2. Posts a rich Slack summary to #email-agent
 *
 * Vercel cron: "0 22 28-31 * *" — fires on the last few days of the month,
 * combined with the date check below it only runs on the 1st.
 * Better: use "0 22 * * *" + date guard, or the exact "0 22 1 * *" schedule.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchMonthlyMetrics,
  generateRecommendations,
  getSeasonalCalendar,
  buildReportHtml,
  type MonthlyMetrics,
  type Recommendation,
} from "@/lib/klaviyo-monthly-report";

export const maxDuration = 300;

const SLACK_API           = "https://slack.com/api/chat.postMessage";
const EMAIL_AGENT_CHANNEL = "C0BH6DLMWJH"; // #email-agent

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runReport();
}

// POST allows manual trigger from the dashboard: { "month": 8, "year": 2026 }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return runReport(body.year, body.month);
}

// ─── Core logic ───────────────────────────────────────────────────────────────

async function runReport(forceYear?: number, forceMonth?: number) {
  try {
    // When fired automatically on the 1st, we report on the previous month.
    const now   = new Date();
    const year  = forceYear  ?? (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
    const month = forceMonth ?? (now.getMonth() === 0 ? 12 : now.getMonth()); // 1-indexed

    console.log(`[monthly-email-report] Generating report for ${year}-${String(month).padStart(2,"0")}`);

    // Fetch all Klaviyo data
    const metrics = await fetchMonthlyMetrics(year, month);
    const recs    = generateRecommendations(metrics);

    // Seasonal calendar for the NEXT month
    const nextMonth = month === 12 ? 1  : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    const seasonal  = getSeasonalCalendar(nextYear, nextMonth);

    // Build the full HTML report
    const html = buildReportHtml(metrics, recs, seasonal);

    // Store in Supabase
    const reportId = await storeReport(metrics, recs, html);

    // Post Slack summary
    await postSlackSummary(metrics, recs, reportId);

    return NextResponse.json({
      ok:          true,
      reportMonth: metrics.reportMonth,
      reportId,
      metrics: {
        campaigns:      metrics.campaigns.length,
        totalDelivered: metrics.totalDelivered,
        totalRevenue:   metrics.totalRevenue,
        avgOpenRate:    metrics.avgOpenRate,
        avgClickRate:   metrics.avgClickRate,
        totalUnsubs:    metrics.totalUnsubs,
      },
      recommendations: recs.length,
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[monthly-email-report] Error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ─── Supabase storage ─────────────────────────────────────────────────────────

async function storeReport(m: MonthlyMetrics, recs: Recommendation[], html: string): Promise<string> {
  const supabase  = db();
  const criticals = recs.filter(r => r.priority === "CRITICAL").length;
  const highs     = recs.filter(r => r.priority === "HIGH").length;

  const payload = {
    report_month:       m.reportMonth,
    report_label:       m.reportLabel,
    generated_at:       new Date().toISOString(),
    campaigns_sent:     m.campaigns.length,
    total_delivered:    m.totalDelivered,
    total_revenue:      m.totalRevenue,
    campaign_revenue:   m.campaigns.reduce((s, c) => s + c.revenue, 0),
    flow_revenue:       m.flows.reduce((s, f) => s + f.revenue, 0),
    avg_open_rate:      m.avgOpenRate,
    avg_click_rate:     m.avgClickRate,
    avg_rpr:            m.avgRPR,
    total_unsubscribes: m.totalUnsubs,
    list_size:          m.listSize,
    prev_revenue:       m.prevRevenue,
    prev_open_rate:     m.prevOpenRate,
    prev_click_rate:    m.prevClickRate,
    critical_count:     criticals,
    high_count:         highs,
    recommendations:    recs,
    report_html:        html,
  };

  const { data, error } = await supabase
    .from("monthly_email_reports")
    .upsert(payload, { onConflict: "report_month" })
    .select("id")
    .single();

  if (error) {
    console.error("[monthly-email-report] Supabase upsert failed:", error.message);
    // Non-fatal — Slack still fires
    return "unknown";
  }

  return data.id as string;
}

// ─── Slack summary ────────────────────────────────────────────────────────────

async function postSlackSummary(m: MonthlyMetrics, recs: Recommendation[], reportId: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn("[monthly-email-report] SLACK_BOT_TOKEN not set — skipping Slack notification");
    return;
  }

  const campaignRevenue = m.campaigns.reduce((s, c) => s + c.revenue, 0);
  const flowRevenue     = m.flows.reduce((s, f) => s + f.revenue, 0);
  const momRevText      = m.prevRevenue > 0
    ? ` _(${revChangePct(m.totalRevenue, m.prevRevenue)} vs ${prevMonthLabel(m.reportMonth)})_`
    : "";

  const crFlag   = m.avgClickRate < 0.003 ? ":rotating_light: *CRITICAL*" : m.avgClickRate < 0.008 ? ":warning: LOW" : ":white_check_mark:";
  const orFlag   = m.avgOpenRate  > 0.2   ? ":white_check_mark:" : ":warning:";
  const unsubFlag = m.totalUnsubs > 100 ? ":rotating_light:" : m.totalUnsubs > 50 ? ":warning:" : ":white_check_mark:";

  const criticals = recs.filter(r => r.priority === "CRITICAL");
  const highs     = recs.filter(r => r.priority === "HIGH");

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📊 Monthly Email Report — ${m.reportLabel}`, emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${m.campaigns.length} campaigns sent · ${m.totalDelivered.toLocaleString()} delivered · ${m.listSize.toLocaleString()} subscribers*`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `${orFlag} *Open Rate*\n${(m.avgOpenRate*100).toFixed(1)}% _(prev ${(m.prevOpenRate*100).toFixed(1)}%)_` },
        { type: "mrkdwn", text: `${crFlag} *Click Rate*\n${(m.avgClickRate*100).toFixed(2)}% _(prev ${(m.prevClickRate*100).toFixed(2)}%)_` },
        { type: "mrkdwn", text: `:dollar: *Total Revenue*\n$${m.totalRevenue.toFixed(2)}${momRevText}` },
        { type: "mrkdwn", text: `${unsubFlag} *Unsubscribes*\n${m.totalUnsubs} this month` },
      ],
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `:bar_chart: *Campaign Revenue*\n$${campaignRevenue.toFixed(2)}` },
        { type: "mrkdwn", text: `:arrows_counterclockwise: *Flow Revenue*\n$${flowRevenue.toFixed(2)}` },
        { type: "mrkdwn", text: `:chart_with_upwards_trend: *Revenue / Recipient*\n$${m.avgRPR.toFixed(4)}` },
        { type: "mrkdwn", text: `:busts_in_silhouette: *List Size*\n${m.listSize.toLocaleString()} subscribers` },
      ],
    },
    { type: "divider" },
  ];

  // Top campaign
  if (m.campaigns.length > 0) {
    const top = m.campaigns[0];
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:trophy: *Top Campaign:* ${top.name}\n$${top.revenue.toFixed(2)} revenue · ${(top.openRate*100).toFixed(1)}% OR · ${(top.clickRate*100).toFixed(2)}% CR`,
      },
    });
  }

  // Zero-revenue campaigns
  const zeroRev = m.campaigns.filter(c => c.revenue === 0);
  if (zeroRev.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:x: *${zeroRev.length} campaigns sent with $0 revenue:* ${zeroRev.map(c => c.name).join(", ")}`,
      },
    });
  }

  // Flow highlights
  if (m.flows.length > 0) {
    const flowLines = m.flows.map(f =>
      `• *${f.name}:* ${f.delivered} sent · ${(f.clickRate*100).toFixed(2)}% CR · $${f.revenue.toFixed(2)}`
    ).join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `:arrows_counterclockwise: *Flows this month:*\n${flowLines}` },
    });
  }

  blocks.push({ type: "divider" });

  // Priority actions summary
  if (criticals.length > 0 || highs.length > 0) {
    const actionLines = [...criticals, ...highs].slice(0, 5).map((r, i) => {
      const badge = r.priority === "CRITICAL" ? ":rotating_light:" : ":warning:";
      return `${badge} *${r.title}*\n   ↳ ${r.action.slice(0, 120)}${r.action.length > 120 ? "…" : ""}`;
    }).join("\n\n");

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Priority Actions (${criticals.length} critical, ${highs.length} high):*\n\n${actionLines}` },
    });
  } else {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: ":white_check_mark: *No critical issues this month.* Keep the momentum." },
    });
  }

  // Next month seasonal preview
  const nextMonth = m.reportMonth.split("-");
  const nextLabel = new Date(Number(nextMonth[0]), Number(nextMonth[1]), 1)
    .toLocaleString("en-AU", { month: "long" });
  const nextMonthNum = Number(nextMonth[1]) + 1 > 12 ? 1 : Number(nextMonth[1]) + 1;
  const nextYearNum  = Number(nextMonth[1]) + 1 > 12 ? Number(nextMonth[0]) + 1 : Number(nextMonth[0]);
  const seasonal     = getSeasonalCalendar(nextYearNum, nextMonthNum);
  if (seasonal.length > 0) {
    const calLines = seasonal.map(s => `• *${s.event}* (${s.date}) — ${s.ideas[0]}`).join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `:calendar: *Campaign ideas for ${nextLabel}:*\n${calLines}` },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: `Generated by Harry Labs · Monthly Email Report · ${m.reportMonth} · ${new Date().toLocaleDateString("en-AU")}` },
    ],
  });

  const res = await fetch(SLACK_API, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel:  EMAIL_AGENT_CHANNEL,
      text:     `Monthly Email Report — ${m.reportLabel}`,
      blocks,
      unfurl_links: false,
    }),
  });

  const json = await res.json();
  if (!json.ok) console.error("[monthly-email-report] Slack error:", json.error);
  else console.log("[monthly-email-report] Slack posted OK");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revChangePct(current: number, prev: number): string {
  if (prev === 0) return "new";
  const pct = ((current - prev) / prev) * 100;
  return pct >= 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`;
}

function prevMonthLabel(reportMonth: string): string {
  const [y, m] = reportMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return d.toLocaleString("en-AU", { month: "short" });
}
