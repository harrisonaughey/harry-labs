import { createClient } from "@supabase/supabase-js";
import PageLayout from "@/components/shared/PageLayout";
import ShopifyView from "@/components/shopify/ShopifyView";
import { getStores } from "@/lib/stores";
import { getMerStats, getTopProducts, getLowStockProducts } from "@/lib/analytics";
import { getSyncLog } from "@/lib/data";

export const revalidate = 300;

export default async function ShopifyPage() {
  const stores = await getStores();
  const store = stores[0] ?? null;
  const storeId = store?.id;

  const [merStats, products, lowStock, syncLog] = await Promise.all([
    getMerStats(30, storeId),
    getTopProducts(10, storeId),
    getLowStockProducts(5, storeId),
    getSyncLog(storeId),
  ]);

  const lastSync = syncLog.find((s) => s.source === "shopify") ?? null;

  // Get total product count
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  let countQ = supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active");
  if (storeId) countQ = countQ.eq("store_id", storeId);
  const { count: totalProducts } = await countQ;

  return (
    <PageLayout
      stores={stores}
      activePage="Shopify Store"
      title="Shopify Store"
      subtitle="Store health · inventory · performance"
    >
      <ShopifyView
        store={store}
        products={products as any}
        lowStock={lowStock as any}
        revenue30d={merStats.revenue}
        orders30d={merStats.orderCount}
        aov={merStats.aov}
        lastSync={lastSync}
        totalProducts={totalProducts ?? 0}
      />
    </PageLayout>
  );
}
