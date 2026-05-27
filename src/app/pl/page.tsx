import PageLayout from "@/components/shared/PageLayout";
import PLView from "@/components/pl/PLView";
import { getStores } from "@/lib/stores";
import { getMerStats } from "@/lib/analytics";

export const revalidate = 300;

export default async function PLPage() {
  const stores = await getStores();
  const storeId = stores[0]?.id;
  const stats = await getMerStats(30, storeId);

  return (
    <PageLayout
      stores={stores}
      activePage="P&L"
      title="Profit & Loss"
      subtitle="Revenue from Shopify · configure expenses · see net profit"
    >
      <PLView shopifyRevenue={stats.revenue} shopifyOrders={stats.orderCount} />
    </PageLayout>
  );
}
