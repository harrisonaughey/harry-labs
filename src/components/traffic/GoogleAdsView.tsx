"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import ConnectCard from "./ConnectCard";
import DateRangePicker, { type DateRange, defaultDateRange } from "./DateRangePicker";

// ─── Types ─────────────────────────────────────────────────────────────────────
type InnerTab  = "overview" | "campaigns" | "performance" | "optimise";
type Priority  = "high" | "medium" | "low";
type SortField = "spend" | "impressions" | "clicks" | "ctr" | "avgCpc" | "conversions" | "costPerConv" | "convValue" | "roas";
type SortDir   = "asc" | "desc";

type Rec = {
  id:          string;
  priority:    Priority;
  category:    "budget" | "bidding" | "quality" | "scale" | "health";
  entityName?: string;
  title:       string;
  reason:      string;
  action:      string;
};

type Goals       = { roas?: number; cpa?: number; monthlyBudget?: number };
type ChangeEntry = { id: string; ts: number; campaignName?: string; note: string; applied: boolean };
type AuditStore  = { ts: number; recs: Rec[] };

// ─── Constants ──────────────────────────────────────────────────────────────────
const AUDIT_KEY = "google_audit_v2";
const GOALS_KEY = "google_goals";
const LOG_KEY   = "google_change_log";
const AUDIT_TTL = 7 * 24 * 60 * 60 * 1000;

const CHANNEL_CFG: Record<string, { label: string; icon: string; color: string; benchmark: number }> = {
  SEARCH:          { label: "Search",   icon: "🔍", color: "#4285F4", benchmark: 4.0 },
  SHOPPING:        { label: "Shopping", icon: "🛒", color: "#34A853", benchmark: 5.0 },
  PERFORMANCE_MAX: { label: "PMax",     icon: "⚡", color: "#FF6D00", benchmark: 5.0 },
  DISPLAY:         { label: "Display",  icon: "🖼",  color: "#A142F4", benchmark: 1.5 },
  VIDEO:           { label: "Video",    icon: "📹", color: "#EA4335", benchmark: 2.0 },
  SMART:           { label: "Smart",    icon: "🤖", color: "#5F6368", benchmark: 3.0 },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ENABLED: { bg: "#10b98120", text: "#10b981" },
  PAUSED:  { bg: "#f59e0b20", text: "#fbbf24" },
  REMOVED: { bg: "#ef444420", text: "#ef4444" },
};

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string }> = {
  high:   { label: "High",   color: "#ef4444", bg: "#ef444418" },
  medium: { label: "Medium", color: "#fbbf24", bg: "#fbbf2418" },
  low:    { label: "Low",    color: "#10b981", bg: "#10b98118" },
};

const CTR_BENCHMARK: Record<string, number> = {
  SEARCH: 3.5, SHOPPING: 0.8, PERFORMANCE_MAX: 1.2, DISPLAY: 0.35, VIDEO: 0.5,
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Helpers ────────────────────────────────────────────────────────────────────
function pct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtK(v: number) {
  return v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + "M"
       : v >= 1_000     ? (v / 1_000).toFixed(1) + "K"
       : v.toLocaleString();
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return "just now";
}

function channelCfg(type: string) {
  return CHANNEL_CFG[type] ?? { label: type ?? "Other", icon: "📊", color: "#6b7280", benchmark: 3.0 };
}

// ─── localStorage ───────────────────────────────────────────────────────────────
function readGoals():              Goals           { try { return JSON.parse(localStorage.getItem(GOALS_KEY) ?? "{}"); } catch { return {}; } }
function saveGoals(g: Goals)                       { localStorage.setItem(GOALS_KEY, JSON.stringify(g)); }
function readAudit():              AuditStore|null { try { const r = localStorage.getItem(AUDIT_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveAudit(a: AuditStore)                  { localStorage.setItem(AUDIT_KEY, JSON.stringify(a)); }
function readLog():                ChangeEntry[]   { try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); } catch { return []; } }
function saveLog(l: ChangeEntry[])                 { localStorage.setItem(LOG_KEY, JSON.stringify(l)); }

// ─── Recommendations engine ──────────────────────────────────────────────────────
function generateRecs(
  account:   Record<string, number>,
  campaigns: Record<string, any>[],
  goals:     Goals
): Rec[] {
  const recs: Rec[] = [];
  let id = 0;
  const nid = () => String(++id);

  if (goals.roas && (account.roas ?? 0) > 0 && (account.roas ?? 0) < goals.roas * 0.8) {
    recs.push({ id: nid(), priority: "high", category: "bidding",
      title: "ROAS significantly below target",
      reason: `Account ROAS is ${(account.roas ?? 0).toFixed(2)}× — ${((1 - (account.roas ?? 0) / goals.roas) * 100).toFixed(0)}% below your ${goals.roas}× goal.`,
      action: "Reduce budgets on low-ROAS campaigns and shift spend to winners. Consider tROAS bidding on eligible campaigns." });
  }

  if (goals.cpa && (account.costPerConv ?? 0) > goals.cpa * 1.5) {
    recs.push({ id: nid(), priority: "high", category: "bidding",
      title: "Account CPA 50%+ above target",
      reason: `Cost/conv is ${fmt(account.costPerConv ?? 0)} vs your ${fmt(goals.cpa)} target.`,
      action: "Switch eligible campaigns to Target CPA smart bidding in Google Ads Manager." });
  }

  const totalSpend = campaigns.reduce((s, c) => s + (c.spend ?? 0), 0);

  for (const c of campaigns) {
    const active = c.status === "ENABLED";
    const cfg    = channelCfg(c.channelType);

    if (active && (c.spend ?? 0) > 20 && c.conversions === 0) {
      recs.push({ id: nid(), priority: "high", category: "quality", entityName: c.name,
        title: "Spending without conversions",
        reason: `${fmt(c.spend ?? 0)} spent with 0 conversions. Conversion tracking may be broken or keywords are too broad.`,
        action: "Check conversion tag firing in Tag Assistant. Review search terms and add negatives." });
    }

    if (active && (c.spend ?? 0) > 30 && (c.roas ?? 0) > 0 && (c.roas ?? 0) < 1) {
      recs.push({ id: nid(), priority: "high", category: "budget", entityName: c.name,
        title: "Below break-even ROAS",
        reason: `${cfg.icon} ${cfg.label} — earning ${fmt(c.convValue ?? 0)} on ${fmt(c.spend ?? 0)} spend (${(c.roas ?? 0).toFixed(2)}×).`,
        action: `Reduce daily budget 30–50% in Google Ads Manager. ${c.channelType === "SEARCH" ? "Add negative keywords." : c.channelType === "SHOPPING" ? "Exclude low-margin products." : "Review asset performance scores."}` });
    }

    const avgCpa = account.costPerConv ?? 0;
    if (active && avgCpa > 0 && (c.costPerConv ?? 0) > avgCpa * 2.5 && c.conversions > 0) {
      recs.push({ id: nid(), priority: "medium", category: "bidding", entityName: c.name,
        title: "CPA 2.5× above account average",
        reason: `Cost/conv is ${fmt(c.costPerConv ?? 0)} vs account average ${fmt(avgCpa)}.`,
        action: "Lower target bid or switch to tCPA. Review search terms for irrelevant queries." });
    }

    if (active && (c.spend ?? 0) === 0) {
      recs.push({ id: nid(), priority: "medium", category: "health", entityName: c.name,
        title: "Enabled but not spending",
        reason: `Campaign is active but has $0 spend this period.`,
        action: "Check: (1) daily budget > $0, (2) ad approval status, (3) keyword volume, (4) bid floor." });
    }

    if (active && (c.roas ?? 0) >= 4 && (c.spend ?? 0) > 50 && totalSpend > 0 && ((c.spend ?? 0) / totalSpend) < 0.15) {
      recs.push({ id: nid(), priority: "low", category: "scale", entityName: c.name,
        title: "Scale this winner",
        reason: `${cfg.icon} "${c.name}" delivers ${(c.roas ?? 0).toFixed(2)}× ROAS but only ${(((c.spend ?? 0) / totalSpend) * 100).toFixed(0)}% of budget.`,
        action: "Increase daily budget by 20–30% in Google Ads Manager. Monitor ROAS for 5–7 days before scaling further." });
    }

    if (active && c.channelType === "PERFORMANCE_MAX" && (c.ctr ?? 0) < 0.5 && (c.impressions ?? 0) > 1000) {
      recs.push({ id: nid(), priority: "medium", category: "quality", entityName: c.name,
        title: "PMax CTR below 0.5% — weak assets",
        reason: `CTR of ${(c.ctr ?? 0).toFixed(2)}% suggests poor ad relevance or weak creative.`,
        action: "Review asset group quality scores. Replace low-rated headlines/images. Ensure landing page matches intent." });
    }

    if (active && goals.roas && (c.roas ?? 0) > 0 && (c.roas ?? 0) < goals.roas && (c.spend ?? 0) > 20 && c.conversions > 0 && (c.roas ?? 0) >= 1) {
      recs.push({ id: nid(), priority: "low", category: "bidding", entityName: c.name,
        title: "Below ROAS target but profitable",
        reason: `${(c.roas ?? 0).toFixed(2)}× vs your ${goals.roas}× target — but above break-even.`,
        action: c.channelType === "SEARCH"
          ? "Review search terms, raise bids on exact-match high-intent queries, add negatives."
          : "Improve asset quality scores. Test new headline/description combinations." });
    }
  }

  const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 15);
}

// ─── Sub-components ──────────────────────────────────────────────────────────────

function ChangeBadge({ change, invert = false }: { change: number | null; invert?: boolean }) {
  if (change === null || Math.abs(change) < 0.5) return null;
  const good = invert ? change < 0 : change > 0;
  return (
    <span className="text-xs font-medium" style={{ color: good ? "#10b981" : "#ef4444" }}>
      {change > 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, sub, icon, color, change, invert }: {
  label: string; value: string; sub?: string; icon: string;
  color?: string; change?: number | null; invert?: boolean;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
        <span className="text-sm">{icon}</span>
      </div>
      <p className="text-xl font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      <div className="flex items-center justify-between mt-1 min-h-[16px]">
        {sub && <p className="text-xs" style={{ color: "var(--text-faint)" }}>{sub}</p>}
        <ChangeBadge change={change ?? null} invert={invert} />
      </div>
    </div>
  );
}

// Dual chart: spend bars + conversion line
function DualChart({ daily, label }: { daily: Record<string, number>[]; label: string }) {
  if (!daily.length) return (
    <div className="h-28 flex items-center justify-center text-xs" style={{ color: "var(--text-faint)" }}>
      No daily data for this period
    </div>
  );

  const W = 1000, H = 110, PL = 48, PR = 48, PT = 8, PB = 24;
  const cw = W - PL - PR, ch = H - PT - PB;

  const maxSpend  = Math.max(...daily.map((d) => d.spend), 0.01);
  const maxConv   = Math.max(...daily.map((d) => d.conversions), 0.01);
  const barW      = Math.max((cw / daily.length) - 1.5, 2);
  const showEvery = Math.max(Math.ceil(daily.length / 8), 1);
  const total     = daily.reduce((s, d) => s + d.spend, 0);
  const totalConv = daily.reduce((s, d) => s + d.conversions, 0);

  const bx = (i: number) => PL + (cw / daily.length) * i + 0.75;
  const by = (v: number) => PT + ch - (v / maxSpend) * ch;
  const cx = (i: number) => PL + (cw / daily.length) * i + barW / 2;
  const cy = (v: number) => PT + ch - (v / maxConv) * ch;

  const convPath = daily.map((d, i) =>
    `${i === 0 ? "M" : "L"} ${cx(i).toFixed(1)} ${cy(d.conversions).toFixed(1)}`
  ).join(" ");

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Daily Performance — {label}
        </span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ background: "#4285F4", opacity: 0.75 }} />
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Spend ${total.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded" style={{ background: "#34A853" }} />
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Conv {totalConv.toFixed(1)}</span>
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {[0, maxSpend / 2, maxSpend].map((v, i) => (
          <g key={i}>
            <line x1={PL} y1={by(v)} x2={W - PR} y2={by(v)} stroke="var(--border)" strokeWidth={0.5} />
            <text x={PL - 4} y={by(v) + 3.5} textAnchor="end" fontSize={7} fill="var(--text-faint)">
              {v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
            </text>
          </g>
        ))}
        {[0, maxConv / 2, maxConv].map((v, i) => (
          <text key={`r${i}`} x={W - PR + 4} y={cy(v) + 3.5} textAnchor="start" fontSize={7} fill="#34A85380">
            {v.toFixed(v < 1 ? 1 : 0)}
          </text>
        ))}
        {daily.map((d, i) => {
          const h = Math.max((d.spend / maxSpend) * ch, d.spend > 0 ? 1 : 0);
          return <rect key={`b${i}`} x={bx(i)} y={by(d.spend)} width={barW} height={h} fill="#4285F4" opacity={0.7} rx={1} />;
        })}
        {maxConv > 0 && (
          <path d={convPath} fill="none" stroke="#34A853" strokeWidth={1.5} strokeLinejoin="round" />
        )}
        {daily.map((d, i) => i % showEvery === 0 ? (
          <text key={`l${i}`} x={bx(i) + barW / 2} y={H - 6} textAnchor="middle" fontSize={7} fill="var(--text-faint)">
            {String(d.date ?? "").slice(5)}
          </text>
        ) : null)}
      </svg>
    </div>
  );
}

// Campaign type spend breakdown
function TypeBreakdown({ campaigns }: { campaigns: Record<string, any>[] }) {
  const byType = useMemo(() => {
    const map: Record<string, { spend: number; conversions: number; convValue: number; count: number }> = {};
    for (const c of campaigns) {
      const t = String(c.channelType ?? "UNKNOWN");
      if (!map[t]) map[t] = { spend: 0, conversions: 0, convValue: 0, count: 0 };
      map[t].spend       += c.spend       ?? 0;
      map[t].conversions += c.conversions ?? 0;
      map[t].convValue   += c.convValue   ?? 0;
      map[t].count++;
    }
    return Object.entries(map).sort((a, b) => b[1].spend - a[1].spend);
  }, [campaigns]);

  const totalSpend = byType.reduce((s, [, v]) => s + v.spend, 0);
  if (!byType.length) return null;

  return (
    <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Campaign Type Breakdown</h3>
      <div className="flex rounded-full overflow-hidden h-2 mb-4" style={{ background: "#1e1e2e" }}>
        {byType.map(([type, v]) => {
          const cfg = channelCfg(type);
          const w = totalSpend > 0 ? (v.spend / totalSpend) * 100 : 0;
          return <div key={type} style={{ width: `${w}%`, background: cfg.color }} title={`${cfg.label}: ${fmt(v.spend)}`} />;
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {byType.map(([type, v]) => {
          const cfg      = channelCfg(type);
          const roas     = v.spend > 0 ? v.convValue / v.spend : 0;
          const spendPct = totalSpend > 0 ? (v.spend / totalSpend) * 100 : 0;
          const roasClr  = roas >= cfg.benchmark ? "#10b981" : roas >= 1 ? "#fbbf24" : "#ef4444";
          return (
            <div key={type} className="rounded-lg p-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{cfg.icon} {cfg.label}</span>
                <span className="text-xs ml-auto" style={{ color: "var(--text-faint)" }}>{v.count}</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(v.spend)}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>{spendPct.toFixed(0)}% of spend</span>
                <span className="text-xs font-medium" style={{ color: roasClr }}>{roas.toFixed(2)}×</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>Benchmark: {cfg.benchmark}×</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Day-of-week analysis
function DayParting({ daily }: { daily: Record<string, number>[] }) {
  const byDay = useMemo(() => {
    const map: Record<number, { spend: number; conversions: number; days: number }> = {};
    for (let i = 0; i < 7; i++) map[i] = { spend: 0, conversions: 0, days: 0 };
    for (const d of daily) {
      if (!d.date) continue;
      const day = (new Date(String(d.date) + "T00:00:00").getDay() + 6) % 7; // Mon=0..Sun=6
      map[day].spend       += d.spend       ?? 0;
      map[day].conversions += d.conversions ?? 0;
      map[day].days++;
    }
    return Array.from({ length: 7 }, (_, i) => ({
      day:      WEEKDAYS[i],
      avgSpend: map[i].days > 0 ? map[i].spend / map[i].days : 0,
      avgConv:  map[i].days > 0 ? map[i].conversions / map[i].days : 0,
      samples:  map[i].days,
    }));
  }, [daily]);

  const maxSpend     = Math.max(...byDay.map((d) => d.avgSpend), 0.01);
  const maxConv      = Math.max(...byDay.map((d) => d.avgConv),  0.01);
  const bestSpendDay = byDay.reduce((b, d) => d.avgSpend > b.avgSpend ? d : b, byDay[0]);
  const bestConvDay  = byDay.reduce((b, d) => d.avgConv  > b.avgConv  ? d : b, byDay[0]);

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Day-of-Week Analysis</h3>
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-faint)" }}>
          <span>Peak spend: <span style={{ color: "#4285F4" }}>{bestSpendDay.day}</span></span>
          <span>Peak conv: <span style={{ color: "#34A853" }}>{bestConvDay.day}</span></span>
        </div>
      </div>
      <div className="flex items-end gap-2" style={{ height: 80 }}>
        {byDay.map((d) => {
          const spendH    = maxSpend > 0 ? (d.avgSpend / maxSpend) * 72 : 0;
          const convH     = maxConv  > 0 ? (d.avgConv  / maxConv)  * 72 : 0;
          const isWeekend = d.day === "Sat" || d.day === "Sun";
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5" style={{ height: 72 }}>
                <div className="flex-1 rounded-t-sm" style={{ height: spendH, background: "#4285F4", opacity: 0.75 }} />
                <div className="flex-1 rounded-t-sm" style={{ height: convH,  background: "#34A853", opacity: 0.75 }} />
              </div>
              <span className="text-xs" style={{ color: isWeekend ? "var(--text-faint)" : "var(--text-muted)" }}>{d.day}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: "#4285F4" }} />
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Avg Daily Spend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: "#34A853" }} />
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Avg Daily Conversions</span>
        </div>
        {daily.length < 7 && (
          <span className="text-xs ml-auto" style={{ color: "var(--text-faint)" }}>Need more data for full week</span>
        )}
      </div>
    </div>
  );
}

// Conversion funnel
function ConvFunnel({ account }: { account: Record<string, number> }) {
  const steps = [
    { label: "Impressions", value: account.impressions ?? 0, color: "#4285F4" },
    { label: "Clicks",      value: account.clicks       ?? 0, color: "#FBBC04" },
    { label: "Conversions", value: account.conversions  ?? 0, color: "#34A853" },
  ];
  const maxV = Math.max(steps[0].value, 1);

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Conversion Funnel</h3>
      <div className="space-y-3">
        {steps.map((s, i) => {
          const w    = (s.value / maxV) * 100;
          const rate = i > 0 ? (s.value / Math.max(steps[i - 1].value, 1)) * 100 : 100;
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                <div className="flex items-center gap-3">
                  {i > 0 && <span className="text-xs" style={{ color: "var(--text-faint)" }}>{rate.toFixed(2)}% rate</span>}
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{fmtK(s.value)}</span>
                </div>
              </div>
              <div className="h-5 rounded-md" style={{ background: "var(--bg-subtle)" }}>
                <div className="h-5 rounded-md" style={{ width: `${w}%`, background: s.color, opacity: 0.8 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="text-center">
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Click-Through Rate</p>
          <p className="text-lg font-semibold mt-0.5"
            style={{ color: (account.ctr ?? 0) > 2 ? "#10b981" : "var(--text-primary)" }}>
            {(account.ctr ?? 0).toFixed(2)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Conv. Rate</p>
          <p className="text-lg font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
            {(account.clicks ?? 0) > 0
              ? (((account.conversions ?? 0) / (account.clicks ?? 1)) * 100).toFixed(2)
              : "0.00"}%
          </p>
        </div>
      </div>
    </div>
  );
}

// Account health flags
function AuditFlags({ account, campaigns }: {
  account: Record<string, number>; campaigns: Record<string, any>[];
}) {
  type Flag = { severity: "danger" | "warn"; msg: string; detail?: string };
  const flags: Flag[] = [];

  const noConv = campaigns.filter((c) => (c.spend ?? 0) > 10 && c.conversions === 0 && c.status === "ENABLED");
  if (noConv.length)
    flags.push({ severity: "danger", msg: `${noConv.length} campaign${noConv.length > 1 ? "s" : ""} spending without conversions`, detail: noConv.map((c) => c.name).join(", ") });

  const subBE = campaigns.filter((c) => (c.spend ?? 0) > 20 && (c.roas ?? 0) > 0 && (c.roas ?? 0) < 1);
  if (subBE.length)
    flags.push({ severity: "warn", msg: `${subBE.length} campaign${subBE.length > 1 ? "s" : ""} below break-even ROAS`, detail: subBE.map((c) => `${c.name} (${(c.roas ?? 0).toFixed(2)}×)`).join(", ") });

  const highCpa = campaigns.filter((c) => {
    const avg = account.costPerConv ?? 0;
    return avg > 0 && (c.costPerConv ?? 0) > avg * 2.5 && c.conversions > 0;
  });
  if (highCpa.length)
    flags.push({ severity: "warn", msg: `${highCpa.length} campaign${highCpa.length > 1 ? "s" : ""} with CPA 2.5× above average`, detail: highCpa.map((c) => c.name).join(", ") });

  const zeroSpend = campaigns.filter((c) => c.status === "ENABLED" && (c.spend ?? 0) === 0);
  if (zeroSpend.length)
    flags.push({ severity: "warn", msg: `${zeroSpend.length} enabled campaign${zeroSpend.length > 1 ? "s" : ""} with $0 spend` });

  if (!flags.length) return (
    <div className="rounded-xl p-4 mb-5 flex items-center gap-3" style={{ background: "#10b98110", border: "1px solid #10b98130" }}>
      <span>✅</span>
      <p className="text-sm" style={{ color: "#10b981" }}>Account health looks good — no critical issues found</p>
    </div>
  );

  return (
    <div className="rounded-xl mb-5 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <span>⚠️</span>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Account Flags</h3>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#ef444420", color: "#ef4444" }}>{flags.length}</span>
      </div>
      <div style={{ background: "var(--bg-card)" }}>
        {flags.map((f, i) => (
          <div key={i} className="px-5 py-3 flex items-start gap-3"
            style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
            <span className="mt-0.5 flex-shrink-0">{f.severity === "danger" ? "🔴" : "🟡"}</span>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{f.msg}</p>
              {f.detail && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{f.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sortable campaign table with filters and CSV export
function CampaignTable({ campaigns }: { campaigns: Record<string, any>[] }) {
  const [sortField,    setSortField]    = useState<SortField>("spend");
  const [sortDir,      setSortDir]      = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ENABLED" | "PAUSED">("ALL");
  const [typeFilter,   setTypeFilter]   = useState("ALL");

  const types = useMemo(
    () => ["ALL", ...Array.from(new Set(campaigns.map((c) => String(c.channelType ?? ""))))],
    [campaigns]
  );

  const sorted = useMemo(() => {
    const rows = campaigns.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (typeFilter   !== "ALL" && String(c.channelType ?? "") !== typeFilter) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      const diff = (a[sortField] ?? 0) - (b[sortField] ?? 0);
      return sortDir === "desc" ? -diff : diff;
    });
  }, [campaigns, sortField, sortDir, statusFilter, typeFilter]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  }

  function exportCsv() {
    const headers = ["Campaign", "Type", "Status", "Spend", "Impressions", "Clicks", "CTR%", "Avg CPC", "Conversions", "Conv Value", "Cost/Conv", "ROAS"];
    const rows = sorted.map((c) => [
      `"${c.name}"`, channelCfg(c.channelType).label, c.status,
      (c.spend ?? 0).toFixed(2), c.impressions ?? 0, c.clicks ?? 0,
      (c.ctr ?? 0).toFixed(2), (c.avgCpc ?? 0).toFixed(2),
      (c.conversions ?? 0).toFixed(1), (c.convValue ?? 0).toFixed(2),
      (c.costPerConv ?? 0).toFixed(2), (c.roas ?? 0).toFixed(2),
    ]);
    const csv  = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "google-ads-campaigns.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (!campaigns.length) return (
    <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>
      No campaign data — connect Google Ads to see campaigns
    </div>
  );

  const SortTh = ({ field, label }: { field: SortField; label: string }) => (
    <th className="px-3 py-3 text-left font-medium uppercase tracking-wider cursor-pointer select-none"
      style={{ color: sortField === field ? "#a5b4fc" : "var(--text-faint)", whiteSpace: "nowrap", fontSize: 10 }}
      onClick={() => toggleSort(field)}>
      {label}{sortField === field ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  const totSpend = sorted.reduce((s, c) => s + (c.spend ?? 0), 0);
  const totImpr  = sorted.reduce((s, c) => s + (c.impressions ?? 0), 0);
  const totClick = sorted.reduce((s, c) => s + (c.clicks ?? 0), 0);
  const totConv  = sorted.reduce((s, c) => s + (c.conversions ?? 0), 0);
  const totVal   = sorted.reduce((s, c) => s + (c.convValue ?? 0), 0);
  const avgCtr   = totImpr  > 0 ? (totClick / totImpr) * 100 : 0;
  const avgCpc   = totClick > 0 ? totSpend / totClick : 0;
  const avgCpa   = totConv  > 0 ? totSpend / totConv  : 0;
  const totRoas  = totSpend > 0 ? totVal   / totSpend  : 0;

  return (
    <div>
      <div className="flex items-center gap-3 px-5 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex gap-1">
          {(["ALL", "ENABLED", "PAUSED"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="text-xs px-2.5 py-1 rounded-md font-medium"
              style={{ background: statusFilter === s ? "#1e1e30" : "transparent", color: statusFilter === s ? "#a5b4fc" : "var(--text-muted)", border: `1px solid ${statusFilter === s ? "#3730a3" : "var(--border)"}` }}>
              {s === "ALL" ? "All Status" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {types.map((t) => {
            const cfg = t === "ALL" ? null : channelCfg(t);
            return (
              <button key={t} onClick={() => setTypeFilter(t)}
                className="text-xs px-2.5 py-1 rounded-md font-medium"
                style={{ background: typeFilter === t ? "#1e1e30" : "transparent", color: typeFilter === t ? "#a5b4fc" : "var(--text-muted)", border: `1px solid ${typeFilter === t ? "#3730a3" : "var(--border)"}` }}>
                {cfg ? `${cfg.icon} ${cfg.label}` : "All Types"}
              </button>
            );
          })}
        </div>
        <span className="text-xs ml-auto" style={{ color: "var(--text-faint)" }}>{sorted.length} campaigns</span>
        <button onClick={exportCsv} className="text-xs px-3 py-1.5 rounded-md hover:opacity-80"
          style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 920 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="px-3 py-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)", fontSize: 10 }}>Campaign</th>
              <th className="px-3 py-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)", fontSize: 10 }}>Type</th>
              <th className="px-3 py-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)", fontSize: 10 }}>Status</th>
              <SortTh field="spend"       label="Spend" />
              <SortTh field="impressions" label="Impr." />
              <SortTh field="clicks"      label="Clicks" />
              <SortTh field="ctr"         label="CTR" />
              <SortTh field="avgCpc"      label="CPC" />
              <SortTh field="conversions" label="Conv." />
              <SortTh field="convValue"   label="Conv. Val" />
              <SortTh field="costPerConv" label="CPA" />
              <SortTh field="roas"        label="ROAS" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const s   = STATUS_STYLE[c.status] ?? { bg: "#6b728020", text: "var(--text-secondary)" };
              const cfg = channelCfg(c.channelType);
              const roasOk = (c.roas ?? 0) >= cfg.benchmark;
              return (
                <tr key={c.id} className="hover:bg-white/[0.02]" style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-3 py-3">
                    <p className="font-medium truncate max-w-[180px]" style={{ color: "var(--text-primary)" }} title={c.name}>{c.name}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: cfg.color + "20", color: cfg.color }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.text }}>
                      {String(c.status ?? "").charAt(0) + String(c.status ?? "").slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{fmt(c.spend ?? 0)}</td>
                  <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{fmtK(c.impressions ?? 0)}</td>
                  <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{fmtK(c.clicks ?? 0)}</td>
                  <td className="px-3 py-3" style={{ color: (c.ctr ?? 0) > 2 ? "#10b981" : "var(--text-secondary)" }}>{(c.ctr ?? 0).toFixed(2)}%</td>
                  <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{fmt(c.avgCpc ?? 0)}</td>
                  <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{(c.conversions ?? 0).toFixed(1)}</td>
                  <td className="px-3 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{fmt(c.convValue ?? 0)}</td>
                  <td className="px-3 py-3" style={{ color: (c.costPerConv ?? 0) === 0 ? "var(--text-faint)" : "var(--text-secondary)" }}>
                    {(c.costPerConv ?? 0) > 0 ? fmt(c.costPerConv) : "—"}
                  </td>
                  <td className="px-3 py-3 font-medium"
                    style={{ color: roasOk ? "#10b981" : (c.roas ?? 0) >= 1 ? "#fbbf24" : "#ef4444" }}>
                    {(c.roas ?? 0).toFixed(2)}×
                  </td>
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 1 && (
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td className="px-3 py-3 text-xs font-semibold" style={{ color: "var(--text-secondary)" }} colSpan={3}>
                  Totals ({sorted.length})
                </td>
                <td className="px-3 py-3 font-semibold text-xs" style={{ color: "var(--text-primary)" }}>{fmt(totSpend)}</td>
                <td className="px-3 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{fmtK(totImpr)}</td>
                <td className="px-3 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{fmtK(totClick)}</td>
                <td className="px-3 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{avgCtr.toFixed(2)}%</td>
                <td className="px-3 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{fmt(avgCpc)}</td>
                <td className="px-3 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{totConv.toFixed(1)}</td>
                <td className="px-3 py-3 font-semibold text-xs" style={{ color: "var(--text-primary)" }}>{fmt(totVal)}</td>
                <td className="px-3 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{avgCpa > 0 ? fmt(avgCpa) : "—"}</td>
                <td className="px-3 py-3 font-semibold text-xs"
                  style={{ color: totRoas >= 2 ? "#10b981" : totRoas >= 1 ? "#fbbf24" : "#ef4444" }}>
                  {totRoas.toFixed(2)}×
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// Recommendations panel
function RecommendationsPanel({ account, campaigns, goals }: {
  account: Record<string, number>; campaigns: Record<string, any>[]; goals: Goals;
}) {
  const [audit, setAudit] = useState<AuditStore | null>(null);

  useEffect(() => { setAudit(readAudit()); }, []);

  const isStale = !audit || (Date.now() - audit.ts) > AUDIT_TTL;
  const hasData = campaigns.length > 0 || (account.spend ?? 0) > 0;

  function generate() {
    if (!hasData) return;
    const store = { ts: Date.now(), recs: generateRecs(account, campaigns, goals) };
    saveAudit(store); setAudit(store);
  }

  useEffect(() => { if (!audit && hasData) generate(); }, [hasData]); // eslint-disable-line react-hooks/exhaustive-deps

  const recs  = audit?.recs ?? [];
  const highs = recs.filter((r) => r.priority === "high").length;
  const meds  = recs.filter((r) => r.priority === "medium").length;
  const lows  = recs.filter((r) => r.priority === "low").length;

  const CAT_ICON: Record<string, string> = {
    budget: "💰", bidding: "🎯", quality: "⚡", scale: "📈", health: "🩺",
  };

  return (
    <div className="rounded-xl mb-6 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4"
        style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span>🧠</span>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Optimisation Recommendations</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
              {audit ? `Generated ${timeAgo(audit.ts)}` : "Not yet generated"}
              {isStale && audit && <span style={{ color: "#fbbf24" }}> · Stale</span>}
            </p>
          </div>
          {recs.length > 0 && (
            <div className="flex items-center gap-2 ml-2">
              {highs > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#ef444420", color: "#ef4444" }}>{highs} high</span>}
              {meds  > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#fbbf2420", color: "#fbbf24" }}>{meds} med</span>}
              {lows  > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#10b98120", color: "#10b981" }}>{lows} low</span>}
            </div>
          )}
        </div>
        <button onClick={generate} disabled={!hasData}
          className="text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-40"
          style={{ background: isStale ? "#4285F4" : "#1e1e30", color: "#fff", border: "1px solid #4285F440" }}>
          {isStale ? "Generate" : "↻ Refresh"}
        </button>
      </div>

      {!audit ? (
        <div className="py-10 text-center" style={{ background: "var(--bg-card)" }}>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
            {hasData ? "Analyse your account to get targeted recommendations." : "No data to analyse — connect Google Ads first."}
          </p>
          {hasData && (
            <button onClick={generate} className="text-xs px-4 py-2 rounded-lg font-medium"
              style={{ background: "#4285F4", color: "#fff" }}>
              Generate Recommendations
            </button>
          )}
        </div>
      ) : recs.length === 0 ? (
        <div className="py-8 px-5 flex items-center gap-3" style={{ background: "#10b98108" }}>
          <span>✅</span>
          <div>
            <p className="text-sm font-medium" style={{ color: "#10b981" }}>No issues found</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Account health looks strong for this period.</p>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)" }}>
          <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: "#4285F408", borderBottom: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Changes must be applied in{" "}
              <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "#4285F4" }}>Google Ads Manager</a>.
              Refresh after applying to see updated data.
            </p>
          </div>
          {recs.map((rec, i) => {
            const cfg = PRIORITY_CFG[rec.priority];
            return (
              <div key={rec.id} className="px-5 py-4 flex items-start gap-4"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div className="flex-shrink-0 mt-0.5 flex flex-col items-center gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                    style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  <span className="text-xs">{CAT_ICON[rec.category]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{rec.title}</p>
                  {rec.entityName && (
                    <p className="text-xs mb-1 font-mono truncate" style={{ color: "#4285F4" }}>{rec.entityName}</p>
                  )}
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{rec.reason}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "#4285F4" }}>→ </span>{rec.action}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Goals section
function GoalsSection({ goals, onChange }: { goals: Goals; onChange: (g: Goals) => void }) {
  const [roas,   setRoas]   = useState(String(goals.roas          ?? ""));
  const [cpa,    setCpa]    = useState(String(goals.cpa           ?? ""));
  const [budget, setBudget] = useState(String(goals.monthlyBudget ?? ""));
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    setRoas(String(goals.roas          ?? ""));
    setCpa(String(goals.cpa            ?? ""));
    setBudget(String(goals.monthlyBudget ?? ""));
  }, [goals]);

  function save() {
    const g: Goals = {
      roas:          roas   ? parseFloat(roas)   : undefined,
      cpa:           cpa    ? parseFloat(cpa)    : undefined,
      monthlyBudget: budget ? parseFloat(budget) : undefined,
    };
    saveGoals(g); onChange(g);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  const iStyle = {
    background: "var(--bg-subtle)", border: "1px solid var(--border)",
    color: "var(--text-primary)", outline: "none",
  };

  return (
    <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid #4285F430" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>🎯 Performance Goals</h3>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label className="text-xs block mb-1.5" style={{ color: "var(--text-muted)" }}>Target ROAS</label>
          <div className="flex items-center gap-1">
            <input value={roas} onChange={(e) => setRoas(e.target.value)} placeholder="e.g. 4.0"
              className="w-20 text-xs px-2 py-1.5 rounded" style={iStyle} />
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>×</span>
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1.5" style={{ color: "var(--text-muted)" }}>Target CPA</label>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>$</span>
            <input value={cpa} onChange={(e) => setCpa(e.target.value)} placeholder="e.g. 30.00"
              className="w-20 text-xs px-2 py-1.5 rounded" style={iStyle} />
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1.5" style={{ color: "var(--text-muted)" }}>Monthly Budget</label>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>$</span>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 5000"
              className="w-24 text-xs px-2 py-1.5 rounded" style={iStyle} />
          </div>
        </div>
        <button onClick={save} className="text-xs px-4 py-1.5 rounded-md font-medium"
          style={{ background: saved ? "#10b981" : "#4285F4", color: "#fff" }}>
          {saved ? "✓ Saved" : "Save Goals"}
        </button>
        {(goals.roas ?? goals.cpa ?? goals.monthlyBudget) ? (
          <button onClick={() => { saveGoals({}); onChange({}); setRoas(""); setCpa(""); setBudget(""); }}
            className="text-xs" style={{ color: "var(--text-faint)" }}>Clear</button>
        ) : null}
      </div>
    </div>
  );
}

// Month-to-date budget pacing
function BudgetTracker({ daily, goals }: { daily: Record<string, number>[]; goals: Goals }) {
  const now         = new Date();
  const mtdDays     = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthStr    = now.toISOString().slice(0, 7);

  const mtdSpend = useMemo(
    () => daily.filter((d) => String(d.date ?? "").startsWith(monthStr)).reduce((s, d) => s + (d.spend ?? 0), 0),
    [daily, monthStr]
  );

  const dailyAvg    = mtdDays  > 0 ? mtdSpend / mtdDays : 0;
  const projected   = dailyAvg * daysInMonth;
  const budget      = goals.monthlyBudget ?? 0;
  const pacing      = budget > 0 ? (projected / budget) * 100 : null;
  const pacingColor = (pacing ?? 0) > 110 ? "#ef4444" : (pacing ?? 0) > 90 ? "#fbbf24" : "#4285F4";

  return (
    <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>📅 Month-to-Date Budget</h3>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>MTD Spend</p>
          <p className="text-lg font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{fmt(mtdSpend)}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Avg / Day</p>
          <p className="text-lg font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{fmt(dailyAvg)}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Projected Month</p>
          <p className="text-lg font-semibold mt-0.5"
            style={{ color: budget > 0 && projected > budget * 1.1 ? "#ef4444" : budget > 0 && projected > budget * 0.9 ? "#fbbf24" : "var(--text-primary)" }}>
            {fmt(projected)}
          </p>
        </div>
      </div>
      {budget > 0 ? (
        <>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Budget utilisation</span>
            <span className="text-xs font-medium" style={{ color: pacingColor }}>{(pacing ?? 0).toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: "var(--bg-subtle)" }}>
            <div className="h-2 rounded-full" style={{ width: `${Math.min(pacing ?? 0, 100)}%`, background: pacingColor }} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Day {mtdDays} of {daysInMonth}</span>
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Budget: {fmt(budget)}</span>
          </div>
        </>
      ) : (
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>Set a monthly budget goal above to track pacing.</p>
      )}
    </div>
  );
}

// Change log for tracking actions taken in Google Ads Manager
function ChangeLogSection() {
  const [log,      setLog]      = useState<ChangeEntry[]>([]);
  const [note,     setNote]     = useState("");
  const [campaign, setCampaign] = useState("");

  useEffect(() => { setLog(readLog()); }, []);

  function addEntry() {
    if (!note.trim()) return;
    const entry: ChangeEntry = {
      id: String(Date.now()), ts: Date.now(),
      campaignName: campaign.trim() || undefined,
      note: note.trim(), applied: false,
    };
    const newLog = [entry, ...log].slice(0, 50);
    saveLog(newLog); setLog(newLog);
    setNote(""); setCampaign("");
  }

  function toggle(id: string) {
    const newLog = log.map((e) => e.id === id ? { ...e, applied: !e.applied } : e);
    saveLog(newLog); setLog(newLog);
  }

  function remove(id: string) {
    const newLog = log.filter((e) => e.id !== id);
    saveLog(newLog); setLog(newLog);
  }

  const iStyle = {
    background: "var(--bg-subtle)", border: "1px solid var(--border)",
    color: "var(--text-primary)", outline: "none",
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-4" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>📋 Change Log</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>Track changes you apply in Google Ads Manager</p>
      </div>
      <div className="px-5 py-4" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <input value={campaign} onChange={(e) => setCampaign(e.target.value)}
            placeholder="Campaign (optional)" className="w-40 text-xs px-2.5 py-1.5 rounded" style={iStyle} />
          <input value={note} onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
            placeholder="What did you change? e.g. Reduced daily budget 30%"
            className="flex-1 text-xs px-2.5 py-1.5 rounded" style={iStyle} />
          <button onClick={addEntry} disabled={!note.trim()}
            className="text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-40"
            style={{ background: "#4285F4", color: "#fff" }}>
            + Log
          </button>
        </div>
      </div>
      <div style={{ background: "var(--bg-card)" }}>
        {log.length === 0 ? (
          <div className="py-8 text-center text-xs" style={{ color: "var(--text-faint)" }}>
            No changes logged yet. Record actions you take in Google Ads Manager here.
          </div>
        ) : log.map((entry, i) => (
          <div key={entry.id} className="px-5 py-3 flex items-start gap-3"
            style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined, opacity: entry.applied ? 0.6 : 1 }}>
            <button onClick={() => toggle(entry.id)}
              className="w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center"
              style={{ background: entry.applied ? "#4285F4" : "transparent", border: `1px solid ${entry.applied ? "#4285F4" : "var(--border)"}` }}>
              {entry.applied && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
            </button>
            <div className="flex-1 min-w-0">
              {entry.campaignName && (
                <p className="text-xs font-medium mb-0.5 truncate" style={{ color: "#4285F4" }}>{entry.campaignName}</p>
              )}
              <p className="text-xs" style={{ color: entry.applied ? "var(--text-faint)" : "var(--text-primary)", textDecoration: entry.applied ? "line-through" : "none" }}>
                {entry.note}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{timeAgo(entry.ts)}</p>
            </div>
            <button onClick={() => remove(entry.id)} className="text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function GoogleAdsView({ connected }: { connected: boolean }) {
  const [tab,       setTab]       = useState<InnerTab>("overview");
  const [dateRange, setDateRange] = useState<DateRange>(() => defaultDateRange("30d"));
  const [data,      setData]      = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [goals,   setGoals]   = useState<Goals>({});

  useEffect(() => { setGoals(readGoals()); }, []);

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/google/stats?since=${dateRange.since}&until=${dateRange.until}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [connected, dateRange]);

  useEffect(() => { load(); }, [load]);

  if (!connected) return <ConnectCard platform="google" />;

  const a:         Record<string, number>   = data?.account     ?? {};
  const prev:      Record<string, number>   = data?.prevAccount ?? {};
  const campaigns: Record<string, any>[]    = data?.campaigns   ?? [];
  const daily:     Record<string, number>[] = data?.daily       ?? [];

  const roasColor = goals.roas
    ? ((a.roas ?? 0) >= goals.roas ? "#10b981" : (a.roas ?? 0) > 0 ? "#ef4444" : "var(--text-faint)")
    : (a.roas ?? 0) >= 2 ? "#10b981" : (a.roas ?? 0) >= 1 ? "#fbbf24" : "#ef4444";

  const cpaColor = goals.cpa
    ? ((a.costPerConv ?? 0) > 0 && (a.costPerConv ?? 0) <= goals.cpa ? "#10b981" : (a.costPerConv ?? 0) > 0 ? "#ef4444" : "var(--text-primary)")
    : "var(--text-primary)";

  const TABS: { id: InnerTab; label: string }[] = [
    { id: "overview",    label: "📊 Overview"    },
    { id: "campaigns",   label: "📋 Campaigns"   },
    { id: "performance", label: "📈 Performance" },
    { id: "optimise",    label: "🎯 Optimise"    },
  ];

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} accentColor="#4285F4" />
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                data-active={tab === t.id ? "true" : "false"}
                className="tab-btn text-xs px-3 py-1.5 rounded-md font-medium"
                style={{ background: tab === t.id ? "#1e1e30" : "transparent", color: tab === t.id ? "#a5b4fc" : "var(--text-muted)" }}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="btn-icon text-xs px-3 py-1.5 rounded-md disabled:opacity-50"
            style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px solid #3730a3" }}>
            {loading ? "…" : "↻"}
          </button>
          <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer"
            className="btn-icon text-xs px-3 py-1.5 rounded-md font-medium"
            style={{ background: "#4285F420", color: "#4285F4", border: "1px solid #4285F440" }}>
            Google Ads ↗
          </a>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl p-4 mb-5" style={{ background: "#ef444415", border: "1px solid #ef444440" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "#ef4444" }}>Google Ads API Error</p>
          <p className="text-xs font-mono" style={{ color: "#ef4444", opacity: 0.8 }}>{error}</p>
          {error.includes("not approved") && (
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Basic Access application in review — typically approved within 3 business days.
            </p>
          )}
        </div>
      )}

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <>
          {daily.length > 0 && (
            <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <DualChart daily={daily} label={dateRange.label} />
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 mb-4">
            <KpiCard label="Total Spend"  value={fmt(a.spend ?? 0)} icon="💸" sub={dateRange.label}
              change={pct(a.spend ?? 0, prev.spend ?? 0)} invert />
            <KpiCard label="ROAS"         value={(a.roas ?? 0).toFixed(2) + "×"} icon="💰" color={roasColor}
              sub={goals.roas ? `Goal: ${goals.roas}×` : fmt(a.conversionValue ?? 0) + " value"}
              change={pct(a.roas ?? 0, prev.roas ?? 0)} />
            <KpiCard label="Conversions"  value={(a.conversions ?? 0).toFixed(1)} icon="✅"
              change={pct(a.conversions ?? 0, prev.conversions ?? 0)} />
            <KpiCard label="Conv. Value"  value={fmt(a.conversionValue ?? 0)} icon="🛒"
              change={pct(a.conversionValue ?? 0, prev.conversionValue ?? 0)} />
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <KpiCard label="Impressions"  value={fmtK(a.impressions ?? 0)} icon="👁"
              change={pct(a.impressions ?? 0, prev.impressions ?? 0)} />
            <KpiCard label="Clicks"       value={fmtK(a.clicks ?? 0)} icon="🖱️"
              change={pct(a.clicks ?? 0, prev.clicks ?? 0)} />
            <KpiCard label="CTR"          value={(a.ctr ?? 0).toFixed(2) + "%"} icon="📈"
              sub={(a.ctr ?? 0) > 2 ? "Above average" : ""}
              change={pct(a.ctr ?? 0, prev.ctr ?? 0)} color={(a.ctr ?? 0) > 3 ? "#10b981" : undefined} />
            <KpiCard label="Avg CPC"      value={fmt(a.avgCpc ?? 0)} icon="🎯"
              change={pct(a.avgCpc ?? 0, prev.avgCpc ?? 0)} invert />
          </div>

          <div className="grid grid-cols-4 gap-4 mb-5">
            <KpiCard label="Cost / Conv." value={(a.costPerConv ?? 0) > 0 ? fmt(a.costPerConv) : "—"} icon="📊"
              color={cpaColor} sub={goals.cpa ? `Goal: ${fmt(goals.cpa)}` : undefined}
              change={pct(a.costPerConv ?? 0, prev.costPerConv ?? 0)} invert />
            <KpiCard label="Conv. Rate"
              value={(a.clicks ?? 0) > 0 ? (((a.conversions ?? 0) / (a.clicks ?? 1)) * 100).toFixed(2) + "%" : "—"}
              icon="⚡"
              change={pct(
                (a.clicks ?? 0) > 0 ? (a.conversions ?? 0) / (a.clicks ?? 1) : 0,
                (prev.clicks ?? 0) > 0 ? (prev.conversions ?? 0) / (prev.clicks ?? 1) : 0
              )} />
            <KpiCard label="Active Campaigns"
              value={campaigns.filter((c) => c.status === "ENABLED").length + " active"}
              icon="📡" sub={`${campaigns.length} total`} />
            <KpiCard label="Avg Conv. Val"
              value={(a.conversions ?? 0) > 0 ? fmt((a.conversionValue ?? 0) / (a.conversions ?? 1)) : "—"}
              icon="💎"
              change={pct(
                (a.conversions ?? 0) > 0 ? (a.conversionValue ?? 0) / (a.conversions ?? 1) : 0,
                (prev.conversions ?? 0) > 0 ? (prev.conversionValue ?? 0) / (prev.conversions ?? 1) : 0
              )} />
          </div>

          {data && !error && <AuditFlags account={a} campaigns={campaigns} />}
          {campaigns.length > 0 && <TypeBreakdown campaigns={campaigns} />}
        </>
      )}

      {/* ══ CAMPAIGNS ═════════════════════════════════════════════════════════ */}
      {tab === "campaigns" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Campaigns</h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "var(--text-muted)" }}>{campaigns.length}</span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>Click column headers to sort</p>
          </div>
          {loading && !data
            ? <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading…</div>
            : <CampaignTable campaigns={campaigns} />
          }
        </div>
      )}

      {/* ══ PERFORMANCE ═══════════════════════════════════════════════════════ */}
      {tab === "performance" && (
        <>
          {daily.length > 0 && (
            <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <DualChart daily={daily} label={dateRange.label} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-5">
            <DayParting daily={daily} />
            <ConvFunnel account={a} />
          </div>

          {campaigns.length > 0 && <TypeBreakdown campaigns={campaigns} />}

          {campaigns.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>CTR by Campaign Type</h3>
              <div className="space-y-3">
                {Array.from(
                  campaigns.reduce<Map<string, { impr: number; clicks: number }>>((m, c) => {
                    const t = String(c.channelType ?? "UNKNOWN");
                    if (!m.has(t)) m.set(t, { impr: 0, clicks: 0 });
                    const v = m.get(t)!;
                    v.impr   += c.impressions ?? 0;
                    v.clicks += c.clicks      ?? 0;
                    return m;
                  }, new Map())
                ).map(([type, v]) => {
                  const cfg       = channelCfg(type);
                  const ctr       = v.impr > 0 ? (v.clicks / v.impr) * 100 : 0;
                  const benchmark = CTR_BENCHMARK[type] ?? 1.0;
                  const good      = ctr >= benchmark;
                  const barW      = Math.min((ctr / Math.max(benchmark * 2, ctr + 0.1)) * 100, 100);
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs flex items-center gap-1.5">
                          <span>{cfg.icon}</span>
                          <span style={{ color: "var(--text-secondary)" }}>{cfg.label}</span>
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Benchmark: {benchmark}%</span>
                          <span className="text-xs font-medium" style={{ color: good ? "#10b981" : "#fbbf24" }}>{ctr.toFixed(2)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--bg-subtle)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${barW}%`, background: good ? cfg.color : "#fbbf24" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ OPTIMISE ══════════════════════════════════════════════════════════ */}
      {tab === "optimise" && (
        <>
          <GoalsSection goals={goals} onChange={setGoals} />
          <BudgetTracker daily={daily} goals={goals} />
          <RecommendationsPanel account={a} campaigns={campaigns} goals={goals} />
          <ChangeLogSection />
        </>
      )}
    </div>
  );
}
