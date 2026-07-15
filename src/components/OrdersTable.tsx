import React from "react";
import Link from "next/link";

type Order = {
  id: string;
  order_number: string | null;
  customer_email: string | null;
  total_price: number;
  status: string | null;
  fulfillment_status: string | null;
  financial_status: string | null;
  source: string | null;
  created_at: string;
  customers?: { first_name: string | null; last_name: string | null } | null;
};

const statusStyle: Record<string, React.CSSProperties> = {
  fulfilled:   { background: "#10b98120", color: "#10b981" },
  processing:  { background: "#6366f120", color: "#818cf8" },
  refunded:    { background: "#ef444420", color: "#ef4444" },
  pending:     { background: "#f59e0b20", color: "#f59e0b" },
  cancelled:   { background: "#6b728020", color: "#9ca3af" },
};

function getStatus(order: Order): string {
  return order.fulfillment_status || order.financial_status || order.status || "pending";
}

export default function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <div className="rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Orders</h2>
        <Link href="/orders" className="text-xs" style={{ color: "#6366f1" }}>View all →</Link>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>No orders yet</p>
          <p className="text-xs" style={{ color: "#374151" }}>Sync Shopify or Stripe to see orders here</p>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "var(--text-faint)" }}>
              {["Order", "Customer", "Amount", "Source", "Status", "Date"].map((h) => (
                <th key={h} className="px-5 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const status = getStatus(order);
              const style = statusStyle[status.toLowerCase()] ?? { background: "var(--text-muted)20", color: "#9ca3af" };
              const customer = order.customers
                ? `${order.customers.first_name ?? ""} ${order.customers.last_name ?? ""}`.trim()
                : order.customer_email ?? "—";
              const date = new Date(order.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" });

              return (
                <tr key={order.id} style={{ borderTop: "1px solid var(--border-subtle)" }} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-mono" style={{ color: "#a5b4fc" }}>{order.order_number ?? order.id.slice(0, 8)}</td>
                  <td className="px-5 py-3" style={{ color: "var(--text-primary)" }}>{customer}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>${order.total_price.toFixed(2)}</td>
                  <td className="px-5 py-3 capitalize" style={{ color: "var(--text-muted)" }}>{order.source ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full font-medium capitalize" style={style}>
                      {status}
                    </span>
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--text-muted)" }}>{date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
