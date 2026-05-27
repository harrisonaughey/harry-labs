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
        <Sidebar stores={stores} activePage="Content" />
      </Suspense>
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Content Analytics</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Meta · Instagram · TikTok · YouTube · Organic Social
            </p>
          </div>
        </div>
        <ContentDashboard metaConnected={metaConnected} />
      </main>
    </div>
  );
}
