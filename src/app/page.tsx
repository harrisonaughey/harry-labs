import { Suspense } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import KpiCard from "@/components/KpiCard";
import RevenueChart from "@/components/RevenueChart";
import OrdersTable from "@/components/OrdersTable";
import SyncButton from "@/components/SyncButton";
import { getKpiStats, getRevenueChart, getRecentOrders, getSyncLog } from "@/lib/data";
import { getStores } from "@/lib/stores";
import { getMerStats, getChannelBreakdown } from "@/lib/analytics";

export const revalidate = 300;

const QUICK_NAV = [
  { href: "/analytics", icon: "📈", label: "Business Analytics", desc: "MER · ROAS · Profit" },
  { href: "/email",     icon: "✉",  label: "Email",              desc: "Campaigns · Flows · AI Builder" },
  { href: "/traffic",   icon: "📡", label: "Paid Ads",           desc: "Meta · Google · TikTok" },
  { href: "/shopify",   icon: "🛍", label: "Shopify Store",      desc: "Orders · Products · Sync" },
  { href: "/pl",        icon: "📊", label: "P&L Report",         desc: "Revenue · Costs · Net Profit" },
  { href: "/content",   icon: "🎬", label: "Content",            desc: "All channels · Organic · Paid" },
];

function fmt(n: number) {
  return n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + n.toFixed(2);
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const stores = await getStores();
  const storeId = params.store || stores[0]?.id || undefined;
  const currentStore = stores.find((s) => s.id === storeId) || stores[0] || null;

  const [kpis, chartData, orders, syncLog, merStats, channels] = await Promise.all([
    getKpiStats(30, storeId),
    getRevenueChart(6, storeId),
    getRecentOrders(10, storeId),
    getSyncLog(storeId),
    getMerStats(30, storeId),
    getChannelBreakdown(30, storeId),
  ]);

  const grossProfit = merStats.revenue * 0.45;
  const merDisplay = merStats.mer ? merStats.mer.toFixed(2) + "×" : "—";
  const adSpendDisplay = merStats.adSpend > 0 ? fmt(merStats.adSpend) : "$0";

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--bg-app)" }}>
      <Suspense>
        <Sidebar stores={stores} activePage="Overview" />
      </Suspense>
      <main className="flex-1 overflow-y-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {currentStore ? currentStore.name : "Overview"}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {currentStore
                ? `${currentStore.shop_domain} · ${currentStore.currency} · Last 30 days`
                : "No store connected yet"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {currentStore && (
              <Suspense>
                <SyncButton shopDomain={currentStore.shop_domain} />
              </Suspense>
            )}
            {stores.length === 0 && (
              <a
                href="/api/shopify/install?shop=thinkle-com-au.myshopify.com"
                className="text-sm px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
                style={{ background: "#6366f1", color: "white" }}
              >
                + Connect Store
              </a>
            )}
          </div>
        </div>

        {/* Connected banner */}
        {params.connected === "true" && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm font-medium"
            style={{ background: "#10b98120", color: "#10b981", border: "1px solid #10b98140" }}>
            ✅ Store connected successfully! Click &quot;Sync Now&quot; to import your data.
          </div>
        )}

        {/* Row 1 KPIs — Revenue metrics */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <KpiCard label="Revenue"      value={fmt(kpis.revenue.value)}    change={kpis.revenue.change}    positive={kpis.revenue.positive}    icon="💰" />
          <KpiCard label="Gross Profit" value={fmt(grossProfit)}           change={kpis.revenue.change}    positive={kpis.revenue.positive}    icon="📈" />
          <KpiCard label="Ad Spend"     value={adSpendDisplay}             change="—"                      positive={true}                     icon="📡" />
          <KpiCard label="MER"          value={merDisplay}                 change="Marketing efficiency"   positive={true}                     icon="⚡" />
        </div>

        {/* Row 2 KPIs — Operations */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <KpiCard label="Orders"         value={kpis.orders.value.toLocaleString()} change={kpis.orders.change}    positive={kpis.orders.positive}    icon="📦" />
          <KpiCard label="Avg Order Value" value={"$" + kpis.aov.value.toFixed(2)}  change={kpis.aov.change}       positive={kpis.aov.positive}       icon="🛒" />
          <KpiCard label="New Customers"  value={kpis.customers.value.toLocaleString()} change="30 days"           positive={true}                    icon="👥" />
          <KpiCard label="Email Revenue"  value="—"                                   change="Connect Klaviyo"      positive={true}                    icon="✉" />
        </div>

        {/* Revenue Chart + Channel Breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="col-span-2">
            <RevenueChart data={chartData} />
          </div>
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Channel Breakdown</h2>
            {channels.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <p className="text-sm" style={{ color: "var(--text-faint)" }}>No channel data yet</p>
                <p className="text-xs text-center" style={{ color: "#374151" }}>Sync Shopify data to see breakdown</p>
              </div>
            ) : (
              <div className="space-y-3">
                {channels.slice(0, 6).map((ch) => (
                  <div key={ch.channel}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{ch.channel}</span>
                      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{fmt(ch.revenue)}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${ch.pct}%`, background: "#6366f1" }}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{ch.pct.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Shopify", color: "#10b981", connected: true },
                  { label: "Email",   color: "#6366f1", connected: false },
                  { label: "Meta",    color: "#1877F2", connected: false },
                  { label: "Google",  color: "#4285F4", connected: false },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.connected ? s.color : "#2a2a3a" }} />
                    <span className="text-xs" style={{ color: s.connected ? "var(--text-secondary)" : "#374151" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Nav Grid */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Quick Access</h2>
          <div className="grid grid-cols-6 gap-3">
            {QUICK_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl p-4 flex flex-col gap-2 transition-all hover:scale-[1.02] hover:border-indigo-500/40 group"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-faint)" }}>{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <OrdersTable orders={orders} />
      </main>
    </div>
  );
}
