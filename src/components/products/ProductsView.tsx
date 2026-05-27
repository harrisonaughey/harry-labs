"use client";
import { useState } from "react";
import ProductsList from "./ProductsList";
import MarginCalculator from "./MarginCalculator";

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

const TABS = [
  { id: "products",  label: "🏷️ Products" },
  { id: "margin",    label: "📐 Margin Calculator" },
];

export default function ProductsView({ products }: { products: Product[] }) {
  const [tab, setTab] = useState<"products" | "margin">("products");

  // Simplified product list for the margin calculator selector
  const calcProducts = products
    .filter(p => p.status === "active" && p.price > 0)
    .map(p => ({ title: p.title, price: p.price }));

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-lg w-fit"
        style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className="text-sm px-4 py-1.5 rounded-md font-medium transition-all"
            style={{
              background: tab === t.id ? "#1e1e30" : "transparent",
              color:      tab === t.id ? "#a5b4fc" : "#6b7280",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "products"
        ? <ProductsList products={products} />
        : <MarginCalculator products={calcProducts} />
      }
    </>
  );
}
