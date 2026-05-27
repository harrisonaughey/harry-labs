"use client";
import { useState, useMemo } from "react";

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  orders_count: number | null;
  total_spent: number | string | null;
  created_at: string | null;
  last_order_at?: string | null;
};

const FILTERS = ["All", "New (30d)", "Returning", "High-value"] as const;
type Filter = typeof FILTERS[number];

function fmt(v: number | string | null) {
  const n = parseFloat(String(v ?? "0"));
  return isNaN(n) ? "$0" : "$" + n.toFixed(2);
}

export default function CustomersView({
  customers,
  total,
  new30d,
}: {
  customers: Customer[];
  total: number;
  new30d: number;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const repeatRate = total > 0 ? ((customers.filter((c) => (c.orders_count ?? 0) > 1).length / total) * 100).toFixed(0) : "0";

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        !search ||
        [c.first_name, c.last_name].join(" ").toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase());

      const matchFilter =
        filter === "All" ||
        (filter === "New (30d)"  && c.created_at && new Date(c.created_at) >= thirtyDaysAgo) ||
        (filter === "Returning"  && (c.orders_count ?? 0) > 1) ||
        (filter === "High-value" && parseFloat(String(c.total_spent ?? "0")) > 200);

      return matchSearch && matchFilter;
    });
  }, [customers, search, filter, thirtyDaysAgo]);

  return (
    <div>
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Customers", value: total.toLocaleString(),  icon: "👥" },
          { label: "New (30d)",       value: new30d.toLocaleString(), icon: "✨" },
          { label: "Repeat Rate",     value: repeatRate + "%",        icon: "🔄" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl p-5" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider" style={{ color: "#6b7280" }}>{k.label}</span>
              <span className="text-lg">{k.icon}</span>
            </div>
            <p className="text-2xl font-semibold text-white">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <input
            className="text-sm px-3 py-2 rounded-lg outline-none text-white w-64"
            style={{ background: "#111118", border: "1px solid #1e1e2e" }}
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
                style={{
                  background: filter === f ? "#1e1e30" : "transparent",
                  color: filter === f ? "#a5b4fc" : "#6b7280",
                  border: `1px solid ${filter === f ? "#3730a3" : "#1e1e2e"}`,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs" style={{ color: "#4b5563" }}>{filtered.length} customers</span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "#4b5563", borderBottom: "1px solid #1e1e2e" }}>
              {["Customer", "Email", "Orders", "Total Spent", "LTV", "Customer Since"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm" style={{ color: "#4b5563" }}>
                  {customers.length === 0 ? "No customers yet — sync Shopify to import" : "No customers match your filters"}
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Guest";
                const spent = parseFloat(String(c.total_spent ?? "0"));
                const orders = c.orders_count ?? 0;
                const ltv = orders > 0 ? spent / orders : 0;
                return (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderTop: "1px solid #1a1a24" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                          style={{ background: "#1e1e30" }}>
                          {name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-white font-medium">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#9ca3af" }}>{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-white">{orders}</td>
                    <td className="px-4 py-3 text-white font-medium">{fmt(c.total_spent)}</td>
                    <td className="px-4 py-3" style={{ color: "#a5b4fc" }}>{fmt(ltv)}</td>
                    <td className="px-4 py-3" style={{ color: "#6b7280" }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString("en-AU") : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
