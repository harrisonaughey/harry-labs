import { Suspense } from "react";
import PageLayout from "@/components/shared/PageLayout";
import BusinessAnalytics from "@/components/analytics/BusinessAnalytics";
import { getStores } from "@/lib/stores";
import { getMerStats, getChannelBreakdown } from "@/lib/analytics";

export const revalidate = 300;

export default async function AnalyticsPage() {
  const stores = await getStores();
  const storeId = stores[0]?.id;

  const [merStats, channels] = await Promise.all([
    getMerStats(30, storeId),
    getChannelBreakdown(30, storeId),
  ]);

  return (
    <PageLayout
      stores={stores}
      activePage="Business"
      title="Business Analytics"
      subtitle="MER · ROAS · CPA · Gross Profit · Channel attribution"
    >
      <BusinessAnalytics
        revenue={merStats.revenue}
        orderCount={merStats.orderCount}
        aov={merStats.aov}
        adSpend={merStats.adSpend}
        mer={merStats.mer}
        roas={merStats.roas}
        cpa={merStats.cpa}
        grossProfit={merStats.grossProfit}
        channels={channels}
      />
    </PageLayout>
  );
}
