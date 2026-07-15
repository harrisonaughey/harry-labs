import PageLayout from "@/components/shared/PageLayout";
import BusinessAnalytics from "@/components/analytics/BusinessAnalytics";
import { getStores } from "@/lib/stores";
import { isMetaConnected } from "@/lib/meta";
import { isGoogleConnected } from "@/lib/googleAds";
import { isTikTokConnected } from "@/lib/tiktok";
import { getChannelBreakdown } from "@/lib/analytics";

export const revalidate = 300;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store: storeParam } = await searchParams;
  const stores  = await getStores();
  const storeId = storeParam || stores[0]?.id;

  const channels = await getChannelBreakdown(30, storeId);

  return (
    <PageLayout
      stores={stores}
      activePage="Business"
      title="Business Analytics"
      subtitle="MER · ROAS · CPA · Gross Profit · Channel attribution"
      currentStoreId={storeId ?? null}
    >
      <BusinessAnalytics
        metaConnected={isMetaConnected()}
        googleConnected={isGoogleConnected()}
        tiktokConnected={isTikTokConnected()}
        initialChannels={channels}
      />
    </PageLayout>
  );
}
