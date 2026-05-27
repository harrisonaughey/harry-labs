"use client";
import { useState, useMemo } from "react";

type Order = {
  id: string;
  order_number: number | null;
  customer_email: string | null;
  total_price: number | string | null;
  status: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  source: string | null;
  created_at: string | null;
  customers: { first_name: string | null; last_name: string | null } | null;
};

const STATUS_FILTERS = ["All", "Active", "Fulfilled", "Pending", "Cancelled", "Refunded"] as const;
type Filter = typeof STATUS_FILTERS[number];

const BADGE: Record<string, { bg: string; text: string }> = {
  fulfilled:   { bg: "#10b98120", text: "#10b981" },
  paid:        { bg: "#10b98120", text: "#10b981" },
  active:      { bg: "#6366f120", text: "#a5b4fc" },
  pending:     { bg: "#f59e0b20", text: "#fbbf24" },
  unpaid:      { bg: "#f59e0b20", text: "#fbbf24" },
  partial:     { bg: "#f59e0b20", text: "#fbbf24" },
  cancelled:   { bg: "#ef444420", text: "#ef4444" },
  refunded:    { bg: "#ef444420", text: "#ef4444" },
  voided:      { bg: "#ef444420", text: "#ef4444" },
  unfulfilled: { bg: "#1e1e2e",   text: "#6b7280" },
};

function Badge({ label }: { label: string | null }) {
  if (!label) return null;
  const s = BADGE[label.toLowerCase()] ?? { bg: "#1e1e2e", text: "#6b7280" };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: s.bg, color: s.text }}>
      {label}
    </span>
  );
}

function fmt(v: number | string | null) {
  const n = parseFloat(String(v ?? "0"));
  return isNaN(n) ? "$0.00" : "$" + n.toFixed(2);
}

export default function OrdersView({ orders }: { orders: Order[] }) {
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState<Filter>("All");

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !search ||
        String(o.order_number).includes(search) ||
        (o.customer_email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        [o.customers?.first_name, o.customers?.last_name].join(" ").toLowerCase().includes(search.toLowerCase());

      const matchFilter =
        filter === "All" ||
        (filter === "Fulfilled"  && o.fulfillment_status === "fulfilled") ||
        (filter === "Pending"    && (o.financial_status === "pending" || o.fulfillment_status === "unfulfilled")) ||
        (filter === "Cancelled"  && o.status === "cancelled") ||
        (filter === "Refunded"   && o.financial_status === "refunded") ||
        (filter === "Active"     && o.status === "active");

      return matchSearch && matchFilter;
    });
  }, [orders, search, filter]);

  function exportCsv() {
    const rows = [
      ["Order", "Date", "Customer", "Email", "Total", "Status", "Fulfillment", "Financial"],
      ...filtered.map((o) => [
        o.order_number ?? "",
        o.created_at ? new Date(o.created_at).toLocaleDateString("en-AU") : "",
        [o.customers?.first_name, o.customers?.last_name].filter(Boolean).join(" ") || "Guest",
        o.customer_email ?? "",
        fmt(o.total_price),
        o.status ?? "",
        o.fulfillment_status ?? "",
        o.financial_status ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "orders.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <input
            className="text-sm px-3 py-2 rounded-lg outline-none text-white w-64"
            style={{ background: "#111118", border: "1px solid #1e1e2e" }}
            placeholder="Search order # or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
                style={{
                  background: filter === f ? "#1e1e30" : "transparent",
                  color:      filter === f ? "#a5b4fc" : "#6b7280",
                  border:     `1px solid ${filter === f ? "#3730a3" : "#1e1e2e"}`,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "#4b5563" }}>{filtered.length} orders</span>
          <button
            onClick={exportCsv}
            className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: "#1a1a24", color: "#9ca3af", border: "1px solid #2a2a3a" }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "#4b5563", borderBottom: "1px solid #1e1e2e" }}>
              {["Order", "Date", "Customer", "Total", "Status", "Fulfillment", "Financial"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-sm" style={{ color: "#4b5563" }}>
                  {orders.length === 0 ? "No orders yet — sync Shopify to import" : "No orders match your filters"}
                </td>
              </tr>
            ) : (
              filtered.map((o) => {
                const name = [o.customers?.first_name, o.customers?.last_name].filter(Boolean).join(" ") || "Guest";
                return (
                  <tr key={o.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderTop: "1px solid #1a1a24" }}>
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">#{o.order_number}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#9ca3af" }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString("en-AU") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>{o.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{fmt(o.total_price)}</td>
                    <td className="px-4 py-3"><Badge label={o.status} /></td>
                    <td className="px-4 py-3"><Badge label={o.fulfillment_status} /></td>
                    <td className="px-4 py-3"><Badge label={o.financial_status} /></td>
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
