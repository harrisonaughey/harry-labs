"use client";
import { useState, useEffect, useCallback, Fragment } from "react";
import ConnectCard from "./ConnectCard";
import SpendChart from "./SpendChart";
import AgentInsightsPanel from "./AgentInsightsPanel";
import DateRangePicker, { type DateRange, defaultDateRange } from "./DateRangePicker";

// ─── Types ────────────────────────────────────────────────────────────────────
type InnerTab = "reporting" | "management" | "agent";
type Priority = "high" | "medium" | "low";
type RecType  = "pause" | "budget_increase" | "budget_decrease" | "refresh_creative" | "investigate" | "review_audience";

type Rec = {
  id:          string;
  priority:    Priority;
  type:        RecType;
  entity:      "campaign" | "ad_set" | "account";
  entityId?:   string;
  entityName?: string;
  title:       string;
  reason:      string;
  action:      string;
  actionable?: boolean;
  newBudget?:  number | null;
  currentBudget?: number | null;
  currentStatus?: string;
};

type AuditStore = { ts: number; recs: Rec[] };
type Goals      = { roas?: number; cpa?: number };
type ChangeLogEntry = {
  id: string; ts: number; entityType: string; entityName: string;
  action: string; oldValue: string; newValue: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const AUDIT_KEY = "meta_audit_v2";
const GOALS_KEY = "meta_goals";
const LOG_KEY   = "meta_change_log";
const AUDIT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  high:   { label: "High",   color: "#ef4444", bg: "#ef444418", dot: "🔴" },
  medium: { label: "Medium", color: "#fbbf24", bg: "#fbbf2418", dot: "🟡" },
  low:    { label: "Low",    color: "#10b981", bg: "#10b98118", dot: "🟢" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ACTIVE:  { bg: "#10b98120", text: "#10b981" },
  PAUSED:  { bg: "#f59e0b20", text: "#fbbf24" },
  DELETED: { bg: "#ef444420", text: "#ef4444" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const d    = Math.floor(diff / 86400000);
  const h    = Math.floor(diff / 3600000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return "just now";
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
function readGoals(): Goals      { try { return JSON.parse(localStorage.getItem(GOALS_KEY) ?? "{}"); } catch { return {}; } }
function saveGoals(g: Goals)     { localStorage.setItem(GOALS_KEY, JSON.stringify(g)); }
function readAudit(): AuditStore | null { try { const r = localStorage.getItem(AUDIT_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveAudit(a: AuditStore)      { localStorage.setItem(AUDIT_KEY, JSON.stringify(a)); }
function readLog(): ChangeLogEntry[]   { try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); } catch { return []; } }

function appendLog(entry: Omit<ChangeLogEntry, "id" | "ts">) {
  const log  = readLog();
  const full = { ...entry, id: Math.random().toString(36).slice(2), ts: Date.now() };
  localStorage.setItem(LOG_KEY, JSON.stringify([full, ...log].slice(0, 200)));
}

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
      action: "Review campaigns below target ROAS in the campaign table and reduce budgets on underperformers." });
  }
  if (account.frequency > 3.5) {
    recs.push({ id: nid(), priority: "high", type: "refresh_creative", entity: "account",
      title: "Account-wide audience fatigue",
      reason: `Average frequency ${account.frequency.toFixed(1)}× — audiences are seeing ads too often.`,
      action: "Refresh creatives across all active campaigns or expand lookalike audiences." });
  }
  if (goals.cpa && account.spend > 0 && account.purchases > 0) {
    const cpa = account.spend / account.purchases;
    if (cpa > goals.cpa * 1.5) {
      recs.push({ id: nid(), priority: "high", type: "review_audience", entity: "account",
        title: "CPA significantly above target",
        reason: `Account CPA ${fmt(cpa)} is ${((cpa / goals.cpa - 1) * 100).toFixed(0)}% over your ${fmt(goals.cpa)} target.`,
        action: "Audit audience targeting and bid strategies on campaigns with highest CPA." });
    }
  }

  for (const c of campaigns) {
    const active = c.status === "ACTIVE";

    // Spending with zero purchases (danger)
    if (active && c.spend > 20 && c.purchases === 0) {
      recs.push({ id: nid(), priority: "high", type: "pause", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: `Pause — spending without conversions`,
        reason: `"${c.name}" has spent ${fmt(c.spend)} with zero purchases.`,
        action: "Pause this campaign immediately and review the landing page and offer.",
        actionable: true, currentStatus: "ACTIVE" });
    }

    // Below break-even ROAS with meaningful spend
    if (active && c.spend > 30 && c.roas > 0 && c.roas < 1) {
      recs.push({ id: nid(), priority: "high", type: "budget_decrease", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: `Reduce budget — below break-even`,
        reason: `"${c.name}" ROAS is ${c.roas.toFixed(2)}× — spending ${fmt(c.spend)} to earn ${fmt(c.purchaseValue)}.`,
        action: `Cut daily budget by 50%${c.dailyBudget ? ` (to ${fmt(c.dailyBudget * 0.5)}/day)` : ""} until ROAS improves.`,
        actionable: !!c.dailyBudget, newBudget: c.dailyBudget ? c.dailyBudget * 0.5 : null, currentBudget: c.dailyBudget });
    }

    // High frequency per campaign
    if (active && c.frequency > 3.5) {
      recs.push({ id: nid(), priority: "medium", type: "refresh_creative", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: `Creative fatigue`,
        reason: `"${c.name}" frequency ${c.frequency.toFixed(1)}× — the same people keep seeing this ad.`,
        action: "Expand the audience with broader lookalikes or upload fresh creative variants." });
    }

    // Active but zero spend
    if (active && c.spend === 0) {
      recs.push({ id: nid(), priority: "medium", type: "investigate", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: `Delivery issue — $0 spend`,
        reason: `"${c.name}" is active but not spending. Possible causes: budget exhausted, ad disapproval, or audience too narrow.`,
        action: "Check delivery insights in Meta Ads Manager → this campaign." });
    }

    // Goal miss with real spend
    if (active && goals.roas && c.roas > 0 && c.roas < goals.roas && c.spend > 20 && c.purchases > 0) {
      recs.push({ id: nid(), priority: "medium", type: "review_audience", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: `Below ROAS target`,
        reason: `"${c.name}" is at ${c.roas.toFixed(2)}× vs your ${goals.roas}× target.`,
        action: "A/B test a new creative, refine audience exclusions, or switch bid strategy to cost cap." });
    }

    // Winning campaigns — suggest scaling
    if (active && c.roas >= 3 && c.spend > 20 && c.dailyBudget) {
      recs.push({ id: nid(), priority: "low", type: "budget_increase", entity: "campaign",
        entityId: c.id, entityName: c.name,
        title: `Scale winner`,
        reason: `"${c.name}" is performing at ${c.roas.toFixed(2)}× ROAS — strong efficiency with ${fmt(c.spend)} spend.`,
        action: `Increase daily budget by 20% (to ${fmt(c.dailyBudget * 1.2)}/day) to capture more volume.`,
        actionable: true, newBudget: c.dailyBudget * 1.2, currentBudget: c.dailyBudget });
    }
  }

  const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCsv(campaigns: any[]) {
  const header = ["Name", "Status", "Spend", "Impressions", "Clicks", "CTR%", "CPC", "Frequency", "Purchases", "Revenue", "ROAS"].join(",");
  const rows   = campaigns.map((c) =>
    [c.name, c.status, c.spend.toFixed(2), c.impressions, c.clicks, c.ctr.toFixed(2), c.cpc.toFixed(2), c.frequency.toFixed(2), c.purchases, c.purchaseValue.toFixed(2), c.roas.toFixed(2)].join(",")
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = "meta_campaigns.csv"; a.click();
  URL.revokeObjectURL(url);
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

function KpiCard({ label, value, sub, icon, color, change, invert, alert }: {
  label: string; value: string; sub?: string; icon: string;
  color?: string; change?: number | null; invert?: boolean; alert?: boolean;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: `1px solid ${alert ? "#ef444440" : "var(--border)"}` }}>
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

function EditableValue({ value, onSave }: { value: number | null; onSave: (v: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState("");
  const [saving,  setSaving]  = useState(false);

  if (value === null) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <span style={{ color: "var(--text-faint)", fontSize: 11 }}>$</span>
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              const n = parseFloat(draft);
              if (!isNaN(n) && n > 0) { setSaving(true); await onSave(n); setSaving(false); setEditing(false); }
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-16 text-xs px-1 rounded"
          style={{ background: "var(--bg-subtle)", border: "1px solid #6366f1", color: "var(--text-primary)", outline: "none" }}
          autoFocus />
        {saving && <span style={{ color: "var(--text-faint)", fontSize: 10 }}>…</span>}
      </span>
    );
  }
  return (
    <button onClick={() => { setDraft(value.toFixed(2)); setEditing(true); }} className="text-xs"
      style={{ color: "var(--text-secondary)", cursor: "pointer" }} title="Click to edit">
      ${value.toFixed(2)} <span style={{ color: "var(--text-faint)", fontSize: 10 }}>✏</span>
    </button>
  );
}

function SpendPacing({ monthSpend }: { monthSpend: number }) {
  const now          = new Date();
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth   = now.getDate();
  const pctOfMonth   = dayOfMonth / daysInMonth;
  const projected    = pctOfMonth > 0 ? monthSpend / pctOfMonth : 0;
  const dailyAvg     = dayOfMonth > 0 ? monthSpend / dayOfMonth : 0;

  return (
    <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Budget Pacing — {now.toLocaleString("default", { month: "long" })}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Day {dayOfMonth} of {daysInMonth} · Daily avg {fmt(dailyAvg)} · Projected {fmt(projected)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(monthSpend)}</p>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>MTD spend</p>
        </div>
      </div>
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min((monthSpend / Math.max(projected, 0.01)) * 100, 100)}%`, background: "#6366f1" }} />
        <div className="absolute top-0 h-full w-0.5" style={{ left: `${pctOfMonth * 100}%`, background: "#fbbf24" }} />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>$0</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: "#6366f1" }} /><span className="text-xs" style={{ color: "var(--text-faint)" }}>Actual</span></div>
          <div className="flex items-center gap-1.5"><div className="w-0.5 h-3" style={{ background: "#fbbf24" }} /><span className="text-xs" style={{ color: "var(--text-faint)" }}>Expected pace</span></div>
        </div>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>{fmt(projected)}</span>
      </div>
    </div>
  );
}

function BreakdownPanel({ type, dateParam }: { type: "placement" | "demographic"; dateParam: string }) {
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [open,    setOpen]    = useState(false);

  function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (rows.length) return;
    setLoading(true); setError(null);
    fetch(`/api/meta/breakdown?type=${type}&${dateParam}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setRows(d.rows ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  const label = type === "placement" ? "📍 Placement" : "👥 Demographics";

  return (
    <div className="rounded-xl mb-4 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <button onClick={toggle} className="w-full flex items-center justify-between px-5 py-3 text-left"
        style={{ background: "var(--bg-card)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label} Breakdown</span>
        <span className="text-xs" style={{ color: "var(--text-faint)", transform: open ? "rotate(180deg)" : undefined, display: "inline-block", transition: "transform 0.15s" }}>▾</span>
      </button>
      {open && (
        <div style={{ background: "var(--bg-card-inner)", borderTop: "1px solid var(--border)" }}>
          {loading ? (
            <div className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading…</div>
          ) : error ? (
            <div className="py-4 px-5 text-xs" style={{ color: "#ef4444" }}>{error}</div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-center text-xs" style={{ color: "var(--text-faint)" }}>No data</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border-subtle)" }}>
                  {[type === "placement" ? "Placement" : "Segment", "Spend", "Impressions", "Clicks", "CTR", "CPC", "Purchases", "ROAS"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td className="px-4 py-2 font-medium" style={{ color: "var(--text-primary)" }}>{r.label}</td>
                    <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{fmt(r.spend)}</td>
                    <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{(r.impressions / 1000).toFixed(1)}K</td>
                    <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{r.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{r.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{fmt(r.cpc)}</td>
                    <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{r.purchases}</td>
                    <td className="px-4 py-2"><span style={{ color: r.roas >= 2 ? "#10b981" : r.roas >= 1 ? "#fbbf24" : r.roas > 0 ? "#ef4444" : "var(--text-faint)" }}>{r.roas > 0 ? `${r.roas.toFixed(2)}×` : "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Recommendations Panel ────────────────────────────────────────────────────
function RecommendationsPanel({
  account, campaigns, goals,
  onAction,
}: {
  account: any; campaigns: any[]; goals: Goals;
  onAction: (rec: Rec) => Promise<void>;
}) {
  const [audit,    setAudit]    = useState<AuditStore | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => { setAudit(readAudit()); }, []);

  const isStale  = !audit || (Date.now() - audit.ts) > AUDIT_TTL;
  const hasData  = campaigns.length > 0 || account.spend > 0;

  function generate() {
    if (!hasData) return;
    const recs  = generateRecs(account, campaigns, goals);
    const store = { ts: Date.now(), recs };
    saveAudit(store);
    setAudit(store);
  }

  // Auto-generate if no audit exists and we have data
  useEffect(() => {
    if (!audit && hasData) generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData]);

  async function applyRec(rec: Rec) {
    setApplying(rec.id);
    await onAction(rec);
    // Mark as applied in the audit store
    if (audit) {
      const updated = { ...audit, recs: audit.recs.filter((r) => r.id !== rec.id) };
      saveAudit(updated);
      setAudit(updated);
    }
    setApplying(null);
  }

  const recs   = audit?.recs ?? [];
  const highs  = recs.filter((r) => r.priority === "high").length;
  const meds   = recs.filter((r) => r.priority === "medium").length;
  const lows   = recs.filter((r) => r.priority === "low").length;

  return (
    <div className="rounded-xl mb-6 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {/* Header */}
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
              {highs  > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#ef444420", color: "#ef4444" }}>{highs} high</span>}
              {meds   > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#fbbf2420", color: "#fbbf24" }}>{meds} medium</span>}
              {lows   > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#10b98120", color: "#10b981" }}>{lows} low</span>}
            </div>
          )}
        </div>
        <button onClick={generate} disabled={!hasData}
          className="text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-40"
          style={{ background: isStale ? "#6366f1" : "#1e1e30", color: isStale ? "#fff" : "#a5b4fc", border: "1px solid #3730a3" }}>
          {isStale ? "Generate Report" : "↻ Refresh"}
        </button>
      </div>

      {/* Body */}
      {!audit ? (
        <div className="py-10 text-center" style={{ background: "var(--bg-card-inner)" }}>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
            {hasData ? "Click Generate Report to analyse your account." : "Load data first using the date controls above."}
          </p>
          {hasData && (
            <button onClick={generate}
              className="text-xs px-4 py-2 rounded-lg font-medium"
              style={{ background: "#6366f1", color: "#fff" }}>
              Generate Report
            </button>
          )}
        </div>
      ) : recs.length === 0 ? (
        <div className="py-8 px-5 flex items-center gap-3" style={{ background: "#10b98108" }}>
          <span>✅</span>
          <div>
            <p className="text-sm font-medium" style={{ color: "#10b981" }}>No issues found</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Account looks healthy based on current data.</p>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card-inner)" }}>
          {recs.map((rec, i) => {
            const cfg = PRIORITY_CFG[rec.priority];
            return (
              <div key={rec.id} className="px-5 py-4 flex items-start gap-4"
                style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}>
                {/* Priority badge */}
                <div className="flex-shrink-0 mt-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium block whitespace-nowrap"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.dot} {cfg.label}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{rec.title}</p>
                  {rec.entityName && (
                    <p className="text-xs mb-1" style={{ color: "var(--text-faint)" }}>
                      {rec.entity === "campaign" ? "Campaign" : rec.entity === "ad_set" ? "Ad Set" : "Account"}: {rec.entityName}
                    </p>
                  )}
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{rec.reason}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: "#6366f1" }}>→</span>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{rec.action}</p>
                  </div>
                </div>

                {/* Action button */}
                {rec.actionable && (
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => applyRec(rec)}
                      disabled={applying === rec.id}
                      className="text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-50"
                      style={{
                        background: rec.type === "pause" ? "#ef444420" : rec.type === "budget_decrease" ? "#fbbf2420" : "#10b98120",
                        color:      rec.type === "pause" ? "#ef4444"   : rec.type === "budget_decrease" ? "#fbbf24"   : "#10b981",
                        border:     `1px solid ${rec.type === "pause" ? "#ef444440" : rec.type === "budget_decrease" ? "#fbbf2440" : "#10b98140"}`,
                      }}>
                      {applying === rec.id ? "Applying…" :
                        rec.type === "pause"           ? "Pause Campaign" :
                        rec.type === "budget_decrease" ? "Reduce Budget"  :
                        rec.type === "budget_increase" ? "Increase Budget" : "Apply"}
                    </button>
                  </div>
                )}
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
  const [roas, setRoas] = useState(String(goals.roas ?? ""));
  const [cpa,  setCpa]  = useState(String(goals.cpa  ?? ""));
  const [saved, setSaved] = useState(false);

  useEffect(() => { setRoas(String(goals.roas ?? "")); setCpa(String(goals.cpa ?? "")); }, [goals]);

  function save() {
    const g: Goals = { roas: roas ? parseFloat(roas) : undefined, cpa: cpa ? parseFloat(cpa) : undefined };
    saveGoals(g); onChange(g);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid #6366f130" }}>
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
        <button onClick={save}
          className="text-xs px-4 py-1.5 rounded-md font-medium"
          style={{ background: saved ? "#10b981" : "#6366f1", color: "#fff", transition: "background 0.2s" }}>
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

// ─── Change log ───────────────────────────────────────────────────────────────
function ChangeLog() {
  const [log, setLog] = useState<ChangeLogEntry[]>([]);
  useEffect(() => { setLog(readLog()); }, []);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>📋 Change Log</h3>
        {log.length > 0 && (
          <button onClick={() => { localStorage.removeItem(LOG_KEY); setLog([]); }}
            className="text-xs" style={{ color: "#ef4444" }}>Clear</button>
        )}
      </div>
      {log.length === 0 ? (
        <div className="py-8 text-center text-xs" style={{ color: "var(--text-faint)", background: "var(--bg-card-inner)" }}>
          No changes yet — budget edits and status changes will appear here.
        </div>
      ) : (
        <table className="w-full text-xs" style={{ background: "var(--bg-card-inner)" }}>
          <thead>
            <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border-subtle)" }}>
              {["Time", "Entity", "Action", "Before", "After"].map((h) => (
                <th key={h} className="px-4 py-2 text-left font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {log.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-faint)" }}>{new Date(e.ts).toLocaleString()}</td>
                <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>
                  <span className="block text-xs" style={{ color: "var(--text-faint)" }}>{e.entityType}</span>
                  {e.entityName}
                </td>
                <td className="px-4 py-2 font-medium" style={{ color: "var(--text-primary)" }}>{e.action}</td>
                <td className="px-4 py-2" style={{ color: "#ef4444" }}>{e.oldValue}</td>
                <td className="px-4 py-2" style={{ color: "#10b981" }}>{e.newValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Campaign table (shared, mode-aware) ──────────────────────────────────────
function CampaignTable({
  campaigns, mode, expanded, adExpanded, dateParam,
  onToggleAdsets, onToggleAds, onToggleStatus, onSaveBudget,
}: {
  campaigns: any[]; mode: InnerTab;
  expanded: Record<string, any[] | "loading">;
  adExpanded: Record<string, any[] | "loading">;
  dateParam: string;
  onToggleAdsets: (id: string) => void;
  onToggleAds: (id: string) => void;
  onToggleStatus: (id: string, status: string, name: string, type: string) => void;
  onSaveBudget: (id: string, v: number, old: number | null, name: string, type: string) => Promise<void>;
}) {
  const manage = mode === "management";

  if (campaigns.length === 0) {
    return <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>No campaign data for this period</div>;
  }

  return (
    <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: 36 }} />
        <col style={{ width: "20%" }} />
        {manage && <col style={{ width: 88 }} />}
        {manage && <col style={{ width: 110 }} />}
        <col style={{ width: 90 }} />
        <col style={{ width: 64 }} />
        <col style={{ width: 72 }} />
        <col style={{ width: 56 }} />
        <col style={{ width: 72 }} />
        <col style={{ width: 64 }} />
      </colgroup>
      <thead>
        <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border-subtle)" }}>
          <th className="px-3 py-3" />
          <th className="px-3 py-3 text-left font-medium uppercase tracking-wider">Campaign</th>
          {manage && <th className="px-3 py-3 text-left font-medium uppercase tracking-wider">Status</th>}
          {manage && <th className="px-3 py-3 text-left font-medium uppercase tracking-wider">Daily Budget</th>}
          <th className="px-3 py-3 text-left font-medium uppercase tracking-wider">Spend</th>
          <th className="px-3 py-3 text-left font-medium uppercase tracking-wider">Freq.</th>
          <th className="px-3 py-3 text-left font-medium uppercase tracking-wider">Clicks</th>
          <th className="px-3 py-3 text-left font-medium uppercase tracking-wider">CTR</th>
          <th className="px-3 py-3 text-left font-medium uppercase tracking-wider">Conv.</th>
          <th className="px-3 py-3 text-left font-medium uppercase tracking-wider">ROAS</th>
        </tr>
      </thead>
      <tbody>
        {campaigns.map((c: any) => {
          const s        = STATUS_STYLE[c.status] ?? { bg: "#6b728020", text: "var(--text-secondary)" };
          const isOpen   = !!expanded[c.id];
          const adsets   = expanded[c.id];
          const freqHigh = c.frequency > 3.5;
          const colSpan  = manage ? 10 : 8;

          return (
            <Fragment key={c.id}>
              <tr style={{ borderTop: "1px solid var(--border-subtle)", background: isOpen ? "#ffffff04" : undefined }}
                className="hover:bg-white/[0.015] transition-colors">
                <td className="px-3 py-3">
                  <button onClick={() => onToggleAdsets(c.id)}
                    className="w-5 h-5 flex items-center justify-center rounded text-xs"
                    style={{ color: "#a5b4fc", background: "#6366f115", transform: isOpen ? "rotate(90deg)" : undefined, transition: "transform 0.15s" }}>
                    ▸
                  </button>
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium truncate" style={{ color: "var(--text-primary)" }} title={c.name}>{c.name}</p>
                  {!manage && c.status && (
                    <span className="text-xs mt-0.5 inline-block" style={{ color: s.text }}>{c.status.toLowerCase()}</span>
                  )}
                </td>
                {manage && (
                  <td className="px-3 py-3">
                    <button onClick={() => onToggleStatus(c.id, c.status, c.name, "Campaign")}
                      className="px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-70"
                      style={{ background: s.bg, color: s.text }}>
                      {c.status.toLowerCase()}
                    </button>
                  </td>
                )}
                {manage && (
                  <td className="px-3 py-3">
                    <EditableValue value={c.dailyBudget}
                      onSave={(v) => onSaveBudget(c.id, v, c.dailyBudget, c.name, "Campaign")} />
                  </td>
                )}
                <td className="px-3 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{fmt(c.spend)}</td>
                <td className="px-3 py-3" style={{ color: freqHigh ? "#fbbf24" : "var(--text-secondary)" }}>
                  {c.frequency > 0 ? `${c.frequency.toFixed(1)}×` : "—"}{freqHigh ? " ⚠" : ""}
                </td>
                <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{c.clicks.toLocaleString()}</td>
                <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{c.ctr.toFixed(2)}%</td>
                <td className="px-3 py-3" style={{ color: "var(--text-secondary)" }}>{c.purchases}</td>
                <td className="px-3 py-3">
                  <span style={{ color: c.roas >= 2 ? "#10b981" : c.roas >= 1 ? "#fbbf24" : c.roas > 0 ? "#ef4444" : "var(--text-faint)" }}>
                    {c.roas > 0 ? `${c.roas.toFixed(2)}×` : "—"}
                  </span>
                </td>
              </tr>

              {isOpen && adsets === "loading" && (
                <tr><td colSpan={colSpan} className="px-8 py-2 text-xs" style={{ color: "var(--text-faint)", background: "var(--bg-card-inner)" }}>Loading ad sets…</td></tr>
              )}

              {isOpen && Array.isArray(adsets) && adsets.map((as: any) => {
                const sAs    = STATUS_STYLE[as.status] ?? { bg: "#6b728020", text: "var(--text-secondary)" };
                const asOpen = !!adExpanded[as.id];
                const ads    = adExpanded[as.id];
                const asFreq = as.frequency > 3;
                return (
                  <Fragment key={as.id}>
                    <tr style={{ background: "#0d0d18", borderTop: "1px solid var(--border-subtle)" }}>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end">
                          <button onClick={() => onToggleAds(as.id)}
                            className="w-4 h-4 flex items-center justify-center rounded text-xs"
                            style={{ color: "#818cf8", background: "#6366f110", transform: asOpen ? "rotate(90deg)" : undefined, transition: "transform 0.15s" }}>
                            ▸
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 pl-6">
                        <p className="truncate" style={{ color: "var(--text-secondary)", fontSize: 11 }} title={as.name}>{as.name}</p>
                      </td>
                      {manage && (
                        <td className="px-3 py-2.5">
                          <button onClick={() => onToggleStatus(as.id, as.status, as.name, "Ad Set")}
                            className="px-2 py-0.5 rounded-full font-medium hover:opacity-70"
                            style={{ background: sAs.bg, color: sAs.text, fontSize: 10 }}>
                            {as.status.toLowerCase()}
                          </button>
                        </td>
                      )}
                      {manage && (
                        <td className="px-3 py-2.5">
                          <EditableValue value={as.dailyBudget ?? as.lifetimeBudget}
                            onSave={(v) => onSaveBudget(as.id, v, as.dailyBudget, as.name, "Ad Set")} />
                        </td>
                      )}
                      <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)", fontSize: 11 }}>{fmt(as.spend)}</td>
                      <td className="px-3 py-2.5" style={{ color: asFreq ? "#fbbf24" : "var(--text-secondary)", fontSize: 11 }}>
                        {as.frequency > 0 ? `${as.frequency.toFixed(1)}×` : "—"}{asFreq ? " ⚠" : ""}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)", fontSize: 11 }}>{as.clicks.toLocaleString()}</td>
                      <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)", fontSize: 11 }}>{as.ctr.toFixed(2)}%</td>
                      <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)", fontSize: 11 }}>{as.purchases}</td>
                      <td className="px-3 py-2.5">
                        <span style={{ color: as.roas >= 2 ? "#10b981" : as.roas >= 1 ? "#fbbf24" : as.roas > 0 ? "#ef4444" : "var(--text-faint)", fontSize: 11 }}>
                          {as.roas > 0 ? `${as.roas.toFixed(2)}×` : "—"}
                        </span>
                      </td>
                    </tr>

                    {asOpen && ads === "loading" && (
                      <tr><td colSpan={colSpan} className="px-12 py-2 text-xs" style={{ color: "var(--text-faint)", background: "#080810" }}>Loading ads…</td></tr>
                    )}

                    {asOpen && Array.isArray(ads) && ads.map((ad: any) => {
                      const sAd    = STATUS_STYLE[ad.status] ?? { bg: "#6b728020", text: "var(--text-secondary)" };
                      const fatigue = ad.frequency > 3;
                      return (
                        <tr key={ad.id} style={{ background: "#080810", borderTop: "1px solid #1a1a28" }}>
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2 pl-10" colSpan={manage ? 2 : 1}>
                            <div className="flex items-center gap-2">
                              {ad.thumbnailUrl
                                ? <img src={ad.thumbnailUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" style={{ border: "1px solid var(--border)" }} />
                                : <div className="w-7 h-7 rounded flex-shrink-0 flex items-center justify-center" style={{ background: "#1a1a28", color: "var(--text-faint)", fontSize: 12, border: "1px solid var(--border)" }}>🖼</div>
                              }
                              <div className="min-w-0">
                                <p className="truncate" style={{ color: "var(--text-secondary)", fontSize: 11 }} title={ad.name}>{ad.name}</p>
                                {fatigue && <p style={{ color: "#ef4444", fontSize: 10 }}>⚡ Creative fatigue</p>}
                              </div>
                            </div>
                          </td>
                          {manage && <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full font-medium" style={{ background: sAd.bg, color: sAd.text, fontSize: 10 }}>{ad.status.toLowerCase()}</span></td>}
                          <td className="px-3 py-2" style={{ color: "var(--text-secondary)", fontSize: 11 }}>{fmt(ad.spend)}</td>
                          <td className="px-3 py-2" style={{ color: fatigue ? "#ef4444" : "var(--text-secondary)", fontSize: 11 }}>{ad.frequency > 0 ? `${ad.frequency.toFixed(1)}×` : "—"}{fatigue ? " ⚡" : ""}</td>
                          <td className="px-3 py-2" style={{ color: "var(--text-secondary)", fontSize: 11 }}>{ad.clicks.toLocaleString()}</td>
                          <td className="px-3 py-2" style={{ color: "var(--text-secondary)", fontSize: 11 }}>{ad.ctr.toFixed(2)}%</td>
                          <td className="px-3 py-2" style={{ color: "var(--text-secondary)", fontSize: 11 }}>{ad.purchases}</td>
                          <td className="px-3 py-2"><span style={{ color: ad.roas >= 2 ? "#10b981" : ad.roas >= 1 ? "#fbbf24" : ad.roas > 0 ? "#ef4444" : "var(--text-faint)", fontSize: 11 }}>{ad.roas > 0 ? `${ad.roas.toFixed(2)}×` : "—"}</span></td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
export default function MetaAdsView({ connected }: { connected: boolean }) {
  const [innerTab,   setInnerTab]   = useState<InnerTab>("reporting");
  const [dateRange,  setDateRange]  = useState<DateRange>(() => defaultDateRange("30d"));
  const [data,       setData]       = useState<any>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [goals,      setGoals]      = useState<Goals>({});

  const [expanded,   setExpanded]   = useState<Record<string, any[] | "loading">>({});
  const [adExpanded, setAdExpanded] = useState<Record<string, any[] | "loading">>({});

  useEffect(() => { setGoals(readGoals()); }, []);

  const dateParam = `since=${dateRange.since}&until=${dateRange.until}`;

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/meta/stats?${dateParam}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [connected, dateParam]);

  useEffect(() => { load(); }, [load]);

  async function toggleAdsets(id: string) {
    if (expanded[id]) { setExpanded((p) => { const n = { ...p }; delete n[id]; return n; }); return; }
    setExpanded((p) => ({ ...p, [id]: "loading" }));
    try {
      const j = await fetch(`/api/meta/adsets?campaignId=${id}&${dateParam}`).then((r) => r.json());
      setExpanded((p) => ({ ...p, [id]: j.adsets ?? [] }));
    } catch { setExpanded((p) => ({ ...p, [id]: [] })); }
  }

  async function toggleAds(id: string) {
    if (adExpanded[id]) { setAdExpanded((p) => { const n = { ...p }; delete n[id]; return n; }); return; }
    setAdExpanded((p) => ({ ...p, [id]: "loading" }));
    try {
      const j = await fetch(`/api/meta/ads?adsetId=${id}&${dateParam}`).then((r) => r.json());
      setAdExpanded((p) => ({ ...p, [id]: j.ads ?? [] }));
    } catch { setAdExpanded((p) => ({ ...p, [id]: [] })); }
  }

  async function toggleStatus(entityId: string, currentStatus: string, entityName: string, entityType: string) {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch("/api/meta/action", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", campaignId: entityId, status: newStatus }),
    });
    appendLog({ entityType, entityName, action: "Status changed", oldValue: currentStatus, newValue: newStatus });
    load();
  }

  async function saveBudget(entityId: string, newBudget: number, oldBudget: number | null, entityName: string, entityType: string) {
    await fetch("/api/meta/action", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_budget", campaignId: entityId, dailyBudget: newBudget }),
    });
    appendLog({ entityType, entityName, action: "Daily budget changed", oldValue: oldBudget != null ? fmt(oldBudget) : "—", newValue: fmt(newBudget) });
  }

  async function applyRec(rec: Rec) {
    if (!rec.entityId) return;
    if (rec.type === "pause") {
      await toggleStatus(rec.entityId, "ACTIVE", rec.entityName ?? "", "Campaign");
    } else if ((rec.type === "budget_decrease" || rec.type === "budget_increase") && rec.newBudget) {
      await saveBudget(rec.entityId, rec.newBudget, rec.currentBudget ?? null, rec.entityName ?? "", "Campaign");
      load();
    }
  }

  if (!connected) return <ConnectCard platform="meta" />;

  const a         = data?.account     ?? {};
  const prev      = data?.prevAccount ?? {};
  const campaigns = (data?.campaigns  ?? []).sort((a: any, b: any) => b.spend - a.spend);
  const daily     = data?.daily       ?? [];
  const monthSpend = data?.monthSpend ?? 0;
  const cpa     = a.spend > 0 && a.purchases > 0 ? a.spend / a.purchases : 0;
  const prevCpa = prev.spend > 0 && prev.purchases > 0 ? prev.spend / prev.purchases : 0;
  const roasColor = goals.roas ? (a.roas >= goals.roas ? "#10b981" : a.roas > 0 ? "#ef4444" : "var(--text-faint)")
    : (a.roas >= 2 ? "#10b981" : a.roas >= 1 ? "#fbbf24" : a.roas > 0 ? "#ef4444" : "var(--text-faint)");
  const cpaColor = goals.cpa ? (cpa > 0 && cpa <= goals.cpa ? "#10b981" : cpa > 0 ? "#ef4444" : "var(--text-faint)") : "var(--text-primary)";

  return (
    <div>
      {/* ── Top controls ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {/* Date range */}
        <DateRangePicker value={dateRange} onChange={setDateRange} accentColor="#1877F2" />

        {/* Inner tab + refresh */}
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {(["reporting", "management", "agent"] as InnerTab[]).map((t) => (
              <button key={t} onClick={() => setInnerTab(t)}
                data-active={innerTab === t ? "true" : "false"}
                className="tab-btn text-xs px-3 py-1.5 rounded-md font-medium capitalize"
                style={{ background: innerTab === t ? "#1e1e30" : "transparent", color: innerTab === t ? "#a5b4fc" : "var(--text-muted)" }}>
                {t === "reporting" ? "📊 Reporting" : t === "management" ? "⚙️ Management" : "🤖 Agent"}
              </button>
            ))}
          </div>
          {innerTab === "reporting" && (
            <button onClick={() => exportCsv(campaigns)} disabled={campaigns.length === 0}
              className="btn-icon text-xs px-3 py-1.5 rounded-md disabled:opacity-40"
              style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              ↓ CSV
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="btn-icon text-xs px-3 py-1.5 rounded-md disabled:opacity-50"
            style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px solid #3730a3" }}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl p-4 mb-5" style={{ background: "#ef444415", border: "1px solid #ef444440" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "#ef4444" }}>Meta Ads API Error</p>
          <p className="text-xs font-mono" style={{ color: "#ef4444", opacity: 0.8 }}>{error}</p>
        </div>
      )}

      {/* ══════════════ REPORTING TAB ══════════════ */}
      {innerTab === "reporting" && (
        <>
          {daily.length > 0 && (
            <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <SpendChart data={daily} color="#1877F2" label="Daily Spend — Meta Ads" />
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 mb-4">
            <KpiCard label="Total Spend"  value={fmt(a.spend ?? 0)} icon="💸" sub={`vs ${fmt(prev.spend ?? 0)} prior`} change={pct(a.spend, prev.spend)} invert />
            <KpiCard label="Impressions"  value={((a.impressions ?? 0) / 1000).toFixed(1) + "K"} icon="👁" change={pct(a.impressions, prev.impressions)} />
            <KpiCard label="Reach"        value={((a.reach ?? 0) / 1000).toFixed(1) + "K"} icon="📡" change={pct(a.reach, prev.reach)} />
            <KpiCard label="Frequency"    value={(a.frequency ?? 0).toFixed(2) + "×"} icon="🔁" sub="avg times seen" alert={(a.frequency ?? 0) > 3.5} color={(a.frequency ?? 0) > 3.5 ? "#fbbf24" : "var(--text-primary)"} />
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <KpiCard label="Clicks" value={(a.clicks ?? 0).toLocaleString()} icon="🖱️" change={pct(a.clicks, prev.clicks)} />
            <KpiCard label="CTR"    value={(a.ctr ?? 0).toFixed(2) + "%"} icon="📈" change={pct(a.ctr, prev.ctr)} />
            <KpiCard label="CPC"    value={fmt(a.cpc ?? 0)} icon="🎯" change={pct(a.cpc, prev.cpc)} invert />
            <KpiCard label="CPM"    value={fmt(a.cpm ?? 0)} icon="📊" change={pct(a.cpm, prev.cpm)} invert />
          </div>
          <div className="grid grid-cols-4 gap-4 mb-5">
            <KpiCard label="Purchases"  value={(a.purchases ?? 0).toLocaleString()} icon="🛒" change={pct(a.purchases, prev.purchases)} />
            <KpiCard label="Revenue"    value={fmt(a.purchaseValue ?? 0)} icon="💰" change={pct(a.purchaseValue, prev.purchaseValue)} />
            <KpiCard label="CPA"        value={cpa > 0 ? fmt(cpa) : "—"} icon="📉" color={cpaColor} sub={goals.cpa ? `Target ${fmt(goals.cpa)}` : undefined} change={pct(cpa, prevCpa)} invert />
            <KpiCard label="ROAS"       value={(a.roas ?? 0) > 0 ? `${a.roas.toFixed(2)}×` : "—"} icon="✨" color={roasColor} sub={goals.roas ? `Target ${goals.roas}×` : `$${(a.purchaseValue ?? 0).toFixed(0)} revenue`} change={pct(a.roas, prev.roas)} />
          </div>

          {monthSpend > 0 && <SpendPacing monthSpend={monthSpend} />}

          <BreakdownPanel type="placement"   dateParam={dateParam} />
          <BreakdownPanel type="demographic" dateParam={dateParam} />

          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Campaigns</h2>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "var(--text-muted)" }}>{campaigns.length}</span>
              </div>
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>▸ expand to ad sets → ads</span>
            </div>
            {loading && !data
              ? <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading…</div>
              : <CampaignTable campaigns={campaigns} mode="reporting" expanded={expanded} adExpanded={adExpanded} dateParam={dateParam}
                  onToggleAdsets={toggleAdsets} onToggleAds={toggleAds}
                  onToggleStatus={toggleStatus} onSaveBudget={saveBudget} />
            }
          </div>
        </>
      )}

      {/* ══════════════ MANAGEMENT TAB ══════════════ */}
      {innerTab === "management" && (
        <>
          <RecommendationsPanel account={a} campaigns={campaigns} goals={goals} onAction={applyRec} />

          <GoalsSection goals={goals} onChange={setGoals} />

          <div className="rounded-xl mb-5 overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Campaign Controls</h2>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "var(--text-muted)" }}>{campaigns.length}</span>
              </div>
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>Click status to toggle · click budget to edit</span>
            </div>
            {loading && !data
              ? <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading…</div>
              : <CampaignTable campaigns={campaigns} mode="management" expanded={expanded} adExpanded={adExpanded} dateParam={dateParam}
                  onToggleAdsets={toggleAdsets} onToggleAds={toggleAds}
                  onToggleStatus={toggleStatus} onSaveBudget={saveBudget} />
            }
          </div>

          <ChangeLog />
        </>
      )}

      {/* ══════════════ AGENT TAB ══════════════ */}
      {innerTab === "agent" && <AgentInsightsPanel />}
    </div>
  );
}
