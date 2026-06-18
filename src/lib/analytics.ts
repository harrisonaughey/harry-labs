import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type ChannelRow = {
  channel: string;
  revenue: number;
  orders: number;
  spend: number;
  roas: number | null;
  pct: number;
};

// ─── MER Stats ────────────────────────────────────────────────────────────────
// MER = Total Ad Spend ÷ Total Revenue
export async function getMerStats(days = 30, storeId?: string) {
  const supabase = getServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  let q = supabase
    .from("orders")
    .select("total_price")
    .gte("created_at", sinceStr);
  if (storeId) q = q.eq("store_id", storeId);
  const { data: orders } = await q;

  const revenue = (orders ?? []).reduce(
    (s, o) => s + (parseFloat(String(o.total_price)) || 0),
    0
  );
  const orderCount = orders?.length ?? 0;
  const aov = orderCount > 0 ? revenue / orderCount : 0;

  // Ad spend: sum from sync_log or use 0 if not available
  // In future this will pull from actual ad platform tables
  const adSpend = 0; // placeholder until Meta/Google spend tables exist

  const mer = adSpend > 0 ? revenue / adSpend : null;
  const roas = adSpend > 0 ? revenue / adSpend : null;
  const cpa = adSpend > 0 && orderCount > 0 ? adSpend / orderCount : null;
  const grossProfit = revenue * 0.45; // 45% gross margin estimate

  return { revenue, orderCount, aov, adSpend, mer, roas, cpa, grossProfit };
}

// ─── Channel Breakdown ────────────────────────────────────────────────────────
export async function getChannelBreakdown(days = 30, storeId?: string): Promise<ChannelRow[]> {
  const supabase = getServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  let q = supabase
    .from("orders")
    .select("total_price, source")
    .gte("created_at", sinceStr);
  if (storeId) q = q.eq("store_id", storeId);
  const { data: orders } = await q;

  const grouped: Record<string, { revenue: number; orders: number }> = {};
  (orders ?? []).forEach((o) => {
    const src = o.source ?? "shopify";
    if (!grouped[src]) grouped[src] = { revenue: 0, orders: 0 };
    grouped[src].revenue += parseFloat(String(o.total_price)) || 0;
    grouped[src].orders += 1;
  });

  const total = Object.values(grouped).reduce((s, v) => s + v.revenue, 0);

  return Object.entries(grouped).map(([channel, v]) => ({
    channel,
    revenue: v.revenue,
    orders: v.orders,
    spend: 0,
    roas: null,
    pct: total > 0 ? (v.revenue / total) * 100 : 0,
  }));
}

// ─── Customer Stats ───────────────────────────────────────────────────────────
export async function getCustomerStats(storeId?: string) {
  const supabase = getServiceClient();
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  let totalQ = supabase
    .from("customers")
    .select("id", { count: "exact", head: true });
  let newQ = supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since30.toISOString());

  if (storeId) {
    totalQ = totalQ.eq("store_id", storeId);
    newQ = newQ.eq("store_id", storeId);
  }

  const [{ count: total }, { count: newCount }] = await Promise.all([totalQ, newQ]);

  return {
    total: total ?? 0,
    new30d: newCount ?? 0,
  };
}

// ─── Top Products ─────────────────────────────────────────────────────────────
export async function getTopProducts(limit = 10, storeId?: string) {
  const supabase = getServiceClient();

  let q = supabase
    .from("products")
    .select("id, title, vendor, product_type, price, inventory_quantity, status")
    .eq("status", "active")
    .order("price", { ascending: false })
    .limit(limit);

  if (storeId) q = q.eq("store_id", storeId);
  const { data } = await q;
  return data ?? [];
}

// ─── Top Products by Revenue ─────────────────────────────────────────────────
export async function getTopProductsByRevenue(days = 30, storeId?: string, limit = 10) {
  const supabase = getServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Step 1: order external IDs in the period
  let ordersQ = supabase
    .from("orders")
    .select("external_id")
    .gte("created_at", since.toISOString())
    .not("financial_status", "in", "(refunded,voided)");
  if (storeId) ordersQ = ordersQ.eq("store_id", storeId);
  const { data: recentOrders } = await ordersQ;
  const orderExternalIds = (recentOrders ?? []).map((o) => o.external_id);
  if (orderExternalIds.length === 0) return [];

  // Step 2: line items for those orders
  let liQ = supabase
    .from("order_line_items")
    .select("product_id, product_title, price, quantity, total_price")
    .in("order_external_id", orderExternalIds);
  if (storeId) liQ = liQ.eq("store_id", storeId);
  const { data: items } = await liQ;
  if (!items?.length) return [];

  // Step 3: aggregate by product
  const byProduct: Record<string, { title: string; revenue: number; units: number }> = {};
  for (const item of items) {
    const key = item.product_id ?? item.product_title ?? "unknown";
    if (!byProduct[key]) byProduct[key] = { title: item.product_title ?? "Unknown", revenue: 0, units: 0 };
    byProduct[key].revenue += item.total_price ?? (item.price * item.quantity);
    byProduct[key].units   += item.quantity ?? 1;
  }

  const totalRevenue = Object.values(byProduct).reduce((s, v) => s + v.revenue, 0);

  return Object.entries(byProduct)
    .map(([productId, v]) => ({
      productId,
      title:   v.title,
      revenue: v.revenue,
      units:   v.units,
      revPct:  totalRevenue > 0 ? (v.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

// ─── Repeat Purchase Rate ─────────────────────────────────────────────────────
export async function getRepeatRate(storeId?: string): Promise<number> {
  const supabase = getServiceClient();
  let q = supabase
    .from("customers")
    .select("orders_count", { count: "exact" });
  if (storeId) q = q.eq("store_id", storeId);
  const { data, count } = await q;
  if (!data || !count || count === 0) return 0;
  const repeats = data.filter((c) => (c.orders_count ?? 0) > 1).length;
  return (repeats / count) * 100;
}

// ─── Store Adjustments ────────────────────────────────────────────────────────
export type StoreAdjustment = {
  id: string;
  store_id: string;
  logged_at: string;
  category: string;
  title: string;
  description: string | null;
  metric_snapshot: Record<string, number>;
};

export async function getStoreAdjustments(storeId: string, limit = 50): Promise<StoreAdjustment[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("store_adjustments")
    .select("*")
    .eq("store_id", storeId)
    .order("logged_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as StoreAdjustment[];
}

// ─── Low Stock Products ───────────────────────────────────────────────────────
export async function getLowStockProducts(threshold = 5, storeId?: string) {
  const supabase = getServiceClient();

  let q = supabase
    .from("products")
    .select("id, title, inventory_quantity, price")
    .eq("status", "active")
    .lte("inventory_quantity", threshold)
    .order("inventory_quantity", { ascending: true })
    .limit(20);

  if (storeId) q = q.eq("store_id", storeId);
  const { data } = await q;
  return data ?? [];
}
