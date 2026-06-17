"use client";
import { useState, useEffect, useCallback, Fragment } from "react";
import ConnectCard from "./ConnectCard";
import SpendChart from "./SpendChart";

const PRESETS = [
  { label: "7d",  preset: "last_7d",  days: 7  },
  { label: "30d", preset: "last_30d", days: 30 },
  { label: "90d", preset: "last_90d", days: 90 },
];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ACTIVE:  { bg: "#10b98120", text: "#10b981" },
  PAUSED:  { bg: "#f59e0b20", text: "#fbbf24" },
  DELETED: { bg: "#ef444420", text: "#ef4444" },
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
        <span className="text-base">{icon}</span>
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

  if ((account.frequency ?? 0) > 3.5)
    flags.push({ severity: "warn", msg: "Ad fatigue risk", detail: `Avg frequency is ${(account.frequency ?? 0).toFixed(1)}× — consider refreshing creatives or expanding audiences` });

  const noConv = campaigns.filter((c) => c.spend > 10 && c.purchases === 0 && c.status === "ACTIVE");
  if (noConv.length)
    flags.push({ severity: "danger", msg: `${noConv.length} campaign${noConv.length > 1 ? "s" : ""} spending without conversions`, detail: noConv.map((c) => c.name).join(", ") });

  const subBE = campaigns.filter((c) => c.spend > 20 && c.roas > 0 && c.roas < 1);
  if (subBE.length)
    flags.push({ severity: "warn", msg: `${subBE.length} campaign${subBE.length > 1 ? "s" : ""} below break-even ROAS`, detail: subBE.map((c) => `${c.name} (${c.roas.toFixed(2)}×)`).join(", ") });

  const zeroSpend = campaigns.filter((c) => c.status === "ACTIVE" && c.spend === 0);
  if (zeroSpend.length)
    flags.push({ severity: "warn", msg: `${zeroSpend.length} active campaign${zeroSpend.length > 1 ? "s" : ""} not spending`, detail: zeroSpend.map((c) => c.name).join(", ") });

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
          <div key={i} className="px-5 py-3 flex items-start gap-3" style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}>
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

function SpendPacing({ monthSpend }: { monthSpend: number }) {
  const now          = new Date();
  const dayOfMonth   = now.getDate();
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAvg     = dayOfMonth > 0 ? monthSpend / dayOfMonth : 0;
  const projected    = dailyAvg * daysInMonth;
  const expectedPct  = (dayOfMonth / daysInMonth) * 100;
  const actualPct    = projected > 0 ? (monthSpend / projected) * 100 : 0;
  const paceColor    = actualPct > 110 ? "#ef4444" : actualPct > 90 ? "#fbbf24" : "#6366f1";

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Month-to-Date Spend</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Day {dayOfMonth} of {daysInMonth} · ${dailyAvg.toFixed(2)}/day avg</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            ${monthSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>≈ ${projected.toFixed(0)} projected</p>
        </div>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
        <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(actualPct, 100)}%`, background: paceColor }} />
        <div className="absolute top-0 h-full w-px" style={{ left: `${expectedPct}%`, background: "var(--text-faint)", opacity: 0.6 }} />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          <span style={{ color: "var(--text-faint)", opacity: 0.5 }}>│</span> Expected pace
        </span>
        <span className="text-xs font-medium" style={{ color: paceColor }}>
          {actualPct.toFixed(0)}% of projected
        </span>
      </div>
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
  const [expanded,  setExpanded]  = useState<Record<string, any[] | "loading">>({});

  const preset = PRESETS[presetIdx];

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/meta/stats?preset=${preset.preset}&days=${preset.days}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [connected, preset.preset, preset.days]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setExpanded({}); }, [presetIdx]);

  if (!connected) return <ConnectCard platform="meta" />;

  const a         = data?.account    ?? {};
  const prev      = data?.prevAccount ?? {};
  const campaigns: any[] = data?.campaigns ?? [];
  const daily:     any[] = data?.daily     ?? [];

  async function toggleCampaign(id: string, current: string) {
    const next = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setActionMsg(`Setting ${next.toLowerCase()}…`);
    const res  = await fetch("/api/meta/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", campaignId: id, status: next }),
    });
    const json = await res.json();
    setActionMsg(json.success ? `✅ Campaign ${next.toLowerCase()}d` : `❌ ${json.error}`);
    setTimeout(() => { setActionMsg(null); load(); }, 2000);
  }

  async function toggleAdSets(campaignId: string) {
    if (expanded[campaignId]) {
      setExpanded((p) => { const n = { ...p }; delete n[campaignId]; return n; });
      return;
    }
    setExpanded((p) => ({ ...p, [campaignId]: "loading" }));
    try {
      const res  = await fetch(`/api/meta/adsets?campaignId=${campaignId}&preset=${preset.preset}`);
      const json = await res.json();
      setExpanded((p) => ({ ...p, [campaignId]: json.adsets ?? [] }));
    } catch {
      setExpanded((p) => { const n = { ...p }; delete n[campaignId]; return n; });
    }
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
                color:      presetIdx === i ? "#a5b4fc" : "var(--text-muted)",
                border:     `1px solid ${presetIdx === i ? "#3730a3" : "var(--border)"}`,
              }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {actionMsg && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{actionMsg}</span>}
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

      {/* Spend Chart */}
      {daily.length > 0 && (
        <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <SpendChart data={daily} color="#6366f1" label="Daily Spend — Meta Ads" />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <KpiCard label="Total Spend"  value={fmt(a.spend ?? 0)}  icon="💸" sub={`${preset.label} period`}
          change={pct(a.spend, prev.spend)} invert />
        <KpiCard label="Impressions"  value={((a.impressions ?? 0) / 1000).toFixed(1) + "K"} icon="👁" sub="total impressions"
          change={pct(a.impressions, prev.impressions)} />
        <KpiCard label="Reach"        value={((a.reach ?? 0) / 1000).toFixed(1) + "K"} icon="📡" sub="unique people"
          change={pct(a.reach, prev.reach)} />
        <KpiCard label="Clicks"       value={(a.clicks ?? 0).toLocaleString()} icon="🖱️" sub="link clicks"
          change={pct(a.clicks, prev.clicks)} />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="CTR"          value={(a.ctr ?? 0).toFixed(2) + "%"} icon="📈" sub="click-through rate"
          change={pct(a.ctr, prev.ctr)} />
        <KpiCard label="CPC"          value={fmt(a.cpc ?? 0)} icon="🎯" sub="cost per click"
          change={pct(a.cpc, prev.cpc)} invert />
        <KpiCard label="ROAS"         value={(a.roas ?? 0).toFixed(2) + "×"} icon="💰"
          color={(a.roas ?? 0) >= 2 ? "#10b981" : (a.roas ?? 0) >= 1 ? "#fbbf24" : "#ef4444"}
          sub={`$${fmt(a.purchaseValue ?? 0, false)} revenue`}
          change={pct(a.roas, prev.roas)} />
        <KpiCard label="Purchases"    value={(a.purchases ?? 0).toLocaleString()} icon="🛍️" sub="attributed"
          change={pct(a.purchases, prev.purchases)} />
      </div>

      {/* Audit Flags */}
      {data && <AuditFlags account={a} campaigns={campaigns} />}

      {/* Budget Pacing */}
      {data?.monthSpend !== undefined && <SpendPacing monthSpend={data.monthSpend} />}

      {/* Campaign Table */}
      <div className="rounded-xl mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Campaigns</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "var(--text-muted)" }}>
              {campaigns.length}
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>▸ expand ad sets · click status to toggle</span>
        </div>

        {loading && !data ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>No campaigns for this period</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th className="px-3 py-3 w-8" />
                {["Campaign", "Status", "Spend", "Impr.", "Clicks", "CTR", "CPC", "Purchases", "ROAS"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.sort((a: any, b: any) => b.spend - a.spend).map((c: any) => {
                const s        = STATUS_STYLE[c.status] ?? { bg: "#6b728020", text: "var(--text-secondary)" };
                const isOpen   = !!expanded[c.id];
                const adsets   = expanded[c.id];
                return (
                  <Fragment key={c.id}>
                    <tr style={{ borderTop: "1px solid var(--border-subtle)" }}
                      className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => toggleAdSets(c.id)}
                          className="w-5 h-5 rounded flex items-center justify-center mx-auto transition-all hover:opacity-80"
                          style={{ color: isOpen ? "#a5b4fc" : "var(--text-faint)", background: isOpen ? "#1e1e30" : "transparent" }}>
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[160px]" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{c.objective?.replace(/_/g, " ")}</p>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleCampaign(c.id, c.status)}
                          className="px-2 py-0.5 rounded-full text-xs font-medium capitalize hover:opacity-70 transition-opacity"
                          style={{ background: s.bg, color: s.text }}>
                          {c.status.toLowerCase()}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{fmt(c.spend)}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{(c.impressions / 1000).toFixed(1)}K</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.clicks.toLocaleString()}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmt(c.cpc)}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.purchases}</td>
                      <td className="px-4 py-3">
                        <span style={{ color: c.roas >= 2 ? "#10b981" : c.roas >= 1 ? "#fbbf24" : "#ef4444" }}>
                          {c.roas.toFixed(2)}×
                        </span>
                      </td>
                    </tr>

                    {/* Ad Set rows */}
                    {isOpen && adsets === "loading" && (
                      <tr style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-card-inner)" }}>
                        <td colSpan={10} className="px-8 py-3 text-xs" style={{ color: "var(--text-faint)" }}>
                          Loading ad sets…
                        </td>
                      </tr>
                    )}
                    {isOpen && Array.isArray(adsets) && adsets.length === 0 && (
                      <tr style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-card-inner)" }}>
                        <td colSpan={10} className="px-8 py-3 text-xs" style={{ color: "var(--text-faint)" }}>
                          No ad sets found
                        </td>
                      </tr>
                    )}
                    {isOpen && Array.isArray(adsets) && adsets.map((as: any) => {
                      const as_s = STATUS_STYLE[as.status] ?? { bg: "#6b728020", text: "var(--text-secondary)" };
                      return (
                        <tr key={as.id} style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-card-inner)" }}>
                          <td className="px-3 py-2">
                            <div className="w-1 h-4 rounded-full mx-auto" style={{ background: "#6366f130" }} />
                          </td>
                          <td className="px-4 py-2 pl-8">
                            <p className="font-medium truncate max-w-[150px]" style={{ color: "var(--text-secondary)" }}>{as.name}</p>
                            {as.dailyBudget && (
                              <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>${as.dailyBudget.toFixed(2)}/day budget</p>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded-full text-xs capitalize"
                              style={{ background: as_s.bg, color: as_s.text }}>
                              {as.status.toLowerCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{fmt(as.spend)}</td>
                          <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{(as.impressions / 1000).toFixed(1)}K</td>
                          <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{as.clicks.toLocaleString()}</td>
                          <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{as.ctr.toFixed(2)}%</td>
                          <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{fmt(as.cpc)}</td>
                          <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{as.purchases}</td>
                          <td className="px-4 py-2">
                            <span style={{ color: as.roas >= 2 ? "#10b981" : as.roas >= 1 ? "#fbbf24" : "#ef4444" }}>
                              {as.roas.toFixed(2)}×
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Quick Actions</h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-faint)" }}>Manage all campaigns at once</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pause all active",  icon: "⏸", action: "pause_all",  color: "#fbbf24" },
            { label: "Resume all paused", icon: "▶️", action: "resume_all", color: "#10b981" },
            { label: "Refresh data",      icon: "↻",  action: "refresh",   color: "#818cf8" },
          ].map((btn) => (
            <button key={btn.action}
              onClick={btn.action === "refresh" ? load : async () => {
                const targets = campaigns.filter((c: any) =>
                  btn.action === "pause_all" ? c.status === "ACTIVE" : c.status === "PAUSED"
                );
                setActionMsg(`Processing ${targets.length} campaigns…`);
                await Promise.all(targets.map((c: any) =>
                  fetch("/api/meta/action", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "set_status", campaignId: c.id, status: btn.action === "pause_all" ? "PAUSED" : "ACTIVE" }),
                  })
                ));
                setActionMsg("✅ Done");
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
