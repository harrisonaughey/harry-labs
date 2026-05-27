import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import IntegrationsView from "@/components/integrations/IntegrationsView";
import { getStores } from "@/lib/stores";
import { isMetaConnected } from "@/lib/meta";
import { isGoogleConnected } from "@/lib/googleAds";

export const revalidate = 0;

export default async function IntegrationsPage() {
  const stores = await getStores();

  // Determine which integrations are connected at runtime
  const connectedIds: string[] = ["supabase", "vercel"]; // always connected if page loads
  if (stores.length > 0)    connectedIds.push("shopify");
  if (process.env.KLAVIYO_API_KEY) connectedIds.push("klaviyo");
  if (isMetaConnected())    connectedIds.push("meta");
  if (isGoogleConnected())  connectedIds.push("google_ads");

  const total     = 9; // total integrations documented
  const connected = connectedIds.length;

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--bg-app)" }}>
      <Suspense>
        <Sidebar stores={stores} activePage="Integrations" />
      </Suspense>

      <main className="flex-1 overflow-hidden flex flex-col px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Integration Process</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Setup guides, credentials and connection status for all integrations
            </p>
          </div>
          {/* Progress */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Connected</p>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{connected}<span className="text-sm font-normal" style={{ color: "var(--text-faint)" }}>/{total}</span></p>
            </div>
            <div className="w-32">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${(connected / total) * 100}%`, background: "linear-gradient(90deg, #6366f1, #10b981)" }} />
              </div>
              <p className="text-xs mt-1 text-right" style={{ color: "var(--text-faint)" }}>
                {Math.round((connected / total) * 100)}% complete
              </p>
            </div>
          </div>
        </div>

        {/* Main panel — takes remaining height */}
        <div className="flex-1 min-h-0">
          <IntegrationsView connectedIds={connectedIds} />
        </div>
      </main>
    </div>
  );
}
