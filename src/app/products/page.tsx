import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import PageLayout from "@/components/shared/PageLayout";
import ProductsView from "@/components/products/ProductsView";
import SyncButton from "@/components/SyncButton";
import { getStores } from "@/lib/stores";

export const revalidate = 300;

async function getProducts(storeId?: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  let q = supabase
    .from("products")
    .select("*")
    .order("title", { ascending: true });
  if (storeId) q = q.eq("store_id", storeId);
  const { data } = await q;
  return data ?? [];
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store: storeParam } = await searchParams;
  const stores = await getStores();
  const storeId = storeParam || stores[0]?.id;
  const products = await getProducts(storeId);

  return (
    <PageLayout
      stores={stores}
      activePage="Products"
      title="Products"
      subtitle={`${products.length} products synced · margin calculator`}
      currentStoreId={storeId ?? null}
      headerRight={<SyncButton />}
    >
      <Suspense>
        <ProductsView products={products} />
      </Suspense>
    </PageLayout>
  );
}
