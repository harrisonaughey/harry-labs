"use client";
import { useState, useEffect, useCallback } from "react";
import ConnectCard from "./ConnectCard";

const PRESETS = [
  { label: "7d",   preset: "last_7d",  days: 7  },
  { label: "30d",  preset: "last_30d", days: 30 },
  { label: "90d",  preset: "last_90d", days: 90 },
];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ACTIVE:  { bg: "#10b98120", text: "#10b981" },
  PAUSED:  { bg: "#f59e0b20", text: "#fbbf24" },
  DELETED: { bg: "#ef444420", text: "#ef4444" },
};

function KpiCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider" style={{ color: "#6b7280" }}>{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <p className="text-xl font-semibold" style={{ color: color ?? "#ffffff" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "#4b5563" }}>{sub}</p>}
    </div>
  );
}

function fmt(v: number, isCurrency = true) {
  if (isCurrency) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function MetaAdsView({ connected }: { connected: boolean }) {
  const [presetIdx, setPresetIdx] = useState(1);
  const [data,      setData]      = useState<any>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const preset = PRESETS[presetIdx];

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/meta/stats?preset=${preset.preset}&days=${preset.days}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [connected, preset.preset, preset.days]);

  useEffect(() => { load(); }, [load]);

  if (!connected) return <ConnectCard platform="meta" />;

  const a = data?.account ?? {};
  const campaigns: any[] = data?.campaigns ?? [];

  async function toggleCampaign(id: string, current: string) {
    const newStatus = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setActionMsg(`Setting ${newStatus.toLowerCase()}…`);
    const res = await fetch("/api/meta/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", campaignId: id, status: newStatus }),
    });
    const json = await res.json();
    setActionMsg(json.success ? `✅ Campaign ${newStatus.toLowerCase()}d` : `❌ ${json.error}`);
    setTimeout(() => { setActionMsg(null); load(); }, 2000);
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => setPresetIdx(i)}
              className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
              style={{
                background: presetIdx === i ? "#1e1e30" : "transparent",
                color:      presetIdx === i ? "#a5b4fc" : "#6b7280",
                border:     `1px solid ${presetIdx === i ? "#3730a3" : "#1e1e2e"}`,
              }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {actionMsg && <span className="text-xs" style={{ color: "#9ca3af" }}>{actionMsg}</span>}
          <button onClick={load} disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px solid #3730a3" }}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ background: "#ef444415", border: "1px solid #ef444440", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Spend"    value={fmt(a.spend ?? 0)}       icon="💸" sub={`${preset.label} period`} />
        <KpiCard label="Impressions"    value={((a.impressions ?? 0) / 1000).toFixed(1) + "K"} icon="👁" sub="total impressions" />
        <KpiCard label="Reach"          value={((a.reach ?? 0) / 1000).toFixed(1) + "K"}       icon="📡" sub="unique people" />
        <KpiCard label="Clicks"         value={(a.clicks ?? 0).toLocaleString()} icon="🖱️" sub="link clicks" />
        <KpiCard label="CTR"            value={((a.ctr ?? 0) * 100).toFixed(2) + "%"} icon="📈" sub="click-through rate" />
        <KpiCard label="CPC"            value={fmt(a.cpc ?? 0)}         icon="🎯" sub="cost per click" />
        <KpiCard label="CPM"            value={fmt(a.cpm ?? 0)}         icon="📊" sub="per 1,000 impressions" />
        <KpiCard label="ROAS"           value={(a.roas ?? 0).toFixed(2) + "×"} icon="💰"
          color={(a.roas ?? 0) >= 2 ? "#10b981" : (a.roas ?? 0) >= 1 ? "#fbbf24" : "#ef4444"}
          sub={`$${fmt(a.purchaseValue ?? 0, false)} revenue`} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Purchases"       value={(a.purchases ?? 0).toLocaleString()} icon="🛍️" sub="attributed purchases" />
        <KpiCard label="Purchase Value"  value={fmt(a.purchaseValue ?? 0)} icon="💳" sub="attributed revenue" />
        <KpiCard label="Frequency"       value={(a.frequency ?? 0).toFixed(2)} icon="🔄" sub="avg times seen" />
      </div>

      {/* Campaign Table */}
      <div className="rounded-xl" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1e1e2e" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Campaigns</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "#6b7280" }}>
              {campaigns.length} campaigns
            </span>
          </div>
          <span className="text-xs" style={{ color: "#4b5563" }}>Click status to pause/activate</span>
        </div>

        {loading && campaigns.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "#4b5563" }}>Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "#4b5563" }}>No campaign data for this period</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "#4b5563" }}>
                {["Campaign", "Status", "Spend", "Impressions", "Clicks", "CTR", "CPC", "Purchases", "ROAS"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.sort((a: any, b: any) => b.spend - a.spend).map((c: any) => {
                const s = STATUS_STYLE[c.status] ?? { bg: "#6b728020", text: "#9ca3af" };
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid #1a1a24" }}
                    className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium truncate max-w-[180px]">{c.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>{c.objective?.replace(/_/g, " ")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleCampaign(c.id, c.status)}
                        className="px-2 py-0.5 rounded-full text-xs font-medium capitalize hover:opacity-70 transition-opacity"
                        style={{ background: s.bg, color: s.text }}>
                        {c.status.toLowerCase()}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{fmt(c.spend)}</td>
                    <td className="px-4 py-3" style={{ color: "#9ca3af" }}>{(c.impressions/1000).toFixed(1)}K</td>
                    <td className="px-4 py-3" style={{ color: "#9ca3af" }}>{c.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: "#9ca3af" }}>{(c.ctr*100).toFixed(2)}%</td>
                    <td className="px-4 py-3" style={{ color: "#9ca3af" }}>{fmt(c.cpc)}</td>
                    <td className="px-4 py-3" style={{ color: "#9ca3af" }}>{c.purchases}</td>
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

      {/* Quick Actions Panel */}
      <div className="mt-6 rounded-xl p-6" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <h3 className="text-sm font-semibold text-white mb-1">Quick Actions</h3>
        <p className="text-xs mb-4" style={{ color: "#4b5563" }}>Manage campaigns directly from this dashboard</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pause all active", icon: "⏸", action: "pause_all",  color: "#fbbf24" },
            { label: "Resume all paused", icon: "▶️", action: "resume_all", color: "#10b981" },
            { label: "Refresh data",      icon: "↻",  action: "refresh",   color: "#818cf8" },
          ].map(btn => (
            <button key={btn.action}
              onClick={btn.action === "refresh" ? load : async () => {
                const toToggle = campaigns.filter((c: any) =>
                  btn.action === "pause_all" ? c.status === "ACTIVE" : c.status === "PAUSED"
                );
                setActionMsg(`Processing ${toToggle.length} campaigns…`);
                await Promise.all(toToggle.map((c: any) =>
                  fetch("/api/meta/action", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "set_status",
                      campaignId: c.id,
                      status: btn.action === "pause_all" ? "PAUSED" : "ACTIVE",
                    }),
                  })
                ));
                setActionMsg(`✅ Done`);
                setTimeout(() => { setActionMsg(null); load(); }, 1500);
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium hover:opacity-80 transition-opacity text-left"
              style={{ background: `${btn.color}15`, color: btn.color, border: `1px solid ${btn.color}30` }}>
              <span>{btn.icon}</span> {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
