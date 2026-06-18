"use client";
import { useState, useEffect, useCallback } from "react";

type ChannelRow = {
  channel: string;
  revenue: number;
  orders: number;
  spend: number;
  roas: number | null;
  pct: number;
};

type Props = {
  metaConnected:    boolean;
  googleConnected:  boolean;
  tiktokConnected:  boolean;
  initialChannels:  ChannelRow[];
};

const PERIODS = [
  { id: "7d",  label: "7 days",  days: 7  },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
] as const;
type PeriodId = typeof PERIODS[number]["id"];

const PL_STORAGE_KEY = "harry_labs_pl_v2";

function periodDates(days: number): { since: string; until: string } {
  const pad  = (n: number) => String(n).padStart(2, "0");
  const ymd  = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  return { since: ymd(since), until: ymd(until) };
}

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(2);
}

function Kpi({
  label, value, sub, color, loading,
}: {
  label: string; value: string; sub?: string; color?: string; loading?: boolean;
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>{label}</p>
      {loading ? (
        <div className="h-8 w-24 rounded-md animate-pulse" style={{ background: "var(--bg-subtle)" }} />
      ) : (
        <p className="text-2xl font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      )}
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{sub}</p>}
    </div>
  );
}

function SpendPill({ label, value, connected, loading }: {
  label: string; value: number; connected: boolean; loading: boolean;
}) {
  if (!connected) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981" }} />
      <span className="text-xs" style={{ color: "var(--text-faint)" }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {loading ? "…" : fmt(value)}
      </span>
    </div>
  );
}

export default function BusinessAnalytics({
  metaConnected, googleConnected, tiktokConnected, initialChannels,
}: Props) {
  const [period,      setPeriod]      = useState<PeriodId>("30d");
  const [loading,     setLoading]     = useState(true);
  const [revenue,     setRevenue]     = useState(0);
  const [orderCount,  setOrderCount]  = useState(0);
  const [metaSpend,   setMetaSpend]   = useState(0);
  const [googleSpend, setGoogleSpend] = useState(0);
  const [tiktokSpend, setTiktokSpend] = useState(0);
  const [cogsRate,    setCogsRate]    = useState(0.45);

  // Read COGS config from localStorage (set in P&L page)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PL_STORAGE_KEY) ?? "{}");
      if (saved.cogsMode === "pct" && saved.cogsPct) {
        setCogsRate(parseFloat(saved.cogsPct) / 100);
      }
    } catch {}
  }, []);

  const fetchData = useCallback(async (pid: PeriodId) => {
    setLoading(true);
    const p    = PERIODS.find((x) => x.id === pid)!;
    const { since, until } = periodDates(p.days);

    const fetches: Promise<void>[] = [];

    // Revenue
    fetches.push(
      fetch(`/api/pl/revenue?since=${since}&until=${until}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) {
            setRevenue(d.netRevenue ?? d.revenue ?? 0);
            setOrderCount(d.orderCount ?? 0);
          }
        })
        .catch(() => {})
    );

    // Meta spend
    if (metaConnected) {
      fetches.push(
        fetch(`/api/meta/stats?since=${since}&until=${until}&preset=custom&days=${p.days}`)
          .then((r) => r.json())
          .then((d) => { setMetaSpend(d.account?.spend ?? 0); })
          .catch(() => {})
      );
    } else {
      setMetaSpend(0);
    }

    // Google spend
    if (googleConnected) {
      fetches.push(
        fetch(`/api/google/stats?days=${p.days}`)
          .then((r) => r.json())
          .then((d) => { setGoogleSpend(d.account?.spend ?? 0); })
          .catch(() => {})
      );
    } else {
      setGoogleSpend(0);
    }

    // TikTok spend
    if (tiktokConnected) {
      fetches.push(
        fetch(`/api/tiktok/stats?days=${p.days}`)
          .then((r) => r.json())
          .then((d) => { setTiktokSpend(d.account?.spend ?? 0); })
          .catch(() => {})
      );
    } else {
      setTiktokSpend(0);
    }

    await Promise.all(fetches);
    setLoading(false);
  }, [metaConnected, googleConnected, tiktokConnected]);

  useEffect(() => { fetchData(period); }, [period, fetchData]);

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const anyAds      = metaConnected || googleConnected || tiktokConnected;
  const totalSpend  = metaSpend + googleSpend + tiktokSpend;
  const cogs        = revenue * cogsRate;
  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const contribution = grossProfit - totalSpend;
  const contribPct  = revenue > 0 ? (contribution / revenue) * 100 : 0;
  const netProfit   = contribution; // contribution = net before other expenses (we don't have them here)
  const netMargin   = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const aov         = orderCount > 0 ? revenue / orderCount : 0;
  const mer         = totalSpend > 0 ? revenue / totalSpend : null;
  const cpa         = totalSpend > 0 && orderCount > 0 ? totalSpend / orderCount : null;
  const cogsLabel   = `${(cogsRate * 100).toFixed(0)}% from P&L config`;

  const waterfallSteps = [
    { label: "Revenue",             value: revenue,      color: "#10b981", isDeduct: false },
    { label: `− COGS (${(cogsRate*100).toFixed(0)}%)`, value: cogs, color: "#f59e0b", isDeduct: true  },
    { label: "Gross Profit",        value: grossProfit,  color: "#34d399", isDeduct: false },
    ...(anyAds
      ? [{ label: "− Ad Spend", value: totalSpend, color: "#ef4444", isDeduct: true },
         { label: "Contribution Margin", value: contribution, color: "#818cf8", isDeduct: false }]
      : []
    ),
  ];
  const maxBar = Math.max(...waterfallSteps.map((s) => s.value));

  const currentPeriodLabel = PERIODS.find((p) => p.id === period)!.label;

  return (
    <div>
      {/* ── Period selector ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Period:</p>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
                style={{
                  background: period === p.id ? "#6366f1" : "transparent",
                  color:      period === p.id ? "white"   : "var(--text-muted)",
                }}
              >
                {p.id}
              </button>
            ))}
          </div>
          <p className="text-xs ml-1" style={{ color: "var(--text-faint)" }}>Last {currentPeriodLabel}</p>
        </div>

        {/* Live spend source pills */}
        {anyAds && (
          <div className="flex items-center gap-3">
            <SpendPill label="Meta"   value={metaSpend}   connected={metaConnected}   loading={loading} />
            <SpendPill label="Google" value={googleSpend} connected={googleConnected} loading={loading} />
            <SpendPill label="TikTok" value={tiktokSpend} connected={tiktokConnected} loading={loading} />
          </div>
        )}
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-6 gap-4 mb-8">
        <Kpi
          label="Revenue"
          value={fmt(revenue)}
          sub={`${orderCount} orders`}
          color="#10b981"
          loading={loading}
        />
        <Kpi
          label="Ad Spend"
          value={anyAds ? fmt(totalSpend) : "—"}
          sub={anyAds ? "live from platforms" : "no platforms connected"}
          color={totalSpend > 0 ? "#ef4444" : undefined}
          loading={loading && anyAds}
        />
        <Kpi
          label="MER"
          value={mer ? mer.toFixed(2) + "×" : "—"}
          sub="Revenue ÷ Spend"
          color={mer == null ? undefined : mer >= 4 ? "#10b981" : mer >= 2 ? "#fbbf24" : "#ef4444"}
          loading={loading && anyAds}
        />
        <Kpi
          label="Gross Profit"
          value={fmt(grossProfit)}
          sub={`${grossMargin.toFixed(1)}% margin · ${cogsLabel}`}
          color={grossProfit >= 0 ? "#34d399" : "#ef4444"}
          loading={loading}
        />
        <Kpi
          label="Contribution"
          value={anyAds ? fmt(contribution) : "—"}
          sub={anyAds ? `${contribPct.toFixed(1)}% of revenue` : "connect ads to see"}
          color={contribution >= 0 ? "#818cf8" : "#ef4444"}
          loading={loading && anyAds}
        />
        <Kpi
          label="CPA"
          value={cpa ? fmt(cpa) : "—"}
          sub="cost per order"
          loading={loading && anyAds}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* ── Revenue Waterfall ────────────────────────────────────────────────── */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Revenue Waterfall</h2>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
            Revenue → COGS{anyAds ? " → Ad Spend → Contribution" : " → Gross Profit"}
          </p>

          {loading ? (
            <div className="space-y-4">
              {[1,2,3,4].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-24 rounded animate-pulse" style={{ background: "var(--bg-subtle)" }} />
                  <div className="h-2 rounded-full animate-pulse" style={{ background: "var(--bg-subtle)", width: `${40 + i * 15}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {waterfallSteps.map((step) => {
                const barPct = maxBar > 0 ? (step.value / maxBar) * 100 : 0;
                return (
                  <div key={step.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{
                        color:      step.isDeduct ? "var(--text-faint)" : "var(--text-secondary)",
                        paddingLeft: step.isDeduct ? "10px" : "0",
                      }}>
                        {step.label}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: step.color }}>
                        {step.isDeduct ? "−" : ""}{fmt(Math.abs(step.value))}
                        {!step.isDeduct && revenue > 0 && (
                          <span className="ml-1.5 font-normal" style={{ color: "var(--text-faint)" }}>
                            {((step.value / revenue) * 100).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "var(--border)" }}>
                      <div className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(0, barPct)}%`, background: step.color, opacity: step.isDeduct ? 0.7 : 1 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && revenue > 0 && (
            <div className="mt-5 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: "1px solid var(--border)" }}>
              <div>
                <p className="text-xs mb-0.5" style={{ color: "var(--text-faint)" }}>Gross margin</p>
                <p className="text-base font-bold" style={{ color: grossMargin >= 40 ? "#34d399" : grossMargin >= 20 ? "#fbbf24" : "#ef4444" }}>
                  {grossMargin.toFixed(1)}%
                </p>
              </div>
              {anyAds && (
                <div>
                  <p className="text-xs mb-0.5" style={{ color: "var(--text-faint)" }}>Contribution margin</p>
                  <p className="text-base font-bold" style={{ color: contribPct >= 20 ? "#818cf8" : contribPct >= 0 ? "#fbbf24" : "#ef4444" }}>
                    {contribPct.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Channel Attribution ──────────────────────────────────────────────── */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Channel Attribution</h2>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Revenue by order source (last 30d)</p>

          {initialChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>No channel data</p>
              <p className="text-xs" style={{ color: "#374151" }}>Sync Shopify to populate</p>
            </div>
          ) : (
            <div className="space-y-3">
              {initialChannels.map((ch) => (
                <div key={ch.channel} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs capitalize font-medium" style={{ color: "var(--text-primary)" }}>{ch.channel}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{fmt(ch.revenue)}</span>
                        <span className="text-xs" style={{ color: "var(--text-faint)" }}>{ch.orders} orders</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                      <div className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${ch.pct}%`, background: "#6366f1" }} />
                    </div>
                  </div>
                  <span className="text-xs w-10 text-right font-medium" style={{ color: "var(--text-muted)" }}>
                    {ch.pct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Channel Detail Table ─────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Platform Summary</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Revenue · Spend · ROAS per channel — last {currentPeriodLabel}
            </p>
          </div>
          {loading && (
            <span className="text-xs px-2 py-1 rounded-full animate-pulse"
              style={{ background: "var(--bg-subtle)", color: "var(--text-faint)" }}>
              Fetching…
            </span>
          )}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border-subtle)" }}>
              {["Platform", "Revenue", "Spend", "ROAS", "MER contribution", "Status"].map((h) => (
                <th key={h} className="px-5 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Shopify row */}
            <tr style={{ borderTop: "1px solid var(--border-subtle)" }} className="hover:bg-white/[0.02]">
              <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>Shopify (organic)</td>
              <td className="px-5 py-3 font-medium" style={{ color: "#10b981" }}>
                {loading ? "…" : fmt(revenue)}
              </td>
              <td className="px-5 py-3" style={{ color: "var(--text-faint)" }}>—</td>
              <td className="px-5 py-3" style={{ color: "var(--text-faint)" }}>—</td>
              <td className="px-5 py-3" style={{ color: "var(--text-faint)" }}>
                {loading ? "…" : totalSpend > 0 ? `${((revenue / revenue) * 100).toFixed(0)}% of rev` : "—"}
              </td>
              <td className="px-5 py-3">
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#10b98120", color: "#10b981" }}>Connected</span>
              </td>
            </tr>

            {/* Meta row */}
            <tr style={{ borderTop: "1px solid var(--border-subtle)" }} className="hover:bg-white/[0.02]">
              <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>Meta Ads</td>
              <td className="px-5 py-3" style={{ color: "var(--text-faint)" }}>—</td>
              <td className="px-5 py-3 font-medium" style={{ color: metaConnected ? "#ef4444" : "var(--text-faint)" }}>
                {!metaConnected ? "—" : loading ? "…" : fmt(metaSpend)}
              </td>
              <td className="px-5 py-3">
                {metaConnected && !loading && metaSpend > 0 && revenue > 0 ? (
                  <span style={{ color: (revenue / metaSpend) >= 2 ? "#10b981" : "#fbbf24" }}>
                    {(revenue / metaSpend).toFixed(2)}×
                  </span>
                ) : <span style={{ color: "var(--text-faint)" }}>—</span>}
              </td>
              <td className="px-5 py-3" style={{ color: "var(--text-faint)" }}>
                {metaConnected && !loading && totalSpend > 0
                  ? `${((metaSpend / totalSpend) * 100).toFixed(0)}% of spend`
                  : "—"}
              </td>
              <td className="px-5 py-3">
                <span className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: metaConnected ? "#10b98120" : "#ef444420", color: metaConnected ? "#10b981" : "#ef4444" }}>
                  {metaConnected ? "Connected" : "Not connected"}
                </span>
              </td>
            </tr>

            {/* Google row */}
            <tr style={{ borderTop: "1px solid var(--border-subtle)" }} className="hover:bg-white/[0.02]">
              <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>Google Ads</td>
              <td className="px-5 py-3" style={{ color: "var(--text-faint)" }}>—</td>
              <td className="px-5 py-3 font-medium" style={{ color: googleConnected ? "#ef4444" : "var(--text-faint)" }}>
                {!googleConnected ? "—" : loading ? "…" : fmt(googleSpend)}
              </td>
              <td className="px-5 py-3">
                {googleConnected && !loading && googleSpend > 0 && revenue > 0 ? (
                  <span style={{ color: (revenue / googleSpend) >= 2 ? "#10b981" : "#fbbf24" }}>
                    {(revenue / googleSpend).toFixed(2)}×
                  </span>
                ) : <span style={{ color: "var(--text-faint)" }}>—</span>}
              </td>
              <td className="px-5 py-3" style={{ color: "var(--text-faint)" }}>
                {googleConnected && !loading && totalSpend > 0
                  ? `${((googleSpend / totalSpend) * 100).toFixed(0)}% of spend`
                  : "—"}
              </td>
              <td className="px-5 py-3">
                <span className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: googleConnected ? "#10b98120" : "#ef444420", color: googleConnected ? "#10b981" : "#ef4444" }}>
                  {googleConnected ? "Connected" : "Not connected"}
                </span>
              </td>
            </tr>

            {/* TikTok row */}
            <tr style={{ borderTop: "1px solid var(--border-subtle)" }} className="hover:bg-white/[0.02]">
              <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>TikTok Ads</td>
              <td className="px-5 py-3" style={{ color: "var(--text-faint)" }}>—</td>
              <td className="px-5 py-3 font-medium" style={{ color: tiktokConnected ? "#ef4444" : "var(--text-faint)" }}>
                {!tiktokConnected ? "—" : loading ? "…" : fmt(tiktokSpend)}
              </td>
              <td className="px-5 py-3">
                {tiktokConnected && !loading && tiktokSpend > 0 && revenue > 0 ? (
                  <span style={{ color: (revenue / tiktokSpend) >= 2 ? "#10b981" : "#fbbf24" }}>
                    {(revenue / tiktokSpend).toFixed(2)}×
                  </span>
                ) : <span style={{ color: "var(--text-faint)" }}>—</span>}
              </td>
              <td className="px-5 py-3" style={{ color: "var(--text-faint)" }}>
                {tiktokConnected && !loading && totalSpend > 0
                  ? `${((tiktokSpend / totalSpend) * 100).toFixed(0)}% of spend`
                  : "—"}
              </td>
              <td className="px-5 py-3">
                <span className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: tiktokConnected ? "#10b98120" : "#6366f120", color: tiktokConnected ? "#10b981" : "#a5b4fc" }}>
                  {tiktokConnected ? "Connected" : "Pending"}
                </span>
              </td>
            </tr>

            {/* Blended total */}
            {anyAds && !loading && totalSpend > 0 && (
              <tr style={{ borderTop: "2px solid var(--border)" }} className="font-semibold">
                <td className="px-5 py-3" style={{ color: "var(--text-primary)" }}>Blended Total</td>
                <td className="px-5 py-3" style={{ color: "#10b981" }}>{fmt(revenue)}</td>
                <td className="px-5 py-3" style={{ color: "#ef4444" }}>{fmt(totalSpend)}</td>
                <td className="px-5 py-3">
                  {mer ? (
                    <span style={{ color: mer >= 4 ? "#10b981" : mer >= 2 ? "#fbbf24" : "#ef4444" }}>
                      {mer.toFixed(2)}× MER
                    </span>
                  ) : "—"}
                </td>
                <td className="px-5 py-3" style={{ color: "var(--text-faint)" }}>100% of spend</td>
                <td className="px-5 py-3" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Info bar ──────────────────────────────────────────────────────────── */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <span className="text-base flex-shrink-0" style={{ color: "#6366f1" }}>ℹ</span>
        <div className="space-y-1">
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>How these numbers are calculated</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            <strong>Revenue</strong> — Shopify orders (refunds excluded) for the selected period.{" "}
            <strong>Ad Spend</strong> — live from connected ad platforms, re-fetched when you switch periods.{" "}
            <strong>COGS rate</strong> — {(cogsRate * 100).toFixed(0)}%, read from your P&L configuration (change it on the P&L page).{" "}
            <strong>MER</strong> = Total Revenue ÷ Total Ad Spend. A MER of 4× means $1 in ads returns $4 in revenue.{" "}
            <strong>Contribution Margin</strong> = Gross Profit − Ad Spend.{" "}
            {!anyAds && "Connect Meta or Google Ads in Integrations to unlock spend metrics."}
          </p>
        </div>
      </div>
    </div>
  );
}
