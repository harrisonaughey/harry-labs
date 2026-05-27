"use client";
import { useState, useMemo } from "react";

const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "AUD", symbol: "A$" },
  { code: "NZD", symbol: "NZ$" },
  { code: "SGD", symbol: "S$" },
  { code: "PHP", symbol: "₱" },
];

const OFFER_TYPES = [
  { label: "1×",    qty: 1 },
  { label: "2-pack", qty: 2 },
  { label: "3-pack", qty: 3 },
];

type Product = { title: string; price: number };

const DEFAULTS = {
  sellingPrice: 49.99,
  offerQty: 1,
  unitQty: 1,
  taxInclusive: false,
  taxRate: 0,
  productCost: 4,
  shipping: 10,
  paymentFee: 3,
  otherCosts: 0,
  cpa: 30,
  scrub: 20,
};

function fmt(sym: string, v: number, plus = false) {
  const n = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${plus && v >= 0 ? "+" : ""}${sym}${n}`;
}

function Row({ label, value, sub, color, bold, border }:
  { label: string; value: string; sub?: string; color?: string; bold?: boolean; border?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-3 ${border ? "mt-2 pt-4" : ""}`}
      style={{ borderTop: border ? "1px solid #1e1e2e" : undefined }}
    >
      <div>
        <span className="text-sm" style={{ color: bold ? "#e5e7eb" : "#9ca3af" }}>{label}</span>
        {sub && <span className="text-xs ml-2" style={{ color: "#4b5563" }}>{sub}</span>}
      </div>
      <span
        className={`text-sm ${bold ? "font-semibold" : "font-medium"}`}
        style={{ color: color ?? (bold ? "#ffffff" : "#d1d5db") }}
      >
        {value}
      </span>
    </div>
  );
}

export default function MarginCalculator({ products }: { products: Product[] }) {
  const [currency,     setCurrency]     = useState("USD");
  const [offerIdx,     setOfferIdx]     = useState(0);
  const [sellingPrice, setSellingPrice] = useState(DEFAULTS.sellingPrice);
  const [unitQty,      setUnitQty]      = useState(DEFAULTS.unitQty);
  const [taxInclusive, setTaxInclusive] = useState(DEFAULTS.taxInclusive);
  const [taxRate,      setTaxRate]      = useState(DEFAULTS.taxRate);
  const [productCost,  setProductCost]  = useState(DEFAULTS.productCost);
  const [shipping,     setShipping]     = useState(DEFAULTS.shipping);
  const [paymentFee,   setPaymentFee]   = useState(DEFAULTS.paymentFee);
  const [otherCosts,   setOtherCosts]   = useState(DEFAULTS.otherCosts);
  const [cpa,          setCpa]          = useState(DEFAULTS.cpa);
  const [scrub,        setScrub]        = useState(DEFAULTS.scrub);
  const [selectedProd, setSelectedProd] = useState("");

  const sym = CURRENCIES.find(c => c.code === currency)?.symbol ?? "$";

  // Auto-fill from selected product
  function handleProductSelect(title: string) {
    setSelectedProd(title);
    const p = products.find(p => p.title === title);
    if (p) setSellingPrice(p.price);
  }

  const calc = useMemo(() => {
    const offerMultiplier = OFFER_TYPES[offerIdx].qty;
    const totalUnits      = unitQty * offerMultiplier;

    // Net price (ex-tax)
    const netPrice = taxInclusive
      ? sellingPrice / (1 + taxRate / 100)
      : sellingPrice;

    const cogs         = productCost * totalUnits;
    const ship         = shipping;
    const payFee       = (paymentFee / 100) * sellingPrice;
    const other        = otherCosts;
    const totalCost    = cogs + ship + payFee + other;
    const grossProfit  = netPrice - totalCost;
    const grossMargin  = netPrice > 0 ? (grossProfit / netPrice) * 100 : 0;
    const scrubSavings = cpa * (scrub / 100);
    const effectiveCac = cpa - scrubSavings;
    const netProfit    = grossProfit - effectiveCac;
    const netMargin    = netPrice > 0 ? (netProfit / netPrice) * 100 : 0;
    const breakEven    = grossProfit;

    return { netPrice, cogs, ship, payFee, other, totalCost, grossProfit, grossMargin, scrubSavings, effectiveCac, netProfit, netMargin, breakEven };
  }, [offerIdx, unitQty, sellingPrice, taxInclusive, taxRate, productCost, shipping, paymentFee, otherCosts, cpa, scrub]);

  function reset() {
    setSellingPrice(DEFAULTS.sellingPrice); setOfferIdx(0); setUnitQty(DEFAULTS.unitQty);
    setTaxInclusive(false); setTaxRate(DEFAULTS.taxRate); setProductCost(DEFAULTS.productCost);
    setShipping(DEFAULTS.shipping); setPaymentFee(DEFAULTS.paymentFee); setOtherCosts(DEFAULTS.otherCosts);
    setCpa(DEFAULTS.cpa); setScrub(DEFAULTS.scrub); setSelectedProd("");
  }

  // Input helpers
  const numInput = (val: number, setter: (n: number) => void, suffix?: string, prefix?: string) => (
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-3 text-sm" style={{ color: "#6b7280" }}>{prefix}</span>}
      <input
        type="number" min={0} step="0.01"
        value={val === 0 ? "" : val}
        onChange={e => setter(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1"
        style={{
          background: "#0d0d14", border: "1px solid #1e1e2e",
          paddingLeft: prefix ? "1.75rem" : "0.75rem",
          paddingRight: suffix ? "2rem" : "0.75rem",
          WebkitAppearance: "none",
        }}
      />
      {suffix && <span className="absolute right-3 text-sm" style={{ color: "#6b7280" }}>{suffix}</span>}
    </div>
  );

  const profitColor = calc.netProfit >= 0 ? "#10b981" : "#ef4444";
  const marginColor = calc.netMargin >= 0 ? "#10b981" : "#ef4444";

  return (
    <div>
      {/* Top KPI bar */}
      <div
        className="rounded-xl px-6 py-5 mb-6 flex items-center justify-between"
        style={{ background: "#111118", border: "1px solid #1e1e2e" }}
      >
        <div>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>Net profit per order</p>
          <p className="text-3xl font-bold" style={{ color: profitColor }}>{fmt(sym, calc.netProfit)}</p>
          <p className="text-sm mt-1" style={{ color: marginColor }}>{calc.netMargin.toFixed(1)}% margin</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>Break-even CAC</p>
          <p className="text-2xl font-bold text-white">{fmt(sym, calc.breakEven)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* ── Left: Inputs ── */}
        <div className="rounded-xl p-6" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-white">Inputs</h3>
            {/* Currency pills */}
            <div className="flex gap-1 flex-wrap justify-end">
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => setCurrency(c.code)}
                  className="text-xs px-2 py-1 rounded-md font-medium transition-all"
                  style={{
                    background: currency === c.code ? "#ffffff" : "transparent",
                    color:      currency === c.code ? "#000000" : "#6b7280",
                  }}>
                  {c.code}
                </button>
              ))}
            </div>
          </div>

          {/* Product selector */}
          {products.length > 0 && (
            <div className="mb-5">
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "#6b7280" }}>
                Load from product
              </label>
              <select
                value={selectedProd}
                onChange={e => handleProductSelect(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "#0d0d14", border: "1px solid #1e1e2e" }}
              >
                <option value="">— Select a product —</option>
                {products.map(p => (
                  <option key={p.title} value={p.title}>{p.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* SALE */}
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#4b5563" }}>Sale</p>
          <div className="space-y-4 mb-5">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>Selling price</label>
              {numInput(sellingPrice, setSellingPrice, sym)}
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>Offer type</label>
              <div className="grid grid-cols-3 gap-2">
                {OFFER_TYPES.map((o, i) => (
                  <button key={o.label} onClick={() => setOfferIdx(i)}
                    className="py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: offerIdx === i ? "#ffffff" : "#0d0d14",
                      color:      offerIdx === i ? "#000000" : "#6b7280",
                      border:     `1px solid ${offerIdx === i ? "#ffffff" : "#1e1e2e"}`,
                    }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>Qty per order</label>
              {numInput(unitQty, setUnitQty, "units")}
            </div>
          </div>

          {/* SALES TAX */}
          <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: "1.25rem", marginBottom: "1.25rem" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#4b5563" }}>
                Sales tax ({currency})
              </p>
              {!taxInclusive && (
                <span className="text-xs" style={{ color: "#4b5563" }}>Tax added at checkout — does not affect margin</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>Inclusive in price?</label>
                <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #1e1e2e" }}>
                  {[{ label: "Yes (VAT/GST)", val: true }, { label: "No (US-style)", val: false }].map(opt => (
                    <button key={opt.label} onClick={() => setTaxInclusive(opt.val)}
                      className="flex-1 py-2 text-xs font-medium transition-all"
                      style={{
                        background: taxInclusive === opt.val ? "#ffffff" : "transparent",
                        color:      taxInclusive === opt.val ? "#000000" : "#6b7280",
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>
                  Sales tax rate {taxInclusive ? "(included)" : "(added at checkout)"}
                </label>
                {numInput(taxRate, setTaxRate, "%")}
              </div>
            </div>
          </div>

          {/* COSTS */}
          <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: "1.25rem", marginBottom: "1.25rem" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#4b5563" }}>
              Costs ({currency} per order)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>Product cost</label>
                {numInput(productCost, setProductCost, sym)}
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>Shipping</label>
                {numInput(shipping, setShipping, sym)}
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>Payment fee</label>
                {numInput(paymentFee, setPaymentFee, "%")}
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>Other costs</label>
                {numInput(otherCosts, setOtherCosts, sym)}
              </div>
            </div>
          </div>

          {/* MARKETING */}
          <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: "1.25rem" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#4b5563" }}>Marketing</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>CPA</label>
                {numInput(cpa, setCpa, sym)}
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>
                  Scrub <span style={{ color: "#4b5563" }}>% of CPA we don't pay</span>
                </label>
                {numInput(scrub, setScrub, "%")}
              </div>
            </div>
          </div>

          <button onClick={reset}
            className="mt-5 text-xs hover:opacity-70 transition-opacity"
            style={{ color: "#4b5563" }}>
            Reset to defaults
          </button>
        </div>

        {/* ── Right: Breakdown ── */}
        <div className="rounded-xl p-6" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <h3 className="text-sm font-semibold text-white mb-4">Breakdown</h3>

          <Row label="Selling price" value={fmt(sym, sellingPrice)} bold />

          <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: "0.5rem", marginTop: "0.5rem" }}>
            <Row label="COGS" value={`– ${fmt(sym, calc.cogs)}`} />
            <Row label="Shipping" value={`– ${fmt(sym, calc.ship)}`} />
            <Row label={`Payment fee (${paymentFee}%)`} value={`– ${fmt(sym, calc.payFee)}`} />
            {calc.other > 0 && <Row label="Other costs" value={`– ${fmt(sym, calc.other)}`} />}
            <Row label="Total cost" value={`– ${fmt(sym, calc.totalCost)}`} bold />
          </div>

          <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: "0.5rem", marginTop: "0.75rem" }}>
            <Row label="Gross profit" value={fmt(sym, calc.grossProfit)} bold
              color={calc.grossProfit >= 0 ? "#ffffff" : "#ef4444"} />
            <Row label="Gross margin" value={`${calc.grossMargin.toFixed(1)}%`}
              color={calc.grossMargin >= 0 ? "#9ca3af" : "#ef4444"} />
          </div>

          <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: "0.5rem", marginTop: "0.75rem" }}>
            <Row label="Marketing CPA" value={`– ${fmt(sym, cpa)}`} />
            <Row label={`Scrub savings (${scrub}%)`} value={`+ ${fmt(sym, calc.scrubSavings)}`}
              color="#10b981" />
            <Row label="Effective CAC" value={`– ${fmt(sym, calc.effectiveCac)}`} />
          </div>

          <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: "0.75rem", marginTop: "0.75rem" }}>
            <Row label="Net profit" value={fmt(sym, calc.netProfit)} bold color={profitColor} />
            <Row label="Net margin" value={`${calc.netMargin.toFixed(1)}%`} color={marginColor} />
          </div>

          {/* Break-even box */}
          <div className="mt-6 rounded-xl p-4" style={{ background: "#0d0d14", border: "1px solid #1e1e2e" }}>
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#4b5563" }}>Break-even CAC</p>
            <p className="text-xl font-bold text-white">{fmt(sym, calc.breakEven)}</p>
            <p className="text-xs mt-1" style={{ color: "#4b5563" }}>
              Max you can spend on marketing per order before losing money
            </p>
          </div>

          {/* Scenario summary */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Conservative", cpaFactor: 0.6 },
              { label: "Target",       cpaFactor: 1.0 },
              { label: "Aggressive",   cpaFactor: 1.4 },
            ].map(s => {
              const scenCpa    = cpa * s.cpaFactor;
              const scenScrub  = scenCpa * (scrub / 100);
              const scenNet    = calc.grossProfit - (scenCpa - scenScrub);
              const scenMargin = sellingPrice > 0 ? (scenNet / sellingPrice) * 100 : 0;
              const c          = scenNet >= 0 ? "#10b981" : "#ef4444";
              return (
                <div key={s.label} className="rounded-lg p-3 text-center"
                  style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                  <p className="text-xs mb-1" style={{ color: "#4b5563" }}>{s.label}</p>
                  <p className="text-sm font-semibold" style={{ color: c }}>{fmt(sym, scenNet)}</p>
                  <p className="text-xs" style={{ color: c }}>{scenMargin.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
