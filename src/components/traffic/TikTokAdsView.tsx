"use client";
import { useState, useEffect, useCallback } from "react";
import ConnectCard from "./ConnectCard";
import SpendChart from "./SpendChart";

// ─── Types ────────────────────────────────────────────────────────────────────
type InnerTab = "reporting" | "management";
type Priority = "high" | "medium" | "low";
type RecType  = "pause" | "refresh_creative" | "budget_increase" | "budget_decrease" | "review_audience" | "investigate";

type Rec = {
  id:          string;
  priority:    Priority;
  type:        RecType;
  entity:      "campaign" | "account";
  entityId?:   string;
  entityName?: string;
  title:       string;
  reason:      string;
  action:      string;
};

type AuditStore = { ts: number; recs: Rec[] };
type Goals      = { roas?: number; cpa?: number };

// ─── Constants ────────────────────────────────────────────────────────────────
const AUDIT_KEY = "tiktok_audit_v1";
const GOALS_KEY = "tiktok_goals";
const AUDIT_TTL = 7 * 24 * 60 * 60 * 1000;

const DAY_OPTIONS = [7, 30, 90];

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  high:   { label: "High",   color: "#ef4444", bg: "#ef444418", dot: "🔴" },
  medium: { label: "Medium", color: "#fbbf24", bg: "#fbbf2418", dot: "🟡" },
  low:    { label: "Low",    color: "#10b981", bg: "#10b98118", dot: "🟢" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ENABLE:  { bg: "#10b98120", text: "#10b981" },
  DISABLE: { bg: "#f59e0b20", text: "#fbbf24" },
  DELETE:  { bg: "#ef444420", text: "#ef4444" },
};

const OBJECTIVE_LABEL: Record<string, string> = {
  CONVERSIONS:     "Conversions",
  TRAFFIC:         "Traffic",
  APP_PROMOTION:   "App",
  VIDEO_VIEWS:     "Views",
  REACH:           "Reach",
  LEAD_GENERATION: "Lead Gen",
  CATALOG_SALES:   "Catalog",
  COMMUNITY_INTERACTION: "Community",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return "just now";
}

// ─── localStorage ─────────────────────────────────────────────────────────────
function readGoals(): Goals       { try { return JSON.parse(localStorage.getItem(GOALS_KEY) ?? "{}"); } catch { return {}; } }
function saveGoals(g: Goals)      { localStorage.setItem(GOALS_KEY, JSON.stringify(g)); }
function readAudit(): AuditStore | null { try { const r = localStorage.getItem(AUDIT_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveAudit(a: AuditStore)      { localStorage.setItem(AUDIT_KEY, JSON.stringify(a)); }

// ─── Recommendations engine ───────────────────────────────────────────────────
function generateRecs(account: any, campaigns: any[], goals: Goals): Rec[] {
  const recs: Rec[] = [];
  let id = 0;
  const nid = () => String(++id);

  // Account-level
  if (goals.roas && account.roas > 0 && account.roas < goals.roas) {
    recs.push({ id: nid(), priority: "high", type: "investigate", entity: "account",
      title: "Account ROAS below target",
      reason: `Current ROAS ${account.roas.toFixed(2)}× vs your ${goals.roas}× target.`,
      action: "Review top campaigns and pause or reduce budget on those below break-even." });
  }

  if (account.frequency > 3.5 && account.spend > 0) {
    recs.push({ id: nid(), priority: "high", type: "refresh_creative", entity: "account",
      title: "High ad frequency — audience fatigue",
      reason: `Account frequency is ${account.frequency.toFixed(1)} (recommended: <3.5).`,
      action: "Refresh creatives with new hooks, formats, or expand audience targeting." });
  }

  if (goals.cpa && account.costPerConversion > 0 && account.costPerConversion > goals.cpa * 1.5) {
    recs.push({ id: nid(), priority: "high", type: "review_audience", entity: "account",
      title: "CPA significantly above target",
      reason: `Account CPA ${fmt(account.costPerConversion)} is ${((account.costPerConversion / goals.cpa - 1) * 100).toFixed(0)}% above your ${fmt(goals.cpa)} target.`,
      action: "Narrow interest targeting or switch to value-based bidding (Lowest CPA)." });
  }

  // Campaign-level
  for (const c of campaigns) {
    const active = c.status === "ENABLE";

    // Spending without conversions
    if (active && c.spend > 20 && c.conversions === 0) {
      recs.push({ id: nid(), priority: "high", type: "pause", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: "Spending without conversions",
        reason: `"${c.name}" spent ${fmt(c.spend)} with zero conversions.`,
        action: "Pause and review pixel events, landing page CRO, and audience match quality." });
    }

    // Sub-1 ROAS
    if (active && c.spend > 30 && c.roas > 0 && c.roas < 1) {
      recs.push({ id: nid(), priority: "high", type: "budget_decrease", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: "Below break-even ROAS",
        reason: `"${c.name}" ROAS is ${c.roas.toFixed(2)}× — losing money.`,
        action: "Reduce budget by 30-50% and test a new creative with a stronger offer." });
    }

    // Low VTR (video view-through rate) — watched2s / impressions
    const vtr = c.impressions > 0 ? (c.watched2s / c.impressions) * 100 : 0;
    if (active && c.impressions > 500 && vtr < 20) {
      recs.push({ id: nid(), priority: "medium", type: "refresh_creative", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: "Low video hook rate (<20%)",
        reason: `"${c.name}" 2s VTR is ${vtr.toFixed(1)}% — most users scroll past within 2 seconds.`,
        action: "Test a new creative hook: start with movement, bold text overlay, or a direct question." });
    }

    // High frequency
    if (active && c.frequency > 3.5 && c.spend > 10) {
      recs.push({ id: nid(), priority: "medium", type: "refresh_creative", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: "Creative fatigue — high frequency",
        reason: `"${c.name}" frequency is ${c.frequency.toFixed(1)}. Audience has seen this ad many times.`,
        action: "Duplicate the ad set with a fresh creative variant." });
    }

    // Active but $0 spend
    if (active && c.spend === 0) {
      recs.push({ id: nid(), priority: "medium", type: "investigate", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: "Enabled campaign not spending",
        reason: `"${c.name}" is enabled but has $0 spend this period.`,
        action: "Check bid strategy, daily budget, ad review status, and audience size in TikTok Ads Manager." });
    }

    // Below ROAS goal but has conversions
    if (goals.roas && active && c.roas > 0 && c.roas < goals.roas && c.spend > 20 && c.conversions > 0) {
      recs.push({ id: nid(), priority: "medium", type: "review_audience", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: "Below ROAS target",
        reason: `"${c.name}" at ${c.roas.toFixed(2)}× vs your ${goals.roas}× target.`,
        action: "Test Broad Match audience with Smart Creative to let TikTok's algorithm find converters." });
    }

    // Scale winner
    if (active && c.roas >= 3 && c.spend > 20) {
      recs.push({ id: nid(), priority: "low", type: "budget_increase", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: "Scale winner",
        reason: `"${c.name}" is at ${c.roas.toFixed(2)}× ROAS — strong efficiency.`,
        action: "Increase daily budget by 20% in TikTok Ads Manager. Avoid >50% jumps to protect algorithm learning." });
    }
  }

  const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
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
        <span>{icon}</span>
      </div>
      <p className="text-xl font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      <div className="flex items-center justify-between mt-1 min-h-[16px]">
        {sub && <p className="text-xs" style={{ color: "var(--text-faint)" }}>{sub}</p>}
        <ChangeBadge change={change ?? null} invert={invert} />
      </div>
    </div>
  );
}

// ─── Audit flags ──────────────────────────────────────────────────────────────
function AuditFlags({ account, campaigns }: { account: any; campaigns: any[] }) {
  type Flag = { severity: "warn" | "danger"; msg: string; detail?: string };
  const flags: Flag[] = [];

  const noConv = campaigns.filter((c) => c.spend > 10 && c.conversions === 0 && c.status === "ENABLE");
  if (noConv.length)
    flags.push({ severity: "danger", msg: `${noConv.length} campaign${noConv.length > 1 ? "s" : ""} spending without conversions`, detail: noConv.map((c) => c.name).join(", ") });

  const subBE = campaigns.filter((c) => c.spend > 20 && c.roas > 0 && c.roas < 1);
  if (subBE.length)
    flags.push({ severity: "warn", msg: `${subBE.length} campaign${subBE.length > 1 ? "s" : ""} below break-even ROAS`, detail: subBE.map((c) => `${c.name} (${c.roas.toFixed(2)}×)`).join(", ") });

  const lowVtr = campaigns.filter((c) => {
    const vtr = c.impressions > 0 ? (c.watched2s / c.impressions) * 100 : 0;
    return c.impressions > 500 && vtr < 20 && c.status === "ENABLE";
  });
  if (lowVtr.length)
    flags.push({ severity: "warn", msg: `${lowVtr.length} campaign${lowVtr.length > 1 ? "s" : ""} with low hook rate (<20% VTR)`, detail: lowVtr.map((c) => c.name).join(", ") });

  if (account.frequency > 3.5 && account.spend > 0)
    flags.push({ severity: "warn", msg: `Account frequency ${account.frequency.toFixed(1)} — audience fatigue risk` });

  if (!flags.length) {
    return (
      <div className="rounded-xl p-4 mb-5 flex items-center gap-3" style={{ background: "#10b98110", border: "1px solid #10b98130" }}>
        <span>✅</span>
        <p className="text-sm" style={{ color: "#10b981" }}>No issues detected</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl mb-5 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <span>⚠️</span>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Audit Flags</h3>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#ef444420", color: "#ef4444" }}>{flags.length}</span>
      </div>
      <div style={{ background: "var(--bg-card-inner)" }}>
        {flags.map((f, i) => (
          <div key={i} className="px-5 py-3 flex items-start gap-3"
            style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}>
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

// ─── Recommendations panel ────────────────────────────────────────────────────
function RecommendationsPanel({ account, campaigns, goals }: {
  account: any; campaigns: any[]; goals: Goals;
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

  return (
    <div className="rounded-xl mb-6 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4"
        style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="text-base">🧠</span>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Account Recommendations</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
              {audit ? `Last generated ${timeAgo(audit.ts)}` : "Not yet generated"}
              {isStale && audit && <span style={{ color: "#fbbf24" }}> · Due for refresh</span>}
            </p>
          </div>
          {recs.length > 0 && (
            <div className="flex items-center gap-2 ml-2">
              {highs > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#ef444420", color: "#ef4444" }}>{highs} high</span>}
              {meds  > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#fbbf2420", color: "#fbbf24" }}>{meds} medium</span>}
              {lows  > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#10b98120", color: "#10b981" }}>{lows} low</span>}
            </div>
          )}
        </div>
        <button onClick={generate} disabled={!hasData}
          className="text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-40"
          style={{ background: isStale ? "#ee1d52" : "#1e1e30", color: "#fff", border: "1px solid #ee1d5260" }}>
          {isStale ? "Generate Report" : "↻ Refresh"}
        </button>
      </div>

      {!audit ? (
        <div className="py-10 text-center" style={{ background: "var(--bg-card-inner)" }}>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
            {hasData ? "Click Generate Report to analyse your account." : "Load data first."}
          </p>
          {hasData && (
            <button onClick={generate} className="text-xs px-4 py-2 rounded-lg font-medium" style={{ background: "#ee1d52", color: "#fff" }}>
              Generate Report
            </button>
          )}
        </div>
      ) : recs.length === 0 ? (
        <div className="py-8 px-5 flex items-center gap-3" style={{ background: "#10b98108" }}>
          <span>✅</span>
          <div>
            <p className="text-sm font-medium" style={{ color: "#10b981" }}>No issues found</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Account looks healthy.</p>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card-inner)" }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: "#ee1d5208", borderBottom: "1px solid var(--border-subtle)" }}>
            <span style={{ color: "#ee1d52", fontSize: 12 }}>ℹ</span>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Apply budget/status changes in{" "}
              <a href="https://ads.tiktok.com" target="_blank" rel="noopener noreferrer" style={{ color: "#ee1d52" }}>TikTok Ads Manager</a>.
              Creative changes can be made by duplicating the ad group with new creative.
            </p>
          </div>
          {recs.map((rec, i) => {
            const cfg = PRIORITY_CFG[rec.priority];
            return (
              <div key={rec.id} className="px-5 py-4 flex items-start gap-4"
                style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}>
                <div className="flex-shrink-0 mt-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium block whitespace-nowrap"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.dot} {cfg.label}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{rec.title}</p>
                  {rec.entityName && (
                    <p className="text-xs mb-1" style={{ color: "var(--text-faint)" }}>Campaign: {rec.entityName}</p>
                  )}
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{rec.reason}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: "#ee1d52" }}>→</span>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{rec.action}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Goals section ────────────────────────────────────────────────────────────
function GoalsSection({ goals, onChange }: { goals: Goals; onChange: (g: Goals) => void }) {
  const [roas,  setRoas]  = useState(String(goals.roas ?? ""));
  const [cpa,   setCpa]   = useState(String(goals.cpa  ?? ""));
  const [saved, setSaved] = useState(false);

  useEffect(() => { setRoas(String(goals.roas ?? "")); setCpa(String(goals.cpa ?? "")); }, [goals]);

  function save() {
    const g: Goals = { roas: roas ? parseFloat(roas) : undefined, cpa: cpa ? parseFloat(cpa) : undefined };
    saveGoals(g); onChange(g);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid #ee1d5230" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>🎯 Performance Goals</h3>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label className="text-xs block mb-1.5" style={{ color: "var(--text-muted)" }}>Target ROAS</label>
          <div className="flex items-center gap-1">
            <input value={roas} onChange={(e) => setRoas(e.target.value)} placeholder="e.g. 3.0"
              className="w-24 text-xs px-2 py-1.5 rounded"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }} />
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>×</span>
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1.5" style={{ color: "var(--text-muted)" }}>Target CPA</label>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>$</span>
            <input value={cpa} onChange={(e) => setCpa(e.target.value)} placeholder="e.g. 25.00"
              className="w-24 text-xs px-2 py-1.5 rounded"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }} />
          </div>
        </div>
        <button onClick={save} className="text-xs px-4 py-1.5 rounded-md font-medium"
          style={{ background: saved ? "#10b981" : "#ee1d52", color: "#fff", transition: "background 0.2s" }}>
          {saved ? "✓ Saved" : "Save Goals"}
        </button>
        {(goals.roas || goals.cpa) && (
          <button onClick={() => { saveGoals({}); onChange({}); setRoas(""); setCpa(""); }}
            className="text-xs" style={{ color: "var(--text-faint)" }}>Clear</button>
        )}
      </div>
    </div>
  );
}

// ─── Campaign table ───────────────────────────────────────────────────────────
function CampaignTable({ campaigns }: { campaigns: any[] }) {
  if (campaigns.length === 0) {
    return <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>No campaign data for this period</div>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border-subtle)" }}>
          {["Campaign", "Objective", "Status", "Spend", "Impressions", "2s VTR", "Clicks", "CTR", "Conversions", "ROAS"].map((h) => (
            <th key={h} className="px-4 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {campaigns.map((c: any) => {
          const s   = STATUS_STYLE[c.status] ?? { bg: "#6b728020", text: "var(--text-secondary)" };
          const vtr = c.impressions > 0 ? (c.watched2s / c.impressions) * 100 : 0;
          return (
            <tr key={c.id} style={{ borderTop: "1px solid var(--border-subtle)" }} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-3"><p className="font-medium truncate max-w-[140px]" style={{ color: "var(--text-primary)" }} title={c.name}>{c.name}</p></td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#ee1d5220", color: "#ee1d52" }}>{OBJECTIVE_LABEL[c.objectiveType] ?? c.objectiveType}</span></td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: s.bg, color: s.text }}>{c.status === "ENABLE" ? "active" : c.status.toLowerCase()}</span></td>
              <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{fmt(c.spend)}</td>
              <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{(c.impressions / 1000).toFixed(1)}K</td>
              <td className="px-4 py-3"><span style={{ color: vtr >= 30 ? "#10b981" : vtr >= 20 ? "#fbbf24" : "#ef4444" }}>{vtr.toFixed(1)}%</span></td>
              <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.clicks.toLocaleString()}</td>
              <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.ctr.toFixed(2)}%</td>
              <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.conversions.toFixed(1)}</td>
              <td className="px-4 py-3"><span style={{ color: c.roas >= 2 ? "#10b981" : c.roas >= 1 ? "#fbbf24" : "#ef4444" }}>{c.roas > 0 ? `${c.roas.toFixed(2)}×` : "—"}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
export default function TikTokAdsView({ connected }: { connected: boolean }) {
  const [innerTab, setInnerTab] = useState<InnerTab>("reporting");
  const [days,     setDays]     = useState(30);
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [goals,    setGoals]    = useState<Goals>({});

  useEffect(() => { setGoals(readGoals()); }, []);

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/tiktok/stats?days=${days}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [connected, days]);

  useEffect(() => { load(); }, [load]);

  if (!connected) return <ConnectCard platform="tiktok" />;

  const a:  any   = data?.account     ?? {};
  const campaigns: any[] = data?.campaigns ?? [];
  const daily: any[]     = data?.daily     ?? [];

  const roasColor = goals.roas
    ? (a.roas >= goals.roas ? "#10b981" : a.roas > 0 ? "#ef4444" : "var(--text-faint)")
    : (a.roas ?? 0) >= 2 ? "#10b981" : (a.roas ?? 0) >= 1 ? "#fbbf24" : "#ef4444";

  const cpaColor = goals.cpa
    ? (a.costPerConversion > 0 && a.costPerConversion <= goals.cpa ? "#10b981" : a.costPerConversion > 0 ? "#ef4444" : "var(--text-primary)")
    : "var(--text-primary)";

  const acctVtr = a.impressions > 0 ? (a.watched2s / a.impressions) * 100 : 0;
  const vtrColor = acctVtr >= 30 ? "#10b981" : acctVtr >= 20 ? "#fbbf24" : acctVtr > 0 ? "#ef4444" : "var(--text-primary)";

  return (
    <div>
      {/* ── Top controls ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1">
          {DAY_OPTIONS.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className="text-xs px-3 py-1.5 rounded-md font-medium"
              style={{ background: days === d ? "#1e1e30" : "transparent", color: days === d ? "#a5b4fc" : "var(--text-muted)", border: `1px solid ${days === d ? "#3730a3" : "var(--border)"}` }}>
              {d}d
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-0.5 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {(["reporting", "management"] as InnerTab[]).map((t) => (
              <button key={t} onClick={() => setInnerTab(t)}
                className="text-xs px-3 py-1.5 rounded-md font-medium capitalize"
                style={{ background: innerTab === t ? "#1e1e30" : "transparent", color: innerTab === t ? "#a5b4fc" : "var(--text-muted)" }}>
                {t === "reporting" ? "📊 Reporting" : "⚙️ Management"}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md disabled:opacity-50"
            style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px solid #3730a3" }}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl p-4 mb-5" style={{ background: "#ef444415", border: "1px solid #ef444440" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "#ef4444" }}>TikTok API Error</p>
          <p className="text-xs font-mono" style={{ color: "#ef4444", opacity: 0.8 }}>{error}</p>
        </div>
      )}

      {/* ══════════════ REPORTING TAB ══════════════ */}
      {innerTab === "reporting" && (
        <>
          {daily.length > 0 && (
            <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <SpendChart data={daily} color="#ee1d52" label="Daily Spend — TikTok Ads" />
            </div>
          )}

          {/* Row 1: Spend + core delivery */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <KpiCard label="Total Spend"  value={fmt(a.spend ?? 0)} icon="💸" sub={`last ${days} days`} change={null} invert />
            <KpiCard label="Impressions"  value={((a.impressions ?? 0) / 1000).toFixed(1) + "K"} icon="👁" />
            <KpiCard label="Reach"        value={((a.reach ?? 0) / 1000).toFixed(1) + "K"} icon="🎯" sub={`Freq: ${(a.frequency ?? 0).toFixed(1)}×`} />
            <KpiCard label="Clicks"       value={(a.clicks ?? 0).toLocaleString()} icon="🖱️" />
          </div>

          {/* Row 2: Video + conversion */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            <KpiCard label="2s Hook Rate" value={acctVtr.toFixed(1) + "%"} icon="🎬" color={vtrColor} sub="% who watch 2s+" />
            <KpiCard label="Video Plays"  value={((a.videoPlays ?? 0) / 1000).toFixed(1) + "K"} icon="▶️" sub={`Avg ${(a.avgPlaySec ?? 0).toFixed(0)}s`} />
            <KpiCard label="Conversions"  value={(a.conversions ?? 0).toFixed(1)} icon="✅" sub={`CPA: ${a.costPerConversion > 0 ? fmt(a.costPerConversion) : "—"}`} />
            <KpiCard label="ROAS"         value={(a.roas ?? 0) > 0 ? (a.roas ?? 0).toFixed(2) + "×" : "—"} icon="💰" color={roasColor}
              sub={goals.roas ? `Target ${goals.roas}×` : `${fmt(a.conversionValue ?? 0)} revenue`} />
          </div>

          {data && !error && <AuditFlags account={a} campaigns={campaigns} />}

          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Campaigns</h2>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "var(--text-muted)" }}>{campaigns.length}</span>
              </div>
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>Sorted by spend</span>
            </div>
            {loading && !data
              ? <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading…</div>
              : <CampaignTable campaigns={campaigns} />
            }
          </div>
        </>
      )}

      {/* ══════════════ MANAGEMENT TAB ══════════════ */}
      {innerTab === "management" && (
        <>
          <RecommendationsPanel account={a} campaigns={campaigns} goals={goals} />

          <GoalsSection goals={goals} onChange={setGoals} />

          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Campaign Reference</h2>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "var(--text-muted)" }}>{campaigns.length}</span>
              </div>
              <a href="https://ads.tiktok.com" target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-md font-medium hover:opacity-80"
                style={{ background: "#ee1d5220", color: "#ee1d52", border: "1px solid #ee1d5240" }}>
                Open TikTok Ads Manager →
              </a>
            </div>
            <div className="px-5 py-3 flex items-center gap-2" style={{ background: "#ee1d5208", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "#ee1d52", fontSize: 12 }}>ℹ</span>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                Budget and status changes must be made in TikTok Ads Manager. To refresh a creative, duplicate the ad group with a new video.
              </p>
            </div>
            {loading && !data
              ? <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading…</div>
              : <CampaignTable campaigns={campaigns} />
            }
          </div>
        </>
      )}
    </div>
  );
}
