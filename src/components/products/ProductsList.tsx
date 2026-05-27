"use client";
import { useState } from "react";

type Product = {
  id: string;
  external_id: string;
  title: string;
  vendor: string | null;
  product_type: string | null;
  status: string;
  price: number;
  compare_at_price: number | null;
  sku: string | null;
  inventory_quantity: number;
  updated_at: string;
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  active:   { bg: "#10b98120", text: "#10b981" },
  draft:    { bg: "#6b728020", text: "#9ca3af" },
  archived: { bg: "#ef444420", text: "#ef4444" },
};

export default function ProductsList({ products }: { products: Product[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = products.filter(p => {
    const matchSearch = !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all:      products.length,
    active:   products.filter(p => p.status === "active").length,
    draft:    products.filter(p => p.status === "draft").length,
    archived: products.filter(p => p.status === "archived").length,
  };

  return (
    <div className="rounded-xl" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid #1e1e2e" }}>
        <input
          type="text"
          placeholder="Search products or SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1"
          style={{ background: "#0d0d14", border: "1px solid #1e1e2e", maxWidth: 280 }}
        />
        <div className="flex gap-1">
          {(["all", "active", "draft", "archived"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="text-xs px-3 py-1.5 rounded-md capitalize transition-all"
              style={{
                background: statusFilter === s ? "#1e1e30" : "transparent",
                color:      statusFilter === s ? "#a5b4fc" : "#6b7280",
                border:     `1px solid ${statusFilter === s ? "#3730a3" : "transparent"}`,
              }}>
              {s} <span style={{ color: "#4b5563" }}>({counts[s]})</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm" style={{ color: "#4b5563" }}>
          {products.length === 0 ? "No products synced yet — run a Shopify sync" : "No products match your filter"}
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "#4b5563" }}>
              {["Product", "SKU", "Price", "Compare at", "Inventory", "Type", "Status"].map(h => (
                <th key={h} className="px-5 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const style = STATUS_STYLE[p.status] ?? { bg: "#6b728020", text: "#9ca3af" };
              const discount = p.compare_at_price && p.compare_at_price > p.price
                ? Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100)
                : null;
              return (
                <tr key={p.id} style={{ borderTop: "1px solid #1a1a24" }}
                  className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-white font-medium truncate max-w-[200px]">{p.title}</p>
                    {p.vendor && <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>{p.vendor}</p>}
                  </td>
                  <td className="px-5 py-3" style={{ color: "#6b7280" }}>{p.sku ?? "—"}</td>
                  <td className="px-5 py-3 text-white font-medium">
                    ${p.price.toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    {p.compare_at_price ? (
                      <span>
                        <span style={{ color: "#6b7280" }}>${p.compare_at_price.toFixed(2)}</span>
                        {discount && (
                          <span className="ml-1.5 text-xs px-1 rounded"
                            style={{ background: "#10b98120", color: "#10b981" }}>
                            -{discount}%
                          </span>
                        )}
                      </span>
                    ) : <span style={{ color: "#374151" }}>—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span style={{ color: p.inventory_quantity > 10 ? "#10b981" : p.inventory_quantity > 0 ? "#fbbf24" : "#ef4444" }}>
                      {p.inventory_quantity.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3" style={{ color: "#6b7280" }}>{p.product_type ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full capitalize font-medium"
                      style={{ background: style.bg, color: style.text }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
