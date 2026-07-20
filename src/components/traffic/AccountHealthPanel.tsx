"use client";
import { useState, useEffect } from "react";
import type { PlatformHealth, PlatformStatus, HealthIssue } from "@/app/api/health/route";

type AgentAction = {
  id: number; created_at: string; action_type: string; severity: string;
  object_id: string; object_name: string; reason: string;
  executed: boolean; approved: boolean | null; slack_ts: string | null;
};

type HealthData = {
  meta:    PlatformHealth;
  google:  PlatformHealth;
  tiktok:  PlatformHealth;
  agentActions: { pending: AgentAction[]; recent: AgentAction[] };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<PlatformStatus, { color: string; bg: string; dot: string; label: string }> = {
  healthy:      { color: "#10b981", bg: "#10b98114", dot: "●", label: "Healthy"     },
  warning:      { color: "#fbbf24", bg: "#fbbf2414", dot: "●", label: "Needs Attention" },
  critical:     { color: "#ef4444", bg: "#ef444414", dot: "●", label: "Action Required" },
  disconnected: { color: "#6b7280", bg: "#6b728014", dot: "○", label: "Disconnected" },
};

const SEV_CFG: Record<string, { color: string; bg: string; icon: string }> = {
  critical: { color: "#ef4444", bg: "#ef444412", icon: "⚠" },
  warning:  { color: "#fbbf24", bg: "#fbbf2412", icon: "◆" },
  info:     { color: "#6366f1", bg: "#6366f112", icon: "ℹ" },
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

// ─── Single issue row ─────────────────────────────────────────────────────────
function IssueRow({ issue }: { issue: HealthIssue }) {
  const cfg = SEV_CFG[issue.severity];
  return (
    <div className="rounded-lg p-3" style={{ background: cfg.bg, border: `1px solid ${cfg.color}20` }}>
      <div className="flex items-start gap-2">
        <span className="text-xs mt-0.5 flex-shrink-0 font-bold" style={{ color: cfg.color }}>{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: cfg.color }}>{issue.title}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{issue.description}</p>
          {issue.action && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--text-primary)" }}>
              → {issue.action}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Platform health card ─────────────────────────────────────────────────────
function PlatformCard({
  platform, health, icon, color, expanded, onToggle,
}: {
  platform: string;
  health: PlatformHealth;
  icon: string;
  color: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = STATUS_CFG[health.status];

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: `1px solid ${health.status === "healthy" ? "var(--border)" : cfg.color + "40"}` }}>
      {/* Header */}
      <button
        className="w-full text-left px-4 py-3.5 flex items-center gap-3"
        onClick={onToggle}
        style={{ borderBottom: expanded ? "1px solid var(--border)" : "none" }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: color + "18", border: `1px solid ${color}30` }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{platform}</span>
            {health.accountName && (
              <span className="text-xs truncate max-w-[140px]" style={{ color: "var(--text-muted)" }}>{health.accountName}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.dot}</span>
            <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
            {health.issues.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold ml-1"
                style={{ background: cfg.bg, color: cfg.color }}>
                {health.issues.length} issue{health.issues.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Metrics strip */}
        {health.metrics && health.metrics.spend > 0 && (
          <div className="hidden md:flex items-center gap-4 mr-2">
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{health.metrics.roas > 0 ? `${health.metrics.roas.toFixed(2)}×` : "—"}</p>
              <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>ROAS</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{fmt$(health.metrics.spend)}</p>
              <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>7d spend</p>
            </div>
          </div>
        )}

        <span className="text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4">
          {!health.connected ? (
            <div className="py-4 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Not connected</p>
              <a href="/integrations" className="text-xs mt-1 inline-block" style={{ color: "#6366f1" }}>Connect in Integrations →</a>
            </div>
          ) : health.issues.length === 0 ? (
            <div className="py-4 flex items-center gap-2">
              <span style={{ color: "#10b981" }}>✓</span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>No issues detected. Account is running normally.</span>
            </div>
          ) : (
            <div className="space-y-2 pt-3">
              {health.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
            </div>
          )}

          {/* Metrics row when expanded */}
          {health.metrics && health.metrics.spend > 0 && (
            <div className="grid grid-cols-4 gap-3 mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              {[
                { label: "7d Spend",      value: fmt$(health.metrics.spend) },
                { label: "ROAS",          value: health.metrics.roas > 0 ? `${health.metrics.roas.toFixed(2)}×` : "—" },
                { label: "CPA",           value: health.metrics.cpa > 0 ? fmt$(health.metrics.cpa) : "—" },
                { label: "Conversions",   value: health.metrics.conversions.toLocaleString() },
              ].map((m) => (
                <div key={m.label} className="rounded-lg px-3 py-2" style={{ background: "var(--bg-subtle)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{m.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-faint)" }}>{m.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Recommended Actions ──────────────────────────────────────────────────────
function RecommendedActions({ data }: { data: HealthData }) {
  // Collect all issues across platforms that have actions
  const allActions: Array<{ platform: string; color: string; issue: HealthIssue }> = [];

  const platforms = [
    { key: "meta"   as const, label: "Meta Ads",    color: "#1877F2" },
    { key: "google" as const, label: "Google Ads",  color: "#4285F4" },
    { key: "tiktok" as const, label: "TikTok Ads",  color: "#ee1d52" },
  ];

  for (const p of platforms) {
    for (const issue of data[p.key].issues) {
      if (issue.action) allActions.push({ platform: p.label, color: p.color, issue });
    }
  }

  // Merge with agent pending actions
  const agentRecs = data.agentActions.pending;

  if (allActions.length === 0 && agentRecs.length === 0) return null;

  // Sort: critical first, then warning, then info
  const sevOrder = { critical: 0, warning: 1, info: 2 };
  allActions.sort((a, b) => sevOrder[a.issue.severity] - sevOrder[b.issue.severity]);

  const TYPE_ICON: Record<string, string> = {
    pause: "⏸", budget_decrease: "↓", budget_increase: "↑", flag: "⚑", recommend: "💡",
  };

  return (
    <div className="rounded-xl overflow-hidden mt-4" style={{ background: "var(--bg-card)", border: "1px solid #6366f130" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-base">🎯</span>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recommended Actions</h3>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-1"
          style={{ background: "#6366f118", color: "#a5b4fc" }}>
          {allActions.length + agentRecs.length}
        </span>
      </div>

      <div className="px-5 py-3 space-y-3">
        {/* Health-derived actions */}
        {allActions.map(({ platform, color, issue }, i) => {
          const cfg = SEV_CFG[issue.severity];
          return (
            <div key={i} className="flex items-start gap-3 py-2" style={{ borderBottom: i < allActions.length - 1 || agentRecs.length > 0 ? "1px solid var(--border)" : "none" }}>
              <span className="text-sm flex-shrink-0 mt-0.5 font-bold" style={{ color: cfg.color }}>{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: color + "18", color }}>
                    {platform}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: cfg.color }}>{issue.title}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{issue.action}</p>
              </div>
            </div>
          );
        })}

        {/* Agent pending actions */}
        {agentRecs.map((a, i) => (
          <div key={a.id} className="flex items-start gap-3 py-2"
            style={{ borderBottom: i < agentRecs.length - 1 ? "1px solid var(--border)" : "none" }}>
            <span className="text-sm flex-shrink-0 mt-0.5">{TYPE_ICON[a.action_type] ?? "💡"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ background: "#a5b4fc18", color: "#a5b4fc" }}>
                  Agent
                </span>
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{a.object_name}</span>
                <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>⏳ pending Slack approval</span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{a.reason}</p>
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>{timeAgo(a.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Overall health summary bar ───────────────────────────────────────────────
function OverallSummary({ data }: { data: HealthData }) {
  const platforms = [
    { key: "meta"   as const, label: "Meta",   color: "#1877F2", icon: "📘" },
    { key: "google" as const, label: "Google", color: "#4285F4", icon: "🔵" },
    { key: "tiktok" as const, label: "TikTok", color: "#ee1d52", icon: "🎵" },
  ];

  const totalIssues = platforms.reduce((sum, p) => sum + data[p.key].issues.length, 0);
  const hasAny = platforms.some((p) => data[p.key].connected);

  if (!hasAny) return null;

  const overallStatus: PlatformStatus =
    platforms.some((p) => data[p.key].status === "critical") ? "critical" :
    platforms.some((p) => data[p.key].status === "warning")  ? "warning"  : "healthy";

  const cfg = STATUS_CFG[overallStatus];

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      <span className="text-base font-bold" style={{ color: cfg.color }}>{cfg.dot}</span>
      <div className="flex-1">
        <span className="text-sm font-semibold" style={{ color: cfg.color }}>
          {overallStatus === "healthy" ? "All accounts healthy" : `${totalIssues} issue${totalIssues !== 1 ? "s" : ""} across your ad accounts`}
        </span>
        {overallStatus !== "healthy" && (
          <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
            — see details below
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {platforms.map((p) => {
          const ph = data[p.key];
          if (!ph.connected) return null;
          const pcfg = STATUS_CFG[ph.status];
          return (
            <span key={p.key} className="text-[10px] px-2 py-1 rounded-full font-semibold"
              style={{ background: pcfg.bg, color: pcfg.color, border: `1px solid ${pcfg.color}30` }}>
              {p.icon} {p.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function AccountHealthPanel() {
  const [data,     setData]     = useState<HealthData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [open,     setOpen]     = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        // Auto-expand platforms that have issues
        const autoExpand: Record<string, boolean> = {};
        for (const key of ["meta", "google", "tiktok"] as const) {
          if (d[key]?.issues?.length > 0) autoExpand[key] = true;
        }
        setExpanded(autoExpand);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mb-6">
      {/* Section header */}
      <button
        className="w-full flex items-center justify-between mb-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🩺</span>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Account Health</h2>
          {data && (() => {
            const total = data.meta.issues.length + data.google.issues.length + data.tiktok.issues.length + data.agentActions.pending.length;
            return total > 0 ? (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "#ef444418", color: "#ef4444" }}>
                {total}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "#10b98118", color: "#10b981" }}>
                ✓
              </span>
            );
          })()}
        </div>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          {loading ? (
            <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>Checking account health…</p>
            </div>
          ) : !data ? (
            <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>Could not load health data.</p>
            </div>
          ) : (
            <>
              <OverallSummary data={data} />

              <div className="space-y-2">
                {([
                  { key: "meta"   as const, label: "Meta Ads",   icon: "📘", color: "#1877F2" },
                  { key: "google" as const, label: "Google Ads", icon: "🔵", color: "#4285F4" },
                  { key: "tiktok" as const, label: "TikTok Ads", icon: "🎵", color: "#ee1d52" },
                ]).map((p) => (
                  <PlatformCard
                    key={p.key}
                    platform={p.label}
                    health={data[p.key]}
                    icon={p.icon}
                    color={p.color}
                    expanded={expanded[p.key] ?? false}
                    onToggle={() => setExpanded((prev) => ({ ...prev, [p.key]: !prev[p.key] }))}
                  />
                ))}
              </div>

              <RecommendedActions data={data} />
            </>
          )}
        </>
      )}
    </div>
  );
}
