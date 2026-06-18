"use client";
import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type MonthData = {
  year: number; month: number; key: string; label: string;
  revenue: number; orderCount: number; refunds: number; isCurrentMonth: boolean;
};

type Props = {
  storeId: string | null;
  monthlyHistory: MonthData[];
  customerStats: { total: number; new30d: number };
  repeatRate: number;
  inventoryValue: number;
  metaConnected: boolean;
  googleConnected: boolean;
  tiktokConnected: boolean;
};

type TabId = "exec" | "pl" | "cash" | "growth" | "unit" | "forecast";
type TrafficStatus = "green" | "amber" | "red" | "neutral";
type HighlightType = "positive" | "warning" | "negative";

const TABS: { id: TabId; label: string }[] = [
  { id: "exec",     label: "Executive Summary" },
  { id: "pl",       label: "P&L Analysis" },
  { id: "cash",     label: "Cash & Working Capital" },
  { id: "growth",   label: "Growth Analytics" },
  { id: "unit",     label: "Unit Economics" },
  { id: "forecast", label: "Forecasting" },
];

const PL_KEY  = "harry_labs_pl_v2";
const CFO_KEY = "harry_labs_cfo_v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function aud(n: number, dec = 0): string {
  if (!isFinite(n)) return "—";
  const str = Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? "-$" : "$") + str;
}

function pctStr(n: number, dec = 1, sign = false): string {
  if (!isFinite(n)) return "—";
  return (sign && n > 0 ? "+" : "") + n.toFixed(dec) + "%";
}

function mom(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function statusColor(s: TrafficStatus): string {
  return s === "green" ? "#10b981" : s === "amber" ? "#f59e0b" : s === "red" ? "#ef4444" : "#64748b";
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, badge, badgeColor }: {
  label: string; value: string; sub?: string; color?: string; badge?: string; badgeColor?: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-xl font-bold truncate" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs mt-1 truncate" style={{ color: "var(--text-faint)" }}>{sub}</p>}
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full mt-2 inline-block"
          style={{ background: `${badgeColor ?? "#6366f1"}20`, color: badgeColor ?? "#a5b4fc", border: `1px solid ${badgeColor ?? "#6366f1"}40` }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function TrafficLight({ label, value, status }: { label: string; value: string; status: TrafficStatus }) {
  const c = statusColor(status);
  const icon = status === "green" ? "✓" : status === "amber" ? "!" : status === "red" ? "✕" : "—";
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: `${c}25`, color: c }}>{icon}</div>
      <div className="text-center">
        <p className="text-xs leading-tight" style={{ color: "var(--text-faint)" }}>{label}</p>
        <p className="text-xs font-semibold mt-0.5" style={{ color: c }}>{value}</p>
      </div>
    </div>
  );
}

function HL({ text, type }: { text: string; type: HighlightType }) {
  const c = type === "positive" ? { b: "#10b981", bg: "#10b98108", t: "#34d399" }
           : type === "warning"  ? { b: "#f59e0b", bg: "#f59e0b08", t: "#fbbf24" }
           :                       { b: "#ef4444", bg: "#ef444408", t: "#f87171" };
  return (
    <div className="text-xs py-2 px-3 mb-2 rounded-r-lg"
      style={{ borderLeft: `3px solid ${c.b}`, background: c.bg, color: c.t }}
      dangerouslySetInnerHTML={{ __html: text }} />
  );
}

function SCard({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3.5 flex items-start justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
          {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Row({ label, right, bold, rc, divider }: { label: string; right: React.ReactNode; bold?: boolean; rc?: string; divider?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${divider ? "border-t mt-2 pt-3" : ""}`}
      style={{ borderColor: "var(--border)", borderBottom: divider ? undefined : "1px solid #1e1e2e18" }}>
      <span className="text-xs" style={{ color: bold ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span className="text-xs font-semibold ml-3 text-right" style={{ color: rc ?? "var(--text-primary)" }}>{right}</span>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>{text}</span>
  );
}

function MomRow({ label, base, curr, invert = false, fmt = "aud" }: {
  label: string; base: number; curr: number; invert?: boolean; fmt?: "aud" | "pct" | "num";
}) {
  const change = mom(curr, base);
  const good   = invert ? (change !== null && change <= 0) : (change !== null && change > 0);
  const neutral = change !== null && Math.abs(change) < 1;
  const color  = change === null ? "var(--text-faint)" : neutral ? "#f59e0b" : good ? "#10b981" : "#ef4444";
  const f      = (n: number) => fmt === "pct" ? pctStr(n) : fmt === "num" ? n.toLocaleString() : aud(n);
  return (
    <div className="flex items-center gap-2 py-1.5" style={{ borderBottom: "1px solid #1e1e2e15" }}>
      <span className="flex-1 text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-xs w-20 text-right" style={{ color: "var(--text-faint)" }}>{f(base)}</span>
      <span className="text-xs" style={{ color: "var(--text-faint)" }}>→</span>
      <span className="text-xs w-20 text-right font-medium" style={{ color: "var(--text-primary)" }}>{f(curr)}</span>
      {change !== null
        ? <Badge text={`${change > 0 ? "+" : ""}${change.toFixed(1)}%`} color={color} />
        : <span className="text-xs w-14 text-right" style={{ color: "var(--text-faint)" }}>—</span>}
    </div>
  );
}

function BarChart({ data, color = "#6366f1", height = 56 }: {
  data: { label: string; value: number; projected?: boolean }[]; color?: string; height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const isLast = i === data.length - 1 && !d.projected;
          const h      = Math.max(3, (d.value / max) * height);
          return (
            <div key={i} className="flex-1">
              <div className="w-full rounded-sm"
                style={{
                  height: h,
                  background: d.projected ? `${color}30` : isLast ? color : `${color}55`,
                  border: d.projected ? `1px dashed ${color}60` : "none",
                  borderRadius: "3px 3px 0 0",
                }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {data.map((d, i) => {
          const isLast = i === data.length - 1 && !d.projected;
          return (
            <div key={i} className="flex-1 text-center"
              style={{ fontSize: 9, color: isLast ? "#10b981" : d.projected ? `${color}80` : "var(--text-faint)", fontWeight: isLast ? 600 : 400 }}>
              {d.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WfRow({ label, value, pct, color, dim, bold, revenue }: {
  label: string; value: number; pct: number; color: string; dim?: boolean; bold?: boolean; revenue: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 text-right flex-shrink-0" style={{ fontSize: 11, paddingLeft: dim ? 14 : 0,
        color: bold ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: bold ? 600 : 400, opacity: dim ? 0.75 : 1 }}>
        {label}
      </div>
      <div className="flex-1 h-4 rounded-sm overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
        <div className="h-full rounded-sm" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color, opacity: dim ? 0.65 : 1 }} />
      </div>
      <div className="w-28 text-right flex-shrink-0">
        <span className="text-xs font-medium" style={{ color: value < 0 ? "#ef4444" : bold ? color : "var(--text-secondary)" }}>
          {value < 0 ? "−" : ""}{aud(Math.abs(value))}
        </span>
        {!dim && revenue > 0 && (
          <span className="text-xs ml-1" style={{ color: "var(--text-faint)" }}>
            ({((Math.abs(value) / revenue) * 100).toFixed(0)}%)
          </span>
        )}
      </div>
    </div>
  );
}

function CfgInput({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4">
      <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>$</span>
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          placeholder="0" />
      </div>
      {hint && <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{hint}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CFOView({
  storeId, monthlyHistory, customerStats, repeatRate, inventoryValue,
  metaConnected, googleConnected, tiktokConnected,
}: Props) {
  const [tab, setTab] = useState<TabId>("exec");

  // PL config (shared key with P&L page)
  const [cogsMode,  setCogsMode]  = useState<"pct" | "fixed">("pct");
  const [cogsPct,   setCogsPct]   = useState(45);
  const [cogsFixed, setCogsFixed] = useState(0);

  // CFO manual inputs
  const [bankBalance,       setBankBalance]       = useState("0");
  const [accountsPayable,   setAccountsPayable]   = useState("0");
  const [monthlyFixedCosts, setMonthlyFixedCosts] = useState("0");
  const [revenueTarget,     setRevenueTarget]     = useState("0");
  const [profitTarget,      setProfitTarget]      = useState("0");
  const [configSaved,       setConfigSaved]       = useState(false);

  // Ad spend
  const [metaSpend,   setMetaSpend]   = useState(0);
  const [googleSpend, setGoogleSpend] = useState(0);
  const [tiktokSpend, setTiktokSpend] = useState(0);
  const [loadingAds,  setLoadingAds]  = useState(false);

  useEffect(() => {
    try {
      const pl = JSON.parse(localStorage.getItem(PL_KEY) ?? "{}");
      if (pl.cogsMode)  setCogsMode(pl.cogsMode);
      if (pl.cogsPct)   setCogsPct(parseFloat(pl.cogsPct)   || 45);
      if (pl.cogsFixed) setCogsFixed(parseFloat(pl.cogsFixed) || 0);
    } catch {}
    try {
      const cfo = JSON.parse(localStorage.getItem(CFO_KEY) ?? "{}");
      if (cfo.bankBalance)       setBankBalance(cfo.bankBalance);
      if (cfo.accountsPayable)   setAccountsPayable(cfo.accountsPayable);
      if (cfo.monthlyFixedCosts) setMonthlyFixedCosts(cfo.monthlyFixedCosts);
      if (cfo.revenueTarget)     setRevenueTarget(cfo.revenueTarget);
      if (cfo.profitTarget)      setProfitTarget(cfo.profitTarget);
    } catch {}
  }, []);

  const saveConfig = useCallback(() => {
    localStorage.setItem(CFO_KEY, JSON.stringify({
      bankBalance, accountsPayable, monthlyFixedCosts, revenueTarget, profitTarget,
    }));
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 1500);
  }, [bankBalance, accountsPayable, monthlyFixedCosts, revenueTarget, profitTarget]);

  // Fetch current-month ad spend
  useEffect(() => {
    if (!metaConnected && !googleConnected && !tiktokConnected) return;
    const now   = new Date();
    const since = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const until = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const days  = now.getDate();
    setLoadingAds(true);
    const ps: Promise<void>[] = [];
    if (metaConnected) ps.push(
      fetch(`/api/meta/stats?since=${since}&until=${until}&preset=custom&days=${days}`)
        .then((r) => r.json()).then((d) => { if (d.account?.spend) setMetaSpend(d.account.spend); }).catch(() => {})
    );
    if (googleConnected) ps.push(
      fetch(`/api/google/stats?days=${days}`)
        .then((r) => r.json()).then((d) => { if (d.account?.spend) setGoogleSpend(d.account.spend); }).catch(() => {})
    );
    if (tiktokConnected) ps.push(
      fetch(`/api/tiktok/stats?days=${days}`)
        .then((r) => r.json()).then((d) => { if (d.account?.spend) setTiktokSpend(d.account.spend); }).catch(() => {})
    );
    Promise.all(ps).finally(() => setLoadingAds(false));
  }, [metaConnected, googleConnected, tiktokConnected]);

  // ── Core calculations ─────────────────────────────────────────────────────────
  const history  = monthlyHistory;
  const current  = history[history.length - 1];
  const previous = history[history.length - 2];

  const revenue     = current?.revenue     ?? 0;
  const prevRevenue = previous?.revenue    ?? 0;
  const orders      = current?.orderCount  ?? 0;
  const prevOrders  = previous?.orderCount ?? 0;
  const refunds     = current?.refunds     ?? 0;

  const aov        = orders     > 0 ? revenue     / orders     : 0;
  const prevAov    = prevOrders > 0 ? prevRevenue / prevOrders : 0;

  const cogsVal     = cogsMode === "pct" ? revenue * (cogsPct / 100) : cogsFixed;
  const cogsRate    = revenue > 0 ? cogsVal / revenue : cogsPct / 100;
  const prevCogsVal = cogsMode === "pct" ? prevRevenue * (cogsPct / 100) : cogsFixed;

  const grossProfit     = revenue     - cogsVal;
  const prevGrossProfit = prevRevenue - prevCogsVal;
  const grossMargin     = revenue > 0     ? grossProfit     / revenue     : 0;
  const prevGrossMargin = prevRevenue > 0 ? prevGrossProfit / prevRevenue : 0;

  const totalAdSpend    = metaSpend + googleSpend + tiktokSpend;
  const contribution    = grossProfit - totalAdSpend;
  const contributionPct = revenue > 0 ? contribution / revenue : 0;
  const mer             = totalAdSpend > 0 ? revenue / totalAdSpend : null;

  const fixedCosts     = parseFloat(monthlyFixedCosts) || 0;
  const netProfit      = grossProfit - totalAdSpend - fixedCosts;
  const prevNetProfit  = prevGrossProfit - fixedCosts;
  const netMargin      = revenue > 0     ? netProfit     / revenue     : 0;
  const prevNetMargin  = prevRevenue > 0 ? prevNetProfit / prevRevenue : 0;

  // Days in current month
  const nowDate        = new Date();
  const daysElapsed    = nowDate.getDate();
  const daysInMonth    = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
  const dailyRev       = daysElapsed > 0 ? revenue / daysElapsed : 0;
  const eomProjection  = dailyRev * daysInMonth;
  const annualRunRate  = dailyRev * 365;

  // Inventory
  const cogsDailyRate     = cogsVal > 0 ? cogsVal / 30 : 0;
  const dio               = cogsDailyRate > 0 ? inventoryValue / cogsDailyRate : null;
  const inventoryTurnover = inventoryValue > 0 ? (cogsVal * 12) / inventoryValue : null;

  // Cash
  const bankBal     = parseFloat(bankBalance)      || 0;
  const apBal       = parseFloat(accountsPayable)  || 0;
  const netCash     = bankBal - apBal;
  const totalExpMo  = cogsVal + totalAdSpend + fixedCosts;
  const monthlyBurn = Math.max(0, totalExpMo - revenue);
  const cashRunway  = monthlyBurn > 0 ? netCash / monthlyBurn : null;

  // Customer metrics
  const newCusts     = customerStats.new30d;
  const cac          = newCusts > 0 && totalAdSpend > 0 ? totalAdSpend / newCusts : null;
  const avgOrdersPer = totalAdSpend > 0 ? 1 + (repeatRate / 100) : 1.3;
  const ltv          = grossMargin > 0 ? aov * avgOrdersPer * grossMargin : 0;
  const ltvCacRatio  = cac && cac > 0 && ltv > 0 ? ltv / cac : null;

  // Refund rate
  const totalGrossRev = revenue + refunds;
  const refundRate    = totalGrossRev > 0 ? (refunds / totalGrossRev) * 100 : 0;

  // Revenue split (new vs returning estimate)
  const returningRevPct = Math.min((repeatRate / 100) * 0.8, 0.6);
  const returningRev    = revenue * returningRevPct;
  const newRev          = revenue - returningRev;

  // Budget vs actual
  const revTarget     = parseFloat(revenueTarget) || 0;
  const profTarget    = parseFloat(profitTarget)  || 0;
  const revAttain     = revTarget  > 0 ? (revenue  / revTarget)  * 100 : null;
  const profAttain    = profTarget > 0 ? (netProfit / profTarget) * 100 : null;

  // 3-month projection from compound growth
  const recentFull   = history.filter((m) => !m.isCurrentMonth).slice(-3);
  const growthRate   = recentFull.length >= 2 && recentFull[0].revenue > 0
    ? Math.pow(
        recentFull[recentFull.length - 1].revenue / recentFull[0].revenue,
        1 / (recentFull.length - 1)
      ) - 1
    : 0.05;
  const nowM  = nowDate.getMonth();
  const proj1 = eomProjection * (1 + growthRate);
  const proj2 = proj1 * (1 + growthRate);
  const proj3 = proj2 * (1 + growthRate);
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const p1Label = monthNames[(nowM + 1) % 12];
  const p2Label = monthNames[(nowM + 2) % 12];
  const p3Label = monthNames[(nowM + 3) % 12];

  // Traffic lights
  const tRevenue   = (): TrafficStatus => { const c = mom(revenue, prevRevenue); return c === null ? "neutral" : c >= 5 ? "green" : c >= 0 ? "amber" : "red"; };
  const tGrossM    = (): TrafficStatus => grossMargin >= 0.5 ? "green" : grossMargin >= 0.35 ? "amber" : grossMargin > 0 ? "red" : "neutral";
  const tMer       = (): TrafficStatus => !mer ? "neutral" : mer >= 4 ? "green" : mer >= 3 ? "amber" : "red";
  const tNetM      = (): TrafficStatus => netMargin >= 0.15 ? "green" : netMargin >= 0.05 ? "amber" : netMargin > 0 ? "red" : "neutral";
  const tInvTurn   = (): TrafficStatus => !inventoryTurnover ? "neutral" : inventoryTurnover >= 6 ? "green" : inventoryTurnover >= 3 ? "amber" : "red";
  const tLtvCac    = (): TrafficStatus => !ltvCacRatio ? "neutral" : ltvCacRatio >= 3 ? "green" : ltvCacRatio >= 2 ? "amber" : "red";
  const tRefund    = (): TrafficStatus => refundRate <= 3 ? "green" : refundRate <= 7 ? "amber" : "red";
  const tRepeat    = (): TrafficStatus => repeatRate >= 30 ? "green" : repeatRate >= 20 ? "amber" : repeatRate > 0 ? "red" : "neutral";

  // Auto highlights
  const highlights = useMemo((): { text: string; type: HighlightType }[] => {
    const items: { text: string; type: HighlightType }[] = [];
    const momRev = mom(revenue, prevRevenue);
    if (momRev !== null) {
      if (momRev >= 10)      items.push({ text: `Revenue up <strong>${momRev.toFixed(1)}%</strong> MoM — strong growth momentum`, type: "positive" });
      else if (momRev >= 0)  items.push({ text: `Revenue up <strong>${momRev.toFixed(1)}%</strong> MoM — steady progress`, type: "positive" });
      else                   items.push({ text: `Revenue down <strong>${Math.abs(momRev).toFixed(1)}%</strong> MoM — investigate root cause`, type: "negative" });
    }
    const marginMom = prevGrossMargin > 0 ? (grossMargin - prevGrossMargin) * 100 : null;
    if (marginMom !== null && Math.abs(marginMom) >= 0.5) {
      if (marginMom >= 1)   items.push({ text: `Gross margin improved <strong>${marginMom.toFixed(1)}pp</strong> — COGS efficiency gaining`, type: "positive" });
      else if (marginMom <= -1) items.push({ text: `Gross margin fell <strong>${Math.abs(marginMom).toFixed(1)}pp</strong> — review COGS`, type: "warning" });
    }
    if (mer !== null) {
      if (mer >= 5)          items.push({ text: `Excellent MER <strong>${mer.toFixed(1)}×</strong> — ad spend delivering strong returns`, type: "positive" });
      else if (mer < 3)      items.push({ text: `MER <strong>${mer.toFixed(1)}×</strong> is below 3× — review ad channel efficiency`, type: "negative" });
      else                   items.push({ text: `MER <strong>${mer.toFixed(1)}×</strong> — healthy but monitor for softening`, type: "warning" });
    }
    if (refundRate > 7)      items.push({ text: `Refund rate <strong>${refundRate.toFixed(1)}%</strong> above 7% threshold — review product quality or listing accuracy`, type: "negative" });
    else if (refundRate > 3) items.push({ text: `Refund rate <strong>${refundRate.toFixed(1)}%</strong> — aim to reduce below 3%`, type: "warning" });
    else if (refundRate > 0) items.push({ text: `Refund rate <strong>${refundRate.toFixed(1)}%</strong> — well within acceptable range`, type: "positive" });
    if (ltvCacRatio !== null) {
      if (ltvCacRatio >= 3)  items.push({ text: `LTV:CAC ratio <strong>${ltvCacRatio.toFixed(1)}×</strong> — healthy customer economics, acquisition is sustainable`, type: "positive" });
      else                   items.push({ text: `LTV:CAC <strong>${ltvCacRatio.toFixed(1)}×</strong> — target ≥3× for sustainable paid growth`, type: "warning" });
    }
    if (repeatRate >= 30)    items.push({ text: `Strong repeat rate <strong>${repeatRate.toFixed(1)}%</strong> — retention driving efficient growth`, type: "positive" });
    else if (repeatRate < 20 && repeatRate > 0) items.push({ text: `Low repeat rate <strong>${repeatRate.toFixed(1)}%</strong> — invest in post-purchase journeys & loyalty`, type: "warning" });
    if (revenue === 0)       items.push({ text: `No revenue data yet — run a full Shopify sync from the Shopify Store page`, type: "warning" });
    return items.slice(0, 6);
  }, [revenue, prevRevenue, grossMargin, prevGrossMargin, mer, refundRate, ltvCacRatio, repeatRate]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Tab bar + SOP download */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap p-0.5 rounded-xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="text-xs px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap"
              style={{
                background: tab === t.id ? "#1e1e30" : "transparent",
                color:      tab === t.id ? "#a5b4fc" : "var(--text-muted)",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <a href="/CFO_Hub_SOP.docx" download="CFO_Hub_SOP.docx"
          className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg font-medium whitespace-nowrap flex-shrink-0 transition-all"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)", textDecoration: "none" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#a5b4fc"; (e.currentTarget as HTMLElement).style.borderColor = "#6366f1"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
          <span>📄</span>
          <span>Download SOP</span>
        </a>
      </div>

      {/* ── EXECUTIVE SUMMARY ───────────────────────────────────────────────── */}
      {tab === "exec" && (
        <div>
          {/* KPI strip */}
          <div className="grid grid-cols-5 gap-4 mb-5">
            <KpiCard label="Revenue MTD" value={aud(revenue)} sub={`${orders} orders · ${daysElapsed}d elapsed`} color="#10b981"
              badge={mom(revenue, prevRevenue) !== null ? `${(mom(revenue, prevRevenue)! >= 0 ? "+" : "")}${mom(revenue, prevRevenue)!.toFixed(1)}% MoM` : undefined}
              badgeColor={mom(revenue, prevRevenue) !== null && mom(revenue, prevRevenue)! >= 0 ? "#10b981" : "#ef4444"} />
            <KpiCard label="Net Profit MTD" value={aud(netProfit)} sub={`${pctStr(netMargin * 100)} net margin`}
              color={netProfit >= 0 ? "#10b981" : "#ef4444"} />
            <KpiCard label="Gross Margin" value={pctStr(grossMargin * 100)} sub={`${aud(grossProfit)} gross profit`}
              color={grossMargin >= 0.5 ? "#34d399" : grossMargin >= 0.35 ? "#fbbf24" : "#ef4444"} />
            <KpiCard label="MER" value={mer ? `${mer.toFixed(2)}×` : "—"}
              sub={mer ? `${aud(totalAdSpend)} ad spend` : "No ad platforms connected"}
              color={mer ? (mer >= 4 ? "#818cf8" : mer >= 3 ? "#fbbf24" : "#ef4444") : "var(--text-faint)"}
              badge={loadingAds ? "Loading…" : undefined} />
            <KpiCard label="Annual Run Rate" value={aud(annualRunRate)}
              sub={`${aud(dailyRev, 0)}/day · ${daysElapsed}d pace`} color="#6366f1"
              badge={`EOM est. ${aud(eomProjection)}`} badgeColor="#6366f1" />
          </div>

          {/* Financial health traffic lights */}
          <div className="rounded-xl p-4 mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xs uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>Financial Health</p>
            <div className="flex items-start gap-2">
              <TrafficLight label="Revenue Trend"    value={mom(revenue, prevRevenue) !== null ? `${mom(revenue, prevRevenue)! >= 0 ? "+" : ""}${mom(revenue, prevRevenue)!.toFixed(1)}%` : "—"} status={tRevenue()} />
              <div className="w-px self-stretch mx-1" style={{ background: "var(--border-subtle)" }} />
              <TrafficLight label="Gross Margin"     value={pctStr(grossMargin * 100)}             status={tGrossM()} />
              <div className="w-px self-stretch mx-1" style={{ background: "var(--border-subtle)" }} />
              <TrafficLight label="Ad Efficiency"    value={mer ? `MER ${mer.toFixed(1)}×` : "—"}  status={tMer()} />
              <div className="w-px self-stretch mx-1" style={{ background: "var(--border-subtle)" }} />
              <TrafficLight label="Net Margin"       value={pctStr(netMargin * 100)}               status={tNetM()} />
              <div className="w-px self-stretch mx-1" style={{ background: "var(--border-subtle)" }} />
              <TrafficLight label="Inventory Turns"  value={inventoryTurnover ? `${inventoryTurnover.toFixed(1)}×/yr` : "—"} status={tInvTurn()} />
              <div className="w-px self-stretch mx-1" style={{ background: "var(--border-subtle)" }} />
              <TrafficLight label="LTV:CAC"          value={ltvCacRatio ? `${ltvCacRatio.toFixed(1)}×` : "—"}           status={tLtvCac()} />
              <div className="w-px self-stretch mx-1" style={{ background: "var(--border-subtle)" }} />
              <TrafficLight label="Refund Rate"      value={refundRate > 0 ? pctStr(refundRate) : "0%"}                  status={tRefund()} />
              <div className="w-px self-stretch mx-1" style={{ background: "var(--border-subtle)" }} />
              <TrafficLight label="Repeat Customers" value={pctStr(repeatRate)}                    status={tRepeat()} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Highlights */}
            <SCard title="Key Highlights & Concerns" sub="Auto-generated from your live data">
              {highlights.length === 0
                ? <p className="text-xs" style={{ color: "var(--text-faint)" }}>No data to analyse yet — sync Shopify first.</p>
                : highlights.map((h, i) => <HL key={i} text={h.text} type={h.type} />)}
            </SCard>

            {/* MoM Comparison */}
            <SCard title="Month-over-Month" sub={`${previous?.label ?? "Last month"} → ${current?.label ?? "This month"}`}>
              <MomRow label="Revenue"         base={prevRevenue}       curr={revenue}         fmt="aud" />
              <MomRow label="Gross Profit"    base={prevGrossProfit}   curr={grossProfit}     fmt="aud" />
              <MomRow label="Gross Margin"    base={prevGrossMargin * 100} curr={grossMargin * 100} fmt="pct" />
              <MomRow label="Net Profit"      base={prevNetProfit}     curr={netProfit}       fmt="aud" />
              <MomRow label="Net Margin"      base={prevNetMargin * 100}   curr={netMargin * 100}   fmt="pct" />
              <MomRow label="Orders"          base={prevOrders}        curr={orders}          fmt="num" />
              <MomRow label="AOV"             base={prevAov}           curr={aov}             fmt="aud" />
              <MomRow label="Refund Rate"     base={previous ? (previous.refunds / (previous.revenue + previous.refunds) * 100) : 0}
                                              curr={refundRate}        invert                 fmt="pct" />
            </SCard>
          </div>
        </div>
      )}

      {/* ── P&L ANALYSIS ────────────────────────────────────────────────────── */}
      {tab === "pl" && (
        <div>
          <div className="grid grid-cols-2 gap-5 mb-5">
            {/* Waterfall */}
            <SCard title="P&L Waterfall" sub={`${current?.label ?? "Current month"} — revenue breakdown`}>
              {revenue === 0
                ? <p className="text-xs text-center py-8" style={{ color: "var(--text-faint)" }}>No revenue data yet</p>
                : (
                <div className="space-y-2.5">
                  <WfRow label="Revenue"             value={revenue}      pct={100}                         color="#10b981" bold      revenue={revenue} />
                  {refunds > 0 && <WfRow label="  Refunds"   value={-refunds}    pct={(refunds/revenue)*100}       color="#ef4444" dim      revenue={revenue} />}
                  <WfRow label="  COGS"              value={-cogsVal}     pct={(cogsVal/revenue)*100}       color="#ef4444" dim      revenue={revenue} />
                  <WfRow label="Gross Profit"        value={grossProfit}  pct={(grossProfit/revenue)*100}   color="#34d399" bold      revenue={revenue} />
                  {totalAdSpend > 0 && <WfRow label="  Ad Spend"  value={-totalAdSpend} pct={(totalAdSpend/revenue)*100} color="#f59e0b" dim revenue={revenue} />}
                  <WfRow label="Contribution Margin" value={contribution} pct={(contribution/revenue)*100}  color="#818cf8" bold      revenue={revenue} />
                  {fixedCosts > 0 && <WfRow label="  Fixed Costs" value={-fixedCosts} pct={(fixedCosts/revenue)*100} color="#ef4444" dim revenue={revenue} />}
                  <WfRow label="Net Profit"          value={netProfit}    pct={Math.max(0,(netProfit/revenue)*100)} color={netProfit >= 0 ? "#10b981" : "#ef4444"} bold revenue={revenue} />
                </div>
              )}
            </SCard>

            {/* 6-month margin trends */}
            <SCard title="6-Month Margin Trends" sub="Gross and net margin by month">
              <div className="mb-5">
                <div className="flex justify-between mb-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Gross Margin</span>
                  <span className="text-xs font-semibold" style={{ color: "#34d399" }}>{pctStr(grossMargin * 100)}</span>
                </div>
                <BarChart
                  color="#34d399"
                  data={history.map((m) => ({
                    label: m.label,
                    value: m.revenue > 0
                      ? ((m.revenue - (cogsMode === "pct" ? m.revenue * (cogsPct/100) : cogsFixed)) / m.revenue) * 100
                      : 0,
                  }))}
                />
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div className="flex justify-between mb-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Net Margin</span>
                  <span className="text-xs font-semibold" style={{ color: netMargin >= 0 ? "#10b981" : "#ef4444" }}>{pctStr(netMargin * 100)}</span>
                </div>
                <BarChart
                  color="#10b981"
                  data={history.map((m) => {
                    const gp = m.revenue - (cogsMode === "pct" ? m.revenue * (cogsPct/100) : cogsFixed);
                    const np = gp - fixedCosts;
                    return { label: m.label, value: m.revenue > 0 ? Math.max(0, (np / m.revenue) * 100) : 0 };
                  })}
                />
              </div>
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <Row label="Gross Margin this month" right={pctStr(grossMargin * 100)}   rc={grossMargin >= 0.5 ? "#34d399" : "#fbbf24"} />
                <Row label="Net Margin this month"   right={pctStr(netMargin * 100)}     rc={netMargin >= 0.15  ? "#10b981" : "#f59e0b"} />
                <Row label="Contribution Margin"     right={pctStr(contributionPct * 100)} rc="#818cf8" />
                {mer && <Row label="MER" right={`${mer.toFixed(2)}×`} rc="#818cf8" />}
              </div>
            </SCard>
          </div>

          {/* Period P&L Statement */}
          <SCard title="Period P&L Statement" sub={`${previous?.label ?? "Last month"} vs ${current?.label ?? "This month"}`}>
            <div className="grid grid-cols-2 gap-8">
              {[
                { label: previous?.label ?? "Last Month", rev: prevRevenue, cgs: prevCogsVal, gp: prevGrossProfit, gm: prevGrossMargin, np: prevNetProfit, nm: prevNetMargin, ad: 0, ord: prevOrders },
                { label: current?.label ?? "This Month",  rev: revenue,     cgs: cogsVal,     gp: grossProfit,     gm: grossMargin,     np: netProfit,     nm: netMargin,     ad: totalAdSpend, ord: orders },
              ].map((col, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold mb-3 pb-2" style={{ color: i === 1 ? "#a5b4fc" : "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{col.label}</p>
                  <Row label="Revenue"            right={aud(col.rev)}            />
                  <Row label="COGS"               right={`(${aud(col.cgs)})`}    rc="#ef444490" />
                  <Row label="Gross Profit"       right={aud(col.gp)}  bold       rc="#34d399" />
                  <Row label="  Gross Margin"     right={pctStr(col.gm * 100)}   rc="var(--text-faint)" />
                  {col.ad > 0 && <Row label="Ad Spend" right={`(${aud(col.ad)})`} rc="#f59e0b90" />}
                  <Row label="Contribution"       right={aud(col.gp - col.ad)}   rc="#818cf8" />
                  {fixedCosts > 0 && <Row label="Fixed Costs" right={`(${aud(fixedCosts)})`} rc="#ef444490" />}
                  <Row label="Net Profit"         right={aud(col.np)} bold        rc={col.np >= 0 ? "#10b981" : "#ef4444"} divider />
                  <Row label="  Net Margin"       right={pctStr(col.nm * 100)}   rc="var(--text-faint)" />
                  <Row label="Orders"             right={col.ord.toLocaleString()} />
                  <Row label="AOV"                right={col.ord > 0 ? aud(col.rev / col.ord) : "—"} />
                </div>
              ))}
            </div>
          </SCard>

          <div className="mt-4 rounded-xl px-4 py-3 text-xs" style={{ background: "#6366f110", border: "1px solid #6366f130", color: "#a5b4fc" }}>
            COGS config, scenario modelling and break-even analysis live on the{" "}
            <a href="/pl" className="underline font-medium">P&L page →</a>
          </div>
        </div>
      )}

      {/* ── CASH & WORKING CAPITAL ───────────────────────────────────────────── */}
      {tab === "cash" && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <KpiCard label="Cash Balance" value={bankBal > 0 ? aud(bankBal) : "—"} sub="Manual entry below" color="#10b981" />
            <KpiCard label="Cash Runway"
              value={cashRunway !== null ? (cashRunway > 24 ? "24+ months" : `${cashRunway.toFixed(1)} months`) : "—"}
              sub={monthlyBurn > 0 ? `${aud(monthlyBurn)}/mo burn` : "Operating profitably"}
              color={cashRunway === null ? "var(--text-faint)" : cashRunway > 6 ? "#10b981" : cashRunway > 3 ? "#fbbf24" : "#ef4444"} />
            <KpiCard label="Inventory Value (Est.)" value={inventoryValue > 0 ? aud(inventoryValue) : "—"}
              sub="Price × COGS rate × stock qty" color="var(--text-primary)" />
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Cash inputs */}
            <SCard title="Cash Position" sub="Manual inputs — update when your bank balance changes">
              <CfgInput label="Bank Balance" hint="Current available cash in business account" value={bankBalance} onChange={setBankBalance} />
              <CfgInput label="Accounts Payable" hint="Outstanding invoices owed to suppliers" value={accountsPayable} onChange={setAccountsPayable} />
              <CfgInput label="Monthly Fixed Costs" hint="Salaries, rent, software, Shopify subscription — recurring monthly" value={monthlyFixedCosts} onChange={setMonthlyFixedCosts} />
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
                <Row label="Net Cash (Bank − AP)"         right={aud(netCash)}       rc={netCash >= 0 ? "#10b981" : "#ef4444"} bold />
                <Row label="Total Monthly Expense (est.)" right={aud(totalExpMo)}     rc="var(--text-secondary)" />
                <Row label="Monthly Net Burn"             right={monthlyBurn > 0 ? aud(monthlyBurn) : "Profitable"} rc={monthlyBurn === 0 ? "#10b981" : "#ef4444"} />
                <Row label="Estimated Cash Runway"        right={cashRunway !== null ? (cashRunway > 24 ? "24+ months" : `${cashRunway.toFixed(1)} months`) : "—"}
                  rc={cashRunway === null ? "var(--text-faint)" : cashRunway > 6 ? "#10b981" : cashRunway > 3 ? "#fbbf24" : "#ef4444"} bold />
              </div>
              <button onClick={saveConfig}
                className="w-full text-xs py-2.5 rounded-lg font-medium transition-all"
                style={{ background: configSaved ? "#10b981" : "#6366f1", color: "white" }}>
                {configSaved ? "✓ Saved" : "Save"}
              </button>
            </SCard>

            {/* Inventory & working capital */}
            <SCard title="Working Capital & Inventory" sub="Ecommerce-specific capital efficiency metrics">
              {inventoryValue > 0
                ? <>
                    <Row label="Inventory Value (Est.)"    right={aud(inventoryValue)}   />
                    <Row label="Inventory Turnover (Ann.)" right={inventoryTurnover ? `${inventoryTurnover.toFixed(1)}× / year` : "—"}
                      rc={inventoryTurnover ? (inventoryTurnover >= 6 ? "#10b981" : inventoryTurnover >= 3 ? "#fbbf24" : "#ef4444") : "var(--text-faint)"} />
                    <Row label="Days Inventory (DIO)"      right={dio ? `${Math.round(dio)} days` : "—"}
                      rc={dio ? (dio <= 60 ? "#10b981" : dio <= 90 ? "#fbbf24" : "#ef4444") : "var(--text-faint)"} />
                    <Row label="Revenue per $1 Inventory"  right={inventoryValue > 0 ? `$${(revenue / inventoryValue).toFixed(2)}` : "—"}
                      rc="#818cf8" />
                    <Row label="COGS / month"              right={aud(cogsVal)}           />
                    <div className="mt-4" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      {(inventoryTurnover ?? 0) < 4 && (
                        <HL text="Low inventory turnover — review slow-moving SKUs and consider clearance pricing to free up working capital" type="warning" />
                      )}
                      {(inventoryTurnover ?? 0) >= 6 && (
                        <HL text="Healthy inventory turnover — stock is moving efficiently relative to COGS" type="positive" />
                      )}
                    </div>
                  </>
                : <p className="text-xs py-6 text-center" style={{ color: "var(--text-faint)" }}>Sync products to calculate inventory metrics</p>
              }
              {bankBal > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Working Capital</p>
                  <Row label="Current Assets (Cash + Inventory)" right={aud(bankBal + inventoryValue)} rc="#10b981" />
                  <Row label="Current Liabilities (AP)"          right={aud(apBal)}                    />
                  <Row label="Net Working Capital"               right={aud(bankBal + inventoryValue - apBal)} bold
                    rc={(bankBal + inventoryValue - apBal) >= 0 ? "#10b981" : "#ef4444"} />
                  <Row label="Current Ratio"
                    right={apBal > 0 ? `${((bankBal + inventoryValue) / apBal).toFixed(1)}×` : "—"}
                    rc={apBal > 0 && (bankBal + inventoryValue) / apBal >= 2 ? "#10b981" : "#fbbf24"} />
                </div>
              )}
            </SCard>
          </div>
        </div>
      )}

      {/* ── GROWTH ANALYTICS ────────────────────────────────────────────────── */}
      {tab === "growth" && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <KpiCard label="New Customers (30d)" value={newCusts.toLocaleString()}
              sub={customerStats.total > 0 ? `of ${customerStats.total.toLocaleString()} total` : undefined}
              color="var(--text-primary)" />
            <KpiCard label="Repeat Purchase Rate" value={pctStr(repeatRate)}
              sub="Customers with 2+ orders"
              color={repeatRate >= 30 ? "#10b981" : repeatRate >= 20 ? "#fbbf24" : "#ef4444"} />
            <KpiCard label="Est. Returning Revenue" value={aud(returningRev)}
              sub={`~${pctStr(returningRevPct * 100)} of total revenue`} color="#818cf8" />
          </div>

          <div className="grid grid-cols-2 gap-5 mb-5">
            {/* 6-month bar chart */}
            <SCard title="6-Month Revenue Trend" sub="Monthly Shopify revenue">
              <BarChart
                color="#6366f1"
                height={80}
                data={history.map((m) => ({ label: m.label, value: m.revenue }))}
              />
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <Row label="Revenue this month"          right={aud(revenue)}        rc="#10b981" />
                <Row label="Revenue per day (pace)"      right={aud(dailyRev, 0)}    rc="#6366f1" />
                <Row label="MoM change"                  right={mom(revenue, prevRevenue) !== null ? pctStr(mom(revenue, prevRevenue)!, 1, true) : "—"}
                  rc={mom(revenue, prevRevenue) !== null && mom(revenue, prevRevenue)! >= 0 ? "#10b981" : "#ef4444"} />
                <Row label="Orders this month"           right={orders.toLocaleString()} />
                <Row label="AOV"                         right={aov > 0 ? aud(aov, 2) : "—"} />
              </div>
            </SCard>

            {/* New vs returning */}
            <SCard title="New vs Returning Revenue" sub="Estimated from repeat purchase rate">
              {revenue > 0
                ? <>
                    {/* Stacked bar */}
                    <div className="flex h-5 rounded-lg overflow-hidden mb-3" style={{ gap: 2 }}>
                      <div style={{ flex: 100 - returningRevPct * 100, background: "#6366f1", borderRadius: "6px 0 0 6px" }} />
                      <div style={{ flex: returningRevPct * 100, background: "#10b981", borderRadius: "0 6px 6px 0", minWidth: 4 }} />
                    </div>
                    <div className="flex gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: "#6366f1" }} />
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>New ({pctStr((1 - returningRevPct) * 100, 0)})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Returning ({pctStr(returningRevPct * 100, 0)})</span>
                      </div>
                    </div>
                    <Row label="New Customer Revenue"     right={aud(newRev)}           rc="#818cf8" />
                    <Row label="Returning Customer Rev."  right={aud(returningRev)}     rc="#10b981" />
                    <Row label="Total Customers"          right={customerStats.total.toLocaleString()} />
                    <Row label="New Customers (30d)"      right={newCusts.toLocaleString()} rc="#818cf8" />
                    <Row label="Avg Orders / Customer"    right={`${avgOrdersPer.toFixed(1)}×`} />
                    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                      {repeatRate >= 25
                        ? <HL text={`<strong>${pctStr(returningRevPct * 100, 0)}</strong> of revenue comes from returning customers — strong retention reducing CAC dependence`} type="positive" />
                        : <HL text="Returning customers reduce blended CAC — invest in post-purchase flows to lift repeat rate above 30%" type="warning" />}
                    </div>
                  </>
                : <p className="text-xs py-6 text-center" style={{ color: "var(--text-faint)" }}>No order data yet — run a Shopify sync</p>}
            </SCard>
          </div>

          {/* Order volume trend */}
          <SCard title="Order Volume Trend" sub="Monthly order count — 6 months">
            <BarChart
              color="#f59e0b"
              height={60}
              data={history.map((m) => ({ label: m.label, value: m.orderCount }))}
            />
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Avg Monthly Orders (6mo)</p>
                <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {Math.round(history.reduce((s, m) => s + m.orderCount, 0) / history.filter((m) => m.orderCount > 0).length || 1).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Peak Month</p>
                <p className="text-lg font-bold" style={{ color: "#10b981" }}>
                  {history.reduce((best, m) => m.orderCount > best.orderCount ? m : best, history[0])?.label ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Orders MoM</p>
                <p className="text-lg font-bold" style={{ color: mom(orders, prevOrders) !== null && mom(orders, prevOrders)! >= 0 ? "#10b981" : "#ef4444" }}>
                  {mom(orders, prevOrders) !== null ? pctStr(mom(orders, prevOrders)!, 1, true) : "—"}
                </p>
              </div>
            </div>
          </SCard>
        </div>
      )}

      {/* ── UNIT ECONOMICS ──────────────────────────────────────────────────── */}
      {tab === "unit" && (
        <div>
          {/* Per-order grid */}
          <div className="grid grid-cols-6 gap-3 mb-5">
            {[
              { label: "AOV",             value: aov,                            color: "#e2e8f0", sub: "Avg order value" },
              { label: "COGS / Order",    value: aov * cogsRate,                 color: "#ef4444", sub: `${pctStr(cogsRate * 100, 0)} of AOV` },
              { label: "Gross / Order",   value: aov - aov * cogsRate,           color: "#34d399", sub: `${pctStr(grossMargin * 100, 0)} margin` },
              { label: "CPA (Ad Cost)",   value: cac ?? 0,                       color: "#f59e0b", sub: cac ? "Blended" : "No ad data" },
              { label: "Contribution",    value: cac ? (aov - aov * cogsRate - (cac ?? 0)) : (aov - aov * cogsRate), color: "#818cf8", sub: "After ad cost" },
              { label: "Net Profit",      value: orders > 0 ? netProfit / orders : 0, color: netProfit >= 0 ? "#10b981" : "#ef4444", sub: `${pctStr(netMargin * 100, 0)} margin` },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-4 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{c.label}</p>
                <p className="text-lg font-bold" style={{ color: c.color }}>{c.value > 0 ? aud(c.value, 2) : "—"}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{c.sub}</p>
                {i > 0 && aov > 0 && c.value !== 0 && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                    {pctStr((c.value / aov) * 100, 0)} of AOV
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* LTV:CAC */}
            <SCard title="LTV : CAC Analysis" sub="Customer lifetime value vs acquisition cost">
              {ltv > 0
                ? <>
                    <div className="mb-4">
                      <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                        LTV:CAC Ratio — {ltvCacRatio ? `${ltvCacRatio.toFixed(1)}×` : "—"} {ltvCacRatio && ltvCacRatio >= 3 ? "✓ Healthy (target: ≥3×)" : "(target: ≥3×)"}
                      </p>
                      {/* Ratio bar */}
                      <div className="flex gap-1 h-6 items-center rounded-lg overflow-hidden">
                        <div className="h-full flex items-center justify-center text-xs font-bold text-white px-3"
                          style={{ flex: ltvCacRatio ? Math.min(ltvCacRatio, 5) : 3, background: "#10b981", borderRadius: "6px 0 0 6px", minWidth: 60 }}>
                          LTV {ltv > 0 ? aud(ltv, 0) : "—"}
                        </div>
                        <div className="h-full flex items-center justify-center text-xs font-bold text-white px-3"
                          style={{ flex: 1, background: "#ef444480", borderRadius: "0 6px 6px 0", minWidth: 60 }}>
                          CAC {cac ? aud(cac, 0) : "—"}
                        </div>
                      </div>
                    </div>
                    <Row label="Est. LTV"                right={aud(ltv, 0)}      rc="#10b981" />
                    <Row label="Blended CAC"             right={cac ? aud(cac, 0) : "—"} rc="#f59e0b" />
                    <Row label="LTV:CAC Ratio"           right={ltvCacRatio ? `${ltvCacRatio.toFixed(2)}×` : "—"}
                      rc={ltvCacRatio ? (ltvCacRatio >= 3 ? "#10b981" : "#f59e0b") : "var(--text-faint)"} bold />
                    <Row label="CAC Payback Period"
                      right={cac && aov > 0 && grossMargin > 0 ? `~${(cac / (aov * grossMargin)).toFixed(1)} orders` : "—"} />
                    <Row label="Avg Orders / Customer"   right={`${avgOrdersPer.toFixed(1)}×`} />
                    <Row label="Gross Margin (used)"     right={pctStr(grossMargin * 100)} rc="#34d399" />
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                        LTV = AOV × avg orders × gross margin. CAC = ad spend ÷ new customers (30d).
                      </p>
                    </div>
                  </>
                : <p className="text-xs py-6 text-center" style={{ color: "var(--text-faint)" }}>Need revenue and ad spend data to calculate</p>}
            </SCard>

            {/* Channel efficiency */}
            <SCard title="Channel Efficiency" sub="Ad spend, CPA and ROAS by platform">
              <div className="flex gap-3 pb-2 mb-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="flex-1 text-xs" style={{ color: "var(--text-faint)" }}>Channel</span>
                <span className="w-20 text-right text-xs" style={{ color: "var(--text-faint)" }}>Spend</span>
                <span className="w-20 text-right text-xs" style={{ color: "var(--text-faint)" }}>Est. CPA</span>
                <span className="w-16 text-right text-xs" style={{ color: "var(--text-faint)" }}>ROAS</span>
              </div>
              {[
                { label: "Meta Ads",   spend: metaSpend,   connected: metaConnected },
                { label: "Google Ads", spend: googleSpend, connected: googleConnected },
                { label: "TikTok Ads", spend: tiktokSpend, connected: tiktokConnected },
              ].map((ch) => {
                const chCac  = ch.spend > 0 && newCusts > 0 ? (ch.spend / newCusts) * (ch.spend / (totalAdSpend || 1)) : null;
                const chRoas = ch.spend > 0 ? revenue * (ch.spend / (totalAdSpend || 1)) / ch.spend : null;
                return (
                  <div key={ch.label} className="flex gap-3 items-center py-1.5" style={{ borderBottom: "1px solid #1e1e2e15" }}>
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: ch.connected ? "#10b981" : "var(--border)" }} />
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{ch.label}</span>
                    </div>
                    <span className="w-20 text-right text-xs font-medium" style={{ color: ch.connected ? "var(--text-primary)" : "var(--text-faint)" }}>
                      {ch.connected ? (loadingAds ? "…" : aud(ch.spend)) : "—"}
                    </span>
                    <span className="w-20 text-right text-xs" style={{ color: ch.connected && chCac ? "#f59e0b" : "var(--text-faint)" }}>
                      {ch.connected && chCac ? aud(chCac, 0) : "—"}
                    </span>
                    <span className="w-16 text-right text-xs font-semibold"
                      style={{ color: chRoas && ch.connected ? (chRoas >= 4 ? "#10b981" : chRoas >= 3 ? "#fbbf24" : "#ef4444") : "var(--text-faint)" }}>
                      {ch.connected && chRoas ? `${chRoas.toFixed(1)}×` : "—"}
                    </span>
                  </div>
                );
              })}
              <div className="flex gap-3 items-center py-1.5 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
                <span className="flex-1 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Total / Blended</span>
                <span className="w-20 text-right text-xs font-bold" style={{ color: "#f59e0b" }}>{aud(totalAdSpend)}</span>
                <span className="w-20 text-right text-xs font-semibold" style={{ color: cac ? "#f59e0b" : "var(--text-faint)" }}>{cac ? aud(cac, 0) : "—"}</span>
                <span className="w-16 text-right text-xs font-bold" style={{ color: mer ? "#818cf8" : "var(--text-faint)" }}>{mer ? `${mer.toFixed(1)}×` : "—"}</span>
              </div>
              {!metaConnected && !googleConnected && !tiktokConnected && (
                <p className="text-xs mt-4 text-center" style={{ color: "var(--text-faint)" }}>
                  Connect ad platforms on <a href="/traffic" className="underline">Paid Ads →</a>
                </p>
              )}
            </SCard>
          </div>
        </div>
      )}

      {/* ── FORECASTING ─────────────────────────────────────────────────────── */}
      {tab === "forecast" && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <KpiCard label="Annual Run Rate" value={annualRunRate > 0 ? aud(annualRunRate) : "—"}
              sub={`Based on ${daysElapsed}-day pace`} color="#6366f1" />
            <KpiCard label="Revenue / Day" value={dailyRev > 0 ? aud(dailyRev, 0) : "—"}
              sub={`${daysElapsed} days into ${current?.label ?? "month"}`} color="#818cf8" />
            <KpiCard label="EOM Projection" value={eomProjection > 0 ? aud(eomProjection) : "—"}
              sub={`${daysInMonth - daysElapsed} days remaining`} color="#10b981"
              badge={revTarget > 0 ? `${pctStr((eomProjection / revTarget) * 100, 0)} of target` : undefined}
              badgeColor={revTarget > 0 && eomProjection >= revTarget ? "#10b981" : "#f59e0b"} />
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Projection chart */}
            <SCard title="Revenue Trend + 3-Month Projection" sub={`${Math.round(growthRate * 100)}% MoM growth rate applied`}>
              <BarChart
                color="#6366f1"
                height={80}
                data={[
                  ...history.map((m) => ({ label: m.label, value: m.isCurrentMonth ? eomProjection : m.revenue })),
                  { label: p1Label, value: proj1, projected: true },
                  { label: p2Label, value: proj2, projected: true },
                  { label: p3Label, value: proj3, projected: true },
                ]}
              />
              <div className="flex gap-4 mt-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#6366f1" }} />
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>Actual</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#6366f130", border: "1px dashed #6366f160" }} />
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>Projected</span>
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <Row label={`${p1Label} Projection`} right={aud(proj1)} rc="#6366f190" />
                <Row label={`${p2Label} Projection`} right={aud(proj2)} rc="#6366f190" />
                <Row label={`${p3Label} Projection`} right={aud(proj3)} rc="#6366f190" />
                <Row label="Q3 Total Projection" right={aud(proj1 + proj2 + proj3)} bold rc="#818cf8" />
                <Row label="Assumed Growth Rate"  right={pctStr(growthRate * 100, 1, true) + " MoM"} rc="var(--text-faint)" />
              </div>
            </SCard>

            {/* Budget vs Actual */}
            <SCard title="Budget vs Actual" sub="Set monthly revenue and profit targets">
              <CfgInput label={`Revenue Target (${current?.label ?? "this month"})`}
                hint="Your revenue goal for this period" value={revenueTarget} onChange={setRevenueTarget} />
              <CfgInput label={`Net Profit Target (${current?.label ?? "this month"})`}
                hint="Your profit goal for this period" value={profitTarget} onChange={setProfitTarget} />
              <button onClick={saveConfig}
                className="w-full text-xs py-2.5 rounded-lg font-medium mb-5 transition-all"
                style={{ background: configSaved ? "#10b981" : "#6366f1", color: "white" }}>
                {configSaved ? "✓ Saved" : "Save Targets"}
              </button>
              {revTarget > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  <Row label="Revenue (Actual)"     right={aud(revenue)}   rc="#10b981" />
                  <Row label="Revenue Target"       right={aud(revTarget)} rc="var(--text-faint)" />
                  <Row label="Revenue Attainment"   right={revAttain !== null ? pctStr(revAttain, 1) : "—"} bold
                    rc={revAttain !== null ? (revAttain >= 100 ? "#10b981" : revAttain >= 80 ? "#fbbf24" : "#ef4444") : "var(--text-faint)"} />
                  <Row label="Revenue vs Budget"
                    right={revTarget > 0 ? (revenue >= revTarget ? `+${aud(revenue - revTarget)}` : `−${aud(revTarget - revenue)}`) : "—"}
                    rc={revenue >= revTarget ? "#10b981" : "#ef4444"} />
                  {profTarget > 0 && <>
                    <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
                    <Row label="Net Profit (Actual)"  right={aud(netProfit)}   rc={netProfit >= 0 ? "#10b981" : "#ef4444"} />
                    <Row label="Profit Target"        right={aud(profTarget)}  rc="var(--text-faint)" />
                    <Row label="Profit Attainment"    right={profAttain !== null ? pctStr(profAttain, 1) : "—"} bold
                      rc={profAttain !== null ? (profAttain >= 100 ? "#10b981" : profAttain >= 80 ? "#fbbf24" : "#ef4444") : "var(--text-faint)"} />
                  </>}
                  {(revAttain ?? 0) >= 100 && (
                    <HL text={`Revenue target exceeded by <strong>${aud(revenue - revTarget)}</strong> — ${pctStr(revAttain! - 100, 1)} above goal`} type="positive" />
                  )}
                  {revAttain !== null && revAttain < 80 && (
                    <HL text={`Revenue at <strong>${pctStr(revAttain, 0)}</strong> of target — ${aud(revTarget - revenue)} gap to close`} type="warning" />
                  )}
                </div>
              )}
              {revTarget === 0 && (
                <p className="text-xs text-center py-4" style={{ color: "var(--text-faint)" }}>Enter targets above to track attainment</p>
              )}
            </SCard>
          </div>
        </div>
      )}
    </div>
  );
}
