"use client";
import { useState, useEffect, useCallback } from "react";

type Props = {
  shopifyRevenue: number;
  shopifyOrders: number;
};

type ExpenseRow = { id: string; label: string; amount: string };

function fmt(n: number) {
  return "$" + n.toFixed(2);
}

function fmt2(n: number, color?: string) {
  return <span style={{ color: color ?? "white" }}>{n < 0 ? "-" : ""}${Math.abs(n).toFixed(2)}</span>;
}

const STORAGE_KEY = "harry_labs_pl_config";

export default function PLView({ shopifyRevenue, shopifyOrders }: Props) {
  const [cogsMode,    setCogsMode]    = useState<"pct" | "fixed">("pct");
  const [cogsPct,     setCogsPct]     = useState("55");
  const [cogsFixed,   setCogsFixed]   = useState("0");
  const [adSpend,     setAdSpend]     = useState("0");
  const [shipping,    setShipping]    = useState("0");
  const [platformFee, setPlatformFee] = useState("0");
  const [extraRows,   setExtraRows]   = useState<ExpenseRow[]>([]);
  const [newLabel,    setNewLabel]    = useState("");
  const [newAmount,   setNewAmount]   = useState("");

  // Persist to localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (saved.cogsPct)     setCogsPct(saved.cogsPct);
      if (saved.cogsFixed)   setCogsFixed(saved.cogsFixed);
      if (saved.cogsMode)    setCogsMode(saved.cogsMode);
      if (saved.adSpend)     setAdSpend(saved.adSpend);
      if (saved.shipping)    setShipping(saved.shipping);
      if (saved.platformFee) setPlatformFee(saved.platformFee);
      if (saved.extraRows)   setExtraRows(saved.extraRows);
    } catch {}
  }, []);

  const save = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cogsPct, cogsFixed, cogsMode, adSpend, shipping, platformFee, extraRows }));
  }, [cogsPct, cogsFixed, cogsMode, adSpend, shipping, platformFee, extraRows]);

  useEffect(() => { save(); }, [save]);

  const revenue     = shopifyRevenue;
  const cogs        = cogsMode === "pct" ? revenue * (parseFloat(cogsPct) / 100) : parseFloat(cogsFixed);
  const grossProfit = revenue - cogs;
  const adSpendNum  = parseFloat(adSpend)     || 0;
  const shippingNum = parseFloat(shipping)    || 0;
  const platFeeNum  = parseFloat(platformFee) || 0;
  const extraTotal  = extraRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalExpenses = cogs + adSpendNum + shippingNum + platFeeNum + extraTotal;
  const netProfit   = revenue - totalExpenses;
  const netMargin   = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  function addRow() {
    if (!newLabel) return;
    setExtraRows((r) => [...r, { id: Date.now().toString(), label: newLabel, amount: newAmount || "0" }]);
    setNewLabel(""); setNewAmount("");
  }
  function removeRow(id: string) {
    setExtraRows((r) => r.filter((row) => row.id !== id));
  }

  const PL_ROWS = [
    { label: "Revenue",        value: revenue,      indent: 0, color: "#10b981",  bold: true },
    { label: "COGS",           value: -cogs,         indent: 1, color: "#ef4444", bold: false },
    { label: "Gross Profit",   value: grossProfit,  indent: 0, color: grossProfit >= 0 ? "#10b981" : "#ef4444", bold: true, divider: true },
    { label: "Ad Spend",       value: -adSpendNum,  indent: 1, color: "#ef4444", bold: false },
    { label: "Shipping",       value: -shippingNum, indent: 1, color: "#ef4444", bold: false },
    { label: "Platform Fees",  value: -platFeeNum,  indent: 1, color: "#ef4444", bold: false },
    ...extraRows.map((r) => ({ label: r.label, value: -(parseFloat(r.amount) || 0), indent: 1, color: "#ef4444", bold: false })),
    { label: "Net Profit",     value: netProfit,    indent: 0, color: netProfit >= 0 ? "#10b981" : "#ef4444", bold: true, divider: true },
  ];

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Revenue",      value: fmt(revenue),            color: "#10b981" },
          { label: "Gross Profit", value: fmt(grossProfit),        color: grossProfit >= 0 ? "#10b981" : "#ef4444", sub: `${grossMargin.toFixed(1)}% margin` },
          { label: "Total Expenses",value: fmt(totalExpenses),     color: "#ef4444" },
          { label: "Net Profit",   value: fmt(netProfit),          color: netProfit >= 0 ? "#10b981" : "#ef4444", sub: `${netMargin.toFixed(1)}% net margin` },
        ].map((k) => (
          <div key={k.label} className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            {k.sub && <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* P&L Statement */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>P&L Statement</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Revenue from Shopify · expenses below</p>
          </div>
          <div className="p-5 space-y-2">
            {PL_ROWS.map((row, i) => (
              <div key={i}>
                {row.divider && <div className="my-2" style={{ borderTop: "1px solid var(--border)" }} />}
                <div className="flex items-center justify-between py-1.5"
                  style={{ paddingLeft: row.indent ? "16px" : "0" }}>
                  <span className="text-sm" style={{ color: row.bold ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: row.bold ? 600 : 400 }}>
                    {row.label}
                  </span>
                  <span className="text-sm font-medium" style={{ color: row.color }}>
                    {row.value < 0 ? "-" : ""}{fmt(Math.abs(row.value))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expense inputs */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Configure Expenses</h2>

            {/* COGS */}
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text-secondary)" }}>
                Cost of Goods (COGS)
              </label>
              <div className="flex gap-2 mb-2">
                {(["pct", "fixed"] as const).map((m) => (
                  <button key={m} onClick={() => setCogsMode(m)}
                    className="text-xs px-3 py-1 rounded-md"
                    style={{ background: cogsMode === m ? "#6366f1" : "var(--bg-subtle)", color: cogsMode === m ? "white" : "var(--text-muted)" }}>
                    {m === "pct" ? "% of Revenue" : "Fixed AUD"}
                  </button>
                ))}
              </div>
              {cogsMode === "pct" ? (
                <div className="flex items-center gap-2">
                  <input type="number" value={cogsPct} onChange={(e) => setCogsPct(e.target.value)}
                    className="w-24 text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>% → {fmt(cogs)}</span>
                </div>
              ) : (
                <input type="number" value={cogsFixed} onChange={(e) => setCogsFixed(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  placeholder="0.00" />
              )}
            </div>

            {/* Fixed expenses */}
            {[
              { label: "Ad Spend (AUD)", value: adSpend,     set: setAdSpend,     hint: "Meta + Google combined" },
              { label: "Shipping",       value: shipping,    set: setShipping,    hint: "Carrier + fulfilment costs" },
              { label: "Platform Fees",  value: platformFee, set: setPlatformFee, hint: "Shopify subscription + % fees" },
            ].map((field) => (
              <div key={field.label} className="mb-3">
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>{field.label}</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>$</span>
                  <input type="number" value={field.value} onChange={(e) => field.set(e.target.value)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    placeholder="0.00" />
                </div>
                <p className="text-xs mt-0.5" style={{ color: "#374151" }}>{field.hint}</p>
              </div>
            ))}
          </div>

          {/* Extra expense rows */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Additional Expenses</h2>
            <div className="space-y-2 mb-3">
              {extraRows.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <span className="flex-1 text-xs" style={{ color: "var(--text-primary)" }}>{r.label}</span>
                  <span className="text-xs" style={{ color: "#ef4444" }}>${parseFloat(r.amount).toFixed(2)}</span>
                  <button onClick={() => removeRow(r.id)} className="text-xs px-2" style={{ color: "var(--text-muted)" }}>✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                placeholder="Expense label" />
              <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                className="w-24 text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                placeholder="Amount" />
              <button onClick={addRow}
                className="text-sm px-3 py-2 rounded-lg hover:opacity-80 transition-opacity"
                style={{ background: "#6366f1", color: "white" }}>
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
