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
