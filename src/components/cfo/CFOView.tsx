"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MonthData = {
  year: number;
  month: number;
  key: string;
  label: string;
  isCurrentMonth: boolean;
  revenue: number;
  orderCount: number;
  refunds: number;
};

type TopProduct = {
  title: string;
  revenue: number;
  units: number;
  revPct: number;
};

type ExpenseLine = {
  id: string;
  name: string;
  amount: string;
  category: string;
};

type Props = {
  storeId: string | null;
  monthlyHistory: MonthData[];
  customerStats: { total: number; new30d: number };
  repeatRate: number;
  inventoryValue: number;
  topProducts: TopProduct[];
  metaConnected: boolean;
  googleConnected: boolean;
  tiktokConnected: boolean;
};

type TabId = "exec" | "pl" | "cash" | "growth" | "unit" | "forecast";
type Scenario = "conservative" | "base" | "optimistic";

// ─── Constants ────────────────────────────────────────────────────────────────

const PL_KEY  = "harry_labs_pl_v2";
const CFO_KEY = "harry_labs_cfo_v1";

const EXPENSE_CATEGORIES = ["Staff", "Rent", "Software", "Marketing", "Shipping", "Other"];

const SCENARIO_LABELS: Record<Scenario, string> = {
  conservative: "Conservative −20%",
  base:         "Base",
  optimistic:   "Optimistic +20%",
};
const SCENARIO_MULTIPLIERS: Record<Scenario, number> = {
  conservative: 0.8,
  base:         1.0,
  optimistic:   1.2,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const $fn = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const pct = (n: number, decimals = 1) => `${n.toFixed(decimals)}%`;

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
      <p className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? "#f9fafb" }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold" style={{ color: "#e5e7eb" }}>{title}</h3>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>{sub}</p>}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className ?? ""}`} style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
      {children}
    </div>
  );
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: `${color}22`, color }}>
      {label}
    </span>
  );
}

function TrafficLight({ label, status, value }: { label: string; status: "green" | "amber" | "red" | "gray"; value: string }) {
  const dot = status === "green" ? "#10b981" : status === "amber" ? "#f59e0b" : status === "red" ? "#ef4444" : "#6b7280";
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
        <span className="text-xs" style={{ color: "#9ca3af" }}>{label}</span>
      </div>
      <span className="text-xs font-medium" style={{ color: "#e5e7eb" }}>{value}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CFOView({
  monthlyHistory,
  customerStats,
  repeatRate,
  inventoryValue,
  topProducts,
  metaConnected,
  googleConnected,
  tiktokConnected,
}: Props) {

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabId>("exec");

  // ── COGS (read from PL page, editable inline) ─────────────────────────────
  const [cogsPct,   setCogsPct]   = useState("45");
  const [cogsMode,  setCogsMode]  = useState<"pct" | "fixed">("pct");
  const [cogsFixed, setCogsFixed] = useState("0");
  const [cogsEditing, setCogsEditing] = useState(false);
  const [cogsPctDraft,   setCogsPctDraft]   = useState("45");
  const [cogsModeDraft,  setCogsModeDraft]  = useState<"pct" | "fixed">("pct");
  const [cogsFixedDraft, setCogsFixedDraft] = useState("0");

  // ── CFO inputs ───────────────────────────────────────────────────────────────
  const [bankBalance,        setBankBalance]        = useState("0");
  const [accountsPayable,    setAccountsPayable]    = useState("0");
  const [accountsReceivable, setAccountsReceivable] = useState("0");
  const [expenseLines, setExpenseLines] = useState<ExpenseLine[]>([
    { id: uid(), name: "Staff & Payroll",    amount: "0", category: "Staff"    },
    { id: uid(), name: "Rent & Utilities",   amount: "0", category: "Rent"     },
    { id: uid(), name: "Software & Tools",   amount: "0", category: "Software" },
    { id: uid(), name: "Shipping & Freight", amount: "0", category: "Shipping" },
  ]);
  const [revenueTarget,      setRevenueTarget]      = useState("0");
  const [profitTarget,       setProfitTarget]       = useState("0");
  const [grossMarginTarget,  setGrossMarginTarget]  = useState("0");
  const [taxRate,            setTaxRate]            = useState("27.5");
  const [gstRegistered,      setGstRegistered]      = useState(true);
  const [avgOrdersPer,       setAvgOrdersPer]       = useState("1.3");
  const [configOpen,         setConfigOpen]         = useState(false);

  // ── Forecast scenario ────────────────────────────────────────────────────────
  const [scenario, setScenario] = useState<Scenario>("base");

  // ── P&L period selector ──────────────────────────────────────────────────────
  const [plMonthIdx, setPlMonthIdx] = useState<number | null>(null);

  // ── Ad spend (live) ──────────────────────────────────────────────────────────
  const [metaSpend,   setMetaSpend]   = useState(0);
  const [googleSpend, setGoogleSpend] = useState(0);
  const [tiktokSpend, setTiktokSpend] = useState(0);
  const [spendLoaded, setSpendLoaded] = useState(false);

  // ─── Load from localStorage ───────────────────────────────────────────────
  useEffect(() => {
    try {
      const pl = JSON.parse(localStorage.getItem(PL_KEY) ?? "{}");
      if (pl.cogsPct)  setCogsPct(String(pl.cogsPct));
      if (pl.cogsMode) setCogsMode(pl.cogsMode);
      if (pl.cogsFixed !== undefined) setCogsFixed(String(pl.cogsFixed));
    } catch {}

    try {
      const cfo = JSON.parse(localStorage.getItem(CFO_KEY) ?? "{}");
      if (cfo.bankBalance)        setBankBalance(String(cfo.bankBalance));
      if (cfo.accountsPayable)    setAccountsPayable(String(cfo.accountsPayable));
      if (cfo.accountsReceivable) setAccountsReceivable(String(cfo.accountsReceivable));
      if (cfo.revenueTarget)      setRevenueTarget(String(cfo.revenueTarget));
      if (cfo.profitTarget)       setProfitTarget(String(cfo.profitTarget));
      if (cfo.grossMarginTarget)  setGrossMarginTarget(String(cfo.grossMarginTarget));
      if (cfo.taxRate)            setTaxRate(String(cfo.taxRate));
      if (typeof cfo.gstRegistered === "boolean") setGstRegistered(cfo.gstRegistered);
      if (cfo.avgOrdersPer)       setAvgOrdersPer(String(cfo.avgOrdersPer));

      if (Array.isArray(cfo.expenseLines) && cfo.expenseLines.length > 0) {
        setExpenseLines(cfo.expenseLines);
      } else if (cfo.monthlyFixedCosts) {
        // migrate legacy single-field to itemised lines
        setExpenseLines([{ id: uid(), name: "Fixed Operating Costs", amount: String(cfo.monthlyFixedCosts), category: "Other" }]);
      }
    } catch {}
  }, []);

  // ─── Save config ──────────────────────────────────────────────────────────
  const saveConfig = useCallback(() => {
    localStorage.setItem(CFO_KEY, JSON.stringify({
      bankBalance, accountsPayable, accountsReceivable,
      expenseLines, revenueTarget, profitTarget, grossMarginTarget,
      taxRate, gstRegistered, avgOrdersPer,
    }));
  }, [bankBalance, accountsPayable, accountsReceivable, expenseLines,
      revenueTarget, profitTarget, grossMarginTarget, taxRate, gstRegistered, avgOrdersPer]);

  const saveCogs = useCallback(() => {
    localStorage.setItem(PL_KEY, JSON.stringify({
      cogsPct: cogsPctDraft, cogsMode: cogsModeDraft, cogsFixed: cogsFixedDraft,
    }));
    setCogsPct(cogsPctDraft);
    setCogsMode(cogsModeDraft);
    setCogsFixed(cogsFixedDraft);
    setCogsEditing(false);
  }, [cogsPctDraft, cogsModeDraft, cogsFixedDraft]);

  const openCogsEditor = () => {
    setCogsPctDraft(cogsPct);
    setCogsModeDraft(cogsMode);
    setCogsFixedDraft(cogsFixed);
    setCogsEditing(true);
  };

  // ─── Fetch ad spend ───────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const endpoints: Array<[string, (v: number) => void]> = [
      ...(metaConnected   ? [["/api/meta/stats",   setMetaSpend]]   as any : []),
      ...(googleConnected ? [["/api/google/stats", setGoogleSpend]] as any : []),
      ...(tiktokConnected ? [["/api/tiktok/stats", setTiktokSpend]] as any : []),
    ];
    if (!endpoints.length) { setSpendLoaded(true); return; }
    Promise.allSettled(
      endpoints.map(([url, setter]) =>
        fetch(url).then(r => r.json()).then(d => { if (mounted) setter(d?.spend ?? d?.totalSpend ?? 0); })
      )
    ).finally(() => { if (mounted) setSpendLoaded(true); });
    return () => { mounted = false; };
  }, [metaConnected, googleConnected, tiktokConnected]);

  // ─── Core data ────────────────────────────────────────────────────────────
  const now     = new Date();
  const curMon  = monthlyHistory.find(m => m.isCurrentMonth) ?? monthlyHistory[monthlyHistory.length - 1];
  const prevMon = monthlyHistory[monthlyHistory.length - 2] ?? null;

  const revenue     = curMon?.revenue    ?? 0;
  const orderCount  = curMon?.orderCount ?? 0;
  const refunds     = curMon?.refunds    ?? 0;
  const prevRevenue = prevMon?.revenue   ?? 0;
  const aov         = orderCount > 0 ? revenue / orderCount : 0;

  // ─── COGS & gross profit ──────────────────────────────────────────────────
  const cogsPctNum  = parseFloat(cogsPct) / 100;
  const cogsVal     = cogsMode === "pct" ? revenue * cogsPctNum : (parseFloat(cogsFixed) || 0);
  const grossProfit = Math.max(0, revenue - cogsVal);
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;

  // ─── Expenses ─────────────────────────────────────────────────────────────
  const totalAdSpend  = metaSpend + googleSpend + tiktokSpend;
  const fixedCosts    = expenseLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalExpenses = cogsVal + totalAdSpend + fixedCosts;
  const netProfit     = revenue - totalExpenses;

  // ─── Days elapsed this month ──────────────────────────────────────────────
  const daysElapsed   = now.getDate();
  const daysTotal     = daysInMonth(now.getFullYear(), now.getMonth() + 1);
  const completionPct = daysElapsed / daysTotal;
  const eomProjection = daysElapsed > 0 ? (revenue / daysElapsed) * daysTotal : 0;
  const annualRunRate = daysElapsed > 0 ? (revenue / daysElapsed) * 365 : 0;

  // ─── Growth & MoM ─────────────────────────────────────────────────────────
  const momRevChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
  const ytdRevenue   = monthlyHistory.reduce((s, m) => {
    return m.year === now.getFullYear() ? s + m.revenue : s;
  }, 0);

  // ─── 3-month growth rate ──────────────────────────────────────────────────
  const lastThree    = monthlyHistory.slice(-3).map(m => m.revenue);
  const growthRates: number[] = [];
  for (let i = 1; i < lastThree.length; i++) {
    if (lastThree[i - 1] > 0) growthRates.push((lastThree[i] - lastThree[i - 1]) / lastThree[i - 1]);
  }
  const avgGrowthRate = growthRates.length > 0
    ? growthRates.reduce((s, r) => s + r, 0) / growthRates.length
    : 0;

  // ─── Cash & working capital ───────────────────────────────────────────────
  const bankBal = parseFloat(bankBalance)        || 0;
  const apBal   = parseFloat(accountsPayable)    || 0;
  const arBal   = parseFloat(accountsReceivable) || 0;
  const netCash = bankBal - apBal;

  // ─── GST (Australian 10% inclusive) ──────────────────────────────────────
  const gstLiability  = gstRegistered ? revenue / 11  : 0;
  const gstOnCogs     = gstRegistered ? cogsVal  / 11 : 0;
  const netGstPayable = Math.max(0, gstLiability - gstOnCogs);

  // ─── Tax provision ─────────────────────────────────────────────────────────
  const taxRatePct        = parseFloat(taxRate) || 27.5;
  const taxProvision      = netProfit > 0 ? netProfit * (taxRatePct / 100) : 0;
  const netProfitAfterTax = netProfit - taxProvision;

  // ─── Balance sheet ─────────────────────────────────────────────────────────
  const currentAssets      = bankBal + arBal + inventoryValue;
  const currentLiabilities = apBal + netGstPayable + taxProvision;
  const netWorkingCapital  = currentAssets - currentLiabilities;
  const currentRatio       = currentLiabilities > 0 ? currentAssets / currentLiabilities : null;

  // ─── Burn & runway ─────────────────────────────────────────────────────────
  const monthlyBurn = Math.max(0, totalExpenses - revenue);
  const cashRunway  = monthlyBurn > 0 ? netCash / monthlyBurn : null;

  // ─── Inventory ─────────────────────────────────────────────────────────────
  const inventoryTurnover = inventoryValue > 0 ? (cogsVal * 12) / inventoryValue : null;
  const dioVal            = inventoryValue > 0 && cogsVal > 0 ? inventoryValue / (cogsVal / 30) : null;

  // ─── Unit economics ────────────────────────────────────────────────────────
  const newCusts = customerStats.new30d;
  const cac      = newCusts > 0 && totalAdSpend > 0 ? totalAdSpend / newCusts : null;
  const aopNum   = parseFloat(avgOrdersPer) || 1.3;
  const ltv      = aov * aopNum * grossMargin;
  const ltvCac   = cac && cac > 0 ? ltv / cac : null;
  const mer      = totalAdSpend > 0 ? revenue / totalAdSpend : null;

  // ─── Budget attainment ─────────────────────────────────────────────────────
  const revTarget = parseFloat(revenueTarget)    || 0;
  const npTarget  = parseFloat(profitTarget)     || 0;
  const gmTarget  = parseFloat(grossMarginTarget) || 0;
  const revAtt    = revTarget > 0 ? (revenue      / revTarget) * 100 : null;
  const npAtt     = npTarget  > 0 ? (netProfit    / npTarget)  * 100 : null;
  const gmAtt     = gmTarget  > 0 ? (grossMargin * 100 / gmTarget) * 100 : null;

  // ─── Forecast ─────────────────────────────────────────────────────────────
  const sMultiplier = SCENARIO_MULTIPLIERS[scenario];
  const adjGrowth   = avgGrowthRate * sMultiplier;
  const baseRev     = eomProjection > 0 ? eomProjection : revenue;
  const fRevM1      = baseRev * (1 + adjGrowth);
  const fRevM2      = fRevM1  * (1 + adjGrowth);
  const fRevM3      = fRevM2  * (1 + adjGrowth);
  const fGPM1       = fRevM1  * grossMargin;
  const fGPM2       = fRevM2  * grossMargin;
  const fGPM3       = fRevM3  * grossMargin;
  const projAdScale = revenue > 0 ? totalAdSpend / revenue : 0;
  const fNPM1       = fGPM1 - (fRevM1 * projAdScale) - fixedCosts;
  const fNPM2       = fGPM2 - (fRevM2 * projAdScale) - fixedCosts;
  const fNPM3       = fGPM3 - (fRevM3 * projAdScale) - fixedCosts;

  // ─── Dynamic quarter label ────────────────────────────────────────────────
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const quarterLabel   = `Q${currentQuarter} ${now.getFullYear()}`;

  // ─── Next 3 month labels ──────────────────────────────────────────────────
  const nextMonthLabels = [1, 2, 3].map(i => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return d.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
  });

  // ─── P&L period selector ─────────────────────────────────────────────────
  const plIdx     = plMonthIdx !== null ? plMonthIdx : monthlyHistory.length - 1;
  const plMonth   = monthlyHistory[plIdx] ?? curMon;
  const plRevenue = plMonth?.revenue    ?? 0;
  const plOrders  = plMonth?.orderCount ?? 0;
  const plRefunds = plMonth?.refunds    ?? 0;
  const plCogsVal     = cogsMode === "pct" ? plRevenue * cogsPctNum : (parseFloat(cogsFixed) || 0);
  const plGrossProfit = Math.max(0, plRevenue - plCogsVal);
  const plNetProfit   = plGrossProfit - totalAdSpend - fixedCosts;

  // ─── Traffic lights ────────────────────────────────────────────────────────
  function tlMer():  "green" | "amber" | "red" | "gray" {
    if (!mer) return "gray";
    if (mer >= 4) return "green"; if (mer >= 2.5) return "amber"; return "red";
  }
  function tlGM(): "green" | "amber" | "red" | "gray" {
    if (grossMargin >= 0.5) return "green"; if (grossMargin >= 0.3) return "amber"; return "red";
  }
  function tlLtv(): "green" | "amber" | "red" | "gray" {
    if (!ltvCac) return "gray";
    if (ltvCac >= 3) return "green"; if (ltvCac >= 1.5) return "amber"; return "red";
  }
  function tlCash(): "green" | "amber" | "red" | "gray" {
    if (bankBal <= 0) return "gray";
    if (cashRunway === null) return "green";
    if (cashRunway >= 6) return "green"; if (cashRunway >= 3) return "amber"; return "red";
  }
  function tlGst(): "green" | "amber" | "red" | "gray" {
    if (!gstRegistered) return "gray";
    return netGstPayable < revenue * 0.15 ? "green" : "amber";
  }
  function tlMoM(): "green" | "amber" | "red" | "gray" {
    if (prevRevenue === 0) return "gray";
    if (momRevChange >= 5) return "green"; if (momRevChange >= 0) return "amber"; return "red";
  }

  // ─── Expense line helpers ─────────────────────────────────────────────────
  function addExpenseLine() {
    setExpenseLines(prev => [...prev, { id: uid(), name: "", amount: "0", category: "Other" }]);
  }
  function removeExpenseLine(id: string) {
    setExpenseLines(prev => prev.filter(l => l.id !== id));
  }
  function updateExpenseLine(id: string, field: keyof ExpenseLine, value: string) {
    setExpenseLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  // ─── Expense by category ─────────────────────────────────────────────────
  const expByCategory: Record<string, number> = {};
  for (const line of expenseLines) {
    const cat = line.category || "Other";
    expByCategory[cat] = (expByCategory[cat] ?? 0) + (parseFloat(line.amount) || 0);
  }

  // ─── Input styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: "#0a0a0f", border: "1px solid #2d2d3d", borderRadius: 6,
    padding: "6px 10px", color: "#e5e7eb", fontSize: 13, width: "100%",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: "#9ca3af", marginBottom: 4, display: "block",
  };
  const miniBtn = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: "1px solid", transition: "all 0.15s",
    background: active ? "#6366f1" : "transparent",
    borderColor: active ? "#6366f1" : "#374151",
    color: active ? "#fff" : "#9ca3af",
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      {/* Tab bar + SOP download */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          {(["exec","pl","cash","growth","unit","forecast"] as TabId[]).map(t => {
            const labels: Record<TabId,string> = {
              exec: "Executive", pl: "P&L", cash: "Cash",
              growth: "Growth", unit: "Unit Econ", forecast: "Forecast",
            };
            return (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{ background: tab === t ? "#6366f1" : "transparent", color: tab === t ? "#fff" : "#6b7280" }}>
                {labels[t]}
              </button>
            );
          })}
        </div>
        <a href="/CFO_Hub_SOP.docx" download
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "#111118", border: "1px solid #1e1e2e", color: "#9ca3af", textDecoration: "none" }}>
          📄 Download SOP
        </a>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          EXECUTIVE SUMMARY
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "exec" && (
        <div className="flex flex-col gap-5">
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Revenue (MTD)"   value={$fn(revenue)}
              sub={`${pct(completionPct * 100, 0)} of month`} />
            <KPI label="Gross Profit"    value={$fn(grossProfit)}
              sub={`${pct(grossMargin * 100)} GM`}
              color={grossMargin >= 0.4 ? "#10b981" : grossMargin >= 0.25 ? "#f59e0b" : "#ef4444"} />
            <KPI label="Net Profit"      value={$fn(netProfit)}
              sub={revenue > 0 ? `${pct((netProfit/revenue)*100)} NP margin` : "—"}
              color={netProfit >= 0 ? "#10b981" : "#ef4444"} />
            <KPI label="MER"             value={mer ? `${mer.toFixed(2)}×` : "—"}
              sub={`${$fn(totalAdSpend)} spend`}
              color={mer ? (mer >= 4 ? "#10b981" : mer >= 2.5 ? "#f59e0b" : "#ef4444") : "#6b7280"} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="EOM Projection"           value={$fn(eomProjection)} sub="at current run rate" />
            <KPI label="Annual Run Rate"           value={$fn(annualRunRate)} sub="extrapolated" />
            <KPI label={`YTD ${now.getFullYear()}`} value={$fn(ytdRevenue)} />
            <KPI label="Repeat Rate"              value={`${repeatRate.toFixed(1)}%`}
              sub={`${customerStats.total.toLocaleString()} customers total`} />
          </div>

          {/* Traffic lights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <SectionHeader title="Financial Health Indicators" />
              <div className="divide-y" style={{ borderColor: "#1e1e2e" }}>
                <TrafficLight label="Marketing Efficiency Ratio" status={tlMer()}
                  value={mer ? `${mer.toFixed(2)}×` : "Not connected"} />
                <TrafficLight label="Gross Margin" status={tlGM()} value={pct(grossMargin * 100)} />
                <TrafficLight label="LTV:CAC Ratio" status={tlLtv()}
                  value={ltvCac ? `${ltvCac.toFixed(2)}×` : "Insufficient data"} />
                <TrafficLight label="Cash Runway" status={tlCash()}
                  value={cashRunway !== null ? `${cashRunway.toFixed(1)} months` : bankBal > 0 ? "Profitable" : "Not set"} />
                <TrafficLight label="MoM Revenue Growth" status={tlMoM()}
                  value={prevRevenue > 0 ? `${momRevChange >= 0 ? "+" : ""}${pct(momRevChange)}` : "First month"} />
                <TrafficLight label="GST Liability (est.)" status={tlGst()}
                  value={gstRegistered ? `${$fn(netGstPayable)} net payable` : "Not registered"} />
              </div>
            </Card>

            <Card>
              <SectionHeader title="Auto Highlights" />
              <div className="space-y-2.5">
                {[
                  revenue > prevRevenue && prevRevenue > 0
                    ? { c: "#10b981", t: `Revenue up ${pct(momRevChange)} MoM — ${$fn(revenue)} vs ${$fn(prevRevenue)} last month` }
                    : revenue < prevRevenue && prevRevenue > 0
                    ? { c: "#ef4444", t: `Revenue down ${pct(Math.abs(momRevChange))} MoM — ${$fn(Math.abs(revenue - prevRevenue))} gap` }
                    : null,
                  grossMargin >= 0.5
                    ? { c: "#10b981", t: `Strong gross margin of ${pct(grossMargin * 100)} — healthy product economics` }
                    : grossMargin < 0.3 && grossMargin > 0
                    ? { c: "#f59e0b", t: `Gross margin of ${pct(grossMargin * 100)} is below 30% — review COGS` }
                    : null,
                  mer && mer < 2
                    ? { c: "#ef4444", t: `MER of ${mer.toFixed(2)}× is below 2× — ad spend may be unprofitable` }
                    : mer && mer >= 5
                    ? { c: "#10b981", t: `Excellent MER of ${mer.toFixed(2)}× — strong ad efficiency` }
                    : null,
                  cashRunway !== null && cashRunway < 3
                    ? { c: "#ef4444", t: `Cash runway is ${cashRunway.toFixed(1)} months — immediate action required` }
                    : null,
                  ltvCac && ltvCac < 1.5
                    ? { c: "#f59e0b", t: `LTV:CAC of ${ltvCac.toFixed(2)}× is low — customer acquisition may exceed lifetime value` }
                    : null,
                  netProfit < 0
                    ? { c: "#ef4444", t: `Business is unprofitable — net loss of ${$fn(Math.abs(netProfit))} this month` }
                    : null,
                  gstRegistered && netGstPayable > 0
                    ? { c: "#f59e0b", t: `GST liability of ${$fn(netGstPayable)} due to ATO this BAS period` }
                    : null,
                  !spendLoaded && (metaConnected || googleConnected || tiktokConnected)
                    ? { c: "#6b7280", t: "Fetching live ad spend — profit figures will update shortly" }
                    : null,
                ].filter(Boolean).slice(0, 6).map((h, i) => h && (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: h.c }} />
                    <p className="text-xs" style={{ color: "#d1d5db" }}>{h.t}</p>
                  </div>
                ))}
                {momRevChange === 0 && grossMargin === 0 && revenue === 0 && (
                  <p className="text-xs" style={{ color: "#6b7280" }}>
                    No revenue data yet. Configure COGS in the P&amp;L tab and connect ad platforms in Integrations.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* MoM table */}
          <Card>
            <SectionHeader title="Month-on-Month Comparison"
              sub={`${prevMon?.label ?? "Previous"} → ${curMon?.label ?? "Current"}`} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Revenue",      curr: revenue,     prev: prevRevenue },
                { label: "Gross Profit", curr: grossProfit, prev: prevRevenue > 0 ? prevRevenue * (1 - cogsPctNum) : 0 },
                { label: "Ad Spend",     curr: totalAdSpend, prev: 0, noChg: true },
                { label: "Net Profit",   curr: netProfit,   prev: 0, noChg: true },
              ].map(({ label, curr, prev, noChg }) => {
                const chg = prev > 0 ? ((curr - prev) / prev) * 100 : null;
                return (
                  <div key={label}>
                    <p className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</p>
                    <p className="text-lg font-bold" style={{ color: "#f9fafb" }}>{$fn(curr)}</p>
                    {chg !== null && !noChg
                      ? <p className="text-xs mt-0.5" style={{ color: chg >= 0 ? "#10b981" : "#ef4444" }}>
                          {chg >= 0 ? "+" : ""}{pct(chg)} vs last month
                        </p>
                      : <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>current month</p>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          P&L ANALYSIS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "pl" && (
        <div className="flex flex-col gap-5">

          {/* Period selector */}
          <Card>
            <SectionHeader title="Period Selector" sub="Click a month to review its P&L statement" />
            <div className="flex gap-2 flex-wrap">
              {monthlyHistory.map((m, i) => (
                <button key={m.key} onClick={() => setPlMonthIdx(i)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: plIdx === i ? "#6366f1" : "#1a1a2e",
                    color: plIdx === i ? "#fff" : "#9ca3af",
                    border: `1px solid ${plIdx === i ? "#6366f1" : "#2d2d3d"}`,
                  }}>
                  {m.label}{m.year !== now.getFullYear() ? ` '${String(m.year).slice(2)}` : ""}{m.isCurrentMonth ? " (now)" : ""}
                </button>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Waterfall */}
            <Card>
              <SectionHeader title={`P&L Waterfall — ${plMonth.label} ${plMonth.year}`} />
              {[
                { label: "Revenue",        value: plRevenue,     pos: true  },
                { label: `COGS (${cogsMode === "pct" ? pct(parseFloat(cogsPct)) : $fn(parseFloat(cogsFixed))})`,
                                           value: -plCogsVal,    pos: false },
                { label: "= Gross Profit", value: plGrossProfit, pos: plGrossProfit >= 0, bold: true },
                { label: "Ad Spend",       value: -totalAdSpend, pos: false },
                { label: "Fixed Expenses", value: -fixedCosts,   pos: false },
                { label: "= Net Profit",   value: plNetProfit,   pos: plNetProfit >= 0, bold: true },
              ].map(({ label, value, pos, bold }) => {
                const abs   = Math.abs(value);
                const width = Math.min(100, (abs / Math.max(plRevenue, 1)) * 100);
                return (
                  <div key={label} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className={`text-xs ${bold ? "font-bold" : ""}`}
                        style={{ color: bold ? "#e5e7eb" : "#9ca3af" }}>{label}</span>
                      <span className={`text-xs font-medium ${bold ? "font-bold" : ""}`}
                        style={{ color: pos ? "#10b981" : "#ef4444" }}>
                        {value >= 0 ? $fn(value) : `-${$fn(abs)}`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1a1a2e" }}>
                      <div className="h-full rounded-full" style={{ width: `${width}%`, background: pos ? "#10b981" : "#ef4444" }} />
                    </div>
                  </div>
                );
              })}
            </Card>

            {/* P&L Statement */}
            <Card>
              <SectionHeader title="P&L Statement" sub={`${plMonth.label} ${plMonth.year}`} />
              {[
                { label: "Gross Revenue",         value: plRevenue,                                    color: "#e5e7eb" },
                { label: "Returns & Refunds",      value: -plRefunds,                                   color: "#ef4444", indent: true  },
                { label: "Net Revenue",            value: plRevenue - plRefunds,                        color: "#e5e7eb", bold: true    },
                { label: "COGS",                   value: -plCogsVal,                                   color: "#ef4444", indent: true  },
                { label: "Gross Profit",           value: plGrossProfit,                                color: "#10b981", bold: true    },
                { label: "Ad Spend",               value: -totalAdSpend,                                color: "#ef4444", indent: true  },
                { label: "Fixed Expenses",         value: -fixedCosts,                                  color: "#ef4444", indent: true  },
                { label: "Operating Profit",       value: plNetProfit,                                  color: plNetProfit >= 0 ? "#10b981" : "#ef4444", bold: true },
                ...(gstRegistered ? [
                  { label: "GST Collected",        value: -gstLiability,                               color: "#f59e0b", indent: true  },
                  { label: "GST Input Credits",    value: gstOnCogs,                                   color: "#10b981", indent: true  },
                  { label: "Net GST Payable",      value: -netGstPayable,                              color: "#f59e0b", indent: true  },
                ] : []),
                { label: `Tax Provision (${pct(taxRatePct)})`, value: -taxProvision,                   color: "#f59e0b", indent: true  },
                { label: "Net Profit After Tax",   value: netProfitAfterTax,                            color: netProfitAfterTax >= 0 ? "#10b981" : "#ef4444", bold: true },
              ].map(({ label, value, color, indent, bold }) => (
                <div key={label} className="flex justify-between py-1" style={{ borderBottom: "1px solid #1a1a2e" }}>
                  <span className={`text-xs ${indent ? "pl-4" : ""} ${bold ? "font-bold" : ""}`}
                    style={{ color: bold ? "#e5e7eb" : "#9ca3af" }}>{label}</span>
                  <span className={`text-xs ${bold ? "font-bold" : ""}`} style={{ color }}>
                    {value >= 0 ? $fn(value) : `-${$fn(Math.abs(value))}`}
                  </span>
                </div>
              ))}
            </Card>
          </div>

          {/* Inline COGS editor */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="COGS Configuration" sub="Synced with the P&L page — changes apply everywhere" />
              {!cogsEditing && (
                <button onClick={openCogsEditor}
                  className="text-xs px-3 py-1 rounded-lg"
                  style={{ background: "#1a1a2e", border: "1px solid #2d2d3d", color: "#9ca3af" }}>
                  ✏️ Edit
                </button>
              )}
            </div>
            {!cogsEditing ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs" style={{ color: "#6b7280" }}>Mode</p>
                  <p className="text-sm font-medium" style={{ color: "#e5e7eb" }}>
                    {cogsMode === "pct" ? "% of Revenue" : "Fixed AUD/month"}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#6b7280" }}>Setting</p>
                  <p className="text-sm font-medium" style={{ color: "#e5e7eb" }}>
                    {cogsMode === "pct" ? pct(parseFloat(cogsPct)) : $fn(parseFloat(cogsFixed))}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#6b7280" }}>COGS this month</p>
                  <p className="text-sm font-medium" style={{ color: "#ef4444" }}>{$fn(cogsVal)}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button style={miniBtn(cogsModeDraft === "pct")}   onClick={() => setCogsModeDraft("pct")}>% of Revenue</button>
                  <button style={miniBtn(cogsModeDraft === "fixed")} onClick={() => setCogsModeDraft("fixed")}>Fixed AUD</button>
                </div>
                {cogsModeDraft === "pct" ? (
                  <div style={{ maxWidth: 200 }}>
                    <label style={labelStyle}>COGS %</label>
                    <input type="number" value={cogsPctDraft} onChange={e => setCogsPctDraft(e.target.value)}
                      style={inputStyle} placeholder="45" />
                  </div>
                ) : (
                  <div style={{ maxWidth: 200 }}>
                    <label style={labelStyle}>Fixed COGS / Month (AUD)</label>
                    <input type="number" value={cogsFixedDraft} onChange={e => setCogsFixedDraft(e.target.value)}
                      style={inputStyle} placeholder="0" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={saveCogs}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "#6366f1", color: "#fff" }}>Save COGS</button>
                  <button onClick={() => setCogsEditing(false)}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "#1a1a2e", border: "1px solid #2d2d3d", color: "#9ca3af" }}>Cancel</button>
                </div>
              </div>
            )}
          </Card>

          {/* Expense line items */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="Monthly Expense Breakdown"
                sub={`Total: ${$fn(fixedCosts)} / month`} />
              <button onClick={addExpenseLine}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: "#1a1a2e", border: "1px solid #2d2d3d", color: "#a5b4fc" }}>
                + Add Line
              </button>
            </div>
            <div className="space-y-2 mb-3">
              {expenseLines.map(line => (
                <div key={line.id} className="grid gap-2 items-center"
                  style={{ gridTemplateColumns: "1fr 120px 120px 28px" }}>
                  <input placeholder="Expense name" value={line.name}
                    onChange={e => updateExpenseLine(line.id, "name", e.target.value)}
                    style={inputStyle} />
                  <input type="number" placeholder="AUD" value={line.amount}
                    onChange={e => updateExpenseLine(line.id, "amount", e.target.value)}
                    style={inputStyle} />
                  <select value={line.category}
                    onChange={e => updateExpenseLine(line.id, "category", e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={() => removeExpenseLine(line.id)}
                    className="flex items-center justify-center rounded w-7 h-7"
                    style={{ background: "#1a1a2e", color: "#ef4444", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid #1e1e2e" }}>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(expByCategory).filter(([, v]) => v > 0).map(([cat, amt]) => (
                  <span key={cat} className="text-xs" style={{ color: "#6b7280" }}>
                    {cat}: <span style={{ color: "#e5e7eb" }}>{$fn(amt)}</span>
                  </span>
                ))}
              </div>
              <button onClick={saveConfig}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "#6366f1", color: "#fff" }}>
                Save Expenses
              </button>
            </div>
          </Card>

          {/* 6-month revenue chart (clickable for period selection) */}
          <Card>
            <SectionHeader title="6-Month Revenue — Click a Bar to Select Period" />
            <div className="flex items-end gap-2 h-28">
              {monthlyHistory.map((m, i) => {
                const max = Math.max(...monthlyHistory.map(x => x.revenue), 1);
                const h   = Math.max(6, (m.revenue / max) * 100);
                return (
                  <div key={m.key} className="flex flex-col items-center gap-1 flex-1 cursor-pointer group"
                    onClick={() => setPlMonthIdx(i)}>
                    <div className="w-full rounded-t transition-all group-hover:opacity-80"
                      style={{ height: `${h}%`, background: plIdx === i ? "#6366f1" : "#2563eb44" }} />
                    <span className="text-xs" style={{ color: plIdx === i ? "#a5b4fc" : "#4b5563" }}>
                      {m.label}
                    </span>
                    <span className="text-xs" style={{ color: "#374151" }}>{$fn(m.revenue)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CASH & WORKING CAPITAL
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "cash" && (
        <div className="flex flex-col gap-5">

          {/* Input panel */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="Balance Sheet Inputs" sub="Enter your current financial position" />
              <button onClick={() => setConfigOpen(!configOpen)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "#1a1a2e", border: "1px solid #2d2d3d", color: "#9ca3af" }}>
                {configOpen ? "▲ Close" : "✏️ Edit Inputs"}
              </button>
            </div>
            {configOpen && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label style={labelStyle}>Bank Balance (AUD)</label>
                    <input type="number" value={bankBalance} onChange={e => setBankBalance(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Accounts Receivable (AUD)</label>
                    <input type="number" value={accountsReceivable} onChange={e => setAccountsReceivable(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Accounts Payable (AUD)</label>
                    <input type="number" value={accountsPayable} onChange={e => setAccountsPayable(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Income Tax Rate (%)</label>
                    <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} style={inputStyle} placeholder="27.5" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="gstChk" checked={gstRegistered}
                    onChange={e => setGstRegistered(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
                  <label htmlFor="gstChk" className="text-xs" style={{ color: "#9ca3af" }}>
                    GST Registered — Australian 10% GST applies to all revenue
                  </label>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => { saveConfig(); setConfigOpen(false); }}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "#6366f1", color: "#fff" }}>Save</button>
                </div>
              </div>
            )}
          </Card>

          {/* Balance sheet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <SectionHeader title="Current Assets" />
              {[
                { label: "Cash & Bank",         value: bankBal        },
                { label: "Accounts Receivable", value: arBal          },
                { label: "Inventory (est.)",    value: inventoryValue  },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid #1a1a2e" }}>
                  <span className="text-xs" style={{ color: "#9ca3af" }}>{label}</span>
                  <span className="text-xs font-medium" style={{ color: "#e5e7eb" }}>{$fn(value)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-1">
                <span className="text-xs font-bold" style={{ color: "#e5e7eb" }}>Total Assets</span>
                <span className="text-xs font-bold" style={{ color: "#10b981" }}>{$fn(currentAssets)}</span>
              </div>
            </Card>

            <Card>
              <SectionHeader title="Current Liabilities" />
              {[
                { label: "Accounts Payable",          value: apBal         },
                ...(gstRegistered ? [{ label: "GST Payable (net est.)", value: netGstPayable }] : []),
                { label: `Income Tax Provision (${pct(taxRatePct)})`, value: taxProvision },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid #1a1a2e" }}>
                  <span className="text-xs" style={{ color: "#9ca3af" }}>{label}</span>
                  <span className="text-xs font-medium" style={{ color: value > 0 ? "#ef4444" : "#6b7280" }}>{$fn(value)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-1">
                <span className="text-xs font-bold" style={{ color: "#e5e7eb" }}>Total Liabilities</span>
                <span className="text-xs font-bold" style={{ color: "#ef4444" }}>{$fn(currentLiabilities)}</span>
              </div>
            </Card>
          </div>

          {/* Working capital KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Net Working Capital" value={$fn(netWorkingCapital)}
              color={netWorkingCapital >= 0 ? "#10b981" : "#ef4444"} />
            <KPI label="Current Ratio" value={currentRatio ? `${currentRatio.toFixed(2)}×` : "—"} sub="target > 1.5×"
              color={currentRatio ? (currentRatio >= 1.5 ? "#10b981" : currentRatio >= 1 ? "#f59e0b" : "#ef4444") : "#6b7280"} />
            <KPI label="Cash Runway"
              value={cashRunway !== null ? `${cashRunway.toFixed(1)} mo` : "Profitable"}
              sub={monthlyBurn > 0 ? `${$fn(monthlyBurn)}/mo burn` : "No burn"}
              color={cashRunway !== null ? (cashRunway >= 6 ? "#10b981" : cashRunway >= 3 ? "#f59e0b" : "#ef4444") : "#10b981"} />
            <KPI label="Net Cash (bank − AP)" value={$fn(netCash)}
              color={netCash >= 0 ? "#10b981" : "#ef4444"} />
          </div>

          {/* Inventory metrics */}
          <Card>
            <SectionHeader title="Inventory & Supply Chain" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs mb-1" style={{ color: "#6b7280" }}>Inventory Value (est.)</p>
                <p className="text-xl font-bold" style={{ color: "#e5e7eb" }}>{$fn(inventoryValue)}</p>
                <p className="text-xs" style={{ color: "#4b5563" }}>at 45% COGS</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#6b7280" }}>Turnover</p>
                <p className="text-xl font-bold" style={{ color: "#e5e7eb" }}>
                  {inventoryTurnover ? `${inventoryTurnover.toFixed(1)}×/yr` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#6b7280" }}>Days Inventory (DIO)</p>
                <p className="text-xl font-bold" style={{ color: dioVal && dioVal < 45 ? "#10b981" : "#f59e0b" }}>
                  {dioVal ? `${dioVal.toFixed(0)}d` : "—"}
                </p>
                <p className="text-xs" style={{ color: "#4b5563" }}>target &lt; 45 days</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#6b7280" }}>Inventory / Assets</p>
                <p className="text-xl font-bold" style={{ color: "#e5e7eb" }}>
                  {currentAssets > 0 ? pct((inventoryValue / currentAssets) * 100) : "—"}
                </p>
              </div>
            </div>
          </Card>

          {/* GST summary */}
          {gstRegistered && (
            <Card>
              <SectionHeader title="GST Summary — Australian 10%"
                sub="Estimate only — consult your BAS agent before lodging" />
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "GST Collected on Sales",   value: gstLiability,  color: "#f59e0b", note: "revenue ÷ 11" },
                  { label: "GST on Purchases (credit)", value: gstOnCogs,    color: "#10b981", note: "COGS ÷ 11 (est.)" },
                  { label: "Net GST Payable to ATO",   value: netGstPayable, color: "#ef4444", note: "due this BAS" },
                ].map(({ label, value, color, note }) => (
                  <div key={label}>
                    <p className="text-xs" style={{ color: "#6b7280" }}>{label}</p>
                    <p className="text-xl font-bold mt-1" style={{ color }}>{$fn(value)}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>{note}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GROWTH ANALYTICS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "growth" && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="6-Month Revenue" value={$fn(monthlyHistory.reduce((s, m) => s + m.revenue, 0))} />
            <KPI label="Monthly Average" value={$fn(monthlyHistory.reduce((s, m) => s + m.revenue, 0) / Math.max(1, monthlyHistory.length))} />
            <KPI label="MoM Growth" value={momRevChange >= 0 ? `+${pct(momRevChange)}` : pct(momRevChange)}
              color={momRevChange >= 0 ? "#10b981" : "#ef4444"} />
            <KPI label="3-Month Avg Growth" value={pct(avgGrowthRate * 100)} sub="used in forecast"
              color={avgGrowthRate >= 0 ? "#10b981" : "#ef4444"} />
          </div>

          <Card>
            <SectionHeader title="Monthly Revenue — 6 Months" />
            <div className="flex items-end gap-3 h-40">
              {monthlyHistory.map(m => {
                const max = Math.max(...monthlyHistory.map(x => x.revenue), 1);
                const h   = Math.max(4, (m.revenue / max) * 100);
                return (
                  <div key={m.key} className="flex flex-col items-center gap-1.5 flex-1">
                    <span className="text-xs" style={{ color: "#4b5563" }}>{$fn(m.revenue)}</span>
                    <div className="w-full rounded-t transition-all"
                      style={{ height: `${h}%`, background: m.isCurrentMonth ? "#6366f1" : "#2563eb55" }} />
                    <span className="text-xs" style={{ color: m.isCurrentMonth ? "#a5b4fc" : "#4b5563" }}>{m.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Customer analytics */}
            <Card>
              <SectionHeader title="Customer Analytics" />
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs" style={{ color: "#6b7280" }}>Total Customers</p>
                  <p className="text-3xl font-bold" style={{ color: "#e5e7eb" }}>{customerStats.total.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#6b7280" }}>New (30d)</p>
                  <p className="text-3xl font-bold" style={{ color: "#6366f1" }}>{customerStats.new30d.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#6b7280" }}>Repeat Rate</p>
                  <p className="text-3xl font-bold" style={{ color: "#10b981" }}>{repeatRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#6b7280" }}>AOV</p>
                  <p className="text-3xl font-bold" style={{ color: "#e5e7eb" }}>{$fn(aov)}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "#0d0d1a" }}>
                <p className="text-xs" style={{ color: "#6b7280" }}>
                  {repeatRate.toFixed(1)}% of your customers have placed more than one order.
                  AOV of {$fn(aov)} × repeat orders drives LTV.
                </p>
              </div>
            </Card>

            {/* Top products by revenue */}
            <Card>
              <SectionHeader title="Top Products by Revenue (30 Days)" />
              {topProducts.length === 0 ? (
                <div>
                  <p className="text-xs mb-2" style={{ color: "#6b7280" }}>
                    No product revenue data available. Ensure <code className="text-xs" style={{ color: "#a5b4fc" }}>order_line_items</code> table is syncing from Shopify.
                  </p>
                  <p className="text-xs" style={{ color: "#4b5563" }}>
                    Once syncing, this card shows revenue, units sold, and % of total for your top 5 products.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={i}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs truncate mr-2" style={{ color: "#d1d5db", maxWidth: "60%" }}>
                          {p.title}
                        </span>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-medium" style={{ color: "#e5e7eb" }}>{$fn(p.revenue)}</span>
                          <span className="text-xs ml-2" style={{ color: "#6b7280" }}>{pct(p.revPct)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a1a2e" }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${p.revPct}%`, background: "#6366f1" }} />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>{p.units} units sold</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Platform connection status */}
          <Card>
            <SectionHeader title="Ad Platform Coverage" sub="Revenue attribution requires connected platforms" />
            <div className="flex gap-3 flex-wrap">
              {[
                { name: "Meta Ads",    connected: metaConnected,    color: "#3b82f6" },
                { name: "Google Ads",  connected: googleConnected,  color: "#10b981" },
                { name: "TikTok Ads",  connected: tiktokConnected,  color: "#f59e0b" },
              ].map(({ name, connected, color }) => (
                <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "#1a1a2e", border: `1px solid ${connected ? color + "44" : "#2d2d3d"}` }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: connected ? color : "#374151" }} />
                  <span className="text-xs" style={{ color: connected ? "#e5e7eb" : "#6b7280" }}>{name}</span>
                  {connected && <Badge color={color} label="Live" />}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          UNIT ECONOMICS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "unit" && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="MER" value={mer ? `${mer.toFixed(2)}×` : "—"} sub="total revenue / ad spend"
              color={mer ? (mer >= 4 ? "#10b981" : mer >= 2.5 ? "#f59e0b" : "#ef4444") : "#6b7280"} />
            <KPI label="CAC" value={cac ? $fn(cac) : "—"} sub={`${newCusts} new customers`}
              color={cac ? (cac < 50 ? "#10b981" : cac < 150 ? "#f59e0b" : "#ef4444") : "#6b7280"} />
            <KPI label="Customer LTV" value={ltv > 0 ? $fn(ltv) : "—"}
              sub={`${aopNum.toFixed(1)} avg orders`} color="#a5b4fc" />
            <KPI label="LTV:CAC" value={ltvCac ? `${ltvCac.toFixed(2)}×` : "—"} sub="target ≥ 3×"
              color={ltvCac ? (ltvCac >= 3 ? "#10b981" : ltvCac >= 1.5 ? "#f59e0b" : "#ef4444") : "#6b7280"} />
          </div>

          {/* Per-order breakdown */}
          <Card>
            <SectionHeader title="Per-Order P&L" sub="Average economics per transaction" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Avg Revenue (AOV)",   value: $fn(aov),                                                    color: "#10b981" },
                { label: "Avg COGS",            value: $fn(cogsMode === "pct" ? aov * cogsPctNum : (orderCount > 0 ? (parseFloat(cogsFixed) || 0) / orderCount : 0)), color: "#ef4444" },
                { label: "Avg Gross Profit",    value: $fn(aov * grossMargin),                                      color: "#10b981" },
                { label: "Avg Ad Cost / Order", value: orderCount > 0 ? $fn(totalAdSpend / orderCount) : "—",       color: "#f59e0b" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</p>
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* LTV calculator */}
          <Card>
            <SectionHeader title="LTV Calculator" sub="Adjust avg orders per customer to model lifetime value" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Avg Orders Per Customer</label>
                <input type="number" value={avgOrdersPer} onChange={e => setAvgOrdersPer(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 180 }} step="0.1" min="1" />
                <p className="text-xs mt-2" style={{ color: "#4b5563" }}>
                  Repeat rate from data: {repeatRate.toFixed(1)}%
                </p>
                <button onClick={saveConfig}
                  className="mt-2 px-3 py-1 rounded text-xs"
                  style={{ background: "#6366f1", color: "#fff" }}>Save</button>
              </div>
              <div className="p-4 rounded-lg" style={{ background: "#0d0d1a" }}>
                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                  <div>
                    <p className="text-xs" style={{ color: "#6b7280" }}>AOV</p>
                    <p className="text-lg font-bold" style={{ color: "#e5e7eb" }}>{$fn(aov)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: "#6b7280" }}>× Margin</p>
                    <p className="text-lg font-bold" style={{ color: "#e5e7eb" }}>{pct(grossMargin * 100)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: "#6b7280" }}>× Orders</p>
                    <p className="text-lg font-bold" style={{ color: "#e5e7eb" }}>{aopNum.toFixed(1)}</p>
                  </div>
                </div>
                <div className="pt-3" style={{ borderTop: "1px solid #1e1e2e" }}>
                  <p className="text-xs" style={{ color: "#6b7280" }}>Customer LTV</p>
                  <p className="text-3xl font-bold" style={{ color: "#6366f1" }}>{ltv > 0 ? $fn(ltv) : "—"}</p>
                  {cac && (
                    <p className="text-xs mt-1" style={{ color: ltvCac && ltvCac >= 3 ? "#10b981" : "#f59e0b" }}>
                      LTV:CAC = {ltvCac?.toFixed(2)}× (CAC: {$fn(cac)})
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Channel efficiency */}
          <Card>
            <SectionHeader title="Ad Channel Efficiency" />
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "#6b7280" }}>
                  <th className="text-left py-2 pr-4">Channel</th>
                  <th className="text-right py-2 pr-4">Spend (MTD)</th>
                  <th className="text-right py-2 pr-4">% of Total Spend</th>
                  <th className="text-right py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Meta Ads",    spend: metaSpend,   connected: metaConnected   },
                  { name: "Google Ads",  spend: googleSpend, connected: googleConnected },
                  { name: "TikTok Ads",  spend: tiktokSpend, connected: tiktokConnected },
                ].map(({ name, spend, connected }) => (
                  <tr key={name} style={{ borderTop: "1px solid #1a1a2e" }}>
                    <td className="py-2 pr-4" style={{ color: "#d1d5db" }}>{name}</td>
                    <td className="text-right py-2 pr-4" style={{ color: connected ? "#ef4444" : "#4b5563" }}>
                      {connected ? $fn(spend) : "—"}
                    </td>
                    <td className="text-right py-2 pr-4" style={{ color: "#6b7280" }}>
                      {connected && totalAdSpend > 0 ? pct((spend / totalAdSpend) * 100) : "—"}
                    </td>
                    <td className="text-right py-2">
                      <Badge color={connected ? "#10b981" : "#6b7280"} label={connected ? "Live" : "Not connected"} />
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #2d2d3d" }}>
                  <td className="py-2 pr-4 font-bold" style={{ color: "#e5e7eb" }}>Total</td>
                  <td className="text-right py-2 pr-4 font-bold" style={{ color: "#ef4444" }}>{$fn(totalAdSpend)}</td>
                  <td className="text-right py-2 pr-4 font-bold" style={{ color: "#e5e7eb" }}>100%</td>
                  <td />
                </tr>
              </tbody>
            </table>
            <p className="text-xs mt-3" style={{ color: "#4b5563" }}>
              Per-channel revenue attribution requires UTM tracking + order source data in Shopify.
            </p>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          FORECASTING
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "forecast" && (
        <div className="flex flex-col gap-5">

          {/* Scenario selector */}
          <Card>
            <SectionHeader title="Forecast Scenario"
              sub={`3-month avg growth rate: ${pct(avgGrowthRate * 100)} — applied to EOM projection`} />
            <div className="flex gap-2 flex-wrap mb-2">
              {(["conservative", "base", "optimistic"] as Scenario[]).map(s => (
                <button key={s} onClick={() => setScenario(s)} style={miniBtn(scenario === s)}>
                  {SCENARIO_LABELS[s]}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: "#4b5563" }}>
              {scenario === "conservative" && "Applies 80% of historical growth — worst-case planning for cash flow and budgeting."}
              {scenario === "base"         && "Uses actual 3-month average growth trend — most likely outcome."}
              {scenario === "optimistic"   && "Applies 120% of historical growth — for capacity and hiring planning."}
            </p>
          </Card>

          {/* 3-month projection table */}
          <Card>
            <SectionHeader title={`3-Month Projection — ${SCENARIO_LABELS[scenario]}`} />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "#6b7280" }}>
                    <th className="text-left py-2 pr-6 font-medium">Metric</th>
                    <th className="text-right py-2 pr-4 font-medium">EOM (this mo.)</th>
                    {nextMonthLabels.map(l => (
                      <th key={l} className="text-right py-2 pr-4 font-medium">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Revenue",      vals: [eomProjection, fRevM1, fRevM2, fRevM3], colorFn: () => "#e5e7eb" },
                    { label: "Gross Profit", vals: [eomProjection * grossMargin, fGPM1, fGPM2, fGPM3], colorFn: () => "#10b981" },
                    { label: "Net Profit",   vals: [eomProjection * grossMargin - totalAdSpend - fixedCosts, fNPM1, fNPM2, fNPM3],
                      colorFn: (v: number) => v >= 0 ? "#10b981" : "#ef4444" },
                    { label: "Gross Margin", vals: [grossMargin * 100, grossMargin * 100, grossMargin * 100, grossMargin * 100],
                      colorFn: () => "#6366f1", isPct: true },
                  ].map(({ label, vals, colorFn, isPct }) => (
                    <tr key={label} style={{ borderTop: "1px solid #1a1a2e" }}>
                      <td className="py-2.5 pr-6 font-medium" style={{ color: "#9ca3af" }}>{label}</td>
                      {vals.map((v, i) => (
                        <td key={i} className="text-right py-2.5 pr-4 font-medium"
                          style={{ color: colorFn(v) }}>
                          {isPct ? pct(v) : $fn(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-3" style={{ color: "#4b5563" }}>
              Gross margin assumed constant at {pct(grossMargin * 100)}. Ad spend scaled proportionally to revenue.
              Fixed expenses remain at {$fn(fixedCosts)}/month.
            </p>
          </Card>

          {/* Quarter projection */}
          <Card>
            <SectionHeader title={`${quarterLabel} Summary`}
              sub="Current quarter revenue — completed months + EOM projection for current month" />
            {(() => {
              const qMons = monthlyHistory.filter(m =>
                m.year === now.getFullYear() && Math.floor((m.month - 1) / 3) === Math.floor(now.getMonth() / 3)
              );
              const qtdRev = qMons.reduce((s, m) => s + (m.isCurrentMonth ? eomProjection : m.revenue), 0);
              const qtdGP  = qtdRev * grossMargin;
              const qtdNP  = qtdGP - (totalAdSpend * qMons.length) - (fixedCosts * qMons.length);
              return (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: `${quarterLabel} Revenue`,      value: $fn(qtdRev), color: "#e5e7eb" },
                    { label: `${quarterLabel} Gross Profit`, value: $fn(qtdGP),  color: "#10b981" },
                    { label: `${quarterLabel} Net Profit`,   value: $fn(qtdNP),  color: qtdNP >= 0 ? "#10b981" : "#ef4444" },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</p>
                      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

          {/* Budget vs Actual */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="Budget vs Actual" sub="Track performance against monthly targets" />
              <button onClick={() => setConfigOpen(!configOpen)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "#1a1a2e", border: "1px solid #2d2d3d", color: "#9ca3af" }}>
                {configOpen ? "▲ Close" : "✏️ Set Targets"}
              </button>
            </div>

            {configOpen && (
              <div className="grid grid-cols-3 gap-4 mb-4 p-4 rounded-lg" style={{ background: "#0d0d1a" }}>
                <div>
                  <label style={labelStyle}>Revenue Target (AUD/mo)</label>
                  <input type="number" value={revenueTarget} onChange={e => setRevenueTarget(e.target.value)}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Net Profit Target (AUD/mo)</label>
                  <input type="number" value={profitTarget} onChange={e => setProfitTarget(e.target.value)}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Gross Margin Target (%)</label>
                  <input type="number" value={grossMarginTarget} onChange={e => setGrossMarginTarget(e.target.value)}
                    style={inputStyle} placeholder="50" />
                </div>
                <div className="col-span-3 flex justify-end">
                  <button onClick={() => { saveConfig(); setConfigOpen(false); }}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "#6366f1", color: "#fff" }}>Save Targets</button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {[
                { label: "Revenue",      actual: revenue,           target: revTarget, att: revAtt, fmt: $fn },
                { label: "Net Profit",   actual: netProfit,         target: npTarget,  att: npAtt,  fmt: $fn },
                { label: "Gross Margin", actual: grossMargin * 100, target: gmTarget,  att: gmAtt,  fmt: (v: number) => pct(v) },
              ].map(({ label, actual, target, att, fmt }) => {
                const c = att === null ? "#6b7280" : att >= 100 ? "#10b981" : att >= 75 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: "#e5e7eb" }}>{label}</span>
                      <span className="text-xs" style={{ color: "#6b7280" }}>
                        {fmt(actual)} {target > 0 ? `/ ${fmt(target)}` : "(no target set)"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1a1a2e" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, att ?? 0))}%`, background: c }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs" style={{ color: c }}>
                        {att !== null ? `${att.toFixed(1)}% of target` : "Set a target above to track"}
                      </span>
                      {att !== null && att >= 100 && <Badge color="#10b981" label="✓ Reached" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
