"use client";
import { useState } from "react";
import InstagramView      from "@/components/content/InstagramView";
import ManyChatView       from "@/components/content/ManyChatView";
import LiveAuditView      from "@/components/content/LiveAuditView";
import PaymentTrackerView from "@/components/content/PaymentTrackerView";
import ConnectCard        from "@/components/traffic/ConnectCard";

type Props = { metaConnected: boolean };

const TABS = [
  { id: "instagram", label: "Instagram",   icon: "📸", badge: "ig"       },
  { id: "tiktok",    label: "TikTok",      icon: "🎵", badge: null       },
  { id: "manychat",  label: "ManyChat",    icon: "💬", badge: null       },
  { id: "audit",     label: "Audit",       icon: "🎯", badge: null       },
  { id: "payments",  label: "Payments",    icon: "💰", badge: null       },
];

function TikTokStub() {
  return (
    <div className="flex items-start justify-center pt-6">
      <div className="w-full max-w-xl rounded-2xl p-8" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "#00000020", border: "1px solid #ffffff20" }}>🎵</div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>TikTok Organic</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Views · Followers · Top videos · Profile visits</p>
          </div>
        </div>
        <div className="space-y-2 mb-6">
          {[
            { key: "TIKTOK_CLIENT_KEY",    hint: "TikTok for Developers — client key" },
            { key: "TIKTOK_CLIENT_SECRET", hint: "TikTok for Developers — client secret" },
            { key: "TIKTOK_ACCESS_TOKEN",  hint: "Long-lived access token (Content API)" },
          ].map((v) => (
            <div key={v.key} className="flex items-center justify-between px-4 py-3 rounded-lg"
              style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{v.hint}</span>
              <span className="text-xs font-mono font-medium" style={{ color: "#a5b4fc" }}>{v.key}</span>
            </div>
          ))}
        </div>
        <p className="text-xs mb-5" style={{ color: "var(--text-faint)" }}>
          TikTok organic analytics use the Research API (separate from TikTok Ads). Add credentials to Vercel env vars.
        </p>
        <a href="https://developers.tiktok.com/" target="_blank" rel="noopener noreferrer"
          className="block w-full text-center text-sm py-2.5 px-4 rounded-lg font-medium hover:opacity-80 transition-opacity"
          style={{ background: "#00000020", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          TikTok for Developers →
        </a>
      </div>
    </div>
  );
}

export default function ContentDashboard({ metaConnected }: Props) {
  const [tab, setTab] = useState("instagram");

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl w-fit"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {TABS.map((t) => {
          const isActive   = tab === t.id;
          const isIG       = t.badge === "ig";
          const connected  = isIG ? metaConnected : false;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-lg font-medium transition-all"
              style={{
                background: isActive ? "#6366f120" : "transparent",
                color:      isActive ? "#a5b4fc"   : "var(--text-muted)",
              }}>
              <span>{t.icon}</span>
              {t.label}
              {isIG && (
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: connected ? "#10b98120" : "#6b728020",
                    color:      connected ? "#10b981"   : "var(--text-muted)",
                  }}>
                  {connected ? "live" : "connect"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "instagram" && (metaConnected ? <InstagramView /> : <ConnectCard platform="meta" />)}
      {tab === "tiktok"    && <TikTokStub />}
      {tab === "manychat"  && <ManyChatView />}
      {tab === "audit"     && <LiveAuditView />}
      {tab === "payments"  && <PaymentTrackerView />}
    </>
  );
}
