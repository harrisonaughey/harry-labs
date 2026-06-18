"use client";
import { useState, useEffect } from "react";
import MetaAdsView from "./MetaAdsView";
import GoogleAdsView from "./GoogleAdsView";
import TikTokAdsView from "./TikTokAdsView";
import ConnectCard from "./ConnectCard";
import SpendChart from "./SpendChart";

type Props = { metaConnected: boolean; metaTokenError?: string | null; googleConnected: boolean; tiktokConnected: boolean };

const TABS = [
  { id: "meta",      label: "Meta Ads",   icon: "📘", color: "#1877F2" },
  { id: "google",    label: "Google Ads", icon: "🔵", color: "#4285F4" },
  { id: "instagram", label: "Instagram",  icon: "📸", color: "#E1306C" },
  { id: "tiktok",    label: "TikTok Ads", icon: "🎵", color: "#ee1d52" },
];

// ─── Blended cross-platform banner ───────────────────────────────────────────
function BlendedBanner({ metaConnected, googleConnected, tiktokConnected }: {
  metaConnected: boolean; googleConnected: boolean; tiktokConnected: boolean;
}) {
  const [metaData,   setMetaData]   = useState<any>(null);
  const [googleData, setGoogleData] = useState<any>(null);
  const [tiktokData, setTiktokData] = useState<any>(null);

  useEffect(() => {
    if (metaConnected) {
      fetch("/api/meta/stats?preset=last_30d&days=30")
        .then((r) => r.json())
        .then((d) => { if (!d.error) setMetaData(d.account); })
        .catch(() => {});
    }
    if (googleConnected) {
      fetch("/api/google/stats?days=30")
        .then((r) => r.json())
        .then((d) => { if (!d.error) setGoogleData(d.account); })
        .catch(() => {});
    }
    if (tiktokConnected) {
      fetch("/api/tiktok/stats?days=30")
        .then((r) => r.json())
        .then((d) => { if (!d.error) setTiktokData(d.account); })
        .catch(() => {});
    }
  }, [metaConnected, googleConnected, tiktokConnected]);

  if (!metaConnected && !googleConnected && !tiktokConnected) return null;

  const metaSpend   = metaData?.spend    ?? 0;
  const googleSpend = googleData?.spend  ?? 0;
  const tiktokSpend = tiktokData?.spend  ?? 0;
  const totalSpend  = metaSpend + googleSpend + tiktokSpend;

  const metaRoas    = metaData?.roas     ?? 0;
  const googleRoas  = googleData?.roas   ?? 0;
  const tiktokRoas  = tiktokData?.roas   ?? 0;
  const blendedRoas = totalSpend > 0
    ? (metaSpend * metaRoas + googleSpend * googleRoas + tiktokSpend * tiktokRoas) / totalSpend
    : 0;

  const metaPct   = totalSpend > 0 ? (metaSpend   / totalSpend) * 100 : 0;
  const googlePct = totalSpend > 0 ? (googleSpend / totalSpend) * 100 : 0;
  const tiktokPct = totalSpend > 0 ? (tiktokSpend / totalSpend) * 100 : 0;

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between">
        {/* Left: blended totals */}
        <div>
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Blended Performance — Last 30 Days
          </p>
          <div className="flex items-end gap-8">
            <div>
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                ${totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Total Ad Spend</p>
            </div>
            <div>
              <p className="text-2xl font-bold"
                style={{ color: blendedRoas >= 2 ? "#10b981" : blendedRoas >= 1 ? "#fbbf24" : blendedRoas > 0 ? "#ef4444" : "var(--text-faint)" }}>
                {blendedRoas > 0 ? `${blendedRoas.toFixed(2)}×` : "—"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Blended ROAS</p>
            </div>
          </div>

          {/* Spend split bar */}
          {totalSpend > 0 && (
            <div className="mt-4">
              <div className="flex rounded-full overflow-hidden h-1.5" style={{ width: 280, background: "var(--bg-subtle)" }}>
                {metaConnected && metaSpend > 0 && <div style={{ width: `${metaPct}%`, background: "#1877F2" }} />}
                {googleConnected && googleSpend > 0 && <div style={{ width: `${googlePct}%`, background: "#4285F4" }} />}
                {tiktokConnected && tiktokSpend > 0 && <div style={{ width: `${tiktokPct}%`, background: "#ee1d52" }} />}
              </div>
              <div className="flex items-center gap-4 mt-1.5">
                {metaConnected && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#1877F2" }} />
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>Meta {metaPct.toFixed(0)}%</span>
                  </div>
                )}
                {googleConnected && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#4285F4" }} />
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>Google {googlePct.toFixed(0)}%</span>
                  </div>
                )}
                {tiktokConnected && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#ee1d52" }} />
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>TikTok {tiktokPct.toFixed(0)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: per-platform breakdown */}
        <div className="flex gap-6">
          {metaConnected && (
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#1877F2" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Meta Ads</span>
              </div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                ${metaSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs mt-0.5" style={{ color: metaRoas >= 1 ? "#10b981" : metaRoas > 0 ? "#ef4444" : "var(--text-faint)" }}>
                {metaRoas > 0 ? `${metaRoas.toFixed(2)}× ROAS` : metaData ? "No conversions" : "Loading…"}
              </p>
            </div>
          )}
          {googleConnected && (
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#4285F4" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Google Ads</span>
              </div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                ${googleSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs mt-0.5" style={{ color: googleRoas >= 1 ? "#10b981" : googleRoas > 0 ? "#ef4444" : "var(--text-faint)" }}>
                {googleRoas > 0 ? `${googleRoas.toFixed(2)}× ROAS` : googleData ? "No conversions" : "Loading…"}
              </p>
            </div>
          )}
          {tiktokConnected && (
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#ee1d52" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>TikTok Ads</span>
              </div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                ${tiktokSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs mt-0.5" style={{ color: tiktokRoas >= 1 ? "#10b981" : tiktokRoas > 0 ? "#ef4444" : "var(--text-faint)" }}>
                {tiktokRoas > 0 ? `${tiktokRoas.toFixed(2)}× ROAS` : tiktokData ? "No conversions" : "Loading…"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Auth error card ──────────────────────────────────────────────────────────
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
        <ol className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <li className="flex gap-2"><span className="text-indigo-400 font-bold">1.</span> Go to <strong>business.facebook.com</strong> → System Users → generate new token</li>
          <li className="flex gap-2"><span className="text-indigo-400 font-bold">2.</span> Permissions: <code className="px-1 rounded" style={{ background: "var(--bg-subtle)" }}>ads_read</code> <code className="px-1 rounded" style={{ background: "var(--bg-subtle)" }}>ads_management</code></li>
          <li className="flex gap-2"><span className="text-indigo-400 font-bold">3.</span> Update <code className="px-1 rounded" style={{ background: "var(--bg-subtle)" }}>META_ACCESS_TOKEN</code> in Vercel and redeploy</li>
        </ol>
      </div>
    </div>
  );
}

function InstagramView({ metaConnected }: { metaConnected: boolean }) {
  if (!metaConnected) {
    return (
      <div className="flex items-start justify-center pt-8">
        <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: "#E1306C20", border: "1px solid #E1306C40" }}>📸</div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Instagram Ads</h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Managed through Meta Business Manager</p>
            </div>
          </div>
          <p className="text-xs mb-6" style={{ color: "var(--text-secondary)" }}>
            Instagram placements appear in your <strong style={{ color: "var(--text-primary)" }}>Meta Ads</strong> account. Connect Meta to see Stories, Reels, and Feed performance.
          </p>
          <a href="/integrations" className="block text-sm py-2.5 px-4 rounded-lg text-center font-medium hover:opacity-80"
            style={{ background: "#1877F220", color: "#1877F2", border: "1px solid #1877F240" }}>
            Connect Meta Ads →
          </a>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="rounded-xl p-4 mb-6" style={{ background: "#E1306C10", border: "1px solid #E1306C30" }}>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          📸 Instagram placement data is included in your Meta Ads account. The metrics below reflect your full Meta account — filter by placement in Meta Ads Manager for Instagram-only data.
        </p>
      </div>
      <MetaAdsView connected={true} />
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function TrafficDashboard({ metaConnected, metaTokenError, googleConnected, tiktokConnected }: Props) {
  const [tab, setTab] = useState<string>("meta");

  return (
    <>
      {/* Blended banner — shown when at least one platform is connected */}
      {(metaConnected || googleConnected || tiktokConnected) && (
        <BlendedBanner
          metaConnected={metaConnected && !metaTokenError}
          googleConnected={googleConnected}
          tiktokConnected={tiktokConnected}
        />
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-lg w-fit"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {TABS.map((t) => {
          const isConnected =
            t.id === "meta"      ? metaConnected && !metaTokenError :
            t.id === "google"    ? googleConnected :
            t.id === "instagram" ? metaConnected && !metaTokenError :
            t.id === "tiktok"    ? tiktokConnected :
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
      {tab === "instagram" && <InstagramView metaConnected={metaConnected && !metaTokenError} />}
      {tab === "tiktok"    && <TikTokAdsView connected={tiktokConnected} />}
    </>
  );
}
