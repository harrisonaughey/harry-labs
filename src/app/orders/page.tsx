import { createClient } from "@supabase/supabase-js";
import PageLayout from "@/components/shared/PageLayout";
import OrdersView from "@/components/orders/OrdersView";
import { getStores } from "@/lib/stores";

export const revalidate = 300;

async function getOrders(storeId?: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let q = supabase
    .from("orders")
    .select(`
      id, order_number, customer_email, total_price,
      status, financial_status, fulfillment_status,
      source, created_at,
      customers ( first_name, last_name )
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  if (storeId) q = q.eq("store_id", storeId);
  const { data } = await q;

  return (data ?? []).map((o) => ({
    ...o,
    customers: Array.isArray(o.customers) ? (o.customers[0] ?? null) : o.customers,
  }));
}

export default async function OrdersPage() {
  const stores = await getStores();
  const storeId = stores[0]?.id;
  const orders = await getOrders(storeId);

  return (
    <PageLayout
      stores={stores}
      activePage="Orders"
      title="Orders"
      subtitle={`${orders.length} orders · search, filter, export`}
    >
      <OrdersView orders={orders} />
    </PageLayout>
  );
}
