"use client";
import { useState, useEffect } from "react";

type AdRow = {
  ad_id: string; ad_name: string; date: string;
  spend: number; impressions: number; clicks: number;
  ctr: number; cpc: number; frequency: number;
  purchases: number; purchase_value: number; roas: number; cpa: number;
};

type ActionRow = {
  id: number; created_at: string; action_type: string; severity: string;
  object_id: string; object_name: string; reason: string;
  executed: boolean; approved: boolean | null; slack_ts: string | null;
};

type AuditEntry = {
  date: string; video: string; editor?: string;
  final_score: number; decision: string;
  category_scores: Record<string, { raw: number; pts: number }>;
  top_fixes?: string[]; what_worked?: string[];
  penalty_flags?: { flag: string; deduction: number }[];
};

const SCORE_COLOR = (s: number) =>
  s >= 75 ? "#10b981" : s >= 60 ? "#fbbf24" : "#ef4444";
const SCORE_LABEL = (s: number) =>
  s >= 75 ? "GREEN LIGHT" : s >= 60 ? "AMBER" : s >= 45 ? "RED" : "KILL";

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(ts: string) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

// ─── Creative Performance Table ───────────────────────────────────────────────
function CreativeTable({ ads }: { ads: AdRow[] }) {
  if (!ads.length) {
    return (
      <div className="py-10 text-center text-sm" style={{ color: "var(--text-faint)" }}>
        No ad snapshot data yet — agent will populate this once campaigns are live.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Creative", "Spend", "ROAS", "CPA", "Purchases", "CTR", "CPC", "Freq", "Last Snapshot"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ads.map((ad) => {
            const roasOk = ad.roas >= 2.5;
            const cpaOk  = ad.cpa > 0 && ad.cpa <= 28;
            return (
              <tr key={ad.ad_id} style={{ borderBottom: "1px solid var(--border-faint, #ffffff08)" }}>
                <td className="px-3 py-2.5 font-medium max-w-[220px] truncate" style={{ color: "var(--text-primary)" }} title={ad.ad_name}>
                  {ad.ad_name}
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>{fmt$(ad.spend ?? 0)}</td>
                <td className="px-3 py-2.5 font-semibold" style={{ color: roasOk ? "#10b981" : ad.roas > 0 ? "#fbbf24" : "var(--text-faint)" }}>
                  {ad.roas > 0 ? `${ad.roas.toFixed(2)}×` : "—"}
                </td>
                <td className="px-3 py-2.5 font-semibold" style={{ color: cpaOk ? "#10b981" : ad.cpa > 0 ? "#ef4444" : "var(--text-faint)" }}>
                  {ad.cpa > 0 ? fmt$(ad.cpa) : "—"}
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>{ad.purchases ?? 0}</td>
                <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                  {ad.ctr > 0 ? `${(ad.ctr * 100).toFixed(2)}%` : "—"}
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                  {ad.cpc > 0 ? fmt$(ad.cpc) : "—"}
                </td>
                <td className="px-3 py-2.5" style={{ color: ad.frequency >= 3.5 ? "#ef4444" : "var(--text-secondary)" }}>
                  {ad.frequency > 0 ? ad.frequency.toFixed(1) : "—"}
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--text-faint)" }}>{ad.date}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Content Audit Cards ──────────────────────────────────────────────────────
function AuditCard({ audit }: { audit: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const score = audit.final_score;
  const color = SCORE_COLOR(score);
  const label = SCORE_LABEL(score);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: `1px solid ${color}30` }}>
      <button className="w-full text-left px-5 py-4 flex items-center justify-between" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold"
            style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}>
            <span className="text-base leading-none">{score}</span>
            <span className="text-[9px] mt-0.5 opacity-70">/100</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{audit.video}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {audit.editor && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{audit.editor}</span>}
              <span className="text-xs font-semibold" style={{ color }}>{label}</span>
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>{audit.date}</span>
            </div>
          </div>
        </div>
        <span className="text-xs ml-4 flex-shrink-0" style={{ color: "var(--text-faint)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Category scores */}
          {audit.category_scores && (
            <div className="mt-4 mb-4">
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>CATEGORY SCORES</p>
              <div className="space-y-1.5">
                {Object.entries(audit.category_scores).map(([key, val]) => {
                  const pct = (val.raw / 10) * 100;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs w-40 capitalize" style={{ color: "var(--text-secondary)" }}>
                        {key.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: val.raw >= 8 ? "#10b981" : val.raw >= 6 ? "#fbbf24" : "#ef4444" }} />
                      </div>
                      <span className="text-xs w-8 text-right font-semibold" style={{ color: "var(--text-primary)" }}>{val.raw}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {audit.what_worked && audit.what_worked.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "#10b981" }}>WHAT WORKED</p>
                <ul className="space-y-1">
                  {audit.what_worked.map((w, i) => (
                    <li key={i} className="text-xs flex gap-1.5" style={{ color: "var(--text-secondary)" }}>
                      <span style={{ color: "#10b981" }}>✓</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {audit.top_fixes && audit.top_fixes.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "#fbbf24" }}>TOP FIXES</p>
                <ul className="space-y-1">
                  {audit.top_fixes.map((f, i) => (
                    <li key={i} className="text-xs flex gap-1.5" style={{ color: "var(--text-secondary)" }}>
                      <span style={{ color: "#fbbf24" }}>→</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {audit.penalty_flags && audit.penalty_flags.filter(p => p.deduction < 0).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold mb-2" style={{ color: "#ef4444" }}>PENALTY FLAGS</p>
              <ul className="space-y-1">
                {audit.penalty_flags.filter(p => p.deduction < 0).map((f, i) => (
                  <li key={i} className="text-xs flex gap-1.5" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "#ef4444" }}>{f.deduction}</span> {f.flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Action Log ───────────────────────────────────────────────────────────────
function ActionLog({ pending, recent }: { pending: ActionRow[]; recent: ActionRow[] }) {
  const SEVERITY_COLOR: Record<string, string> = {
    kill: "#ef4444", warn: "#fbbf24", recommend: "#a5b4fc", info: "#6b7280",
  };
  const TYPE_ICON: Record<string, string> = {
    pause: "⏸", budget_decrease: "↓", budget_increase: "↑", flag: "⚑", recommend: "💡",
  };

  const renderRow = (a: ActionRow) => (
    <div key={a.id} className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--border-faint, #ffffff08)" }}>
      <span className="text-base flex-shrink-0">{TYPE_ICON[a.action_type] ?? "•"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{a.object_name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase"
            style={{ background: `${SEVERITY_COLOR[a.severity] ?? "#6b7280"}18`, color: SEVERITY_COLOR[a.severity] ?? "#6b7280" }}>
            {a.action_type.replace(/_/g, " ")}
          </span>
          {a.approved === true && <span className="text-[10px] text-green-400">✅ approved</span>}
          {a.approved === false && <span className="text-[10px] text-red-400">❌ rejected</span>}
          {a.approved === null && a.slack_ts && <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>⏳ pending Slack</span>}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{a.reason}</p>
      </div>
      <span className="text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>
        {timeAgo(a.created_at)}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid #a5b4fc30" }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Pending Approval</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#a5b4fc18", color: "#a5b4fc" }}>
              {pending.length}
            </span>
            <span className="text-xs ml-auto" style={{ color: "var(--text-faint)" }}>React ✅ or ❌ in Slack</span>
          </div>
          <div className="px-5">{pending.map(renderRow)}</div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Agent Actions</span>
        </div>
        <div className="px-5">
          {recent.length === 0
            ? <div className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                No actions yet — agent will log kills and recommendations here once campaigns are live.
              </div>
            : recent.map(renderRow)
          }
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function AgentInsightsPanel() {
  const [agentData, setAgentData] = useState<{ ads: AdRow[]; pending: ActionRow[]; recent: ActionRow[] } | null>(null);
  const [audits, setAudits]       = useState<AuditEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [subTab, setSubTab]       = useState<"creatives" | "content" | "log">("creatives");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/meta/agent-insights").then((r) => r.json()).catch(() => ({ ads: [], pending: [], recent: [] })),
      fetch("/api/meta/content-audits").then((r) => r.json()).catch(() => ({ audits: [] })),
    ]).then(([agent, audit]) => {
      setAgentData(agent);
      setAudits(audit.audits ?? []);
      setLoading(false);
    });
  }, []);

  const greenAudits = audits.filter((a) => a.final_score >= 75);
  const amberAudits = audits.filter((a) => a.final_score >= 60 && a.final_score < 75);
  const redAudits   = audits.filter((a) => a.final_score < 60);

  return (
    <div>
      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Ads Tracked",       value: agentData?.ads.length ?? "—",   color: "#a5b4fc" },
          { label: "Pending Approvals", value: agentData?.pending.length ?? "—", color: "#fbbf24" },
          { label: "Green Light",       value: greenAudits.length,              color: "#10b981" },
          { label: "Needs Revision",    value: amberAudits.length + redAudits.length, color: "#ef4444" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl px-4 py-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-5 p-0.5 rounded-lg w-fit" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {([
          { id: "creatives", label: "Creative Performance" },
          { id: "content",   label: `Content Audits (${audits.length})` },
          { id: "log",       label: "Agent Log" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className="text-xs px-3 py-1.5 rounded-md font-medium"
            style={{ background: subTab === t.id ? "#1e1e30" : "transparent", color: subTab === t.id ? "#a5b4fc" : "var(--text-muted)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading agent data…</div>
      )}

      {!loading && subTab === "creatives" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Creative Performance</h2>
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Sorted by ROAS · targets: ROAS ≥2.5× · CPA ≤$28</span>
          </div>
          <CreativeTable ads={agentData?.ads ?? []} />
        </div>
      )}

      {!loading && subTab === "content" && (
        <div className="space-y-3">
          {audits.length === 0
            ? <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>No content audits found.</div>
            : audits.sort((a, b) => b.final_score - a.final_score).map((audit, i) => (
                <AuditCard key={i} audit={audit} />
              ))
          }
        </div>
      )}

      {!loading && subTab === "log" && (
        <ActionLog pending={agentData?.pending ?? []} recent={agentData?.recent ?? []} />
      )}
    </div>
  );
}
