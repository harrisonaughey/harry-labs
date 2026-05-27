"use client";

type Product = {
  id: string;
  title: string;
  vendor: string | null;
  price: number | string | null;
  inventory_quantity: number | null;
  status: string | null;
};

type SyncEntry = {
  source: string;
  entity: string;
  status: string | null;
  records_synced: number | null;
  synced_at: string | null;
};

type Store = {
  id: string;
  name: string;
  shop_domain: string;
  currency: string;
};

type Props = {
  store: Store | null;
  products: Product[];
  lowStock: Product[];
  revenue30d: number;
  orders30d: number;
  aov: number;
  lastSync: SyncEntry | null;
  totalProducts: number;
};

function fmt(n: number) {
  return n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + n.toFixed(2);
}

export default function ShopifyView({ store, products, lowStock, revenue30d, orders30d, aov, lastSync, totalProducts }: Props) {
  if (!store) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No store connected</p>
          <a href="/api/shopify/install?shop=thinkle-com-au.myshopify.com"
            className="text-sm px-4 py-2 rounded-lg inline-block hover:opacity-80 transition-opacity"
            style={{ background: "#6366f1", color: "white" }}>
            Connect Shopify →
          </a>
        </div>
      </div>
    );
  }

  const syncedAgo = lastSync?.synced_at
    ? new Date(lastSync.synced_at).toLocaleString("en-AU")
    : "Never";

  return (
    <div>
      {/* Store health banner */}
      <div className="rounded-xl p-5 mb-6 flex items-center justify-between"
        style={{ background: "var(--bg-card)", border: "1px solid #10b98130" }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: "#10b98120" }}>
            🛍
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{store.name}</p>
            <p className="text-xs mt-0.5" style={{ color: "#10b981" }}>
              ● Connected · {store.shop_domain} · {store.currency}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs" style={{ color: "var(--text-muted)" }}>
          <span>Last synced: <span style={{ color: "var(--text-primary)" }}>{syncedAgo}</span></span>
          <span>{totalProducts} products</span>
          <a href="/api/shopify/sync" className="px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ background: "#6366f120", color: "#a5b4fc", border: "1px solid #6366f130" }}>
            ↻ Sync Now
          </a>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Revenue (30d)",  value: fmt(revenue30d),    icon: "💰", color: "#10b981" },
          { label: "Orders (30d)",   value: orders30d.toLocaleString(), icon: "📦", color: "var(--text-primary)" },
          { label: "Avg Order Value", value: fmt(aov),          icon: "🛒", color: "var(--text-primary)" },
          { label: "Conversion Rate", value: "—",               icon: "📊", color: "var(--text-muted)", sub: "requires storefront data" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{k.label}</span>
              <span className="text-lg">{k.icon}</span>
            </div>
            <p className="text-2xl font-semibold" style={{ color: k.color }}>{k.value}</p>
            {k.sub && <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top products */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #1e1e2e" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Products</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Active products by price</p>
          </div>
          {products.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              No products yet — sync Shopify
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "var(--text-faint)" }}>
                  {["Product", "Price", "Stock", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[160px]" style={{ color: "var(--text-primary)" }}>{p.title}</p>
                      {p.vendor && <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{p.vendor}</p>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>${parseFloat(String(p.price ?? 0)).toFixed(2)}</td>
                    <td className="px-4 py-3" style={{ color: (p.inventory_quantity ?? 0) < 5 ? "#fbbf24" : "var(--text-secondary)" }}>
                      {p.inventory_quantity ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs capitalize"
                        style={{ background: p.status === "active" ? "#10b98120" : "#6b728020", color: p.status === "active" ? "#10b981" : "var(--text-muted)" }}>
                        {p.status ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Low stock alerts + quick links */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid #f59e0b30" }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm">⚠️</span>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Low Stock Alerts</h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f59e0b20", color: "#fbbf24" }}>
                {lowStock.length} products
              </span>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>✅ All products have healthy stock</p>
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: "var(--bg-card-inner)" }}>
                    <span className="text-xs truncate max-w-[200px]" style={{ color: "var(--text-primary)" }}>{p.title}</span>
                    <span className="text-xs font-medium flex-shrink-0"
                      style={{ color: (p.inventory_quantity ?? 0) === 0 ? "#ef4444" : "#fbbf24" }}>
                      {p.inventory_quantity ?? 0} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Quick Links</h2>
            <div className="space-y-2">
              {[
                { label: "Margin Calculator", href: "/products", icon: "📊" },
                { label: "All Orders",        href: "/orders",   icon: "📦" },
                { label: "Customers",         href: "/customers",icon: "👥" },
                { label: "P&L Report",        href: "/pl",       icon: "💹" },
              ].map((l) => (
                <a key={l.href} href={l.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs hover:opacity-80 transition-opacity"
                  style={{ background: "var(--bg-card-inner)", color: "var(--text-secondary)" }}>
                  <span>{l.icon}</span> {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
