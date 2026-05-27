"use client";
import { useState } from "react";

type Props = {
  revenue: number;
  orderCount: number;
  aov: number;
  adSpend: number;
  mer: number | null;
  roas: number | null;
  cpa: number | null;
  grossProfit: number;
  channels: { channel: string; revenue: number; orders: number; spend: number; roas: number | null; pct: number }[];
};

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = typeof PERIODS[number];

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(1) + "k";
  return "$" + n.toFixed(2);
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{sub}</p>}
    </div>
  );
}

const WATERFALL_ITEMS = [
  { key: "revenue",      label: "Revenue",        color: "#6366f1" },
  { key: "adSpend",      label: "− Ad Spend",      color: "#ef4444" },
  { key: "cogs",         label: "− COGS (est.)",   color: "#f59e0b" },
  { key: "net",          label: "= Net",           color: "#10b981" },
];

export default function BusinessAnalytics({ revenue, orderCount, aov, adSpend, mer, roas, cpa, grossProfit, channels }: Props) {
  const [period, setPeriod] = useState<Period>("30d");

  const cogs = revenue * 0.55;
  const net = revenue - adSpend - cogs;
  const netMargin = revenue > 0 ? (net / revenue) * 100 : 0;

  const waterfallData = [
    { key: "revenue", value: revenue },
    { key: "adSpend", value: adSpend },
    { key: "cogs",    value: cogs },
    { key: "net",     value: net },
  ];
  const maxW = Math.max(...waterfallData.map((d) => Math.abs(d.value)));

  return (
    <div>
      {/* Period selector */}
      <div className="flex items-center gap-2 mb-6">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Period:</p>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
              style={{
                background: period === p ? "#6366f1" : "transparent",
                color: period === p ? "white" : "var(--text-muted)",
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs ml-2" style={{ color: "var(--text-faint)" }}>
          {period === "7d" ? "Last 7 days" : period === "30d" ? "Last 30 days" : "Last 90 days"}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-6 gap-4 mb-8">
        <Kpi label="Revenue"       value={fmt(revenue)}                     sub="total Shopify" />
        <Kpi label="Ad Spend"      value={adSpend > 0 ? fmt(adSpend) : "—"} sub="Meta + Google" color={adSpend > 0 ? "#ef4444" : undefined} />
        <Kpi label="MER"           value={mer ? mer.toFixed(2) + "×" : "—"} sub="Revenue / Spend" color={mer && mer >= 3 ? "#10b981" : mer && mer >= 1.5 ? "#fbbf24" : mer ? "#ef4444" : undefined} />
        <Kpi label="Blended ROAS"  value={roas ? roas.toFixed(2) + "×" : "—"} sub="all channels" />
        <Kpi label="CPA"           value={cpa ? fmt(cpa) : "—"}             sub="cost per order" />
        <Kpi label="Gross Profit"  value={fmt(grossProfit)}                 sub="~45% est." color="#10b981" />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Revenue Waterfall */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Revenue Waterfall</h2>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Revenue → expenses → net profit</p>
          <div className="space-y-3">
            {WATERFALL_ITEMS.map((item, i) => {
              const d = waterfallData[i];
              const barPct = maxW > 0 ? (Math.abs(d.value) / maxW) * 100 : 0;
              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                    <span className="text-xs font-semibold" style={{ color: item.color }}>
                      {d.value < 0 ? "-" : ""}{fmt(Math.abs(d.value))}
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--border)" }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${barPct}%`, background: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Net margin</span>
            <span className="text-sm font-bold" style={{ color: netMargin >= 10 ? "#10b981" : netMargin >= 0 ? "#fbbf24" : "#ef4444" }}>
              {netMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Channel Attribution */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Channel Attribution</h2>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Revenue contribution by source</p>
          {channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>No channel data</p>
              <p className="text-xs" style={{ color: "#374151" }}>Sync Shopify to populate</p>
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => (
                <div key={ch.channel} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs capitalize" style={{ color: "var(--text-primary)" }}>{ch.channel}</span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{fmt(ch.revenue)}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${ch.pct}%`, background: "#6366f1" }} />
                    </div>
                  </div>
                  <span className="text-xs w-10 text-right" style={{ color: "var(--text-muted)" }}>{ch.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Channel Detail Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Channel Detail</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Spend · Revenue · ROAS · Orders by channel</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "var(--text-faint)" }}>
              {["Channel", "Revenue", "Spend", "ROAS", "Orders", "Share"].map((h) => (
                <th key={h} className="px-5 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channels.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                  No data — sync Shopify to populate
                </td>
              </tr>
            ) : (
              channels.map((ch) => (
                <tr key={ch.channel} style={{ borderTop: "1px solid var(--border-subtle)" }} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <span className="capitalize font-medium" style={{ color: "var(--text-primary)" }}>{ch.channel}</span>
                  </td>
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{fmt(ch.revenue)}</td>
                  <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>
                    {ch.spend > 0 ? fmt(ch.spend) : <span style={{ color: "#374151" }}>—</span>}
                  </td>
                  <td className="px-5 py-3">
                    {ch.roas ? (
                      <span style={{ color: ch.roas >= 2 ? "#10b981" : ch.roas >= 1 ? "#fbbf24" : "#ef4444" }}>
                        {ch.roas.toFixed(2)}×
                      </span>
                    ) : (
                      <span style={{ color: "#374151" }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{ch.orders}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${ch.pct}%`, background: "#6366f1" }} />
                      </div>
                      <span style={{ color: "var(--text-muted)" }}>{ch.pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MER explanation */}
      <div className="mt-6 rounded-xl p-4 flex items-start gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <span className="text-lg flex-shrink-0">ℹ</span>
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>About MER (Marketing Efficiency Ratio)</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            MER = Total Revenue ÷ Total Ad Spend across all channels. A MER of 3× means every $1 spent on ads returns $3 in revenue.
            Connect Meta Ads and Google Ads to see real spend data. COGS estimated at 55% of revenue.
          </p>
        </div>
      </div>
    </div>
  );
}
