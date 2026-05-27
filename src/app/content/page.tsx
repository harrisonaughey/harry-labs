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
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "#0a0a0f" }}>
      <Suspense>
        <Sidebar stores={stores} activePage="Content" />
      </Suspense>
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">Content Analytics</h1>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              Meta · Instagram · TikTok · YouTube · Organic Social
            </p>
          </div>
        </div>
        <ContentDashboard metaConnected={metaConnected} />
      </main>
    </div>
  );
}
