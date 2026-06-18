"use client";
import { useState, useEffect, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type BasePL = {
  revenue:        number;
  cogs:           number;
  cogsRate:       number; // e.g. 0.45
  adSpend:        number;
  contribution:   number;
  otherExpenses:  number;
  netProfit:      number;
  netMargin:      number; // decimal e.g. 0.25
  grossMargin:    number; // decimal
  orderCount:     number;
  aov:            number;
  periodLabel:    string;
};

type ItemType  = "revenue" | "expense";
type ValueMode = "fixed" | "pct";
type Frequency = "one_time" | "weekly" | "monthly" | "quarterly" | "annual";

const FREQ_OPTIONS: { id: Frequency; label: string; short: string }[] = [
  { id: "one_time",   label: "One-time",  short: "Once"  },
  { id: "weekly",     label: "Weekly",    short: "Wkly"  },
  { id: "monthly",    label: "Monthly",   short: "Mo"    },
  { id: "quarterly",  label: "Quarterly", short: "Qtr"   },
  { id: "annual",     label: "Annual",    short: "Yr"    },
];

type ScenarioItem = {
  id:        string;
  label:     string;
  type:      ItemType;
  valueMode: ValueMode;
  value:     string;
  enabled:   boolean;
  frequency: Frequency;
  startDate: string; // YYYY-MM-DD, empty = no constraint
  endDate:   string; // YYYY-MM-DD, empty = open-ended
};

type Scenario = {
  id:    string;
  name:  string;
  items: ScenarioItem[];
};

type Props = { base: BasePL; periodSince: string; periodUntil: string };

// ─── Storage key ──────────────────────────────────────────────────────────────
const STORE_KEY = "harry_labs_pl_scenarios";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function aud(n: number, dec = 0) {
  return (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-AU", {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  });
}

function pctStr(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function newItem(): ScenarioItem {
  return {
    id: Date.now().toString(), label: "", type: "expense", valueMode: "fixed", value: "", enabled: true,
    frequency: "monthly", startDate: "", endDate: "",
  };
}

// How many times does this frequency recur within [since, until]?
function periodMultiplier(item: ScenarioItem, since: string, until: string): number {
  const s = since ? new Date(since) : null;
  const u = until ? new Date(until) : null;

  // Clamp to startDate/endDate constraints if set
  const effectiveStart = item.startDate ? new Date(Math.max(
    s?.getTime() ?? 0,
    new Date(item.startDate).getTime()
  )) : s;
  const effectiveEnd   = item.endDate ? new Date(Math.min(
    u?.getTime() ?? Infinity,
    new Date(item.endDate).getTime()
  )) : u;

  if (!effectiveStart || !effectiveEnd || effectiveEnd < effectiveStart) return 0;

  const periodDays = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

  switch (item.frequency) {
    case "one_time":   return 1;
    case "weekly":     return periodDays / 7;
    case "monthly":    return periodDays / 30.44;
    case "quarterly":  return periodDays / 91.31;
    case "annual":     return periodDays / 365;
  }
}

function newScenario(n: number): Scenario {
  return { id: Date.now().toString(), name: `Scenario ${n}`, items: [] };
}

// ─── Apply scenario items to base ────────────────────────────────────────────
function applyScenario(base: BasePL, items: ScenarioItem[], since = "", until = "") {
  let deltaRevenue  = 0;
  let deltaExpenses = 0;

  for (const item of items) {
    if (!item.enabled) continue;
    const v = parseFloat(item.value) || 0;
    if (v === 0) continue;

    const mult = since && until ? periodMultiplier(item, since, until) : 1;
    const effectiveValue = v * mult;

    if (item.valueMode === "pct") {
      if (item.type === "revenue") {
        deltaRevenue += base.revenue * (effectiveValue / 100);
      } else {
        deltaExpenses += base.revenue * (effectiveValue / 100);
      }
    } else {
      if (item.type === "revenue") deltaRevenue  += effectiveValue;
      else                         deltaExpenses += effectiveValue;
    }
  }

  const projRevenue     = base.revenue + deltaRevenue;
  const projCogs        = projRevenue * base.cogsRate;
  const projGross       = projRevenue - projCogs;
  const projContrib     = projGross - base.adSpend;
  const projOther       = base.otherExpenses + deltaExpenses;
  const projNetProfit   = projRevenue - projCogs - base.adSpend - projOther;
  const projNetMargin   = projRevenue > 0 ? projNetProfit / projRevenue : 0;
  const projGrossMargin = projRevenue > 0 ? projGross    / projRevenue : 0;

  return {
    revenue:     projRevenue,
    cogs:        projCogs,
    grossProfit: projGross,
    grossMargin: projGrossMargin,
    adSpend:     base.adSpend,
    contribution:projContrib,
    otherExpenses: projOther,
    netProfit:   projNetProfit,
    netMargin:   projNetMargin,
    deltaRevenue,
    deltaExpenses,
    newExpenses:  deltaExpenses,
  };
}

// ─── Break-even analysis ─────────────────────────────────────────────────────
function breakEven(base: BasePL, proj: ReturnType<typeof applyScenario>) {
  // Revenue needed to maintain base net margin with new expense structure
  // netMargin = (R - COGS - AdSpend - OtherExpenses) / R  ← solve for R
  // R × (1 - cogsRate) - AdSpend - projOther = R × baseNetMargin
  // R × (1 - cogsRate - baseNetMargin) = AdSpend + projOther
  const targetMargin = base.netMargin;
  const denominator  = 1 - base.cogsRate - targetMargin;

  if (denominator <= 0) return null; // can't solve (margin target too high)

  const requiredRevenue   = (base.adSpend + proj.otherExpenses) / denominator;
  const extraRevenueNeeded = Math.max(0, requiredRevenue - base.revenue);
  const extraOrdersNeeded  = base.aov > 0 ? extraRevenueNeeded / base.aov : 0;
  const revenuePctIncrease = base.revenue > 0 ? (extraRevenueNeeded / base.revenue) * 100 : 0;

  // MER needed to be profitable at current revenue
  const totalExpenses = base.cogs + base.adSpend + proj.otherExpenses;
  const requiredMer   = base.adSpend > 0 ? base.revenue / base.adSpend : null;

  return {
    requiredRevenue,
    extraRevenueNeeded,
    extraOrdersNeeded,
    revenuePctIncrease,
    requiredMer,
    achievable: extraRevenueNeeded < base.revenue * 0.5, // within 50% uplift
  };
}

// ─── Delta badge ─────────────────────────────────────────────────────────────
function Delta({ a, b, invert = false, prefix = "" }: { a: number; b: number; invert?: boolean; prefix?: string }) {
  const diff = b - a;
  if (Math.abs(diff) < 0.01) return <span className="text-xs" style={{ color: "var(--text-faint)" }}>—</span>;
  const good    = invert ? diff < 0 : diff > 0;
  const pctDiff = a !== 0 ? (diff / Math.abs(a)) * 100 : 0;
  return (
    <div className="flex flex-col items-end">
      <span className="text-xs font-semibold" style={{ color: good ? "#10b981" : "#ef4444" }}>
        {diff > 0 ? "+" : ""}{prefix}{aud(diff, 0)}
      </span>
      <span className="text-xs" style={{ color: good ? "#10b98180" : "#ef444480" }}>
        {pctStr(pctDiff)}
      </span>
    </div>
  );
}

// ─── Compare row ─────────────────────────────────────────────────────────────
function CompareRow({ label, base, proj, invert = false, bold = false, color }: {
  label: string; base: number; proj: number; invert?: boolean; bold?: boolean; color?: string;
}) {
  return (
    <div className="flex items-center py-2.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <span className="flex-1 text-xs" style={{ color: bold ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span className="w-28 text-right text-xs font-medium" style={{ color: color ?? "var(--text-secondary)" }}>
        {aud(base, 2)}
      </span>
      <span className="w-28 text-right text-xs font-medium"
        style={{ color: proj >= 0 ? (proj > base ? "#10b981" : proj < base ? "#ef4444" : "var(--text-secondary)") : "#ef4444" }}>
        {aud(proj, 2)}
      </span>
      <div className="w-32 flex justify-end">
        <Delta a={base} b={proj} invert={invert} />
      </div>
    </div>
  );
}

// ─── Scenario item row ────────────────────────────────────────────────────────
function ItemRow({ item, onChange, onDelete, since, until }: {
  item:     ScenarioItem;
  onChange: (updated: ScenarioItem) => void;
  onDelete: () => void;
  since:    string;
  until:    string;
}) {
  const mult        = since && until ? periodMultiplier(item, since, until) : 1;
  const rawValue    = parseFloat(item.value) || 0;
  const periodValue = item.valueMode === "fixed" ? rawValue * mult : null; // only show $ badge for fixed amounts

  return (
    <div className="py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      {/* ── Row 1: toggle / type / label / $/% / amount / delete ── */}
      <div className="flex items-center gap-2">
        {/* Enable toggle */}
        <button
          onClick={() => onChange({ ...item, enabled: !item.enabled })}
          className="w-8 h-5 rounded-full flex-shrink-0 relative transition-colors"
          style={{ background: item.enabled ? "#6366f1" : "var(--bg-subtle)" }}>
          <span className="absolute w-3 h-3 rounded-full bg-white top-1 transition-all"
            style={{ left: item.enabled ? "14px" : "2px" }} />
        </button>

        {/* Type toggle */}
        <button
          onClick={() => onChange({ ...item, type: item.type === "expense" ? "revenue" : "expense" })}
          className="text-xs px-2 py-0.5 rounded flex-shrink-0 font-medium w-16"
          style={{
            background: item.type === "revenue" ? "#10b98120" : "#ef444420",
            color:      item.type === "revenue" ? "#10b981"   : "#ef4444",
          }}>
          {item.type === "revenue" ? "+ Rev" : "− Exp"}
        </button>

        {/* Label */}
        <input
          value={item.label}
          onChange={(e) => onChange({ ...item, label: e.target.value })}
          placeholder={item.type === "revenue" ? "e.g. New product launch" : "e.g. New hire salary"}
          className="flex-1 text-xs px-2 py-1.5 rounded outline-none"
          style={{
            background: "var(--bg-subtle)", border: "1px solid var(--border)",
            color: item.enabled ? "var(--text-primary)" : "var(--text-faint)",
          }} />

        {/* Value mode */}
        <button
          onClick={() => onChange({ ...item, valueMode: item.valueMode === "fixed" ? "pct" : "fixed" })}
          className="text-xs px-2 py-1 rounded flex-shrink-0"
          style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          {item.valueMode === "fixed" ? "$" : "%"}
        </button>

        {/* Value input */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {item.valueMode === "fixed" && <span className="text-xs" style={{ color: "var(--text-faint)" }}>$</span>}
          <input
            type="number"
            value={item.value}
            onChange={(e) => onChange({ ...item, value: e.target.value })}
            placeholder="0"
            className="w-20 text-xs px-2 py-1.5 rounded outline-none text-right"
            style={{
              background: "var(--bg-subtle)", border: "1px solid var(--border)",
              color: item.enabled ? "var(--text-primary)" : "var(--text-faint)",
            }} />
          {item.valueMode === "pct" && <span className="text-xs" style={{ color: "var(--text-faint)" }}>%</span>}
        </div>

        {/* Delete */}
        <button onClick={onDelete} className="text-xs w-5 h-5 flex items-center justify-center rounded hover:opacity-80 flex-shrink-0"
          style={{ color: "var(--text-faint)" }}>✕</button>
      </div>

      {/* ── Row 2: frequency pills + date fields ── */}
      <div className="flex items-center gap-2 mt-2 pl-10 flex-wrap">
        {/* Frequency pills */}
        <div className="flex gap-1">
          {FREQ_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => onChange({ ...item, frequency: f.id })}
              className="text-xs px-2 py-0.5 rounded-full transition-colors"
              style={{
                background: item.frequency === f.id ? "#6366f130" : "var(--bg-subtle)",
                color:      item.frequency === f.id ? "#a5b4fc"   : "var(--text-faint)",
                border:     `1px solid ${item.frequency === f.id ? "#6366f160" : "var(--border)"}`,
                fontWeight: item.frequency === f.id ? 600 : 400,
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Start date */}
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>From</span>
          <input
            type="date"
            value={item.startDate}
            onChange={(e) => onChange({ ...item, startDate: e.target.value })}
            className="text-xs px-2 py-0.5 rounded outline-none"
            style={{
              background: "var(--bg-subtle)", border: "1px solid var(--border)",
              color: item.startDate ? "var(--text-secondary)" : "var(--text-faint)",
              colorScheme: "dark",
            }} />
        </div>

        {/* End date */}
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>To</span>
          <input
            type="date"
            value={item.endDate}
            onChange={(e) => onChange({ ...item, endDate: e.target.value })}
            className="text-xs px-2 py-0.5 rounded outline-none"
            placeholder="open-ended"
            style={{
              background: "var(--bg-subtle)", border: "1px solid var(--border)",
              color: item.endDate ? "var(--text-secondary)" : "var(--text-faint)",
              colorScheme: "dark",
            }} />
          {item.endDate && (
            <button onClick={() => onChange({ ...item, endDate: "" })}
              className="text-xs" style={{ color: "var(--text-faint)" }}>✕</button>
          )}
        </div>

        {/* Period impact badge */}
        {item.enabled && rawValue > 0 && periodValue !== null && item.frequency !== "one_time" && since && until && (
          <span className="text-xs px-2 py-0.5 rounded-full ml-1"
            style={{
              background: item.type === "revenue" ? "#10b98115" : "#ef444415",
              color:      item.type === "revenue" ? "#10b981"   : "#ef4444",
              border:     `1px solid ${item.type === "revenue" ? "#10b98130" : "#ef444430"}`,
            }}>
            = {item.type === "revenue" ? "+" : "−"}{aud(periodValue, 0)} this period
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PLInteractive({ base, periodSince, periodUntil }: Props) {
  const [scenarios,       setScenarios]       = useState<Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [editingName,     setEditingName]     = useState(false);
  const [nameInput,       setNameInput]       = useState("");

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
      if (Array.isArray(saved) && saved.length > 0) {
        setScenarios(saved);
        setActiveScenarioId(saved[0].id);
      } else {
        const first = newScenario(1);
        setScenarios([first]);
        setActiveScenarioId(first.id);
      }
    } catch {
      const first = newScenario(1);
      setScenarios([first]);
      setActiveScenarioId(first.id);
    }
  }, []);

  // Persist
  useEffect(() => {
    if (scenarios.length > 0) localStorage.setItem(STORE_KEY, JSON.stringify(scenarios));
  }, [scenarios]);

  const active = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];

  function updateActive(fn: (s: Scenario) => Scenario) {
    setScenarios((prev) => prev.map((s) => s.id === active?.id ? fn(s) : s));
  }

  function addItem(type: ItemType) {
    updateActive((s) => ({ ...s, items: [...s.items, { ...newItem(), type }] }));
  }

  function updateItem(id: string, updated: ScenarioItem) {
    updateActive((s) => ({ ...s, items: s.items.map((i) => i.id === id ? updated : i) }));
  }

  function deleteItem(id: string) {
    updateActive((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
  }

  function addScenario() {
    const s = newScenario(scenarios.length + 1);
    setScenarios((prev) => [...prev, s]);
    setActiveScenarioId(s.id);
  }

  function deleteScenario(id: string) {
    const remaining = scenarios.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      const first = newScenario(1);
      setScenarios([first]);
      setActiveScenarioId(first.id);
    } else {
      setScenarios(remaining);
      if (activeScenarioId === id) setActiveScenarioId(remaining[0].id);
    }
  }

  // Calculations
  const proj = useMemo(
    () => active ? applyScenario(base, active.items, periodSince, periodUntil) : null,
    [base, active, periodSince, periodUntil]
  );
  const be   = useMemo(() => proj && base.revenue > 0 ? breakEven(base, proj) : null, [base, proj]);

  const hasChanges = active?.items.some((i) => i.enabled && parseFloat(i.value) > 0);
  const baseGross  = base.revenue - base.cogs;

  if (!active || !proj) return null;

  return (
    <div>
      {/* ── Scenario tabs ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex items-center gap-1 flex-1 flex-wrap">
          {scenarios.map((s) => (
            <div key={s.id} className="flex items-center gap-0.5">
              {editingName && s.id === active.id ? (
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={() => { updateActive((sc) => ({ ...sc, name: nameInput || sc.name })); setEditingName(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { updateActive((sc) => ({ ...sc, name: nameInput || sc.name })); setEditingName(false); } }}
                  className="text-xs px-2 py-1.5 rounded-md outline-none w-32"
                  style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px solid #3730a3" }} />
              ) : (
                <button
                  onClick={() => setActiveScenarioId(s.id)}
                  onDoubleClick={() => { setNameInput(s.name); setEditingName(true); }}
                  className="text-xs px-3 py-1.5 rounded-md font-medium"
                  style={{
                    background: s.id === active.id ? "#1e1e30" : "transparent",
                    color:      s.id === active.id ? "#a5b4fc" : "var(--text-muted)",
                    border:     `1px solid ${s.id === active.id ? "#3730a3" : "var(--border)"}`,
                  }}>
                  {s.name}
                </button>
              )}
              {scenarios.length > 1 && s.id === active.id && !editingName && (
                <button onClick={() => deleteScenario(s.id)}
                  className="text-xs w-4 h-4 flex items-center justify-center"
                  style={{ color: "var(--text-faint)" }}>✕</button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addScenario}
          className="text-xs px-3 py-1.5 rounded-md font-medium hover:opacity-80 flex-shrink-0"
          style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          + New Scenario
        </button>
        <p className="text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>
          Double-click a tab to rename
        </p>
      </div>

      {/* ── Base context banner ─────────────────────────────────────────────── */}
      <div className="rounded-xl p-4 mb-5 flex items-center gap-6" style={{ background: "var(--bg-card)", border: "1px solid #6366f130" }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: "#6366f1" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Base: {base.periodLabel}</span>
        </div>
        {[
          { label: "Revenue",      value: base.revenue,    color: "#10b981" },
          { label: "Net Profit",   value: base.netProfit,  color: base.netProfit >= 0 ? "#10b981" : "#ef4444" },
          { label: "Net Margin",   value: null, text: (base.netMargin * 100).toFixed(1) + "%", color: "var(--text-secondary)" },
          { label: "AOV",          value: base.aov,        color: "var(--text-secondary)" },
          { label: "Orders",       value: null, text: String(base.orderCount), color: "var(--text-secondary)" },
        ].map((k) => (
          <div key={k.label} className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>{k.label}:</span>
            <span className="text-xs font-semibold" style={{ color: k.color }}>
              {k.text ?? aud(k.value!, 0)}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* ── Left: Scenario builder ─────────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Scenario Adjustments</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Add revenue or expense changes to model</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => addItem("revenue")}
                className="text-xs px-3 py-1.5 rounded-md font-medium hover:opacity-80"
                style={{ background: "#10b98120", color: "#10b981", border: "1px solid #10b98140" }}>
                + Revenue
              </button>
              <button onClick={() => addItem("expense")}
                className="text-xs px-3 py-1.5 rounded-md font-medium hover:opacity-80"
                style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440" }}>
                + Expense
              </button>
            </div>
          </div>

          <div className="p-4">
            {active.items.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>No adjustments yet</p>
                <p className="text-xs mb-4" style={{ color: "var(--text-faint)" }}>
                  Add revenue items (new product, price increase) or expenses (new hire, tool subscription)
                </p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => addItem("revenue")}
                    className="text-xs px-3 py-1.5 rounded-md font-medium"
                    style={{ background: "#10b98120", color: "#10b981", border: "1px solid #10b98140" }}>
                    + Add Revenue Item
                  </button>
                  <button onClick={() => addItem("expense")}
                    className="text-xs px-3 py-1.5 rounded-md font-medium"
                    style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440" }}>
                    + Add Expense
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Column headers */}
                <div className="flex items-center gap-2 pb-2 mb-1">
                  <span className="w-8 flex-shrink-0" />
                  <span className="w-16 text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>Type</span>
                  <span className="flex-1 text-xs" style={{ color: "var(--text-faint)" }}>Label</span>
                  <span className="w-6 flex-shrink-0" />
                  <span className="w-24 text-xs text-right flex-shrink-0" style={{ color: "var(--text-faint)" }}>Amount</span>
                  <span className="w-5 flex-shrink-0" />
                </div>
                {active.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onChange={(updated) => updateItem(item.id, updated)}
                    onDelete={() => deleteItem(item.id)}
                    since={periodSince}
                    until={periodUntil}
                  />
                ))}
                {/* Summary */}
                <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-muted)" }}>Net scenario impact</span>
                    <span className="font-semibold" style={{
                      color: proj.deltaRevenue - proj.deltaExpenses > 0 ? "#10b981"
                        : proj.deltaRevenue - proj.deltaExpenses < 0 ? "#ef4444"
                        : "var(--text-faint)",
                    }}>
                      {proj.deltaRevenue - proj.deltaExpenses >= 0 ? "+" : ""}
                      {aud(proj.deltaRevenue - proj.deltaExpenses, 2)}
                    </span>
                  </div>
                  {proj.deltaRevenue > 0 && (
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span style={{ color: "var(--text-faint)" }}>Added revenue</span>
                      <span style={{ color: "#10b981" }}>+{aud(proj.deltaRevenue, 2)}</span>
                    </div>
                  )}
                  {proj.deltaExpenses > 0 && (
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span style={{ color: "var(--text-faint)" }}>Added expenses</span>
                      <span style={{ color: "#ef4444" }}>+{aud(proj.deltaExpenses, 2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Before vs After ─────────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Before vs. After</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Impact of all enabled adjustments</p>
          </div>

          {!hasChanges ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Add adjustments on the left to see the impact</p>
            </div>
          ) : (
            <div className="px-5 py-4">
              {/* Column headers */}
              <div className="flex items-center pb-2 mb-1">
                <span className="flex-1 text-xs" style={{ color: "var(--text-faint)" }}>Metric</span>
                <span className="w-28 text-right text-xs" style={{ color: "var(--text-faint)" }}>Current</span>
                <span className="w-28 text-right text-xs" style={{ color: "var(--text-faint)" }}>Projected</span>
                <span className="w-32 text-right text-xs" style={{ color: "var(--text-faint)" }}>Change</span>
              </div>

              <CompareRow label="Revenue"           base={base.revenue}             proj={proj.revenue}     bold />
              <CompareRow label="COGS"               base={-base.cogs}              proj={-proj.cogs}       invert />
              <CompareRow label="Gross Profit"       base={baseGross}               proj={proj.grossProfit} bold color="#34d399" />
              <CompareRow label="  Gross Margin"     base={base.grossMargin * 100}  proj={proj.grossMargin * 100} />
              <CompareRow label="Ad Spend"           base={-base.adSpend}           proj={-proj.adSpend}    invert />
              <CompareRow label="Contribution Margin" base={base.contribution}      proj={proj.contribution} bold color="#818cf8" />
              <CompareRow label="Other Expenses"     base={-base.otherExpenses}     proj={-proj.otherExpenses} invert />
              <CompareRow label="Net Profit"         base={base.netProfit}          proj={proj.netProfit}   bold
                color={proj.netProfit >= 0 ? "#10b981" : "#ef4444"} />
              <CompareRow label="  Net Margin %"     base={base.netMargin * 100}    proj={proj.netMargin * 100} />

              {/* Visual margin bars */}
              <div className="mt-4 space-y-2">
                {[
                  { label: "Net margin",  base: Math.max(0, base.netMargin * 100), proj: Math.max(0, proj.netMargin * 100), color: "#10b981" },
                  { label: "Gross margin", base: base.grossMargin * 100,           proj: proj.grossMargin * 100,            color: "#34d399" },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>{bar.label}</span>
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                        {bar.base.toFixed(1)}% → <span style={{ color: bar.proj > bar.base ? "#10b981" : "#ef4444" }}>{bar.proj.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
                      <div className="flex h-full">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, bar.proj)}%`, background: bar.color, opacity: 0.9 }} />
                      </div>
                    </div>
                    <div className="h-0.5 relative -mt-1.5 mb-1">
                      <div className="absolute h-3 w-0.5 -top-0.5 rounded-full"
                        style={{ left: `${Math.min(100, bar.base)}%`, background: "#ffffff40" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Break-even analysis ─────────────────────────────────────────────── */}
      {hasChanges && be && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Break-Even Analysis</h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#6366f120", color: "#a5b4fc" }}>
                To maintain {(base.netMargin * 100).toFixed(1)}% net margin
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              What revenue increase is needed to absorb the net impact of these changes?
            </p>
          </div>

          <div className="grid grid-cols-4 divide-x p-0" style={{ borderColor: "var(--border-subtle)" }}>
            {/* Extra revenue needed */}
            <div className="p-5">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Extra Revenue Needed</p>
              <p className="text-2xl font-bold mb-1"
                style={{ color: be.extraRevenueNeeded <= 0 ? "#10b981" : be.achievable ? "#fbbf24" : "#ef4444" }}>
                {be.extraRevenueNeeded <= 0 ? "None" : aud(be.extraRevenueNeeded, 0)}
              </p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                {be.extraRevenueNeeded <= 0
                  ? "Scenario improves profitability — no extra revenue required"
                  : `To maintain your current ${(base.netMargin * 100).toFixed(1)}% net margin`}
              </p>
            </div>

            {/* Extra orders needed */}
            <div className="p-5">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Extra Orders (at current AOV)</p>
              <p className="text-2xl font-bold mb-1"
                style={{ color: be.extraOrdersNeeded <= 0 ? "#10b981" : "var(--text-primary)" }}>
                {be.extraOrdersNeeded <= 0 ? "0" : Math.ceil(be.extraOrdersNeeded).toLocaleString()}
              </p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                {base.aov > 0 ? `At ${aud(base.aov, 0)} AOV` : "Set AOV in P&L summary"}
              </p>
            </div>

            {/* Revenue % increase */}
            <div className="p-5">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Revenue Increase Required</p>
              <p className="text-2xl font-bold mb-1"
                style={{ color: be.revenuePctIncrease <= 0 ? "#10b981" : be.revenuePctIncrease < 20 ? "#fbbf24" : "#ef4444" }}>
                {be.revenuePctIncrease <= 0 ? "0%" : `+${be.revenuePctIncrease.toFixed(1)}%`}
              </p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                {be.revenuePctIncrease <= 0
                  ? "No increase needed"
                  : be.revenuePctIncrease < 10 ? "Achievable with optimisation"
                  : be.revenuePctIncrease < 25 ? "Requires focused growth plan"
                  : "Significant growth needed — reconsider expense"}
              </p>
            </div>

            {/* Net profit impact */}
            <div className="p-5">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Net Profit Impact</p>
              <p className="text-2xl font-bold mb-1"
                style={{ color: proj.netProfit - base.netProfit >= 0 ? "#10b981" : "#ef4444" }}>
                {proj.netProfit - base.netProfit >= 0 ? "+" : ""}
                {aud(proj.netProfit - base.netProfit, 0)}
              </p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                {aud(base.netProfit, 0)} → {aud(proj.netProfit, 0)}
                {" · "}{(base.netMargin * 100).toFixed(1)}% → <span style={{ color: proj.netMargin * 100 > base.netMargin * 100 ? "#10b981" : "#ef4444" }}>
                  {(proj.netMargin * 100).toFixed(1)}%
                </span>
              </p>
            </div>
          </div>

          {/* Insight callout */}
          {proj.deltaExpenses > 0 && be.extraRevenueNeeded > 0 && (
            <div className="mx-5 mb-5 rounded-xl p-4" style={{ background: "#6366f110", border: "1px solid #6366f130" }}>
              <p className="text-xs" style={{ color: "#a5b4fc" }}>
                💡 <strong>Insight:</strong> The added expenses in this scenario cost{" "}
                <strong>{aud(proj.deltaExpenses, 0)}</strong> but your gross margin is{" "}
                <strong>{(base.grossMargin * 100).toFixed(1)}%</strong>, so you need{" "}
                <strong>{aud(proj.deltaExpenses / base.grossMargin, 0)}</strong> in additional revenue just to cover the COGS
                on those sales — plus the full expense on top.
                {base.aov > 0 && (
                  <> That&apos;s <strong>{Math.ceil(be.extraOrdersNeeded)} extra orders</strong> at your current AOV.</>
                )}
              </p>
            </div>
          )}

          {/* Profitable scenario callout */}
          {be.extraRevenueNeeded <= 0 && proj.netProfit > base.netProfit && (
            <div className="mx-5 mb-5 rounded-xl p-4" style={{ background: "#10b98110", border: "1px solid #10b98130" }}>
              <p className="text-xs" style={{ color: "#10b981" }}>
                ✅ <strong>This scenario improves your P&L.</strong> Projected net profit increases by{" "}
                <strong>{aud(proj.netProfit - base.netProfit, 0)}</strong> and net margin improves from{" "}
                {(base.netMargin * 100).toFixed(1)}% to {(proj.netMargin * 100).toFixed(1)}%.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state if no changes */}
      {!hasChanges && (
        <div className="rounded-xl p-8 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-base font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Break-even analysis will appear here</p>
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            Add adjustments above — expenses will show the revenue increase needed to maintain your margins,
            revenue items will show the profit uplift.
          </p>
        </div>
      )}
    </div>
  );
}
