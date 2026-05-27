import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "@/components/Sidebar";
import ProductsView from "@/components/products/ProductsView";
import SyncButton from "@/components/SyncButton";
import { getStores } from "@/lib/stores";

export const revalidate = 300;

async function getProducts() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("title", { ascending: true });
  return data ?? [];
}

export default async function ProductsPage() {
  const [stores, products] = await Promise.all([getStores(), getProducts()]);

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "#0a0a0f" }}>
      <Suspense>
        <Sidebar stores={stores} activePage="Products" />
      </Suspense>

      <main className="flex-1 overflow-y-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">Products</h1>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              {products.length} products synced · margin calculator
            </p>
          </div>
          <SyncButton />
        </div>

        <Suspense>
          <ProductsView products={products} />
        </Suspense>
      </main>
    </div>
  );
}
