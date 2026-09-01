import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import ContentDashboard from "@/components/content/ContentDashboard";
import { getStores } from "@/lib/stores";
import { isMetaConnected } from "@/lib/meta";

export const revalidate = 0;

export default async function ContentPage() {
  const stores = await getStores();
  const metaConnected = isMetaConnected();

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--bg-app)" }}>
      <Suspense>
        <Sidebar stores={stores} activePage="Organic" />
      </Suspense>
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Organic Media</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Instagram · TikTok · ManyChat DMs · Content Audit
            </p>
          </div>
        </div>
        <ContentDashboard metaConnected={metaConnected} />
      </main>
    </div>
  );
}
