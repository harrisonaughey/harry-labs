import { createClient } from "@supabase/supabase-js";
import PageLayout from "@/components/shared/PageLayout";
import ShopifyView from "@/components/shopify/ShopifyView";
import { getStores } from "@/lib/stores";
import { getLowStockProducts, getRepeatRate } from "@/lib/analytics";
import { getSyncLog } from "@/lib/data";

export const revalidate = 300;

export default async function ShopifyPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store: storeParam } = await searchParams;
  const stores  = await getStores();
  const store   = (storeParam ? stores.find((s) => s.id === storeParam) : null) ?? stores[0] ?? null;
  const storeId = store?.id;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [lowStock, syncLog, repeatRate, countResult] = await Promise.all([
    getLowStockProducts(5, storeId),
    getSyncLog(storeId),
    getRepeatRate(storeId),
    storeId
      ? supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active").eq("store_id", storeId)
      : Promise.resolve({ count: 0 }),
  ]);

  const lastSync     = syncLog.find((s) => s.source === "shopify") ?? null;
  const totalProducts = (countResult as any).count ?? 0;

  return (
    <PageLayout
      stores={stores}
      activePage="Shopify Store"
      title="Shopify Store"
      subtitle="Store health · top products · inventory · change log"
      currentStoreId={storeId ?? null}
    >
      <ShopifyView
        store={store}
        initialLowStock={lowStock as any}
        totalProducts={totalProducts}
        lastSync={lastSync}
        repeatRate={repeatRate}
      />
    </PageLayout>
  );
}
