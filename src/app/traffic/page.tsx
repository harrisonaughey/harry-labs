import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import StoreTabBar from "@/components/StoreTabBar";
import TrafficDashboard from "@/components/traffic/TrafficDashboard";
import { getStores } from "@/lib/stores";
import { isMetaConnected, checkMetaToken } from "@/lib/meta";
import { isGoogleConnected } from "@/lib/googleAds";
import { isTikTokConnected } from "@/lib/tiktok";

export const revalidate = 0;

export default async function TrafficPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store: storeParam } = await searchParams;
  const stores = await getStores();
  const storeId = storeParam || stores[0]?.id;

  const metaConnected   = isMetaConnected();
  const googleConnected = isGoogleConnected();
  const tiktokConnected = isTikTokConnected();
  const metaTokenError  = metaConnected ? await checkMetaToken() : null;

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--bg-app)" }}>
      <Suspense>
        <Sidebar stores={stores} activePage="Paid Ads" />
      </Suspense>

      <main className="flex-1 overflow-y-auto px-8 py-8">
        <Suspense>
          <StoreTabBar stores={stores} currentStoreId={storeId ?? null} />
        </Suspense>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Paid Advertising</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Meta · Google · TikTok · Instagram — paid acquisition
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              title={metaTokenError ?? undefined}
              style={{
                background: metaTokenError ? "#ef444415" : metaConnected ? "#10b98115" : "#6b728015",
                border:     `1px solid ${metaTokenError ? "#ef444430" : metaConnected ? "#10b98140" : "var(--border)"}`,
                color:      metaTokenError ? "#ef4444"  : metaConnected ? "#10b981" : "var(--text-faint)",
              }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: metaTokenError ? "#ef4444" : metaConnected ? "#10b981" : "var(--text-faint)" }} />
              Meta {metaTokenError ? "auth error" : metaConnected ? "connected" : "not connected"}
            </span>
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{
                background: googleConnected ? "#10b98115" : "#6b728015",
                border:     `1px solid ${googleConnected ? "#10b98140" : "var(--border)"}`,
                color:      googleConnected ? "#10b981" : "var(--text-faint)",
              }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: googleConnected ? "#10b981" : "var(--text-faint)" }} />
              Google {googleConnected ? "connected" : "not connected"}
            </span>
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{
                background: tiktokConnected ? "#10b98115" : "#6b728015",
                border:     `1px solid ${tiktokConnected ? "#10b98140" : "var(--border)"}`,
                color:      tiktokConnected ? "#10b981" : "var(--text-faint)",
              }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: tiktokConnected ? "#10b981" : "var(--text-faint)" }} />
              TikTok {tiktokConnected ? "connected" : "not connected"}
            </span>
          </div>
        </div>

        <TrafficDashboard
          metaConnected={metaConnected && !metaTokenError}
          metaTokenError={metaTokenError}
          googleConnected={googleConnected}
          tiktokConnected={tiktokConnected}
        />
      </main>
    </div>
  );
}
