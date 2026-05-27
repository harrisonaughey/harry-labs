import { createClient } from "@supabase/supabase-js";
import PageLayout from "@/components/shared/PageLayout";
import CustomersView from "@/components/customers/CustomersView";
import { getStores } from "@/lib/stores";
import { getCustomerStats } from "@/lib/analytics";

export const revalidate = 300;

async function getCustomers(storeId?: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let q = supabase
    .from("customers")
    .select("id, first_name, last_name, email, orders_count, total_spent, created_at")
    .order("total_spent", { ascending: false })
    .limit(500);

  if (storeId) q = q.eq("store_id", storeId);
  const { data } = await q;
  return data ?? [];
}

export default async function CustomersPage() {
  const stores = await getStores();
  const storeId = stores[0]?.id;

  const [customers, stats] = await Promise.all([
    getCustomers(storeId),
    getCustomerStats(storeId),
  ]);

  return (
    <PageLayout
      stores={stores}
      activePage="Customers"
      title="Customers"
      subtitle="Lifetime value · repeat rate · segments"
    >
      <CustomersView customers={customers} total={stats.total} new30d={stats.new30d} />
    </PageLayout>
  );
}
