"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import PLInteractive, { type BasePL } from "./PLInteractive";

// ─── Types ────────────────────────────────────────────────────────────────────
type ExpenseRow = { id: string; label: string; amount: string };
type Period     = "this_month" | "last_month" | "last_90d" | string; // string = "YYYY-MM"

type Props = {
  metaConnected:   boolean;
  googleConnected: boolean;
  tiktokConnected: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "harry_labs_pl_v2";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function aud(n: number, decimals = 0) {
  return "$" + Math.abs(n).toLocaleString("en-AU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pctLabel(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function getPeriodDates(period: Period): { since: string; until: string; label: string } {
  const now  = new Date();
  const pad  = (n: number) => String(n).padStart(2, "0");
  const ymd  = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (period === "this_month") {
    const since = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    return { since, until: ymd(now), label: now.toLocaleDateString("en-AU", { month: "long", year: "numeric" }) };
  }
  if (period === "last_month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last  = new Date(now.getFullYear(), now.getMonth(), 0);
    return { since: ymd(first), until: ymd(last), label: first.toLocaleDateString("en-AU", { month: "long", year: "numeric" }) };
  }
  if (period === "last_90d") {
    const since = new Date(now); since.setDate(now.getDate() - 89);
    return { since: ymd(since), until: ymd(now), label: "Last 90 Days" };
  }
  // "YYYY-MM"
  const [y, m] = period.split("-").map(Number);
  const first  = new Date(y, m - 1, 1);
  const last   = new Date(y, m, 0);
  return { since: ymd(first), until: ymd(last), label: first.toLocaleDateString("en-AU", { month: "long", year: "numeric" }) };
}

function getMonthOptions(): Period[] {
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth() + 1; // 1-indexed
  const months: Period[] = [];
  for (let m = 1; m <= month; m++) {
    months.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return months.reverse(); // most recent first
}

function monthLabel(period: string) {
  if (period === "this_month") return "This Month";
  if (period === "last_month") return "Last Month";
  if (period === "last_90d")   return "90 Days";
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "short" });
}

// ─── Waterfall chart ──────────────────────────────────────────────────────────
function WaterfallChart({ revenue, cogs, adSpend, otherExpenses, netProfit }: {
  revenue: number; cogs: number; adSpend: number; otherExpenses: number; netProfit: number;
}) {
  if (revenue <= 0) return null;
  const grossProfit   = revenue - cogs;
  const contribution  = grossProfit - adSpend;

  const barPct = (v: number) => Math.max(0, Math.min(100, (v / revenue) * 100));

  const steps = [
    { label: "Revenue",            value: revenue,      pct: 100,              color: "#10b981", isDeduction: false },
    { label: "− COGS",             value: -cogs,        pct: barPct(cogs),     color: "#ef4444", isDeduction: true  },
    { label: "Gross Profit",       value: grossProfit,  pct: barPct(grossProfit), color: "#34d399", isDeduction: false },
    { label: "− Ad Spend",         value: -adSpend,     pct: barPct(adSpend),  color: "#f59e0b", isDeduction: true  },
    { label: "Contribution Margin",value: contribution, pct: barPct(contribution), color: "#818cf8", isDeduction: false },
    { label: "− Other Expenses",   value: -otherExpenses, pct: barPct(otherExpenses), color: "#ef4444", isDeduction: true },
    { label: "Net Profit",         value: netProfit,    pct: barPct(Math.max(0, netProfit)), color: netProfit >= 0 ? "#10b981" : "#ef4444", isDeduction: false },
  ];

  return (
    <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h3 className="text-xs uppercase tracking-wider mb-5" style={{ color: "var(--text-muted)" }}>P&L Waterfall</h3>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="text-xs w-36 flex-shrink-0 text-right" style={{
              color: s.isDeduction ? "var(--text-faint)" : "var(--text-secondary)",
              paddingLeft: s.isDeduction ? "12px" : "0",
              fontWeight:  s.isDeduction ? 400 : 500,
            }}>
              {s.label}
            </div>
            <div className="flex-1 h-5 rounded-sm overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
              <div className="h-full rounded-sm transition-all duration-500"
                style={{ width: `${s.pct}%`, background: s.color, opacity: s.isDeduction ? 0.6 : 1 }} />
            </div>
            <div className="w-28 text-right flex-shrink-0">
              <span className="text-xs font-medium" style={{ color: s.value < 0 ? "#ef4444" : s.value === revenue ? "#10b981" : "var(--text-secondary)" }}>
                {s.value < 0 ? "-" : s.value === revenue ? "" : "+"}{aud(Math.abs(s.value))}
              </span>
              {!s.isDeduction && revenue > 0 && (
                <span className="text-xs ml-2" style={{ color: "var(--text-faint)" }}>
                  {((s.value / revenue) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, badge }: {
  label: string; value: string; sub?: string; color?: string; badge?: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{sub}</p>}
      {badge && <span className="text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ background: "#6366f120", color: "#a5b4fc" }}>{badge}</span>}
    </div>
  );
}

// ─── Ad spend source badge ────────────────────────────────────────────────────
function SpendBadge({ label, value, connected, loading }: { label: string; value: number; connected: boolean; loading: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: connected ? "#10b981" : "var(--text-faint)" }} />
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
        {!connected && <span className="text-xs" style={{ color: "var(--text-faint)" }}>(not connected)</span>}
      </div>
      <span className="text-xs font-medium" style={{ color: connected ? "var(--text-primary)" : "var(--text-faint)" }}>
        {loading ? "…" : connected ? aud(value, 2) : "—"}
      </span>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
export default function PLView({ metaConnected, googleConnected, tiktokConnected }: Props) {
  const [mainTab,     setMainTab]    = useState<"summary" | "interactive">("summary");
  const [period,      setPeriod]     = useState<Period>("this_month");
  const [revData,     setRevData]    = useState<{ revenue: number; orderCount: number; refunds: number } | null>(null);
  const [metaSpend,   setMetaSpend]  = useState(0);
  const [googleSpend, setGoogleSpend]= useState(0);
  const [tiktokSpend, setTiktokSpend]= useState(0);
  const [loadingRev,  setLoadingRev] = useState(false);
  const [loadingAds,  setLoadingAds] = useState(false);

  // Expense config (persisted)
  const [cogsMode,    setCogsMode]    = useState<"pct" | "fixed">("pct");
  const [cogsPct,     setCogsPct]     = useState("45");
  const [cogsFixed,   setCogsFixed]   = useState("0");
  const [manualAdSpend, setManualAdSpend] = useState("0");
  const [shipping,    setShipping]    = useState("0");
  const [platformFee, setPlatformFee] = useState("0");
  const [extraRows,   setExtraRows]   = useState<ExpenseRow[]>([]);
  const [newLabel,    setNewLabel]    = useState("");
  const [newAmount,   setNewAmount]   = useState("");
  const [saved,       setSaved]       = useState(false);
  const [showAdManual, setShowAdManual] = useState(false);

  // Load saved config
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (s.cogsPct)     setCogsPct(s.cogsPct);
      if (s.cogsFixed)   setCogsFixed(s.cogsFixed);
      if (s.cogsMode)    setCogsMode(s.cogsMode);
      if (s.manualAdSpend) setManualAdSpend(s.manualAdSpend);
      if (s.shipping)    setShipping(s.shipping);
      if (s.platformFee) setPlatformFee(s.platformFee);
      if (s.extraRows)   setExtraRows(s.extraRows);
    } catch {}
  }, []);

  const saveConfig = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cogsPct, cogsFixed, cogsMode, manualAdSpend, shipping, platformFee, extraRows,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [cogsPct, cogsFixed, cogsMode, manualAdSpend, shipping, platformFee, extraRows]);

  // Fetch revenue when period changes
  const fetchRevenue = useCallback(async (p: Period) => {
    setLoadingRev(true);
    try {
      const { since, until } = getPeriodDates(p);
      const res  = await fetch(`/api/pl/revenue?since=${since}&until=${until}`);
      const json = await res.json();
      if (!json.error) setRevData({ revenue: json.netRevenue ?? json.revenue, orderCount: json.orderCount, refunds: json.refunds ?? 0 });
    } catch {}
    setLoadingRev(false);
  }, []);

  // Fetch ad spend when period changes
  const fetchAdSpend = useCallback(async (p: Period) => {
    if (!metaConnected && !googleConnected && !tiktokConnected) return;
    setLoadingAds(true);
    const { since, until } = getPeriodDates(p);

    const promises: Promise<void>[] = [];

    if (metaConnected) {
      promises.push(
        fetch(`/api/meta/stats?since=${since}&until=${until}&preset=custom&days=30`)
          .then((r) => r.json())
          .then((d) => { if (d.account?.spend) setMetaSpend(d.account.spend); })
          .catch(() => {})
      );
    }
    if (googleConnected) {
      // Calculate approximate days for the period
      const s = new Date(since), u = new Date(until);
      const days = Math.round((u.getTime() - s.getTime()) / 86400000) + 1;
      promises.push(
        fetch(`/api/google/stats?days=${days}`)
          .then((r) => r.json())
          .then((d) => { if (d.account?.spend) setGoogleSpend(d.account.spend); })
          .catch(() => {})
      );
    }
    if (tiktokConnected) {
      const s = new Date(since), u = new Date(until);
      const days = Math.round((u.getTime() - s.getTime()) / 86400000) + 1;
      promises.push(
        fetch(`/api/tiktok/stats?days=${days}`)
          .then((r) => r.json())
          .then((d) => { if (d.account?.spend) setTiktokSpend(d.account.spend); })
          .catch(() => {})
      );
    }

    await Promise.all(promises);
    setLoadingAds(false);
  }, [metaConnected, googleConnected, tiktokConnected]);

  useEffect(() => {
    fetchRevenue(period);
    fetchAdSpend(period);
  }, [period, fetchRevenue, fetchAdSpend]);

  // ── Calculations ─────────────────────────────────────────────────────────────
  const revenue     = revData?.revenue    ?? 0;
  const orderCount  = revData?.orderCount ?? 0;
  const refunds     = revData?.refunds    ?? 0;

  const cogs        = cogsMode === "pct"
    ? revenue * (parseFloat(cogsPct) / 100)
    : parseFloat(cogsFixed) || 0;

  const grossProfit  = revenue - cogs;
  const grossMargin  = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const anyPlatformConnected = metaConnected || googleConnected || tiktokConnected;
  const autoAdSpend  = metaSpend + googleSpend + tiktokSpend;
  const totalAdSpend = anyPlatformConnected && !showAdManual
    ? autoAdSpend
    : (parseFloat(manualAdSpend) || 0);

  const contribution    = grossProfit - totalAdSpend;
  const contributionPct = revenue > 0 ? (contribution / revenue) * 100 : 0;
  const mer             = totalAdSpend > 0 ? revenue / totalAdSpend : null;

  const shippingNum   = parseFloat(shipping)    || 0;
  const platFeeNum    = parseFloat(platformFee) || 0;
  const extraTotal    = extraRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const otherExpenses = shippingNum + platFeeNum + extraTotal;

  const totalExpenses = cogs + totalAdSpend + otherExpenses;
  const netProfit     = revenue - totalExpenses;
  const netMargin     = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const aov           = orderCount > 0 ? revenue / orderCount : 0;
  const cogsPerOrder  = orderCount > 0 ? cogs / orderCount : 0;
  const adPerOrder    = orderCount > 0 ? totalAdSpend / orderCount : 0;
  const contribPerOrd = orderCount > 0 ? contribution / orderCount : 0;
  const netPerOrder   = orderCount > 0 ? netProfit / orderCount : 0;

  // ── Month options ─────────────────────────────────────────────────────────────
  const monthOptions = getMonthOptions();

  // ── CSV export ────────────────────────────────────────────────────────────────
  const { since: periodSince, until: periodUntil, label: periodLabel } = getPeriodDates(period);
  function exportCSV() {
    const rows = [
      ["P&L Statement", periodLabel],
      [],
      ["Revenue",           revenue.toFixed(2)],
      ["  Refunds",         refunds.toFixed(2)],
      ["COGS",              cogs.toFixed(2)],
      ["Gross Profit",      grossProfit.toFixed(2)],
      ["  Gross Margin",    grossMargin.toFixed(1) + "%"],
      ["Ad Spend",          totalAdSpend.toFixed(2)],
      ["  Meta",            metaSpend.toFixed(2)],
      ["  Google",          googleSpend.toFixed(2)],
      ["  TikTok",          tiktokSpend.toFixed(2)],
      ["Contribution Margin", contribution.toFixed(2)],
      ["  CM%",             contributionPct.toFixed(1) + "%"],
      ["  MER",             mer ? mer.toFixed(2) + "x" : "—"],
      ["Shipping",          shippingNum.toFixed(2)],
      ["Platform Fees",     platFeeNum.toFixed(2)],
      ...extraRows.map((r) => [r.label, (parseFloat(r.amount) || 0).toFixed(2)]),
      ["Net Profit",        netProfit.toFixed(2)],
      ["  Net Margin",      netMargin.toFixed(1) + "%"],
      [],
      ["Orders",            orderCount],
      ["AOV",               aov.toFixed(2)],
      ["Net per Order",     netPerOrder.toFixed(2)],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const a   = document.createElement("a");
    a.href    = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `PL_${period}.csv`;
    a.click();
  }

  function addRow() {
    if (!newLabel) return;
    setExtraRows((r) => [...r, { id: Date.now().toString(), label: newLabel, amount: newAmount || "0" }]);
    setNewLabel(""); setNewAmount("");
  }

  const netColor     = netProfit    >= 0 ? "#10b981" : "#ef4444";
  const contribColor = contribution >= 0 ? "#818cf8" : "#ef4444";
  const grossColor   = grossProfit  >= 0 ? "#34d399" : "#ef4444";

  // ── BasePL for Interactive tab ───────────────────────────────────────────────
  const basePL: BasePL = {
    revenue,
    cogs,
    cogsRate:      parseFloat(cogsMode === "pct" ? cogsPct : "0") / 100 || 0,
    adSpend:       totalAdSpend,
    contribution,
    otherExpenses,
    netProfit,
    netMargin:     revenue > 0 ? netProfit / revenue : 0,
    grossMargin:   revenue > 0 ? grossProfit / revenue : 0,
    orderCount,
    aov,
    periodLabel,
  };

  return (
    <div>
      {/* ── Main tab switcher ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex p-0.5 rounded-lg w-fit" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {([
            { id: "summary",     label: "📊 P&L Summary" },
            { id: "interactive", label: "🔮 Interactive Scenarios" },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setMainTab(t.id)}
              className="text-sm px-4 py-1.5 rounded-md font-medium transition-all"
              style={{
                background: mainTab === t.id ? "#1e1e30" : "transparent",
                color:      mainTab === t.id ? "#a5b4fc" : "var(--text-muted)",
              }}>
              {t.label}
            </button>
          ))}
        </div>
        {mainTab === "summary" && (
          <button onClick={exportCSV}
            className="text-xs px-3 py-1.5 rounded-md font-medium hover:opacity-80"
            style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px solid #3730a3" }}>
            ↓ CSV
          </button>
        )}
      </div>

      {/* ── Interactive tab ───────────────────────────────────────────────────── */}
      {mainTab === "interactive" && <PLInteractive base={basePL} periodSince={periodSince} periodUntil={periodUntil} />}

      {/* ── Summary tab ───────────────────────────────────────────────────────── */}
      {mainTab === "summary" && <div>

      {/* ── Period selector + Export ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 flex-wrap">
          {(["this_month", "last_month", "last_90d"] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className="text-xs px-3 py-1.5 rounded-md font-medium"
              style={{
                background: period === p ? "#1e1e30" : "transparent",
                color:      period === p ? "#a5b4fc" : "var(--text-muted)",
                border:     `1px solid ${period === p ? "#3730a3" : "var(--border)"}`,
              }}>
              {monthLabel(p)}
            </button>
          ))}
          <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />
          {monthOptions.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className="text-xs px-3 py-1.5 rounded-md font-medium"
              style={{
                background: period === p ? "#1e1e30" : "transparent",
                color:      period === p ? "#a5b4fc" : "var(--text-muted)",
                border:     `1px solid ${period === p ? "#3730a3" : "var(--border)"}`,
              }}>
              {monthLabel(p)}
            </button>
          ))}
        </div>
        <span className="text-xs px-3 py-1.5 rounded-md" style={{ background: "var(--bg-card)", color: "var(--text-faint)", border: "1px solid var(--border)" }}>
          {periodLabel}
        </span>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <KpiCard
          label="Net Revenue"
          value={loadingRev ? "…" : aud(revenue, 2)}
          sub={orderCount > 0 ? `${orderCount} orders · ${refunds > 0 ? `${aud(refunds, 2)} refunded` : "no refunds"}` : undefined}
          color="#10b981"
        />
        <KpiCard
          label="Gross Profit"
          value={loadingRev ? "…" : aud(grossProfit, 2)}
          sub={`${grossMargin.toFixed(1)}% margin`}
          color={grossColor}
        />
        <KpiCard
          label="Contribution Margin"
          value={loadingRev || loadingAds ? "…" : aud(contribution, 2)}
          sub={`${contributionPct.toFixed(1)}% of revenue`}
          color={contribColor}
          badge={mer ? `MER ${mer.toFixed(2)}×` : undefined}
        />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Net Profit"
          value={loadingRev ? "…" : aud(netProfit, 2)}
          sub={`${netMargin.toFixed(1)}% net margin`}
          color={netColor}
        />
        <KpiCard
          label="Ad Spend"
          value={loadingAds ? "…" : aud(totalAdSpend, 2)}
          sub={anyPlatformConnected && !showAdManual ? "auto from connected platforms" : "manual entry"}
          color="#f59e0b"
        />
        <KpiCard
          label="Orders / AOV"
          value={loadingRev ? "…" : String(orderCount)}
          sub={aov > 0 ? `${aud(aov, 2)} avg order` : undefined}
        />
      </div>

      {/* ── Waterfall chart ───────────────────────────────────────────────────── */}
      <WaterfallChart
        revenue={revenue}
        cogs={cogs}
        adSpend={totalAdSpend}
        otherExpenses={otherExpenses}
        netProfit={netProfit}
      />

      {/* ── P&L Statement + Expense Config ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5 mb-5">

        {/* P&L Statement */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>P&L Statement</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{periodLabel}</p>
          </div>
          <div className="p-5">
            {[
              { label: "Gross Revenue",      value: revenue + refunds,  indent: 0, muted: false },
              ...(refunds > 0 ? [{ label: "Refunds",  value: -refunds, indent: 1, muted: true }] : []),
              { label: "Net Revenue",        value: revenue,    indent: 0, muted: false, divider: true, bold: true, color: "#10b981" },
              { label: `COGS (${cogsMode === "pct" ? cogsPct + "%" : "fixed"})`, value: -cogs, indent: 1, muted: true },
              { label: "Gross Profit",       value: grossProfit, indent: 0, divider: true, bold: true, color: grossColor },
              { label: "  Gross Margin",     value: null, indent: 1, muted: true, label2: grossMargin.toFixed(1) + "%" },
              metaConnected   ? { label: "Ad Spend — Meta",   value: -metaSpend,    indent: 1, muted: true } : null,
              googleConnected ? { label: "Ad Spend — Google", value: -googleSpend,  indent: 1, muted: true } : null,
              tiktokConnected ? { label: "Ad Spend — TikTok", value: -tiktokSpend,  indent: 1, muted: true } : null,
              (!anyPlatformConnected || showAdManual) ? { label: "Ad Spend (manual)", value: -(parseFloat(manualAdSpend) || 0), indent: 1, muted: true } : null,
              { label: "Contribution Margin", value: contribution, indent: 0, divider: true, bold: true, color: contribColor },
              { label: "  CM%",              value: null, indent: 1, muted: true, label2: contributionPct.toFixed(1) + "%" },
              mer ? { label: "  MER",        value: null, indent: 1, muted: true, label2: mer.toFixed(2) + "×" } : null,
              shippingNum > 0 ? { label: "Shipping",        value: -shippingNum, indent: 1, muted: true } : null,
              platFeeNum  > 0 ? { label: "Platform Fees",   value: -platFeeNum,  indent: 1, muted: true } : null,
              ...extraRows.map((r) => ({ label: r.label, value: -(parseFloat(r.amount) || 0), indent: 1, muted: true })),
              { label: "Net Profit",         value: netProfit,   indent: 0, divider: true, bold: true, color: netColor },
              { label: "  Net Margin",       value: null, indent: 1, muted: true, label2: netMargin.toFixed(1) + "%" },
            ].filter(Boolean).map((row: any, i) => (
              <div key={i}>
                {row.divider && <div className="my-3" style={{ borderTop: "1px solid var(--border)" }} />}
                <div className="flex items-center justify-between py-1"
                  style={{ paddingLeft: row.indent ? "12px" : "0" }}>
                  <span className="text-xs" style={{
                    color:      row.bold  ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: row.bold  ? 600 : 400,
                    opacity:    row.muted && !row.bold ? 0.75 : 1,
                  }}>
                    {row.label}
                  </span>
                  {row.label2 != null ? (
                    <span className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>{row.label2}</span>
                  ) : (
                    <span className="text-xs font-medium" style={{ color: row.color ?? (row.value < 0 ? "#ef4444" : "var(--text-secondary)") }}>
                      {row.value < 0 ? "-" : ""}{aud(Math.abs(row.value ?? 0), 2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expense Config */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Expense Configuration</h2>

            {/* COGS */}
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text-secondary)" }}>Cost of Goods Sold (COGS)</label>
              <div className="flex gap-2 mb-2">
                {(["pct", "fixed"] as const).map((m) => (
                  <button key={m} onClick={() => setCogsMode(m)}
                    className="text-xs px-3 py-1 rounded-md"
                    style={{ background: cogsMode === m ? "#6366f1" : "var(--bg-subtle)", color: cogsMode === m ? "white" : "var(--text-muted)" }}>
                    {m === "pct" ? "% of Revenue" : "Fixed $"}
                  </button>
                ))}
              </div>
              {cogsMode === "pct" ? (
                <div className="flex items-center gap-2">
                  <input type="number" value={cogsPct} onChange={(e) => setCogsPct(e.target.value)}
                    className="w-24 text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>% → {aud(cogs, 2)}</span>
                </div>
              ) : (
                <input type="number" value={cogsFixed} onChange={(e) => setCogsFixed(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  placeholder="0.00" />
              )}
            </div>

            {/* Ad Spend — auto or manual */}
            <div className="mb-4 rounded-xl p-3" style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Ad Spend</label>
                {anyPlatformConnected && (
                  <button onClick={() => setShowAdManual(!showAdManual)}
                    className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {showAdManual ? "Use auto" : "Override"}
                  </button>
                )}
              </div>
              {anyPlatformConnected && !showAdManual ? (
                <div className="space-y-0">
                  <SpendBadge label="Meta Ads"    value={metaSpend}   connected={metaConnected}   loading={loadingAds} />
                  <SpendBadge label="Google Ads"  value={googleSpend} connected={googleConnected} loading={loadingAds} />
                  <SpendBadge label="TikTok Ads"  value={tiktokSpend} connected={tiktokConnected} loading={loadingAds} />
                  <div className="flex items-center justify-between pt-2 mt-1">
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
                    <span className="text-xs font-semibold" style={{ color: "#f59e0b" }}>{aud(autoAdSpend, 2)}</span>
                  </div>
                </div>
              ) : (
                <div>
                  {!anyPlatformConnected && <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>Connect Meta or Google for automatic spend tracking</p>}
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>$</span>
                    <input type="number" value={manualAdSpend} onChange={(e) => setManualAdSpend(e.target.value)}
                      className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      placeholder="0.00" />
                  </div>
                </div>
              )}
            </div>

            {/* Fixed expenses */}
            {[
              { label: "Shipping & Fulfilment", value: shipping, set: setShipping, hint: "Carrier + 3PL costs" },
              { label: "Platform Fees", value: platformFee, set: setPlatformFee, hint: "Shopify sub + transaction fees" },
            ].map((f) => (
              <div key={f.label} className="mb-3">
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>$</span>
                  <input type="number" value={f.value} onChange={(e) => f.set(e.target.value)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    placeholder="0.00" />
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{f.hint}</p>
              </div>
            ))}

            <button onClick={saveConfig}
              className="w-full text-xs py-2 rounded-lg font-medium mt-2"
              style={{ background: saved ? "#10b981" : "#6366f1", color: "white", transition: "background 0.2s" }}>
              {saved ? "✓ Saved" : "Save Configuration"}
            </button>
          </div>

          {/* Additional expenses */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Additional Expenses</h2>
            <div className="space-y-2 mb-3">
              {extraRows.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <span className="flex-1 text-xs" style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                  <span className="text-xs font-medium" style={{ color: "#ef4444" }}>{aud(parseFloat(r.amount) || 0, 2)}</span>
                  <button onClick={() => setExtraRows((rows) => rows.filter((x) => x.id !== r.id))}
                    className="text-xs w-5 h-5 flex items-center justify-center rounded-full hover:opacity-80"
                    style={{ background: "#ef444420", color: "#ef4444" }}>✕</button>
                </div>
              ))}
              {extraRows.length === 0 && <p className="text-xs" style={{ color: "var(--text-faint)" }}>No additional expenses added</p>}
            </div>
            <div className="flex gap-2">
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                placeholder="Expense label" onKeyDown={(e) => e.key === "Enter" && addRow()} />
              <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                className="w-20 text-xs px-3 py-2 rounded-lg outline-none"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                placeholder="$" onKeyDown={(e) => e.key === "Enter" && addRow()} />
              <button onClick={addRow}
                className="text-sm px-3 py-2 rounded-lg hover:opacity-80"
                style={{ background: "#6366f1", color: "white" }}>+</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Unit Economics ────────────────────────────────────────────────────── */}
      {orderCount > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Unit Economics — Per Order</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Average across {orderCount} orders · {periodLabel}</p>
          </div>
          <div className="grid grid-cols-6 divide-x" style={{ borderColor: "var(--border-subtle)" }}>
            {[
              { label: "Revenue",       value: aov,           color: "#10b981" },
              { label: "COGS",          value: -cogsPerOrder,  color: "#ef4444" },
              { label: "Gross Profit",  value: aov - cogsPerOrder, color: grossColor },
              { label: "Ad Cost (CPA)", value: -adPerOrder,   color: "#f59e0b" },
              { label: "Contribution",  value: contribPerOrd, color: contribColor },
              { label: "Net Profit",    value: netPerOrder,   color: netColor },
            ].map((col) => (
              <div key={col.label} className="px-4 py-4 text-center" style={{ borderColor: "var(--border-subtle)" }}>
                <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{col.label}</p>
                <p className="text-base font-bold" style={{ color: col.color }}>
                  {col.value < 0 ? "-" : ""}{aud(Math.abs(col.value), 2)}
                </p>
                {col.label !== "Revenue" && aov > 0 && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
                    {((col.value / aov) * 100).toFixed(0)}% of AOV
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>} {/* end summary tab */}
    </div>
  );
}
