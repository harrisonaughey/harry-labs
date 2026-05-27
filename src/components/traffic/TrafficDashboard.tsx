"use client";
import { useState } from "react";
import MetaAdsView from "./MetaAdsView";
import GoogleAdsView from "./GoogleAdsView";
import ConnectCard from "./ConnectCard";

type Props = { metaConnected: boolean; googleConnected: boolean };

const TABS = [
  { id: "meta",      label: "Meta Ads",    icon: "📘", color: "#1877F2" },
  { id: "google",    label: "Google Ads",  icon: "🔵", color: "#4285F4" },
  { id: "instagram", label: "Instagram",   icon: "📸", color: "#E1306C" },
  { id: "tiktok",    label: "TikTok Ads",  icon: "🎵", color: "#010101" },
];

function TikTokView() {
  return (
    <ConnectCard platform="tiktok" />
  );
}

function InstagramView({ metaConnected }: { metaConnected: boolean }) {
  if (!metaConnected) {
    return (
      <div className="flex items-start justify-center pt-8">
        <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: "#E1306C20", border: "1px solid #E1306C40" }}>
              📸
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Instagram Ads</h2>
              <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
                Instagram ads are managed through Meta Business Manager
              </p>
            </div>
          </div>
          <div className="rounded-xl p-4 mb-6" style={{ background: "#0d0d14", border: "1px solid #1e1e2e" }}>
            <p className="text-xs" style={{ color: "#9ca3af" }}>
              Instagram placements appear in your <strong className="text-white">Meta Ads</strong> account.
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
        <p className="text-xs" style={{ color: "#9ca3af" }}>
          📸 Instagram placement data is included in your Meta Ads account.
          The metrics below reflect your full Meta account — filter by placement in Meta Ads Manager for Instagram-only data.
        </p>
      </div>
      <MetaAdsView connected={true} />
    </div>
  );
}

export default function TrafficDashboard({ metaConnected, googleConnected }: Props) {
  const [tab, setTab] = useState<string>("meta");

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-lg w-fit"
        style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
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
                color:      tab === t.id ? "#a5b4fc" : "#6b7280",
              }}>
              <span>{t.icon}</span>
              {t.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: isConnected ? "#10b98120" : "#6b728020",
                  color:      isConnected ? "#10b981"   : "#6b7280",
                }}>
                {isConnected ? "live" : "connect"}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "meta"      && <MetaAdsView   connected={metaConnected}   />}
      {tab === "google"    && <GoogleAdsView connected={googleConnected} />}
      {tab === "instagram" && <InstagramView metaConnected={metaConnected} />}
      {tab === "tiktok"    && <TikTokView />}
    </>
  );
}
