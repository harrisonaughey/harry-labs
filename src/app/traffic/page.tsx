import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import TrafficDashboard from "@/components/traffic/TrafficDashboard";
import { getStores } from "@/lib/stores";
import { isMetaConnected } from "@/lib/meta";
import { isGoogleConnected } from "@/lib/googleAds";

export const revalidate = 0; // always check connection status fresh

export default async function TrafficPage() {
  const [stores] = await Promise.all([getStores()]);
  const metaConnected   = isMetaConnected();
  const googleConnected = isGoogleConnected();

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--bg-app)" }}>
      <Suspense>
        <Sidebar stores={stores} activePage="Paid Ads" />
      </Suspense>

      <main className="flex-1 overflow-y-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Paid Advertising</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Meta · Google · TikTok · Instagram — paid acquisition
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection status badges */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                style={{
                  background: metaConnected   ? "#10b98115" : "#6b728015",
                  border:     `1px solid ${metaConnected   ? "#10b98140" : "var(--border)"}`,
                  color:      metaConnected   ? "#10b981" : "var(--text-faint)",
                }}>
                <span className="w-1.5 h-1.5 rounded-full"
                  style={{ background: metaConnected ? "#10b981" : "var(--text-faint)" }} />
                Meta {metaConnected ? "connected" : "not connected"}
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
            </div>
          </div>
        </div>

        <TrafficDashboard
          metaConnected={metaConnected}
          googleConnected={googleConnected}
        />
      </main>
    </div>
  );
}
