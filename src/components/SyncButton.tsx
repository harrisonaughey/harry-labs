"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton({ shopDomain }: { shopDomain?: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result,  setResult]  = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      // If no shopDomain provided, resolve the first active store automatically
      let domain = shopDomain;
      if (!domain) {
        const storeRes = await fetch("/api/stores");
        if (storeRes.ok) {
          const stores = await storeRes.json();
          domain = stores?.[0]?.shop_domain;
        }
      }
      if (!domain) { setResult("❌ No store connected"); return; }

      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_domain: domain }),
      });
      const data = await res.json();
      if (data.success) {
        const r = data.results;
        setResult(`✅ ${r.orders ?? 0} orders · ${r.customers ?? 0} customers · ${r.products ?? 0} products`);
        setTimeout(() => router.refresh(), 1500);
      } else {
        setResult(`❌ ${data.error}`);
      }
    } catch {
      setResult("❌ Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{result}</span>}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="text-sm px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: "#6366f1", color: "white" }}
      >
        {syncing ? "Syncing…" : "Sync Shopify"}
      </button>
    </div>
  );
}
