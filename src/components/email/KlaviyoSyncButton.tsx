"use client";
import { useState } from "react";

export default function KlaviyoSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/klaviyo/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const c = data.results?.campaigns ?? 0;
        const f = data.results?.flows ?? 0;
        setResult(`✅ ${c} campaigns · ${f} flows`);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setResult(`❌ ${data.error}`);
      }
    } catch { setResult("❌ Sync failed"); }
    finally { setSyncing(false); }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs" style={{ color: "#9ca3af" }}>{result}</span>}
      <button
        onClick={sync}
        disabled={syncing}
        className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50 hover:opacity-80"
        style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px solid #3730a3" }}
      >
        {syncing ? "Syncing…" : "Sync Klaviyo"}
      </button>
    </div>
  );
}
