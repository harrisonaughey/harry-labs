"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Store = { id: string; name: string; shop_domain: string; currency: string };
type LowStockProduct = { id: string; title: string; inventory_quantity: number | null; price: number | string | null };
type SyncEntry = { source: string; entity: string; status: string | null; records_synced: number | null; synced_at: string | null };
type TopProduct = { productId: string; title: string; revenue: number; units: number; revPct: number };
type Adjustment = {
  id: string; store_id: string; logged_at: string; category: string;
  title: string; description: string | null; metric_snapshot: Record<string, any>;
};

type Props = {
  store:         Store | null;
  initialLowStock: LowStockProduct[];
  totalProducts: number;
  lastSync:      SyncEntry | null;
  repeatRate:    number;
};

// ─── Config ───────────────────────────────────────────────────────────────────
const PERIODS = [
  { id: "7d",  days: 7  },
  { id: "30d", days: 30 },
  { id: "90d", days: 90 },
] as const;
type PeriodId = typeof PERIODS[number]["id"];

const CATEGORIES: { id: string; label: string; color: string; bg: string }[] = [
  { id: "price",     label: "Price",     color: "#a5b4fc", bg: "#6366f120" },
  { id: "product",   label: "Product",   color: "#34d399", bg: "#10b98120" },
  { id: "promo",     label: "Promo",     color: "#fde68a", bg: "#fbbf2420" },
  { id: "inventory", label: "Inventory", color: "#fb923c", bg: "#f9731620" },
  { id: "ads",       label: "Ads",       color: "#f87171", bg: "#ef444420" },
  { id: "shipping",  label: "Shipping",  color: "#c4b5fd", bg: "#8b5cf620" },
  { id: "store",     label: "Store",     color: "#67e8f9", bg: "#06b6d420" },
  { id: "other",     label: "Other",     color: "#9ca3af", bg: "#6b728020" },
];

const REASONS = [
  { id: "margin",     label: "Margin improvement" },
  { id: "seasonal",   label: "Seasonal pricing" },
  { id: "competitor", label: "Competitor response" },
  { id: "clearance",  label: "Stock clearance" },
  { id: "launch",     label: "New product / launch" },
  { id: "feedback",   label: "Customer feedback" },
  { id: "ab_test",    label: "A/B test" },
  { id: "campaign",   label: "Marketing campaign" },
  { id: "supplier",   label: "Supplier change" },
  { id: "content",    label: "Content refresh" },
  { id: "other",      label: "Other" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(2);
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date)   { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function periodDates(days: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date(); since.setDate(since.getDate() - (days - 1));
  return { since: ymd(since), until: ymd(until) };
}

function prevPeriodDates(days: number): { since: string; until: string } {
  const until = new Date(); until.setDate(until.getDate() - days);
  const since = new Date(until); since.setDate(since.getDate() - (days - 1));
  return { since: ymd(since), until: ymd(until) };
}

function delta(current: number, prev: number) {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const good = pct >= 0;
  return (
    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
      style={{ background: good ? "#10b98120" : "#ef444420", color: good ? "#10b981" : "#ef4444" }}>
      {good ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function catStyle(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

// ─── Kpi card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, delta: d, loading }: {
  label: string; value: string; sub?: string; color?: string; delta?: number | null; loading?: boolean;
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
        {d !== undefined && <DeltaBadge pct={d} />}
      </div>
      {loading
        ? <div className="h-8 w-24 rounded-md animate-pulse" style={{ background: "var(--bg-subtle)" }} />
        : <p className="text-2xl font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>}
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{sub}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ShopifyView({ store, initialLowStock, totalProducts, lastSync, repeatRate }: Props) {
  const [tab,       setTab]      = useState<"overview" | "products" | "adjustments">("overview");
  const [period,    setPeriod]   = useState<PeriodId>("30d");
  const [syncing,   setSyncing]  = useState(false);
  const [syncMsg,   setSyncMsg]  = useState("");

  // Overview data
  const [revenue,     setRevenue]     = useState(0);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [orders,      setOrders]      = useState(0);
  const [prevOrders,  setPrevOrders]  = useState(0);
  const [aov,         setAov]         = useState(0);
  const [prevAov,     setPrevAov]     = useState(0);
  const [loadingKpis, setLoadingKpis] = useState(true);

  // Products data
  const [products,     setProducts]     = useState<TopProduct[]>([]);
  const [loadingProds, setLoadingProds] = useState(false);
  const [prodsError,   setProdsError]   = useState(false);

  // Adjustments
  const [adjustments,   setAdjustments]  = useState<Adjustment[]>([]);
  const [loadingAdj,    setLoadingAdj]   = useState(false);
  const [showLogForm,   setShowLogForm]  = useState(false);
  const [submitting,    setSubmitting]   = useState(false);
  const [logCategory,   setLogCategory]  = useState("price");
  const [logTitle,      setLogTitle]     = useState("");
  const [logDate,       setLogDate]      = useState(() => ymd(new Date()));
  const [logReason,     setLogReason]    = useState("");
  const [logProducts,   setLogProducts]  = useState("");
  const [logDesc,       setLogDesc]      = useState("");
  const [logOutcome,    setLogOutcome]   = useState("");
  const [logReviewDate, setLogReviewDate] = useState("");
  const [logLink,       setLogLink]      = useState("");

  // KPI fetch
  const fetchKpis = useCallback(async (pid: PeriodId) => {
    setLoadingKpis(true);
    const { days } = PERIODS.find((p) => p.id === pid)!;
    const { since, until }     = periodDates(days);
    const { since: ps, until: pu } = prevPeriodDates(days);
    try {
      const [cur, prev] = await Promise.all([
        fetch(`/api/pl/revenue?since=${since}&until=${until}`).then((r) => r.json()),
        fetch(`/api/pl/revenue?since=${ps}&until=${pu}`).then((r) => r.json()),
      ]);
      if (!cur.error)  { setRevenue(cur.netRevenue ?? cur.revenue ?? 0);   setOrders(cur.orderCount ?? 0);  setAov(cur.orderCount > 0 ? (cur.netRevenue ?? cur.revenue ?? 0) / cur.orderCount : 0); }
      if (!prev.error) { setPrevRevenue(prev.netRevenue ?? prev.revenue ?? 0); setPrevOrders(prev.orderCount ?? 0); setPrevAov(prev.orderCount > 0 ? (prev.netRevenue ?? prev.revenue ?? 0) / prev.orderCount : 0); }
    } catch {}
    setLoadingKpis(false);
  }, []);

  // Products fetch
  const fetchProducts = useCallback(async (pid: PeriodId) => {
    setLoadingProds(true);
    setProdsError(false);
    const { days } = PERIODS.find((p) => p.id === pid)!;
    try {
      const data = await fetch(`/api/shopify/products?days=${days}`).then((r) => r.json());
      if (data.error) { setProdsError(true); } else { setProducts(data.products ?? []); }
    } catch { setProdsError(true); }
    setLoadingProds(false);
  }, []);

  // Adjustments fetch
  const fetchAdjustments = useCallback(async () => {
    setLoadingAdj(true);
    try {
      const data = await fetch("/api/shopify/adjustments").then((r) => r.json());
      setAdjustments(data.adjustments ?? []);
    } catch {}
    setLoadingAdj(false);
  }, []);

  useEffect(() => { fetchKpis(period); }, [period, fetchKpis]);
  useEffect(() => { if (tab === "products")    fetchProducts(period); },    [tab, period, fetchProducts]);
  useEffect(() => { if (tab === "adjustments") fetchAdjustments(); }, [tab, fetchAdjustments]);

  async function submitAdjustment() {
    if (!logTitle.trim()) return;
    setSubmitting(true);
    try {
      const metric_snapshot = {
        source: "manual",
        change_date: logDate,
        reason: logReason || null,
        affected_products: logProducts.trim() || null,
        expected_outcome: logOutcome.trim() || null,
        review_date: logReviewDate || null,
        external_link: logLink.trim() || null,
        revenue_period: revenue,
        orders_period: orders,
        aov,
        repeat_rate: repeatRate,
      };
      const res = await fetch("/api/shopify/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: logCategory,
          title: logTitle,
          description: logDesc.trim() || null,
          metric_snapshot,
        }),
      });
      const data = await res.json();
      if (data.adjustment) {
        setAdjustments((prev) => [data.adjustment, ...prev]);
        setLogTitle(""); setLogDesc(""); setLogReason(""); setLogProducts("");
        setLogOutcome(""); setLogReviewDate(""); setLogLink("");
        setLogDate(ymd(new Date())); setLogCategory("price");
        setShowLogForm(false);
      }
    } catch {}
    setSubmitting(false);
  }

  async function runSync(full = false) {
    setSyncing(true);
    setSyncMsg(full ? "Running full sync…" : "Syncing…");
    try {
      const res  = await fetch(`/api/shopify/sync${full ? "?full=true" : ""}`);
      const data = await res.json();
      if (data.error) {
        setSyncMsg(`Error: ${data.error}`);
      } else {
        const counts = data.results ?? {};
        const total  = Object.values(counts as Record<string, number>).reduce((s, n) => s + n, 0);
        setSyncMsg(full ? `Full sync complete — ${total} records pulled` : `Sync complete — ${total} new records`);
        if (tab === "products")    fetchProducts(period);
        if (tab === "adjustments") fetchAdjustments();
        fetchKpis(period);
      }
    } catch {
      setSyncMsg("Sync failed — check your connection");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 4000);
  }

  if (!store) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No store connected</p>
          <a href="/api/shopify/install?shop=thinkle-com-au.myshopify.com"
            className="text-sm px-4 py-2 rounded-lg inline-block hover:opacity-80"
            style={{ background: "#6366f1", color: "white" }}>
            Connect Shopify →
          </a>
        </div>
      </div>
    );
  }

  const syncedAgo = lastSync?.synced_at ? new Date(lastSync.synced_at).toLocaleString("en-AU") : "Never";
  const currentPeriod = PERIODS.find((p) => p.id === period)!;
  const outOfStock   = initialLowStock.filter((p) => (p.inventory_quantity ?? 0) === 0);
  const lowStockOnly = initialLowStock.filter((p) => (p.inventory_quantity ?? 0) > 0);

  return (
    <div>
      {/* ── Store banner ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl p-4 mb-5 flex items-center justify-between"
        style={{ background: "var(--bg-card)", border: "1px solid #10b98130" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#10b98120", fontSize: "18px" }}>🛍</div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{store.name}</p>
            <p className="text-xs" style={{ color: "#10b981" }}>● Connected · {store.shop_domain} · {store.currency}</p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-xs" style={{ color: "var(--text-muted)" }}>
          <span>Last sync: <span style={{ color: "var(--text-secondary)" }}>{syncedAgo}</span></span>
          <span>{totalProducts} products</span>
          {syncMsg && <span className="text-xs" style={{ color: syncing ? "#a5b4fc" : "#10b981" }}>{syncMsg}</span>}
          <button onClick={() => runSync(false)} disabled={syncing}
            className="px-3 py-1.5 rounded-lg font-medium hover:opacity-80 disabled:opacity-50"
            style={{ background: "#6366f120", color: "#a5b4fc", border: "1px solid #6366f130" }}>
            {syncing ? "Syncing…" : "↻ Sync Now"}
          </button>
        </div>
      </div>

      {/* ── Tab bar + period selector ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex p-0.5 rounded-lg w-fit" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {(["overview", "products", "adjustments"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="text-xs px-4 py-1.5 rounded-md font-medium capitalize transition-all"
              style={{
                background: tab === t ? "#1e1e30" : "transparent",
                color:      tab === t ? "#a5b4fc" : "var(--text-muted)",
              }}>
              {t === "adjustments" ? "Adjustment Log" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab !== "adjustments" && (
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {PERIODS.map((p) => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
                style={{
                  background: period === p.id ? "#6366f1" : "transparent",
                  color:      period === p.id ? "white"   : "var(--text-muted)",
                }}>
                {p.id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div>
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KpiCard
              label={`Revenue (${period})`}
              value={fmt(revenue)}
              sub={`${orders} orders`}
              color="#10b981"
              delta={delta(revenue, prevRevenue)}
              loading={loadingKpis}
            />
            <KpiCard
              label={`Orders (${period})`}
              value={orders.toLocaleString()}
              sub="fulfilled + pending"
              delta={delta(orders, prevOrders)}
              loading={loadingKpis}
            />
            <KpiCard
              label="Avg Order Value"
              value={fmt(aov)}
              sub="revenue ÷ orders"
              delta={delta(aov, prevAov)}
              loading={loadingKpis}
            />
            <KpiCard
              label="Repeat Purchase Rate"
              value={repeatRate > 0 ? `${repeatRate.toFixed(1)}%` : "—"}
              sub="customers with 2+ orders"
              color={repeatRate >= 30 ? "#10b981" : repeatRate >= 15 ? "#fbbf24" : "var(--text-primary)"}
            />
          </div>

          {/* Low stock + quick links */}
          <div className="grid grid-cols-2 gap-5">
            {/* Low stock */}
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid #f59e0b30" }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <span>⚠️</span>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Inventory Alerts</h2>
                {outOfStock.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: "#ef444420", color: "#ef4444" }}>
                    {outOfStock.length} out of stock
                  </span>
                )}
                {lowStockOnly.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#fbbf2420", color: "#fbbf24" }}>
                    {lowStockOnly.length} low
                  </span>
                )}
              </div>

              {initialLowStock.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: "#10b981" }}>✅ All products have healthy stock</p>
                </div>
              ) : (
                <div className="p-4 space-y-1">
                  {outOfStock.length > 0 && (
                    <>
                      <p className="text-xs font-medium px-1 mb-1" style={{ color: "#ef4444" }}>OUT OF STOCK</p>
                      {outOfStock.map((p) => (
                        <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                          style={{ background: "#ef444410", border: "1px solid #ef444420" }}>
                          <span className="text-xs truncate max-w-[200px]" style={{ color: "var(--text-primary)" }}>{p.title}</span>
                          <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#ef4444" }}>0 left</span>
                        </div>
                      ))}
                      {lowStockOnly.length > 0 && <div className="pt-2" />}
                    </>
                  )}
                  {lowStockOnly.length > 0 && (
                    <>
                      <p className="text-xs font-medium px-1 mb-1" style={{ color: "#fbbf24" }}>LOW STOCK</p>
                      {lowStockOnly.map((p) => (
                        <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                          style={{ background: "var(--bg-card-inner)" }}>
                          <span className="text-xs truncate max-w-[200px]" style={{ color: "var(--text-primary)" }}>{p.title}</span>
                          <span className="text-xs font-medium flex-shrink-0" style={{ color: "#fbbf24" }}>{p.inventory_quantity} left</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Quick Links</h2>
              <div className="space-y-2">
                {[
                  { label: "Margin Calculator", href: "/products",  icon: "📊", desc: "Cost vs. sell price analysis" },
                  { label: "All Orders",         href: "/orders",   icon: "📦", desc: "Search and filter orders" },
                  { label: "Customers",          href: "/customers",icon: "👥", desc: "LTV and purchase history" },
                  { label: "P&L Report",         href: "/pl",       icon: "💹", desc: "Profit and loss by period" },
                  { label: "Paid Ads",           href: "/traffic",  icon: "📣", desc: "Meta, Google, TikTok spend" },
                ].map((l) => (
                  <a key={l.href} href={l.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:opacity-80 transition-opacity"
                    style={{ background: "var(--bg-card-inner)" }}>
                    <span className="text-base">{l.icon}</span>
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{l.label}</p>
                      <p className="text-xs" style={{ color: "var(--text-faint)" }}>{l.desc}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PRODUCTS TAB                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "products" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Top Products by Revenue</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Ranked by revenue generated — last {currentPeriod.days} days
            </p>
          </div>

          {loadingProds ? (
            <div className="p-8 space-y-3">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="h-4 rounded animate-pulse flex-1" style={{ background: "var(--bg-subtle)" }} />
                  <div className="h-4 rounded animate-pulse w-20" style={{ background: "var(--bg-subtle)" }} />
                  <div className="h-4 rounded animate-pulse w-16" style={{ background: "var(--bg-subtle)" }} />
                </div>
              ))}
            </div>
          ) : prodsError ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>Could not load product revenue data</p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>Run a Shopify sync to populate order line items</p>
            </div>
          ) : products.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>No product revenue data yet</p>
              <p className="text-xs mb-4" style={{ color: "var(--text-faint)" }}>
                Product revenue needs a full Shopify re-sync to backfill line items. This takes 30–60 seconds.
              </p>
              <button onClick={() => runSync(true)} disabled={syncing}
                className="text-xs px-4 py-2 rounded-lg font-medium inline-block disabled:opacity-50"
                style={{ background: "#6366f1", color: "white" }}>
                {syncing ? syncMsg || "Syncing…" : "↻ Run Full Sync"}
              </button>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border-subtle)" }}>
                  {["#", "Product", "Revenue", "Units Sold", "% of Total", "Stock"].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-left font-medium uppercase tracking-wider ${i === 0 ? "w-8" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.productId} style={{ borderTop: "1px solid var(--border-subtle)" }} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-center" style={{ color: "var(--text-faint)" }}>{i + 1}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium truncate max-w-[220px]" style={{ color: "var(--text-primary)" }}>{p.title}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold" style={{ color: "#10b981" }}>{fmt(p.revenue)}</td>
                    <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{p.units}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--border)" }}>
                          <div className="h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${p.revPct}%`, background: "#6366f1" }} />
                        </div>
                        <span style={{ color: "var(--text-muted)" }}>{p.revPct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {/* Stock is not available in line items — link to products */}
                      <a href="/products" className="text-xs" style={{ color: "#6366f1" }}>→ View</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ADJUSTMENTS TAB                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "adjustments" && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Changes are auto-detected on every sync. Add manual entries to capture decisions, campaigns and context that Shopify can't detect automatically.
            </p>
            <button onClick={() => setShowLogForm((v) => !v)}
              className="text-xs px-4 py-2 rounded-lg font-medium flex-shrink-0 ml-4 hover:opacity-80"
              style={{ background: "#6366f1", color: "white" }}>
              {showLogForm ? "✕ Cancel" : "+ Log Change"}
            </button>
          </div>

          {/* ── Manual log form ─────────────────────────────────────────────── */}
          {showLogForm && (
            <div className="rounded-xl p-5 mb-5" style={{ background: "var(--bg-card)", border: "1px solid #6366f140" }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Log a Store Change</h3>

              {/* Category */}
              <div className="mb-4">
                <p className="text-xs mb-2 font-medium" style={{ color: "var(--text-muted)" }}>Category</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c.id} onClick={() => setLogCategory(c.id)}
                      className="text-xs px-3 py-1 rounded-full font-medium transition-all"
                      style={{
                        background: logCategory === c.id ? c.bg : "var(--bg-subtle)",
                        color:      logCategory === c.id ? c.color : "var(--text-faint)",
                        border:     `1px solid ${logCategory === c.id ? c.color + "40" : "var(--border)"}`,
                      }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title + Date row */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
                    Change Summary <span style={{ color: "#ef4444" }}>*</span>
                  </p>
                  <input value={logTitle} onChange={(e) => setLogTitle(e.target.value)}
                    placeholder="e.g. Raised price on Blue T-Shirt from $49 to $59"
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Date of Change</p>
                  <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)", colorScheme: "dark" }} />
                </div>
              </div>

              {/* Reason + Affected products row */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Reason for Change</p>
                  <select value={logReason} onChange={(e) => setLogReason(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: logReason ? "var(--text-primary)" : "var(--text-faint)" }}>
                    <option value="">Select a reason…</option>
                    {REASONS.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Affected Product(s)</p>
                  <input value={logProducts} onChange={(e) => setLogProducts(e.target.value)}
                    placeholder="e.g. Blue T-Shirt, Summer Bundle"
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              </div>

              {/* Notes */}
              <div className="mb-3">
                <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Notes / Context</p>
                <textarea value={logDesc} onChange={(e) => setLogDesc(e.target.value)}
                  placeholder="What specifically changed? Any background context on this decision?"
                  rows={2}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>

              {/* Expected outcome */}
              <div className="mb-3">
                <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Expected Outcome</p>
                <textarea value={logOutcome} onChange={(e) => setLogOutcome(e.target.value)}
                  placeholder="What do you expect to happen as a result of this change? (revenue, conversion, margin…)"
                  rows={2}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>

              {/* Review date + Reference link */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Review Date <span style={{ color: "var(--text-faint)" }}>(optional)</span></p>
                  <input type="date" value={logReviewDate} onChange={(e) => setLogReviewDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: logReviewDate ? "var(--text-primary)" : "var(--text-faint)", colorScheme: "dark" }} />
                  <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>When to check impact</p>
                </div>
                <div>
                  <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Reference Link <span style={{ color: "var(--text-faint)" }}>(optional)</span></p>
                  <input value={logLink} onChange={(e) => setLogLink(e.target.value)}
                    placeholder="https:// — campaign, ad, supplier doc…"
                    type="url"
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              </div>

              {/* Metric snapshot preview */}
              <div className="rounded-lg px-4 py-3 mb-4 text-xs" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                <p className="mb-2 font-medium" style={{ color: "var(--text-secondary)" }}>Metrics snapshot saved with this entry:</p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: `Revenue (${period})`, val: fmt(revenue) },
                    { label: "Orders",              val: orders.toLocaleString() },
                    { label: "AOV",                 val: fmt(aov) },
                    { label: "Repeat Rate",         val: repeatRate > 0 ? `${repeatRate.toFixed(1)}%` : "—" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg px-3 py-2" style={{ background: "var(--bg-card)" }}>
                      <p style={{ color: "var(--text-faint)" }}>{m.label}</p>
                      <p className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{m.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={submitAdjustment} disabled={!logTitle.trim() || submitting}
                  className="text-xs px-5 py-2 rounded-lg font-medium hover:opacity-80 disabled:opacity-40"
                  style={{ background: "#6366f1", color: "white" }}>
                  {submitting ? "Saving…" : "Save Entry"}
                </button>
                <button onClick={() => setShowLogForm(false)}
                  className="text-xs px-4 py-2 rounded-lg font-medium"
                  style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Timeline ────────────────────────────────────────────────────── */}
          {loadingAdj ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => (
                <div key={i} className="rounded-xl p-5 animate-pulse" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="h-3 w-32 rounded mb-2" style={{ background: "var(--bg-subtle)" }} />
                  <div className="h-4 w-64 rounded" style={{ background: "var(--bg-subtle)" }} />
                </div>
              ))}
            </div>
          ) : adjustments.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-base font-medium mb-2" style={{ color: "var(--text-secondary)" }}>No changes yet</p>
              <p className="text-sm mb-5" style={{ color: "var(--text-faint)" }}>
                Run a sync to auto-detect price, product and website changes, or log a manual entry above.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => runSync(false)} disabled={syncing}
                  className="text-xs px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                  style={{ background: "#6366f120", color: "#a5b4fc", border: "1px solid #6366f130" }}>
                  {syncing ? "Syncing…" : "↻ Sync Now"}
                </button>
                <button onClick={() => setShowLogForm(true)}
                  className="text-xs px-4 py-2 rounded-lg font-medium"
                  style={{ background: "#6366f1", color: "white" }}>
                  + Log Change
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {adjustments.map((adj) => {
                const cat        = catStyle(adj.category);
                const snap       = (adj.metric_snapshot as any) ?? {};
                const isAuto     = snap.source === "auto";
                const entryDate  = new Date(adj.logged_at);
                const daysAgo    = Math.floor((Date.now() - entryDate.getTime()) / 86400000);
                const reasonLabel = REASONS.find((r) => r.id === snap.reason)?.label;
                const reviewDate  = snap.review_date ? new Date(snap.review_date) : null;
                const isPastReview = reviewDate && reviewDate < new Date();

                return (
                  <div key={adj.id} className="rounded-xl overflow-hidden"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

                    {/* ── Header row ── */}
                    <div className="px-5 py-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ background: cat.bg, color: cat.color }}>
                        {cat.label}
                      </span>
                      {isAuto ? (
                        <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: "#06b6d420", color: "#67e8f9", border: "1px solid #06b6d430" }}>
                          Auto
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: "#a5b4fc20", color: "#a5b4fc", border: "1px solid #a5b4fc30" }}>
                          Manual
                        </span>
                      )}
                      <span className="text-xs font-semibold flex-1 truncate" style={{ color: "var(--text-primary)" }}>{adj.title}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>
                        {entryDate.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        {daysAgo === 0 ? " · Today" : daysAgo === 1 ? " · Yesterday" : ` · ${daysAgo}d ago`}
                      </span>
                    </div>

                    <div className="px-5 py-4 space-y-3">

                      {/* ── Manual entry details ── */}
                      {!isAuto && (
                        <>
                          {/* Meta row: reason + change date + affected */}
                          <div className="flex flex-wrap gap-3 text-xs">
                            {snap.change_date && snap.change_date !== ymd(entryDate) && (
                              <span style={{ color: "var(--text-faint)" }}>
                                Changed: <span style={{ color: "var(--text-secondary)" }}>
                                  {new Date(snap.change_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                                </span>
                              </span>
                            )}
                            {reasonLabel && (
                              <span className="px-2 py-0.5 rounded-full"
                                style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                                {reasonLabel}
                              </span>
                            )}
                            {snap.affected_products && (
                              <span style={{ color: "var(--text-faint)" }}>
                                Products: <span style={{ color: "var(--text-secondary)" }}>{snap.affected_products}</span>
                              </span>
                            )}
                          </div>

                          {/* Notes */}
                          {adj.description && (
                            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                              <span style={{ color: "var(--text-faint)" }}>Notes: </span>{adj.description}
                            </p>
                          )}

                          {/* Expected outcome */}
                          {snap.expected_outcome && (
                            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                              <span style={{ color: "var(--text-faint)" }}>Expected: </span>{snap.expected_outcome}
                            </p>
                          )}

                          {/* Review date + external link */}
                          {(reviewDate || snap.external_link) && (
                            <div className="flex items-center gap-4 text-xs pt-1">
                              {reviewDate && (
                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg"
                                  style={{
                                    background: isPastReview ? "#fbbf2420" : "var(--bg-subtle)",
                                    color: isPastReview ? "#fbbf24" : "var(--text-faint)",
                                    border: isPastReview ? "1px solid #fbbf2430" : "1px solid var(--border)",
                                  }}>
                                  {isPastReview ? "⚠ " : "📅 "}
                                  Review by: {reviewDate.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                                  {isPastReview && " — overdue"}
                                </span>
                              )}
                              {snap.external_link && (
                                <a href={snap.external_link} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                                  style={{ color: "#a5b4fc" }}>
                                  ↗ Reference
                                </a>
                              )}
                            </div>
                          )}

                          {/* Metric snapshot grid */}
                          {snap.revenue_period > 0 && (
                            <div className="grid grid-cols-4 gap-2 pt-1">
                              {[
                                { label: `Revenue (${period})`, snap: snap.revenue_period, curr: revenue, f: fmt },
                                { label: "Orders",              snap: snap.orders_period,  curr: orders,  f: (n: number) => n.toLocaleString() },
                                { label: "AOV",                 snap: snap.aov,            curr: aov,     f: fmt },
                                { label: "Repeat Rate",         snap: snap.repeat_rate,    curr: repeatRate, f: (n: number) => `${n.toFixed(1)}%` },
                              ].map((row) => {
                                const d = row.snap > 0 ? delta(row.curr, row.snap) : null;
                                return (
                                  <div key={row.label} className="rounded-lg p-3" style={{ background: "var(--bg-subtle)" }}>
                                    <p className="text-xs mb-1" style={{ color: "var(--text-faint)" }}>{row.label}</p>
                                    <div className="flex items-end gap-1.5 flex-wrap">
                                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{row.f(row.curr)}</span>
                                      {d !== null && (
                                        <span className="text-xs" style={{ color: d >= 0 ? "#10b981" : "#ef4444" }}>
                                          {d >= 0 ? "↑" : "↓"}{Math.abs(d).toFixed(1)}%
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>At log: {row.f(row.snap)}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}

                      {/* ── Auto-detected details ── */}
                      {isAuto && (
                        <>
                          {adj.description && (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{adj.description}</p>
                          )}

                          {snap.field === "price" && snap.before != null && snap.after != null && (
                            <div className="flex items-center gap-3">
                              <div className="rounded-lg px-4 py-2 text-center" style={{ background: "var(--bg-subtle)" }}>
                                <p className="text-xs mb-0.5" style={{ color: "var(--text-faint)" }}>Before</p>
                                <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>${Number(snap.before).toFixed(2)}</p>
                              </div>
                              <span style={{ color: "var(--text-faint)" }}>→</span>
                              <div className="rounded-lg px-4 py-2 text-center" style={{ background: "var(--bg-subtle)" }}>
                                <p className="text-xs mb-0.5" style={{ color: "var(--text-faint)" }}>After</p>
                                <p className="text-sm font-semibold" style={{ color: "#10b981" }}>${Number(snap.after).toFixed(2)}</p>
                              </div>
                              {snap.before > 0 && (
                                <span className="text-xs px-2 py-1 rounded-full"
                                  style={{
                                    background: snap.after > snap.before ? "#10b98120" : "#ef444420",
                                    color: snap.after > snap.before ? "#10b981" : "#ef4444",
                                  }}>
                                  {snap.after > snap.before ? "+" : ""}{(((snap.after - snap.before) / snap.before) * 100).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          )}

                          {snap.field === "status" && snap.before && snap.after && (
                            <div className="flex items-center gap-3">
                              <span className="text-xs px-3 py-1 rounded-full capitalize"
                                style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                                {snap.before}
                              </span>
                              <span style={{ color: "var(--text-faint)" }}>→</span>
                              <span className="text-xs px-3 py-1 rounded-full capitalize font-medium"
                                style={{
                                  background: snap.after === "active" ? "#10b98120" : "#ef444420",
                                  color: snap.after === "active" ? "#10b981" : "#ef4444",
                                }}>
                                {snap.after}
                              </span>
                            </div>
                          )}

                          {snap.field === "theme" && snap.theme_name && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-3 py-1 rounded-full"
                                style={{ background: "#06b6d420", color: "#67e8f9" }}>
                                🎨 {snap.theme_name}
                              </span>
                              {snap.prev_updated_at && (
                                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                                  previously modified {new Date(snap.prev_updated_at).toLocaleDateString("en-AU")}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
