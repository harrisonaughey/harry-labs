import { supabase } from "./supabase";

// ─── KPI Stats ────────────────────────────────────────────────────────────────
export async function getKpiStats(days = 30, storeId?: string) {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - days);

  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - days);

  const sinceStr = since.toISOString();
  const nowStr = now.toISOString();
  const prevSinceStr = prevSince.toISOString();

  let currentQ = supabase.from("orders").select("total_price")
    .gte("created_at", sinceStr).lte("created_at", nowStr);
  let previousQ = supabase.from("orders").select("total_price")
    .gte("created_at", prevSinceStr).lt("created_at", sinceStr);
  let customerQ = supabase.from("customers")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sinceStr);

  if (storeId) {
    currentQ = currentQ.eq("store_id", storeId);
    previousQ = previousQ.eq("store_id", storeId);
    customerQ = customerQ.eq("store_id", storeId);
  }

  const [{ data: current }, { data: previous }, { count: customerCount }] =
    await Promise.all([currentQ, previousQ, customerQ]);

  const currentRevenue = current?.reduce((s, o) => s + (parseFloat(String(o.total_price)) || 0), 0) ?? 0;
  const previousRevenue = previous?.reduce((s, o) => s + (parseFloat(String(o.total_price)) || 0), 0) ?? 0;
  const currentOrders = current?.length ?? 0;
  const previousOrders = previous?.length ?? 0;
  const aov = currentOrders > 0 ? currentRevenue / currentOrders : 0;
  const prevAov = previousOrders > 0 ? previousRevenue / previousOrders : 0;

  const pct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? "+100%" : "—";
    const diff = ((curr - prev) / prev) * 100;
    return (diff >= 0 ? "+" : "") + diff.toFixed(1) + "%";
  };

  return {
    revenue:   { value: currentRevenue,  change: pct(currentRevenue, previousRevenue),   positive: currentRevenue >= previousRevenue },
    orders:    { value: currentOrders,   change: pct(currentOrders, previousOrders),      positive: currentOrders >= previousOrders },
    aov:       { value: aov,             change: pct(aov, prevAov),                       positive: aov >= prevAov },
    customers: { value: customerCount ?? 0, change: "—", positive: true },
  };
}

// ─── Revenue Chart ────────────────────────────────────────────────────────────
export async function getRevenueChart(months = 6, storeId?: string) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  let q = supabase
    .from("revenue_snapshots")
    .select("date, revenue, orders_count, source")
    .gte("date", since.toISOString().split("T")[0])
    .eq("source", "shopify")
    .order("date", { ascending: true });

  if (storeId) q = q.eq("store_id", storeId);

  const { data } = await q;

  const grouped: Record<string, { revenue: number; orders: number }> = {};
  (data ?? []).forEach((row) => {
    const month = new Date(row.date).toLocaleString("en-AU", { month: "short" });
    if (!grouped[month]) grouped[month] = { revenue: 0, orders: 0 };
    grouped[month].revenue += row.revenue;
    grouped[month].orders += row.orders_count;
  });

  return Object.entries(grouped).map(([month, v]) => ({
    month,
    revenue: Math.round(v.revenue),
    orders: v.orders,
  }));
}

// ─── Recent Orders ────────────────────────────────────────────────────────────
export async function getRecentOrders(limit = 10, storeId?: string) {
  let q = supabase
    .from("orders")
    .select(`
      id, order_number, customer_email, total_price,
      status, financial_status, fulfillment_status,
      source, created_at,
      customers ( first_name, last_name )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (storeId) q = q.eq("store_id", storeId);

  const { data } = await q;

  return (data ?? []).map((o) => ({
    ...o,
    customers: Array.isArray(o.customers) ? (o.customers[0] ?? null) : o.customers,
  }));
}

// ─── Sync Log ─────────────────────────────────────────────────────────────────
export async function getSyncLog(storeId?: string) {
  let q = supabase
    .from("sync_log")
    .select("source, entity, status, records_synced, synced_at, error_message")
    .order("synced_at", { ascending: false })
    .limit(20);

  if (storeId) q = q.eq("store_id", storeId);

  const { data } = await q;
  return data ?? [];
}
