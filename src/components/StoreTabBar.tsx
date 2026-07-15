"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Store } from "@/lib/stores";

export default function StoreTabBar({
  stores,
  currentStoreId,
}: {
  stores: Store[];
  currentStoreId: string | null;
}) {
  const pathname = usePathname();
  const activeId = currentStoreId ?? stores[0]?.id ?? null;

  if (stores.length === 0) {
    return (
      <div
        className="flex items-center gap-3 mb-6 pb-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-nav-label)" }}>
          Store
        </span>
        <button
          onClick={() => {
            const shop = window.prompt("Enter your Shopify store domain (e.g. mystore.myshopify.com):");
            if (shop) window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop.trim())}`;
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
          style={{ color: "#a5b4fc", background: "#1e1e30", border: "1px dashed #3730a3" }}
        >
          + Connect Store
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 mb-6 pb-5 flex-wrap"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-widest mr-1 flex-shrink-0"
        style={{ color: "var(--text-nav-label)" }}
      >
        Store
      </span>

      {stores.map((store) => {
        const isActive = store.id === activeId;
        const isSynced = !!store.last_synced_at;

        return (
          <Link
            key={store.id}
            href={`${pathname}?store=${store.id}`}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0"
            style={{
              background: isActive ? "#1e1e30" : "var(--bg-subtle)",
              color: isActive ? "#a5b4fc" : "var(--text-muted)",
              border: `1px solid ${isActive ? "#3730a3" : "var(--border)"}`,
              boxShadow: isActive ? "0 0 0 2px #3730a320" : "none",
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: isActive
                  ? "#6366f1"
                  : isSynced
                  ? "#10b981"
                  : "#f59e0b",
              }}
            />
            <span className="max-w-[160px] truncate">
              {store.name || store.shop_domain}
            </span>
            {isActive && (
              <span
                className="px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: "#6366f120", color: "#a5b4fc", fontSize: "10px" }}
              >
                active
              </span>
            )}
            {!isSynced && !isActive && (
              <span
                className="px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: "#f59e0b20", color: "#fbbf24", fontSize: "10px" }}
              >
                needs sync
              </span>
            )}
          </Link>
        );
      })}

      <button
        onClick={() => {
          const shop = window.prompt("Enter your Shopify store domain (e.g. mystore.myshopify.com):");
          if (shop) window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop.trim())}`;
        }}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 flex-shrink-0"
        style={{ color: "var(--text-faint)", border: "1px dashed var(--border)" }}
      >
        + Add Store
      </button>
    </div>
  );
}
