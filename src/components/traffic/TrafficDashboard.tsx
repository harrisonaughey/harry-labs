"use client";
import { useState } from "react";
import MetaAdsView from "./MetaAdsView";
import GoogleAdsView from "./GoogleAdsView";
import ConnectCard from "./ConnectCard";

type Props = { metaConnected: boolean; metaTokenError?: string | null; googleConnected: boolean };

const TABS = [
  { id: "meta",      label: "Meta Ads",    icon: "📘", color: "#1877F2" },
  { id: "google",    label: "Google Ads",  icon: "🔵", color: "#4285F4" },
  { id: "instagram", label: "Instagram",   icon: "📸", color: "#E1306C" },
  { id: "tiktok",    label: "TikTok Ads",  icon: "🎵", color: "#010101" },
];

function MetaAuthError({ error }: { error: string }) {
  return (
    <div className="flex items-start justify-center pt-8">
      <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "var(--bg-card)", border: "1px solid #ef444430" }}>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "#ef444415", border: "1px solid #ef444430" }}>
            🔒
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Meta — Auth Error</h2>
            <p className="text-sm mt-0.5" style={{ color: "#ef4444" }}>Token present but access blocked</p>
          </div>
        </div>
        <div className="rounded-xl p-4 mb-5 font-mono text-xs" style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)", color: "#ef4444" }}>
          {error}
        </div>
        <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>How to fix:</p>
        <ol className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <li className="flex gap-2"><span className="text-indigo-400 font-bold">1.</span> Go to <strong>business.facebook.com</strong> → Settings → Users → <strong>System Users</strong></li>
          <li className="flex gap-2"><span className="text-indigo-400 font-bold">2.</span> Generate a new token with permissions: <code className="px-1 rounded" style={{ background: "var(--bg-subtle)" }}>ads_read</code> <code className="px-1 rounded" style={{ background: "var(--bg-subtle)" }}>ads_management</code> <code className="px-1 rounded" style={{ background: "var(--bg-subtle)" }}>business_management</code></li>
          <li className="flex gap-2"><span className="text-indigo-400 font-bold">3.</span> Replace <code className="px-1 rounded" style={{ background: "var(--bg-subtle)" }}>META_ACCESS_TOKEN</code> in Vercel env vars and redeploy</li>
        </ol>
        <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer"
          className="mt-5 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ background: "#1877F220", color: "#1877F2", border: "1px solid #1877F240" }}>
          Open Meta Business Suite →
        </a>
      </div>
    </div>
  );
}

function TikTokView() {
  return (
    <ConnectCard platform="tiktok" />
  );
}

function InstagramView({ metaConnected }: { metaConnected: boolean }) {
  if (!metaConnected) {
    return (
      <div className="flex items-start justify-center pt-8">
        <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: "#E1306C20", border: "1px solid #E1306C40" }}>
              📸
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Instagram Ads</h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                Instagram ads are managed through Meta Business Manager
              </p>
            </div>
          </div>
          <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Instagram placements appear in your <strong style={{ color: "var(--text-primary)" }}>Meta Ads</strong> account.
              Connect Meta Ads to see Instagram-specific placement data including Stories, Reels, and Feed performance.
            </p>
          </div>
          <a href="/integrations" className="block text-sm py-2.5 px-4 rounded-lg text-center font-medium hover:opacity-80 transition-opacity"
            style={{ background: "#1877F220", color: "#1877F2", border: "1px solid #1877F240" }}>
            Connect Meta Ads →
          </a>
        </div>
      </div>
    );
  }
  // When Meta is connected, show Meta view filtered note
  return (
    <div>
      <div className="rounded-xl p-4 mb-6" style={{ background: "#E1306C10", border: "1px solid #E1306C30" }}>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          📸 Instagram placement data is included in your Meta Ads account.
          The metrics below reflect your full Meta account — filter by placement in Meta Ads Manager for Instagram-only data.
        </p>
      </div>
      <MetaAdsView connected={true} />
    </div>
  );
}

export default function TrafficDashboard({ metaConnected, metaTokenError, googleConnected }: Props) {
  const [tab, setTab] = useState<string>("meta");

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-lg w-fit"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {TABS.map((t) => {
          const isConnected =
            t.id === "meta"      ? metaConnected :
            t.id === "google"    ? googleConnected :
            t.id === "instagram" ? metaConnected :
            false;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-md font-medium transition-all"
              style={{
                background: tab === t.id ? "#1e1e30" : "transparent",
                color:      tab === t.id ? "#a5b4fc" : "var(--text-muted)",
              }}>
              <span>{t.icon}</span>
              {t.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: isConnected ? "#10b98120" : "#6b728020",
                  color:      isConnected ? "#10b981"   : "var(--text-muted)",
                }}>
                {isConnected ? "live" : "connect"}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "meta"      && metaTokenError && <MetaAuthError error={metaTokenError} />}
      {tab === "meta"      && !metaTokenError && <MetaAdsView connected={metaConnected} />}
      {tab === "google"    && <GoogleAdsView connected={googleConnected} />}
      {tab === "instagram" && <InstagramView metaConnected={metaConnected} />}
      {tab === "tiktok"    && <TikTokView />}
    </>
  );
}
