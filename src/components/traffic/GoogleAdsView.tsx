"use client";
import { useState, useEffect, useCallback } from "react";
import ConnectCard from "./ConnectCard";
import SpendChart from "./SpendChart";

const DAY_OPTIONS = [7, 30, 90];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ENABLED: { bg: "#10b98120", text: "#10b981" },
  PAUSED:  { bg: "#f59e0b20", text: "#fbbf24" },
  REMOVED: { bg: "#ef444420", text: "#ef4444" },
};

const CHANNEL_LABEL: Record<string, string> = {
  SEARCH:          "Search",
  DISPLAY:         "Display",
  SHOPPING:        "Shopping",
  VIDEO:           "Video",
  PERFORMANCE_MAX: "PMax",
};

function pct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

function ChangeBadge({ change, invert = false }: { change: number | null; invert?: boolean }) {
  if (change === null || Math.abs(change) < 0.5) return null;
  const good  = invert ? change < 0 : change > 0;
  const color = good ? "#10b981" : "#ef4444";
  return (
    <span className="text-xs font-medium" style={{ color }}>
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

function AuditFlags({ account, campaigns }: { account: any; campaigns: any[] }) {
  type Flag = { severity: "warn" | "danger"; msg: string; detail?: string };
  const flags: Flag[] = [];

  const noConv = campaigns.filter((c) => c.spend > 10 && c.conversions === 0 && c.status === "ENABLED");
  if (noConv.length)
    flags.push({ severity: "danger", msg: `${noConv.length} campaign${noConv.length > 1 ? "s" : ""} spending without conversions`, detail: noConv.map((c) => c.name).join(", ") });

  const subBE = campaigns.filter((c) => c.spend > 20 && c.roas > 0 && c.roas < 1);
  if (subBE.length)
    flags.push({ severity: "warn", msg: `${subBE.length} campaign${subBE.length > 1 ? "s" : ""} below break-even ROAS`, detail: subBE.map((c) => `${c.name} (${c.roas.toFixed(2)}×)`).join(", ") });

  const highCpa = campaigns.filter((c) => {
    const acctCpa = account.costPerConv ?? 0;
    return acctCpa > 0 && c.costPerConv > acctCpa * 2 && c.conversions > 0;
  });
  if (highCpa.length)
    flags.push({ severity: "warn", msg: `${highCpa.length} campaign${highCpa.length > 1 ? "s" : ""} with CPA >2× account average`, detail: highCpa.map((c) => `${c.name} ($${c.costPerConv.toFixed(2)})`).join(", ") });

  const zeroSpend = campaigns.filter((c) => c.status === "ENABLED" && c.spend === 0);
  if (zeroSpend.length)
    flags.push({ severity: "warn", msg: `${zeroSpend.length} enabled campaign${zeroSpend.length > 1 ? "s" : ""} not spending`, detail: zeroSpend.map((c) => c.name).join(", ") });

  if (!flags.length) {
    return (
      <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: "#10b98110", border: "1px solid #10b98130" }}>
        <span>✅</span>
        <p className="text-sm" style={{ color: "#10b981" }}>No issues detected — account looks healthy</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl mb-6 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <span>⚠️</span>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Audit Flags</h3>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#ef444420", color: "#ef4444" }}>
          {flags.length} issue{flags.length > 1 ? "s" : ""}
        </span>
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

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function GoogleAdsView({ connected }: { connected: boolean }) {
  const [days,    setDays]    = useState(30);
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/google/stats?days=${days}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [connected, days]);

  useEffect(() => { load(); }, [load]);

  if (!connected) return <ConnectCard platform="google" />;

  const a        = data?.account    ?? {};
  const prev     = data?.prevAccount ?? {};
  const campaigns: any[] = data?.campaigns ?? [];
  const daily:    any[]  = data?.daily     ?? [];

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {DAY_OPTIONS.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
              style={{
                background: days === d ? "#1e1e30" : "transparent",
                color:      days === d ? "#a5b4fc" : "var(--text-muted)",
                border:     `1px solid ${days === d ? "#3730a3" : "var(--border)"}`,
              }}>
              {d}d
            </button>
          ))}
        </div>
        <button onClick={load} disabled={loading}
          className="text-xs px-3 py-1.5 rounded-md transition-all hover:opacity-80 disabled:opacity-50"
          style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px solid #3730a3" }}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 mb-6" style={{ background: "#ef444415", border: "1px solid #ef444440" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "#ef4444" }}>Google Ads API Error</p>
          <p className="text-xs font-mono" style={{ color: "#ef4444", opacity: 0.8 }}>{error}</p>
          {error.includes("not approved") && (
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              Basic Access application submitted — typically approved within 3 business days. Once approved, data will load here automatically.
            </p>
          )}
        </div>
      )}

      {/* Spend Chart */}
      {daily.length > 0 && (
        <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <SpendChart data={daily} color="#4285F4" label="Daily Spend — Google Ads" />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <KpiCard label="Total Spend"  value={fmt(a.spend ?? 0)} icon="💸" sub={`last ${days} days`}
          change={pct(a.spend, prev.spend)} invert />
        <KpiCard label="Impressions"  value={((a.impressions ?? 0) / 1000).toFixed(1) + "K"} icon="👁" sub="total impressions"
          change={pct(a.impressions, prev.impressions)} />
        <KpiCard label="Clicks"       value={(a.clicks ?? 0).toLocaleString()} icon="🖱️" sub="total clicks"
          change={pct(a.clicks, prev.clicks)} />
        <KpiCard label="CTR"          value={(a.ctr ?? 0).toFixed(2) + "%"} icon="📈" sub="click-through rate"
          change={pct(a.ctr, prev.ctr)} />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Avg CPC"      value={fmt(a.avgCpc ?? 0)} icon="🎯" sub="cost per click"
          change={pct(a.avgCpc, prev.avgCpc)} invert />
        <KpiCard label="Conversions"  value={(a.conversions ?? 0).toFixed(1)} icon="✅" sub="attributed conversions"
          change={pct(a.conversions, prev.conversions)} />
        <KpiCard label="Cost / Conv." value={fmt(a.costPerConv ?? 0)} icon="📊" sub="cost per conversion"
          change={pct(a.costPerConv, prev.costPerConv)} invert />
        <KpiCard label="ROAS"         value={(a.roas ?? 0).toFixed(2) + "×"} icon="💰"
          color={(a.roas ?? 0) >= 2 ? "#10b981" : (a.roas ?? 0) >= 1 ? "#fbbf24" : "#ef4444"}
          sub={`$${(a.conversionValue ?? 0).toFixed(0)} revenue`}
          change={pct(a.roas, prev.roas)} />
      </div>

      {/* Audit Flags */}
      {data && !error && <AuditFlags account={a} campaigns={campaigns} />}

      {/* Campaign Table */}
      <div className="rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Campaigns</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "var(--text-muted)" }}>
              {campaigns.length}
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Sorted by spend</span>
        </div>

        {loading && !data ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            {error ? "Resolve the error above to see campaigns" : "No campaign data for this period"}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border-subtle)" }}>
                {["Campaign", "Type", "Status", "Spend", "Impressions", "Clicks", "CTR", "Avg CPC", "Conversions", "ROAS"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c: any) => {
                const s = STATUS_STYLE[c.status] ?? { bg: "#6b728020", text: "var(--text-secondary)" };
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border-subtle)" }}
                    className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[160px]" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#6366f120", color: "#818cf8" }}>
                        {CHANNEL_LABEL[c.channelType] ?? c.channelType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                        style={{ background: s.bg, color: s.text }}>
                        {c.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{fmt(c.spend)}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{(c.impressions / 1000).toFixed(1)}K</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmt(c.avgCpc)}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.conversions.toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <span style={{ color: c.roas >= 2 ? "#10b981" : c.roas >= 1 ? "#fbbf24" : "#ef4444" }}>
                        {c.roas.toFixed(2)}×
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
