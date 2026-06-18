import { createClient } from "@supabase/supabase-js";
import PageLayout from "@/components/shared/PageLayout";
import CFOView, { type MonthData } from "@/components/cfo/CFOView";
import { getStores } from "@/lib/stores";
import { getRepeatRate } from "@/lib/analytics";
import { isMetaConnected } from "@/lib/meta";
import { isGoogleConnected } from "@/lib/googleAds";
import { isTikTokConnected } from "@/lib/tiktok";

export const revalidate = 300;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function CFOPage() {
  const stores  = await getStores();
  const store   = stores[0] ?? null;
  const storeId = store?.id;
  const supabase = getServiceClient();

  // ── 6-month order history ───────────────────────────────────────────────────
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  let ordersQ = supabase
    .from("orders")
    .select("total_price, financial_status, created_at")
    .gte("created_at", sixMonthsAgo.toISOString());
  if (storeId) ordersQ = ordersQ.eq("store_id", storeId);
  const { data: rawOrders } = await ordersQ;

  const monthMap: Record<string, { revenue: number; orderCount: number; refunds: number }> = {};
  for (const o of rawOrders ?? []) {
    const d   = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { revenue: 0, orderCount: 0, refunds: 0 };
    const price = parseFloat(String(o.total_price)) || 0;
    if (o.financial_status === "refunded") {
      monthMap[key].refunds += price;
    } else if (o.financial_status !== "voided") {
      monthMap[key].revenue    += price;
      monthMap[key].orderCount  += 1;
    }
  }

  const monthlyHistory: MonthData[] = [];
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyHistory.push({
      year:           d.getFullYear(),
      month:          d.getMonth() + 1,
      key,
      label:          d.toLocaleDateString("en-AU", { month: "short" }),
      isCurrentMonth: i === 0,
      ...(monthMap[key] ?? { revenue: 0, orderCount: 0, refunds: 0 }),
    });
  }

  // ── Customer stats ──────────────────────────────────────────────────────────
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [totalRes, new30Res] = await Promise.all([
    storeId
      ? supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", storeId)
      : Promise.resolve({ count: 0 }),
    storeId
      ? supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", storeId).gte("created_at", since30)
      : Promise.resolve({ count: 0 }),
  ]);
  const customerStats = {
    total: (totalRes as any).count ?? 0,
    new30d: (new30Res as any).count ?? 0,
  };

  // ── Inventory value estimate (price × default COGS rate × qty) ──────────────
  let invQ = supabase
    .from("products")
    .select("price, inventory_quantity")
    .eq("status", "active")
    .gt("inventory_quantity", 0);
  if (storeId) invQ = invQ.eq("store_id", storeId);
  const { data: products } = await invQ;
  const inventoryValue = (products ?? []).reduce((sum, p) => {
    return sum + (parseFloat(String(p.price)) * 0.45 * Math.max(0, p.inventory_quantity ?? 0));
  }, 0);

  const repeatRate = await getRepeatRate(storeId);

  return (
    <PageLayout
      stores={stores}
      activePage="CFO Hub"
      title="CFO Financial Hub"
      subtitle="Executive overview · margins · unit economics · working capital · forecasting"
    >
      <CFOView
        storeId={storeId ?? null}
        monthlyHistory={monthlyHistory}
        customerStats={customerStats}
        repeatRate={repeatRate}
        inventoryValue={inventoryValue}
        metaConnected={isMetaConnected()}
        googleConnected={isGoogleConnected()}
        tiktokConnected={isTikTokConnected()}
      />
    </PageLayout>
  );
}
