"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import ConnectCard from "./ConnectCard";
import DateRangePicker, { type DateRange, defaultDateRange } from "./DateRangePicker";

// ─── Types ────────────────────────────────────────────────────────────────────
type InnerTab  = "overview" | "campaigns" | "performance" | "optimise";
type Priority  = "high" | "medium" | "low";
type SortField = "spend" | "impressions" | "clicks" | "ctr" | "conversions" | "roas" | "vtr" | "frequency" | "reach";
type SortDir   = "asc" | "desc";

type Rec = {
  id:          string;
  priority:    Priority;
  type:        "pause" | "refresh_creative" | "budget_increase" | "budget_decrease" | "review_audience" | "investigate";
  entityName?: string;
  title:       string;
  reason:      string;
  action:      string;
};

type Goals       = { roas?: number; cpa?: number; monthlyBudget?: number };
type ChangeEntry = { id: string; ts: number; campaignName?: string; note: string; applied: boolean };
type AuditStore  = { ts: number; recs: Rec[] };

// ─── Constants ────────────────────────────────────────────────────────────────
const AUDIT_KEY = "tiktok_audit_v2";
const GOALS_KEY = "tiktok_goals_v2";
const LOG_KEY   = "tiktok_change_log";
const AUDIT_TTL = 7 * 24 * 60 * 60 * 1000;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const OBJECTIVE_LABEL: Record<string, string> = {
  CONVERSIONS:           "Conversions",
  TRAFFIC:               "Traffic",
  APP_PROMOTION:         "App",
  VIDEO_VIEWS:           "Views",
  REACH:                 "Reach",
  LEAD_GENERATION:       "Lead Gen",
  CATALOG_SALES:         "Catalog",
  COMMUNITY_INTERACTION: "Community",
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ENABLE:  { bg: "#10b98120", text: "#10b981" },
  DISABLE: { bg: "#f59e0b20", text: "#fbbf24" },
  DELETE:  { bg: "#ef444420", text: "#ef4444" },
};

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string }> = {
  high:   { label: "High",   color: "#ef4444", bg: "#ef444418" },
  medium: { label: "Medium", color: "#fbbf24", bg: "#fbbf2418" },
  low:    { label: "Low",    color: "#10b981", bg: "#10b98118" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function vtr(c: Record<string, number>) {
  return c.impressions > 0 ? (c.watched2s / c.impressions) * 100 : 0;
}

// ─── localStorage ─────────────────────────────────────────────────────────────
function readGoals():              Goals           { try { return JSON.parse(localStorage.getItem(GOALS_KEY) ?? "{}"); } catch { return {}; } }
function saveGoals(g: Goals)                       { localStorage.setItem(GOALS_KEY, JSON.stringify(g)); }
function readAudit():              AuditStore|null { try { const r = localStorage.getItem(AUDIT_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveAudit(a: AuditStore)                  { localStorage.setItem(AUDIT_KEY, JSON.stringify(a)); }
function readLog():                ChangeEntry[]   { try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); } catch { return []; } }
function saveLog(l: ChangeEntry[])                 { localStorage.setItem(LOG_KEY, JSON.stringify(l)); }

// ─── Recommendations engine ───────────────────────────────────────────────────
function generateRecs(account: Record<string, number>, campaigns: Record<string, number | string>[], goals: Goals): Rec[] {
  const recs: Rec[] = [];
  let id = 0;
  const nid = () => String(++id);

  if (goals.roas && (account.roas as number) > 0 && (account.roas as number) < goals.roas * 0.8) {
    recs.push({ id: nid(), priority: "high", type: "investigate",
      title: "ROAS significantly below target",
      reason: `Account ROAS ${(account.roas as number).toFixed(2)}× is ${((1 - (account.roas as number) / goals.roas) * 100).toFixed(0)}% below your ${goals.roas}× goal.`,
      action: "Pause campaigns below break-even and shift budget to top-performing creatives." });
  }

  if ((account.frequency as number) > 3.5 && (account.spend as number) > 0) {
    recs.push({ id: nid(), priority: "high", type: "refresh_creative",
      title: "High ad frequency — audience fatigue",
      reason: `Account frequency is ${(account.frequency as number).toFixed(1)} (ideal <3.5).`,
      action: "Refresh creatives with new hooks, formats, or UGC-style content." });
  }

  if (goals.cpa && (account.costPerConversion as number) > 0 && (account.costPerConversion as number) > goals.cpa * 1.5) {
    recs.push({ id: nid(), priority: "high", type: "review_audience",
      title: "CPA 50%+ above target",
      reason: `Account CPA ${fmt(account.costPerConversion as number)} vs your ${fmt(goals.cpa)} target.`,
      action: "Narrow interest targeting or test Broad Match audience with Smart Creative." });
  }

  for (const c of campaigns) {
    const active     = c.status === "ENABLE";
    const campaignVtr = vtr(c as Record<string, number>);

    if (active && (c.spend as number) > 20 && (c.conversions as number) === 0) {
      recs.push({ id: nid(), priority: "high", type: "pause", entityName: c.name as string,
        title: "Spending without conversions",
        reason: `${fmt(c.spend as number)} spent with zero conversions.`,
        action: "Pause and review pixel events, landing page, and audience match quality." });
    }

    if (active && (c.spend as number) > 30 && (c.roas as number) > 0 && (c.roas as number) < 1) {
      recs.push({ id: nid(), priority: "high", type: "budget_decrease", entityName: c.name as string,
        title: "Below break-even ROAS",
        reason: `ROAS is ${(c.roas as number).toFixed(2)}× — losing money on every sale.`,
        action: "Reduce budget by 30-50% and test a new creative with a stronger offer." });
    }

    if (active && (c.impressions as number) > 500 && campaignVtr < 20) {
      recs.push({ id: nid(), priority: "medium", type: "refresh_creative", entityName: c.name as string,
        title: "Low 2-second hook rate (<20%)",
        reason: `2s VTR is ${campaignVtr.toFixed(1)}% — most users scroll past in the first 2 seconds.`,
        action: "Test a new hook: open with movement, bold text overlay, or a direct question." });
    }

    if (active && (c.frequency as number) > 3.5 && (c.spend as number) > 10) {
      recs.push({ id: nid(), priority: "medium", type: "refresh_creative", entityName: c.name as string,
        title: "Creative fatigue — high frequency",
        reason: `Frequency is ${(c.frequency as number).toFixed(1)}. Same audience has seen this ad many times.`,
        action: "Duplicate the ad group with a fresh creative variant." });
    }

    if (active && (c.spend as number) === 0) {
      recs.push({ id: nid(), priority: "medium", type: "investigate", entityName: c.name as string,
        title: "Enabled campaign not spending",
        reason: `Campaign is active but has $0 spend this period.`,
        action: "Check bid strategy, daily budget, ad review status, and audience size in TikTok Ads Manager." });
    }

    if (goals.roas && active && (c.roas as number) > 0 && (c.roas as number) < goals.roas && (c.spend as number) > 20 && (c.conversions as number) > 0) {
      recs.push({ id: nid(), priority: "medium", type: "review_audience", entityName: c.name as string,
        title: "Below ROAS target but converting",
        reason: `${(c.roas as number).toFixed(2)}× vs your ${goals.roas}× target.`,
        action: "Test Broad Match audience with Smart Creative to let TikTok's algorithm optimise." });
    }

    if (active && (c.roas as number) >= 3 && (c.spend as number) > 20) {
      recs.push({ id: nid(), priority: "low", type: "budget_increase", entityName: c.name as string,
        title: "Scale winner",
        reason: `${(c.roas as number).toFixed(2)}× ROAS — strong efficiency.`,
        action: "Increase daily budget by 20% in TikTok Ads Manager. Avoid >50% jumps to protect algorithm learning." });
    }
  }

  const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 15);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, change, invert }: {
  label: string; value: string; sub?: string; icon: string;
  color?: string; change?: number | null; invert?: boolean;
}) {
  const hasChange = change !== null && change !== undefined && Math.abs(change) >= 0.5;
  const good = invert ? (change ?? 0) < 0 : (change ?? 0) > 0;
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
        <span className="text-sm">{icon}</span>
      </div>
      <p className="text-xl font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      <div className="flex items-center justify-between mt-1 min-h-[16px]">
        {sub && <p className="text-xs" style={{ color: "var(--text-faint)" }}>{sub}</p>}
        {hasChange && (
          <span className="text-xs font-medium" style={{ color: good ? "#10b981" : "#ef4444" }}>
            {(change ?? 0) > 0 ? "↑" : "↓"} {Math.abs(change ?? 0).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// Dual chart: spend bars + conversion line
function DualChart({ daily, label }: { daily: Record<string, number | string>[]; label: string }) {
  if (!daily.length) return (
    <div className="h-28 flex items-center justify-center text-xs" style={{ color: "var(--text-faint)" }}>
      No daily data for this period
    </div>
  );

  const W = 1000, H = 110, PL = 48, PR = 48, PT = 8, PB = 24;
  const cw = W - PL - PR, ch = H - PT - PB;
  const maxSpend = Math.max(...daily.map((d) => d.spend as number), 0.01);
  const maxConv  = Math.max(...daily.map((d) => d.conversions as number), 0.01);
  const barW     = Math.max((cw / daily.length) - 1.5, 2);
  const showEvery = Math.max(Math.ceil(daily.length / 8), 1);
  const total    = daily.reduce((s, d) => s + (d.spend as number), 0);
  const totalConv = daily.reduce((s, d) => s + (d.conversions as number), 0);

  const bx = (i: number) => PL + (cw / daily.length) * i + 0.75;
  const by = (v: number) => PT + ch - (v / maxSpend) * ch;
  const cx = (i: number) => PL + (cw / daily.length) * i + barW / 2;
  const cy = (v: number) => PT + ch - (v / maxConv) * ch;

  const convPath = daily.map((d, i) =>
    `${i === 0 ? "M" : "L"} ${cx(i).toFixed(1)} ${cy(d.conversions as number).toFixed(1)}`
  ).join(" ");

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Daily Performance — {label}
        </span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ background: "#ee1d52", opacity: 0.75 }} />
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Spend ${total.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded" style={{ background: "#10b981" }} />
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
          <text key={`r${i}`} x={W - PR + 4} y={cy(v) + 3.5} textAnchor="start" fontSize={7} fill="#10b98180">
            {v.toFixed(v < 1 ? 1 : 0)}
          </text>
        ))}
        {daily.map((d, i) => {
          const h = Math.max(((d.spend as number) / maxSpend) * ch, (d.spend as number) > 0 ? 1 : 0);
          return <rect key={`b${i}`} x={bx(i)} y={by(d.spend as number)} width={barW} height={h} fill="#ee1d52" opacity={0.7} rx={1} />;
        })}
        {maxConv > 0 && (
          <path d={convPath} fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinejoin="round" />
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

// Objective breakdown
function ObjectiveBreakdown({ campaigns }: { campaigns: Record<string, number | string>[] }) {
  const byObjective = useMemo(() => {
    const map: Record<string, { spend: number; conversions: number; convValue: number; count: number }> = {};
    for (const c of campaigns) {
      const obj = String(c.objectiveType || "OTHER");
      if (!map[obj]) map[obj] = { spend: 0, conversions: 0, convValue: 0, count: 0 };
      map[obj].spend       += (c.spend as number)           ?? 0;
      map[obj].conversions += (c.conversions as number)     ?? 0;
      map[obj].convValue   += (c.conversionValue as number) ?? 0;
      map[obj].count++;
    }
    return Object.entries(map).sort((a, b) => b[1].spend - a[1].spend);
  }, [campaigns]);

  const totalSpend = byObjective.reduce((s, [, v]) => s + v.spend, 0);
  if (!byObjective.length) return null;

  const COLORS = ["#ee1d52", "#ff6b35", "#fbbf24", "#10b981", "#6366f1", "#a78bfa"];

  return (
    <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Campaign Objective Breakdown</h3>
      <div className="flex rounded-full overflow-hidden h-2 mb-4" style={{ background: "#1e1e2e" }}>
        {byObjective.map(([obj, v], i) => {
          const w = totalSpend > 0 ? (v.spend / totalSpend) * 100 : 0;
          return <div key={obj} style={{ width: `${w}%`, background: COLORS[i % COLORS.length] }} title={`${OBJECTIVE_LABEL[obj] ?? obj}: ${fmt(v.spend)}`} />;
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {byObjective.map(([obj, v], i) => {
          const roas     = v.spend > 0 ? v.convValue / v.spend : 0;
          const spendPct = totalSpend > 0 ? (v.spend / totalSpend) * 100 : 0;
          const color    = COLORS[i % COLORS.length];
          return (
            <div key={obj} className="rounded-lg p-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{OBJECTIVE_LABEL[obj] ?? obj}</span>
                <span className="text-xs ml-auto" style={{ color: "var(--text-faint)" }}>{v.count}</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(v.spend)}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>{spendPct.toFixed(0)}% of spend</span>
                {roas > 0 && <span className="text-xs font-medium" style={{ color: roas >= 2 ? "#10b981" : roas >= 1 ? "#fbbf24" : "#ef4444" }}>{roas.toFixed(2)}×</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Day-of-week analysis
function DayParting({ daily }: { daily: Record<string, number | string>[] }) {
  const byDay = useMemo(() => {
    const map: Record<number, { spend: number; conversions: number; days: number }> = {};
    for (let i = 0; i < 7; i++) map[i] = { spend: 0, conversions: 0, days: 0 };
    for (const d of daily) {
      if (!d.date) continue;
      const day = (new Date(String(d.date) + "T00:00:00").getDay() + 6) % 7;
      map[day].spend       += (d.spend as number)       ?? 0;
      map[day].conversions += (d.conversions as number) ?? 0;
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
          <span>Peak spend: <span style={{ color: "#ee1d52" }}>{bestSpendDay.day}</span></span>
          <span>Peak conv: <span style={{ color: "#10b981" }}>{bestConvDay.day}</span></span>
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
                <div className="flex-1 rounded-t-sm" style={{ height: spendH, background: "#ee1d52", opacity: 0.75 }} />
                <div className="flex-1 rounded-t-sm" style={{ height: convH,  background: "#10b981", opacity: 0.75 }} />
              </div>
              <span className="text-xs" style={{ color: isWeekend ? "var(--text-faint)" : "var(--text-muted)" }}>{d.day}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: "#ee1d52" }} />
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Avg Daily Spend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: "#10b981" }} />
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Avg Daily Conversions</span>
        </div>
      </div>
    </div>
  );
}

// Video performance breakdown
function VideoPerformance({ campaigns }: { campaigns: Record<string, number | string>[] }) {
  const sorted = [...campaigns]
    .filter((c) => (c.impressions as number) > 0)
    .sort((a, b) => vtr(b as Record<string, number>) - vtr(a as Record<string, number>));

  if (!sorted.length) return (
    <div className="rounded-xl p-5 text-center text-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-faint)" }}>
      No video data available yet
    </div>
  );

  const maxVtr = Math.max(...sorted.map((c) => vtr(c as Record<string, number>)), 0.01);

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>2-Second Hook Rate by Campaign</h3>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>Target: ≥30%</span>
      </div>
      <div className="space-y-3">
        {sorted.map((c) => {
          const rate  = vtr(c as Record<string, number>);
          const good  = rate >= 30;
          const ok    = rate >= 20;
          const color = good ? "#10b981" : ok ? "#fbbf24" : "#ef4444";
          const barW  = Math.min((rate / Math.max(maxVtr, 35)) * 100, 100);
          return (
            <div key={String(c.id)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs truncate max-w-[220px]" style={{ color: "var(--text-secondary)" }} title={String(c.name)}>{String(c.name)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>{((c.impressions as number) / 1000).toFixed(1)}K impr</span>
                  <span className="text-xs font-semibold" style={{ color }}>{rate.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "var(--bg-subtle)" }}>
                <div className="h-1.5 rounded-full" style={{ width: `${barW}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 flex items-center gap-6" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Strong (≥30%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#fbbf24" }} />
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>OK (20-29%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>{"Needs work (<20%)"}</span>
        </div>
      </div>
    </div>
  );
}

// Audit flags
function AuditFlags({ account, campaigns }: { account: Record<string, number>; campaigns: Record<string, number | string>[] }) {
  type Flag = { severity: "danger" | "warn"; msg: string; detail?: string };
  const flags: Flag[] = [];

  const noConv = campaigns.filter((c) => (c.spend as number) > 10 && (c.conversions as number) === 0 && c.status === "ENABLE");
  if (noConv.length)
    flags.push({ severity: "danger", msg: `${noConv.length} campaign${noConv.length > 1 ? "s" : ""} spending without conversions`, detail: noConv.map((c) => String(c.name)).join(", ") });

  const subBE = campaigns.filter((c) => (c.spend as number) > 20 && (c.roas as number) > 0 && (c.roas as number) < 1);
  if (subBE.length)
    flags.push({ severity: "warn", msg: `${subBE.length} campaign${subBE.length > 1 ? "s" : ""} below break-even ROAS`, detail: subBE.map((c) => `${String(c.name)} (${(c.roas as number).toFixed(2)}×)`).join(", ") });

  const lowVtr = campaigns.filter((c) => (c.impressions as number) > 500 && vtr(c as Record<string, number>) < 20 && c.status === "ENABLE");
  if (lowVtr.length)
    flags.push({ severity: "warn", msg: `${lowVtr.length} campaign${lowVtr.length > 1 ? "s" : ""} with low hook rate (<20% VTR)`, detail: lowVtr.map((c) => String(c.name)).join(", ") });

  if (account.frequency > 3.5 && account.spend > 0)
    flags.push({ severity: "warn", msg: `Account frequency ${(account.frequency ?? 0).toFixed(1)} — audience fatigue risk` });

  if (!flags.length) return (
    <div className="rounded-xl p-4 mb-5 flex items-center gap-3" style={{ background: "#10b98110", border: "1px solid #10b98130" }}>
      <span>✅</span>
      <p className="text-sm" style={{ color: "#10b981" }}>No issues detected — account looks healthy</p>
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

// Sortable campaign table with CSV export
function CampaignTable({ campaigns }: { campaigns: Record<string, number | string>[] }) {
  const [sortField,    setSortField]    = useState<SortField>("spend");
  const [sortDir,      setSortDir]      = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ENABLE" | "DISABLE">("ALL");

  const sorted = useMemo(() => {
    const rows = campaigns.filter((c) => statusFilter === "ALL" || c.status === statusFilter);
    return [...rows].sort((a, b) => {
      let av = (sortField === "vtr" ? vtr(a as Record<string, number>) : (a[sortField] as number)) ?? 0;
      let bv = (sortField === "vtr" ? vtr(b as Record<string, number>) : (b[sortField] as number)) ?? 0;
      const diff = av - bv;
      return sortDir === "desc" ? -diff : diff;
    });
  }, [campaigns, sortField, sortDir, statusFilter]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  }

  function exportCsv() {
    const headers = ["Campaign", "Objective", "Status", "Spend", "Impressions", "Reach", "Freq", "Clicks", "CTR%", "2s VTR%", "Conversions", "CPA", "ROAS"];
    const rows = sorted.map((c) => [
      `"${String(c.name)}"`, OBJECTIVE_LABEL[String(c.objectiveType)] ?? String(c.objectiveType), String(c.status),
      (c.spend as number ?? 0).toFixed(2), String(c.impressions ?? 0), String(c.reach ?? 0),
      (c.frequency as number ?? 0).toFixed(2),
      String(c.clicks ?? 0), (c.ctr as number ?? 0).toFixed(2),
      vtr(c as Record<string, number>).toFixed(2),
      (c.conversions as number ?? 0).toFixed(1), (c.costPerConv as number ?? 0).toFixed(2),
      (c.roas as number ?? 0).toFixed(2),
    ]);
    const csv  = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "tiktok-campaigns.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (!campaigns.length) return (
    <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>
      No campaign data — connect TikTok Ads to see campaigns
    </div>
  );

  const SortTh = ({ field, label }: { field: SortField; label: string }) => (
    <th className="px-3 py-3 text-left font-medium uppercase tracking-wider cursor-pointer select-none"
      style={{ color: sortField === field ? "#ee1d52" : "var(--text-faint)", whiteSpace: "nowrap", fontSize: 10 }}
      onClick={() => toggleSort(field)}>
      {label}{sortField === field ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  const totSpend = sorted.reduce((s, c) => s + (c.spend as number ?? 0), 0);
  const totConv  = sorted.reduce((s, c) => s + (c.conversions as number ?? 0), 0);
  const totVal   = sorted.reduce((s, c) => s + (c.conversionValue as number ?? 0), 0);
  const totRoas  = totSpend > 0 ? totVal / totSpend : 0;
  const avgCpa   = totConv  > 0 ? totSpend / totConv : 0;

  return (
    <div>
      <div className="flex items-center gap-3 px-5 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex gap-1">
          {(["ALL", "ENABLE", "DISABLE"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="text-xs px-2.5 py-1 rounded-md font-medium"
              style={{ background: statusFilter === s ? "#1e1e30" : "transparent", color: statusFilter === s ? "#ee1d52" : "var(--text-muted)", border: `1px solid ${statusFilter === s ? "#ee1d5250" : "var(--border)"}` }}>
              {s === "ALL" ? "All" : s === "ENABLE" ? "Active" : "Paused"}
            </button>
          ))}
        </div>
        <span className="text-xs ml-auto" style={{ color: "var(--text-faint)" }}>{sorted.length} campaigns</span>
        <button onClick={exportCsv} className="text-xs px-3 py-1.5 rounded-md hover:opacity-80"
          style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 960 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="px-3 py-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)", fontSize: 10 }}>Campaign</th>
              <th className="px-3 py-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)", fontSize: 10 }}>Objective</th>
              <th className="px-3 py-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)", fontSize: 10 }}>Status</th>
              <SortTh field="spend"       label="Spend" />
              <SortTh field="impressions" label="Impr." />
              <SortTh field="reach"       label="Reach" />
              <SortTh field="frequency"   label="Freq" />
              <SortTh field="ctr"         label="CTR" />
              <SortTh field="vtr"         label="2s VTR" />
              <SortTh field="conversions" label="Conv." />
              <SortTh field="roas"        label="ROAS" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const s    = STATUS_STYLE[String(c.status)] ?? { bg: "#6b728020", text: "var(--text-secondary)" };
              const rate = vtr(c as Record<string, number>);
              const vtrColor = rate >= 30 ? "#10b981" : rate >= 20 ? "#fbbf24" : rate > 0 ? "#ef4444" : "var(--text-faint)";
              const roasOk   = (c.roas as number ?? 0) >= 2;
              return (
                <tr key={String(c.id)} className="hover:bg-white/[0.02]" style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-3 py-3">
                    <p className="font-medium truncate max-w-[180px]" style={{ color: "var(--text-primary)" }} title={String(c.name)}>{String(c.name)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#ee1d5220", color: "#ee1d52" }}>
                      {OBJECTIVE_LABEL[String(c.objectiveType)] ?? (String(c.objectiveType) || "—")}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.text }}>
                      {c.status === "ENABLE" ? "Active" : c.status === "DISABLE" ? "Paused" : String(c.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{fmt(c.spend as number ?? 0)}</td>
                  <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{fmtK(c.impressions as number ?? 0)}</td>
                  <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{fmtK(c.reach as number ?? 0)}</td>
                  <td className="px-3 py-3" style={{ color: (c.frequency as number ?? 0) > 3.5 ? "#ef4444" : "var(--text-secondary)" }}>
                    {(c.frequency as number ?? 0).toFixed(1)}×
                  </td>
                  <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{(c.ctr as number ?? 0).toFixed(2)}%</td>
                  <td className="px-3 py-3 font-medium" style={{ color: vtrColor }}>{rate.toFixed(1)}%</td>
                  <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{(c.conversions as number ?? 0).toFixed(1)}</td>
                  <td className="px-3 py-3 font-medium" style={{ color: roasOk ? "#10b981" : (c.roas as number ?? 0) >= 1 ? "#fbbf24" : "#ef4444" }}>
                    {(c.roas as number ?? 0) > 0 ? `${(c.roas as number ?? 0).toFixed(2)}×` : "—"}
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
                <td colSpan={5} />
                <td className="px-3 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {totConv.toFixed(1)} · CPA {avgCpa > 0 ? fmt(avgCpa) : "—"}
                </td>
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
  account: Record<string, number>; campaigns: Record<string, number | string>[]; goals: Goals;
}) {
  const [audit, setAudit] = useState<AuditStore | null>(null);
  useEffect(() => { setAudit(readAudit()); }, []);

  const isStale = !audit || (Date.now() - audit.ts) > AUDIT_TTL;
  const hasData = campaigns.length > 0 || account.spend > 0;

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

  const TYPE_ICON: Record<string, string> = {
    pause: "⏸", refresh_creative: "🎬", budget_increase: "📈",
    budget_decrease: "📉", review_audience: "🎯", investigate: "🔍",
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
          style={{ background: isStale ? "#ee1d52" : "#1e1e30", color: "#fff", border: "1px solid #ee1d5240" }}>
          {isStale ? "Generate" : "↻ Refresh"}
        </button>
      </div>

      {!audit ? (
        <div className="py-10 text-center" style={{ background: "var(--bg-card)" }}>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
            {hasData ? "Analyse your account to get targeted recommendations." : "No data — connect TikTok Ads first."}
          </p>
          {hasData && (
            <button onClick={generate} className="text-xs px-4 py-2 rounded-lg font-medium"
              style={{ background: "#ee1d52", color: "#fff" }}>
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
          <div className="px-5 py-2.5" style={{ background: "#ee1d5208", borderBottom: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Apply changes in{" "}
              <a href="https://ads.tiktok.com" target="_blank" rel="noopener noreferrer" style={{ color: "#ee1d52" }}>TikTok Ads Manager</a>.
              Creative changes: duplicate the ad group with a new video.
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
                  <span className="text-xs">{TYPE_ICON[rec.type] ?? "💡"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{rec.title}</p>
                  {rec.entityName && (
                    <p className="text-xs mb-1 font-mono truncate" style={{ color: "#ee1d52" }}>{rec.entityName}</p>
                  )}
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{rec.reason}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "#ee1d52" }}>→ </span>{rec.action}
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
    setRoas(String(goals.roas ?? ""));
    setCpa(String(goals.cpa ?? ""));
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
    <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid #ee1d5230" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>🎯 Performance Goals</h3>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label className="text-xs block mb-1.5" style={{ color: "var(--text-muted)" }}>Target ROAS</label>
          <div className="flex items-center gap-1">
            <input value={roas} onChange={(e) => setRoas(e.target.value)} placeholder="e.g. 3.0"
              className="w-20 text-xs px-2 py-1.5 rounded" style={iStyle} />
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>×</span>
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1.5" style={{ color: "var(--text-muted)" }}>Target CPA</label>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>$</span>
            <input value={cpa} onChange={(e) => setCpa(e.target.value)} placeholder="e.g. 25.00"
              className="w-20 text-xs px-2 py-1.5 rounded" style={iStyle} />
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1.5" style={{ color: "var(--text-muted)" }}>Monthly Budget</label>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>$</span>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 3000"
              className="w-24 text-xs px-2 py-1.5 rounded" style={iStyle} />
          </div>
        </div>
        <button onClick={save} className="text-xs px-4 py-1.5 rounded-md font-medium"
          style={{ background: saved ? "#10b981" : "#ee1d52", color: "#fff" }}>
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

// Budget tracker
function BudgetTracker({ daily, goals }: { daily: Record<string, number | string>[]; goals: Goals }) {
  const now         = new Date();
  const mtdDays     = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthStr    = now.toISOString().slice(0, 7);

  const mtdSpend = useMemo(
    () => daily.filter((d) => String(d.date ?? "").startsWith(monthStr)).reduce((s, d) => s + (d.spend as number ?? 0), 0),
    [daily, monthStr]
  );

  const dailyAvg    = mtdDays  > 0 ? mtdSpend / mtdDays : 0;
  const projected   = dailyAvg * daysInMonth;
  const budget      = goals.monthlyBudget ?? 0;
  const pacingPct   = budget > 0 ? (projected / budget) * 100 : null;
  const pacingColor = (pacingPct ?? 0) > 110 ? "#ef4444" : (pacingPct ?? 0) > 90 ? "#fbbf24" : "#ee1d52";

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
            <span className="text-xs font-medium" style={{ color: pacingColor }}>{(pacingPct ?? 0).toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: "var(--bg-subtle)" }}>
            <div className="h-2 rounded-full" style={{ width: `${Math.min(pacingPct ?? 0, 100)}%`, background: pacingColor }} />
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

// Change log
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
        <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>Track changes you apply in TikTok Ads Manager</p>
      </div>
      <div className="px-5 py-4" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <input value={campaign} onChange={(e) => setCampaign(e.target.value)}
            placeholder="Campaign (optional)" className="w-40 text-xs px-2.5 py-1.5 rounded" style={iStyle} />
          <input value={note} onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
            placeholder="What did you change? e.g. Increased budget 20%"
            className="flex-1 text-xs px-2.5 py-1.5 rounded" style={iStyle} />
          <button onClick={addEntry} disabled={!note.trim()}
            className="text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-40"
            style={{ background: "#ee1d52", color: "#fff" }}>
            + Log
          </button>
        </div>
      </div>
      <div style={{ background: "var(--bg-card)" }}>
        {log.length === 0 ? (
          <div className="py-8 text-center text-xs" style={{ color: "var(--text-faint)" }}>
            No changes logged yet. Record actions you take in TikTok Ads Manager here.
          </div>
        ) : log.map((entry, i) => (
          <div key={entry.id} className="px-5 py-3 flex items-start gap-3"
            style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined, opacity: entry.applied ? 0.6 : 1 }}>
            <button onClick={() => toggle(entry.id)}
              className="w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center"
              style={{ background: entry.applied ? "#ee1d52" : "transparent", border: `1px solid ${entry.applied ? "#ee1d52" : "var(--border)"}` }}>
              {entry.applied && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
            </button>
            <div className="flex-1 min-w-0">
              {entry.campaignName && (
                <p className="text-xs font-medium mb-0.5 truncate" style={{ color: "#ee1d52" }}>{entry.campaignName}</p>
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

// ─── Main view ────────────────────────────────────────────────────────────────
export default function TikTokAdsView({ connected }: { connected: boolean }) {
  const [tab,       setTab]       = useState<InnerTab>("overview");
  const [dateRange, setDateRange] = useState<DateRange>(() => defaultDateRange("30d"));
  const [data,    setData]    = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [goals,   setGoals]   = useState<Goals>({});

  useEffect(() => { setGoals(readGoals()); }, []);

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/tiktok/stats?since=${dateRange.since}&until=${dateRange.until}`);
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

  if (!connected) return <ConnectCard platform="tiktok" />;

  const a         = (data?.account     ?? {}) as Record<string, number>;
  const campaigns = (data?.campaigns   ?? []) as Record<string, number | string>[];
  const daily     = (data?.daily       ?? []) as Record<string, number | string>[];

  const acctVtr  = (a.impressions ?? 0) > 0 ? ((a.watched2s ?? 0) / a.impressions) * 100 : 0;
  const vtrColor = acctVtr >= 30 ? "#10b981" : acctVtr >= 20 ? "#fbbf24" : acctVtr > 0 ? "#ef4444" : "var(--text-primary)";

  const roasColor = goals.roas
    ? ((a.roas ?? 0) >= goals.roas ? "#10b981" : (a.roas ?? 0) > 0 ? "#ef4444" : "var(--text-faint)")
    : (a.roas ?? 0) >= 2 ? "#10b981" : (a.roas ?? 0) >= 1 ? "#fbbf24" : (a.roas ?? 0) > 0 ? "#ef4444" : "var(--text-primary)";

  const cpaColor = goals.cpa
    ? ((a.costPerConversion ?? 0) > 0 && (a.costPerConversion ?? 0) <= goals.cpa ? "#10b981" : (a.costPerConversion ?? 0) > 0 ? "#ef4444" : "var(--text-primary)")
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
        <DateRangePicker value={dateRange} onChange={setDateRange} accentColor="#ee1d52" />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex p-0.5 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                data-active={tab === t.id ? "true" : "false"}
                className="tab-btn text-xs px-3 py-1.5 rounded-md font-medium"
                style={{ background: tab === t.id ? "#1e1e30" : "transparent", color: tab === t.id ? "#ee1d52" : "var(--text-muted)" }}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="btn-icon text-xs px-3 py-1.5 rounded-md disabled:opacity-50"
            style={{ background: "#1e1e30", color: "#ee1d52", border: "1px solid #ee1d5250" }}>
            {loading ? "…" : "↻"}
          </button>
          <a href="https://ads.tiktok.com" target="_blank" rel="noopener noreferrer"
            className="btn-icon text-xs px-3 py-1.5 rounded-md font-medium"
            style={{ background: "#ee1d5220", color: "#ee1d52", border: "1px solid #ee1d5240" }}>
            TikTok Ads ↗
          </a>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 mb-5" style={{ background: "#ef444415", border: "1px solid #ef444440" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "#ef4444" }}>TikTok API Error</p>
          <p className="text-xs font-mono" style={{ color: "#ef4444", opacity: 0.8 }}>{error}</p>
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
            <KpiCard label="Total Spend"  value={`$${(a.spend ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon="💸" sub={dateRange.label} invert />
            <KpiCard label="ROAS"         value={(a.roas ?? 0) > 0 ? `${(a.roas ?? 0).toFixed(2)}×` : "—"} icon="💰" color={roasColor}
              sub={goals.roas ? `Target ${goals.roas}×` : `${(a.conversionValue ?? 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" })} revenue`} />
            <KpiCard label="Conversions"  value={(a.conversions ?? 0).toFixed(1)} icon="✅"
              sub={(a.costPerConversion ?? 0) > 0 ? `CPA: ${fmt(a.costPerConversion)}` : undefined} />
            <KpiCard label="Cost / Conv." value={(a.costPerConversion ?? 0) > 0 ? fmt(a.costPerConversion) : "—"} icon="📊"
              color={cpaColor} sub={goals.cpa ? `Target: ${fmt(goals.cpa)}` : undefined} invert />
          </div>

          <div className="grid grid-cols-4 gap-4 mb-5">
            <KpiCard label="Impressions"  value={fmtK(a.impressions ?? 0)} icon="👁" />
            <KpiCard label="Reach"        value={fmtK(a.reach ?? 0)} icon="🎯" sub={`Freq: ${(a.frequency ?? 0).toFixed(1)}×`} />
            <KpiCard label="2s Hook Rate" value={acctVtr.toFixed(1) + "%"} icon="🎬" color={vtrColor} sub="% who watch ≥2s" />
            <KpiCard label="Avg Watch"    value={`${(a.avgPlaySec ?? 0).toFixed(0)}s`} icon="▶️" sub={`${fmtK(a.videoPlays ?? 0)} plays`} />
          </div>

          {data && !error && <AuditFlags account={a} campaigns={campaigns} />}
          {campaigns.length > 0 && <ObjectiveBreakdown campaigns={campaigns} />}
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
            <VideoPerformance campaigns={campaigns} />
          </div>

          {campaigns.length > 0 && <ObjectiveBreakdown campaigns={campaigns} />}

          {/* Video engagement funnel */}
          {(a.videoPlays ?? 0) > 0 && (
            <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Video Engagement Funnel</h3>
              <div className="space-y-3">
                {[
                  { label: "Video Plays",    value: a.videoPlays    ?? 0, color: "#ee1d52" },
                  { label: "2-Second Views", value: a.watched2s     ?? 0, color: "#fbbf24" },
                  { label: "6-Second Views", value: a.watched6s     ?? 0, color: "#f97316" },
                  { label: "Conversions",    value: a.conversions   ?? 0, color: "#10b981" },
                ].map((s, i, arr) => {
                  const maxVal = arr[0].value || 1;
                  const w    = (s.value / maxVal) * 100;
                  const rate = i > 0 ? (s.value / Math.max(arr[i - 1].value, 1)) * 100 : 100;
                  return (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                        <div className="flex items-center gap-3">
                          {i > 0 && <span className="text-xs" style={{ color: "var(--text-faint)" }}>{rate.toFixed(1)}% of prev</span>}
                          <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{fmtK(s.value)}</span>
                        </div>
                      </div>
                      <div className="h-4 rounded-md" style={{ background: "var(--bg-subtle)" }}>
                        <div className="h-4 rounded-md" style={{ width: `${w}%`, background: s.color, opacity: 0.8 }} />
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
