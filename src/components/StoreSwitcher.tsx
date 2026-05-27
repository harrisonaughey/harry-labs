"use client";
import { useRouter, useSearchParams } from "next/navigation";
import type { Store } from "@/lib/stores";

export default function StoreSwitcher({ stores, currentStoreId }: { stores: Store[]; currentStoreId: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchStore(storeId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("store", storeId);
    router.push(`/?${params.toString()}`);
  }

  if (stores.length === 0) {
    return (
      <a
        href="/api/shopify/install?shop=thinkle-com-au.myshopify.com"
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all w-full"
        style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px dashed #3730a3" }}
      >
        <span>+</span> Connect Store
      </a>
    );
  }

  return (
    <div className="space-y-1">
      {stores.map((store) => (
        <button
          key={store.id}
          onClick={() => switchStore(store.id)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all text-left"
          style={{
            background: currentStoreId === store.id ? "#1e1e30" : "transparent",
            color: currentStoreId === store.id ? "#a5b4fc" : "#6b7280",
            border: currentStoreId === store.id ? "1px solid #3730a3" : "1px solid transparent",
          }}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: store.is_active ? "#10b981" : "#6b7280" }}
          />
          <span className="truncate">{store.name || store.shop_domain}</span>
        </button>
      ))}
      <a
        href="#"
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs w-full mt-1"
        style={{ color: "var(--text-faint)" }}
      >
        <span>+</span> Add store
      </a>
    </div>
  );
}
