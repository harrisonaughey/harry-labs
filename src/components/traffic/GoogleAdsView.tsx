"use client";
import { useState, useEffect, useCallback } from "react";
import ConnectCard from "./ConnectCard";

const DAY_OPTIONS = [7, 30, 90];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ENABLED:  { bg: "#10b98120", text: "#10b981" },
  PAUSED:   { bg: "#f59e0b20", text: "#fbbf24" },
  REMOVED:  { bg: "#ef444420", text: "#ef4444" },
};

const CHANNEL_LABEL: Record<string, string> = {
  SEARCH:       "Search",
  DISPLAY:      "Display",
  SHOPPING:     "Shopping",
  VIDEO:        "Video",
  PERFORMANCE_MAX: "PMax",
};

function KpiCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
        <span>{icon}</span>
      </div>
      <p className="text-xl font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{sub}</p>}
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
      const res = await fetch(`/api/google/stats?days=${days}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [connected, days]);

  useEffect(() => { load(); }, [load]);

  if (!connected) return <ConnectCard platform="google" />;

  const a = data?.account ?? {};
  const campaigns: any[] = data?.campaigns ?? [];

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {DAY_OPTIONS.map(d => (
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
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ background: "#ef444415", border: "1px solid #ef444440", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Spend"      value={fmt(a.spend ?? 0)}                             icon="💸" sub={`last ${days} days`} />
        <KpiCard label="Impressions"      value={((a.impressions ?? 0)/1000).toFixed(1) + "K"}  icon="👁" sub="total impressions" />
        <KpiCard label="Clicks"           value={(a.clicks ?? 0).toLocaleString()}               icon="🖱️" sub="total clicks" />
        <KpiCard label="CTR"              value={(a.ctr ?? 0).toFixed(2) + "%"}                  icon="📈" sub="click-through rate" />
        <KpiCard label="Avg CPC"          value={fmt(a.avgCpc ?? 0)}                             icon="🎯" sub="cost per click" />
        <KpiCard label="Conversions"      value={(a.conversions ?? 0).toFixed(1)}                icon="✅" sub="attributed conversions" />
        <KpiCard label="Cost / Conv."     value={fmt(a.costPerConv ?? 0)}                        icon="📊" sub="cost per conversion" />
        <KpiCard label="ROAS"             value={(a.roas ?? 0).toFixed(2) + "×"}                 icon="💰"
          color={(a.roas ?? 0) >= 2 ? "#10b981" : (a.roas ?? 0) >= 1 ? "#fbbf24" : "#ef4444"}
          sub={`$${(a.conversionValue ?? 0).toFixed(0)} revenue`} />
      </div>

      {/* Campaign Table */}
      <div className="rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Campaigns</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "var(--text-muted)" }}>
              {campaigns.length} campaigns
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Sorted by spend</span>
        </div>

        {loading && campaigns.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>No campaign data for this period</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--text-faint)" }}>
                {["Campaign", "Type", "Status", "Spend", "Impressions", "Clicks", "CTR", "Avg CPC", "Conversions", "ROAS"].map(h => (
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
                      <span className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: "#6366f120", color: "#818cf8" }}>
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
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{(c.impressions/1000).toFixed(1)}K</td>
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
