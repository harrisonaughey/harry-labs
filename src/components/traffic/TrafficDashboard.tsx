"use client";
import { useState, useEffect } from "react";
import MetaAdsView from "./MetaAdsView";
import GoogleAdsView from "./GoogleAdsView";
import TikTokAdsView from "./TikTokAdsView";
import AccountHealthPanel from "./AccountHealthPanel";

type Props = { metaConnected: boolean; metaTokenError?: string | null; googleConnected: boolean; tiktokConnected: boolean };

const TABS = [
  { id: "meta",      label: "Meta Ads",   icon: "📘", color: "#1877F2" },
  { id: "google",    label: "Google Ads", icon: "🔵", color: "#4285F4" },
  { id: "tiktok",    label: "TikTok Ads", icon: "🎵", color: "#ee1d52" },
];

const PLATFORM_COLOR: Record<string, string> = {
  meta: "#1877F2", google: "#4285F4", tiktok: "#ee1d52",
};

type PlatformStats = {
  spend:           number;
  roas:            number;
  conversions:     number;
  conversionValue: number;
};

// ─── Blended cross-platform banner ───────────────────────────────────────────
function BlendedBanner({ metaConnected, googleConnected, tiktokConnected }: {
  metaConnected: boolean; googleConnected: boolean; tiktokConnected: boolean;
}) {
  const [metaData,   setMetaData]   = useState<PlatformStats | null>(null);
  const [googleData, setGoogleData] = useState<PlatformStats | null>(null);
  const [tiktokData, setTiktokData] = useState<PlatformStats | null>(null);

  useEffect(() => {
    if (metaConnected) {
      fetch("/api/meta/stats?preset=last_30d&days=30")
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) {
            const a = d.account ?? {};
            setMetaData({
              spend:           a.spend           ?? 0,
              roas:            a.roas             ?? 0,
              conversions:     a.conversions      ?? 0,
              conversionValue: a.conversionValue  ?? 0,
            });
          }
        })
        .catch(() => {});
    }
    if (googleConnected) {
      fetch("/api/google/stats?days=30")
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) {
            const a = d.account ?? {};
            setGoogleData({
              spend:           a.spend              ?? 0,
              roas:            a.roas               ?? 0,
              conversions:     a.conversions        ?? 0,
              conversionValue: a.conversionValue    ?? a.conversionRevenue ?? 0,
            });
          }
        })
        .catch(() => {});
    }
    if (tiktokConnected) {
      fetch("/api/tiktok/stats?days=30")
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) {
            const a = d.account ?? {};
            setTiktokData({
              spend:           a.spend           ?? 0,
              roas:            a.roas             ?? 0,
              conversions:     a.conversions      ?? 0,
              conversionValue: a.conversionValue  ?? 0,
            });
          }
        })
        .catch(() => {});
    }
  }, [metaConnected, googleConnected, tiktokConnected]);

  if (!metaConnected && !googleConnected && !tiktokConnected) return null;

  const metaSpend   = metaData?.spend    ?? 0;
  const googleSpend = googleData?.spend  ?? 0;
  const tiktokSpend = tiktokData?.spend  ?? 0;
  const totalSpend  = metaSpend + googleSpend + tiktokSpend;

  const totalConversions = (metaData?.conversions     ?? 0)
                         + (googleData?.conversions   ?? 0)
                         + (tiktokData?.conversions   ?? 0);
  const totalRevenue     = (metaData?.conversionValue    ?? 0)
                         + (googleData?.conversionValue  ?? 0)
                         + (tiktokData?.conversionValue  ?? 0);

  const metaRoas    = metaData?.roas   ?? 0;
  const googleRoas  = googleData?.roas ?? 0;
  const tiktokRoas  = tiktokData?.roas ?? 0;
  const blendedRoas = totalSpend > 0
    ? (metaSpend * metaRoas + googleSpend * googleRoas + tiktokSpend * tiktokRoas) / totalSpend
    : 0;

  const metaPct   = totalSpend > 0 ? (metaSpend   / totalSpend) * 100 : 0;
  const googlePct = totalSpend > 0 ? (googleSpend / totalSpend) * 100 : 0;
  const tiktokPct = totalSpend > 0 ? (tiktokSpend / totalSpend) * 100 : 0;

  const fmt = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(1);

  const platforms = [
    { id: "meta",   label: "Meta",   connected: metaConnected,   data: metaData,   spend: metaSpend,   roas: metaRoas,   pct: metaPct   },
    { id: "google", label: "Google", connected: googleConnected, data: googleData, spend: googleSpend, roas: googleRoas, pct: googlePct },
    { id: "tiktok", label: "TikTok", connected: tiktokConnected, data: tiktokData, spend: tiktokSpend, roas: tiktokRoas, pct: tiktokPct },
  ].filter((p) => p.connected);

  const maxRoas = Math.max(...platforms.map((p) => p.roas), 0.01);

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-xs uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
        Blended Performance — Last 30 Days
      </p>

      {/* Top row: 4 headline KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Total Ad Spend",    value: fmt(totalSpend),    color: "var(--text-primary)" },
          { label: "Total Revenue",     value: totalRevenue > 0 ? fmt(totalRevenue) : "—",
            color: totalRevenue > 0 ? "#10b981" : "var(--text-faint)" },
          { label: "Blended ROAS",      value: blendedRoas > 0 ? `${blendedRoas.toFixed(2)}×` : "—",
            color: blendedRoas >= 2 ? "#10b981" : blendedRoas >= 1 ? "#fbbf24" : blendedRoas > 0 ? "#ef4444" : "var(--text-faint)" },
          { label: "Total Conversions", value: totalConversions > 0 ? fmtK(totalConversions) : "—",
            color: "var(--text-primary)" },
        ].map((kpi) => (
          <div key={kpi.label}>
            <p className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Spend split bar */}
      {totalSpend > 0 && (
        <div className="mb-5">
          <div className="flex rounded-full overflow-hidden h-1.5 mb-2" style={{ background: "var(--bg-subtle)" }}>
            {platforms.map((p) => p.spend > 0 && (
              <div key={p.id} style={{ width: `${p.pct}%`, background: PLATFORM_COLOR[p.id] }} />
            ))}
          </div>
          <div className="flex items-center gap-4">
            {platforms.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLOR[p.id] }} />
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>{p.label} {p.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-platform ROAS comparison bars */}
      {platforms.some((p) => p.roas > 0) && (
        <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>ROAS by Platform</p>
          <div className="space-y-2.5">
            {platforms.map((p) => {
              const barW = maxRoas > 0 ? (p.roas / maxRoas) * 100 : 0;
              const roasColor = p.roas >= 2 ? "#10b981" : p.roas >= 1 ? "#fbbf24" : p.roas > 0 ? "#ef4444" : "var(--text-faint)";
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5" style={{ width: 68 }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLATFORM_COLOR[p.id] }} />
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.label}</span>
                  </div>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--bg-subtle)" }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${barW}%`, background: PLATFORM_COLOR[p.id] }} />
                  </div>
                  <span className="text-xs font-semibold w-12 text-right" style={{ color: roasColor }}>
                    {p.roas > 0 ? `${p.roas.toFixed(2)}×` : p.data ? "—" : "…"}
                  </span>
                  <span className="text-xs w-16 text-right" style={{ color: "var(--text-faint)" }}>
                    {fmt(p.spend)}
                  </span>
                  <span className="text-xs w-16 text-right" style={{ color: "var(--text-faint)" }}>
                    {(p.data?.conversions ?? 0) > 0 ? `${fmtK(p.data!.conversions)} conv` : p.data ? "0 conv" : "…"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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

      {/* Account Health — always shown in reporting section */}
      <AccountHealthPanel />

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-lg w-fit"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {TABS.map((t) => {
          const isConnected =
            t.id === "meta"      ? metaConnected && !metaTokenError :
            t.id === "google"    ? googleConnected :
            t.id === "tiktok"    ? tiktokConnected :
            false;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              data-active={tab === t.id ? "true" : "false"}
              className="tab-btn flex items-center gap-2 text-sm px-4 py-1.5 rounded-md font-medium"
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
      {tab === "tiktok"    && <TikTokAdsView connected={tiktokConnected} />}
    </>
  );
}
