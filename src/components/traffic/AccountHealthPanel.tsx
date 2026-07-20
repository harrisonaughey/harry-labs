"use client";
import { useState, useEffect } from "react";
import type { PlatformHealth, HealthIssue } from "@/app/api/health/route";

type Platform = "meta" | "google" | "tiktok";

type AgentAction = {
  id: number; created_at: string; action_type: string; severity: string;
  object_name: string; reason: string;
  executed: boolean; approved: boolean | null; slack_ts: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SEV_CFG: Record<string, { color: string; bg: string; icon: string; border: string }> = {
  critical: { color: "#ef4444", bg: "#ef444410", icon: "⚠", border: "#ef444430" },
  warning:  { color: "#fbbf24", bg: "#fbbf2410", icon: "◆", border: "#fbbf2430" },
  info:     { color: "#6366f1", bg: "#6366f110", icon: "ℹ", border: "#6366f130" },
};

const STATUS_CFG = {
  healthy:      { color: "#10b981", bg: "#10b98114", label: "Healthy",          dot: "●" },
  warning:      { color: "#fbbf24", bg: "#fbbf2414", label: "Needs Attention",  dot: "●" },
  critical:     { color: "#ef4444", bg: "#ef444414", label: "Action Required",  dot: "●" },
  disconnected: { color: "#6b7280", bg: "#6b728014", label: "Disconnected",     dot: "○" },
};

const TYPE_ICON: Record<string, string> = {
  pause: "⏸", budget_decrease: "↓", budget_increase: "↑", flag: "⚑", recommend: "💡",
};

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(ts: string) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 3600)  return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

// ─── Issue card ───────────────────────────────────────────────────────────────
function IssueCard({ issue }: { issue: HealthIssue }) {
  const cfg = SEV_CFG[issue.severity];
  return (
    <div className="rounded-xl p-4" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="flex items-start gap-3">
        <span className="text-sm mt-0.5 flex-shrink-0 font-bold" style={{ color: cfg.color }}>{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold mb-0.5" style={{ color: cfg.color }}>{issue.title}</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{issue.description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Recommended actions ──────────────────────────────────────────────────────
function RecommendedActions({
  health, agentActions,
}: {
  health: PlatformHealth;
  agentActions: { pending: AgentAction[]; recent: AgentAction[] };
}) {
  const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const actionableIssues = [...health.issues]
    .filter((i) => i.action)
    .sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  const agentRecs = agentActions.pending;

  if (actionableIssues.length === 0 && agentRecs.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden mt-4"
      style={{ background: "var(--bg-card)", border: "1px solid #6366f128" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <span>🎯</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recommended Actions</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: "#6366f118", color: "#a5b4fc" }}>
          {actionableIssues.length + agentRecs.length}
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {actionableIssues.map((issue, i) => {
          const cfg = SEV_CFG[issue.severity];
          return (
            <div key={i} className="px-5 py-3.5 flex items-start gap-3">
              <span className="text-sm flex-shrink-0 mt-0.5 font-bold" style={{ color: cfg.color }}>{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{issue.title}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{issue.action}</p>
              </div>
            </div>
          );
        })}

        {agentRecs.map((a) => (
          <div key={a.id} className="px-5 py-3.5 flex items-start gap-3">
            <span className="text-sm flex-shrink-0 mt-0.5">{TYPE_ICON[a.action_type] ?? "💡"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{a.object_name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "#a5b4fc18", color: "#a5b4fc" }}>Agent · pending Slack</span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{a.reason}</p>
            </div>
            <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: "var(--text-faint)" }}>{timeAgo(a.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function AccountHealthPanel({ platform, accentColor }: { platform: Platform; accentColor: string }) {
  const [health,       setHealth]       = useState<PlatformHealth | null>(null);
  const [agentActions, setAgentActions] = useState<{ pending: AgentAction[]; recent: AgentAction[] }>({ pending: [], recent: [] });
  const [loading,      setLoading]      = useState(true);
  const [open,         setOpen]         = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/health?platform=${platform}`)
      .then((r) => r.json())
      .then((d) => {
        setHealth(d.health ?? null);
        setAgentActions(d.agentActions ?? { pending: [], recent: [] });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [platform]);

  const issueCount = (health?.issues.length ?? 0) + agentActions.pending.length;
  const statusCfg  = health ? STATUS_CFG[health.status] : STATUS_CFG.disconnected;

  return (
    <div className="mb-6">
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between mb-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🩺</span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Account Health</span>
          {!loading && health && (
            issueCount > 0 ? (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: statusCfg.bg, color: statusCfg.color }}>
                {issueCount} issue{issueCount !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "#10b98118", color: "#10b981" }}>
                ✓ Healthy
              </span>
            )
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="rounded-xl overflow-hidden"
          style={{ background: "var(--bg-card)", border: `1px solid ${loading || !health ? "var(--border)" : health.status === "healthy" ? "var(--border)" : statusCfg.color + "40"}` }}>

          {/* Status bar */}
          <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
            {loading ? (
              <span className="text-sm" style={{ color: "var(--text-faint)" }}>Checking account health…</span>
            ) : !health ? (
              <span className="text-sm" style={{ color: "var(--text-faint)" }}>Could not load health data.</span>
            ) : (
              <>
                <span className="text-base font-bold" style={{ color: statusCfg.color }}>{statusCfg.dot}</span>
                <span className="text-sm font-semibold" style={{ color: statusCfg.color }}>{statusCfg.label}</span>
                {health.accountName && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {health.accountName}</span>
                )}
                {health.accountStatus && health.accountStatus !== "Active" && health.accountStatus !== "Unknown" && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: statusCfg.bg, color: statusCfg.color }}>
                    {health.accountStatus}
                  </span>
                )}

                {/* 7-day metrics strip */}
                {health.metrics && health.metrics.spend > 0 && (
                  <div className="ml-auto flex items-center gap-5">
                    {[
                      { label: "7d Spend",    value: fmt$(health.metrics.spend) },
                      { label: "ROAS",        value: health.metrics.roas > 0 ? `${health.metrics.roas.toFixed(2)}×` : "—" },
                      { label: "CPA",         value: health.metrics.cpa > 0 ? fmt$(health.metrics.cpa) : "—" },
                      { label: "Conversions", value: health.metrics.conversions.toLocaleString() },
                    ].map((m) => (
                      <div key={m.label} className="text-right">
                        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{m.value}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Issues list */}
          {!loading && health && (
            <div className="px-5 py-4">
              {health.issues.length === 0 && agentActions.pending.length === 0 ? (
                <div className="flex items-center gap-2 py-2">
                  <span style={{ color: "#10b981" }}>✓</span>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    No issues detected. Account is running normally.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {health.issues.map((issue, i) => <IssueCard key={i} issue={issue} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recommended Actions — outside the card so it has its own card */}
      {open && !loading && health && (health.issues.length > 0 || agentActions.pending.length > 0) && (
        <RecommendedActions health={health} agentActions={agentActions} />
      )}
    </div>
  );
}
