import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SHOPIFY_API_VERSION = "2026-04";

// ─── Paginated Shopify fetcher ────────────────────────────────────────────────
async function shopifyFetchAll(shop: string, token: string, endpoint: string): Promise<any[]> {
  const allResults: any[] = [];
  let nextUrl: string | null = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/${endpoint}`;

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, {
      headers: { "X-Shopify-Access-Token": token },
    });

    if (!response.ok) throw new Error(`Shopify ${response.status}: ${endpoint}`);

    const data: Record<string, any[]> = await response.json();

    // Get the first array value in the response (orders, customers, products etc)
    const key = Object.keys(data)[0];
    const rows: any[] = data[key] ?? [];
    allResults.push(...rows);

    // Follow Shopify cursor-based pagination via Link header
    const link = response.headers.get("link");
    const nextMatch = link?.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return allResults;
}

// ─── Main sync function ───────────────────────────────────────────────────────
export async function syncStore(storeId: string) {
  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("id, shop_domain, access_token, last_synced_at")
    .eq("id", storeId)
    .single();

  if (storeErr || !store) throw new Error(`Store not found: ${storeErr?.message}`);

  // Incremental: only fetch records updated since last sync
  const since = store.last_synced_at
    ? new Date(store.last_synced_at).toISOString()
    : null;

  const sinceParam = since ? `&updated_at_min=${encodeURIComponent(since)}` : "";
  const isFirstSync = !since;

  const results: Record<string, number> = {};
  const errors: string[] = [];

  console.log(`[sync] ${store.shop_domain} — ${isFirstSync ? "FULL sync" : `incremental since ${since}`}`);

  // ── Customers ──────────────────────────────────────────────────────────────
  try {
    const customers = await shopifyFetchAll(
      store.shop_domain, store.access_token,
      `customers.json?limit=250&order=updated_at+asc${sinceParam}`
    );
    if (customers.length) {
      const rows = customers.map((c: any) => ({
        store_id: store.id,
        external_id: String(c.id),
        source: "shopify",
        email: c.email ?? "",
        first_name: c.first_name ?? null,
        last_name: c.last_name ?? null,
        phone: c.phone ?? null,
        city: c.default_address?.city ?? null,
        country: c.default_address?.country ?? null,
        total_spent: parseFloat(c.total_spent || "0"),
        orders_count: c.orders_count ?? 0,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
      const { error } = await supabase
        .from("customers")
        .upsert(rows, { onConflict: "store_id,external_id,source" });
      if (error) errors.push(`customers: ${error.message}`);
      else results.customers = rows.length;
    } else {
      results.customers = 0;
    }
  } catch (e: any) { errors.push(`customers: ${e.message}`); }

  // ── Products ───────────────────────────────────────────────────────────────
  try {
    const products = await shopifyFetchAll(
      store.shop_domain, store.access_token,
      `products.json?limit=250${sinceParam}`
    );
    if (products.length) {
      const rows = products.map((p: any) => ({
        store_id: store.id,
        external_id: String(p.id),
        source: "shopify",
        title: p.title,
        vendor: p.vendor ?? null,
        product_type: p.product_type ?? null,
        status: p.status,
        price: parseFloat(p.variants?.[0]?.price || "0"),
        compare_at_price: parseFloat(p.variants?.[0]?.compare_at_price || "0") || null,
        sku: p.variants?.[0]?.sku ?? null,
        inventory_quantity: p.variants?.reduce(
          (s: number, v: any) => s + (v.inventory_quantity || 0), 0
        ),
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
      const { error } = await supabase
        .from("products")
        .upsert(rows, { onConflict: "store_id,external_id,source" });
      if (error) errors.push(`products: ${error.message}`);
      else results.products = rows.length;
    } else {
      results.products = 0;
    }
  } catch (e: any) { errors.push(`products: ${e.message}`); }

  // ── Orders ─────────────────────────────────────────────────────────────────
  try {
    const orders = await shopifyFetchAll(
      store.shop_domain, store.access_token,
      `orders.json?limit=250&status=any&order=updated_at+asc${sinceParam}`
    );
    if (orders.length) {
      // Build customer email → DB id map (store-scoped)
      const emails = [...new Set(orders.map((o: any) => o.email).filter(Boolean))] as string[];
      let emailToId: Record<string, string> = {};
      if (emails.length) {
        const { data: dbCusts } = await supabase
          .from("customers")
          .select("id, email")
          .eq("store_id", store.id)
          .in("email", emails);
        dbCusts?.forEach((c) => { emailToId[c.email] = c.id; });
      }

      const orderRows = orders.map((o: any) => ({
        store_id: store.id,
        external_id: String(o.id),
        source: "shopify",
        order_number: String(o.order_number),
        customer_id: o.email ? (emailToId[o.email] ?? null) : null,
        customer_email: o.email ?? null,
        subtotal: parseFloat(o.subtotal_price || "0"),
        total_price: parseFloat(o.total_price || "0"),
        total_tax: parseFloat(o.total_tax || "0"),
        total_discounts: parseFloat(o.total_discounts || "0"),
        currency: o.currency,
        financial_status: o.financial_status ?? null,
        fulfillment_status: o.fulfillment_status ?? "unfulfilled",
        status: o.financial_status ?? "pending",
        created_at: o.created_at,
        updated_at: o.updated_at,
      }));

      const { error } = await supabase
        .from("orders")
        .upsert(orderRows, { onConflict: "store_id,external_id,source" });
      if (error) errors.push(`orders: ${error.message}`);
      else results.orders = orderRows.length;

      // ── Revenue snapshots (only rebuild days touched in this sync) ────────
      const snapMap: Record<string, { revenue: number; count: number }> = {};
      orders.forEach((o: any) => {
        const date = o.created_at.split("T")[0];
        if (!snapMap[date]) snapMap[date] = { revenue: 0, count: 0 };
        snapMap[date].revenue += parseFloat(o.total_price || "0");
        snapMap[date].count += 1;
      });

      const snapRows = Object.entries(snapMap).map(([date, v]) => ({
        store_id: store.id,
        date,
        source: "shopify",
        revenue: v.revenue,
        orders_count: v.count,
        avg_order_value: v.count > 0 ? v.revenue / v.count : 0,
      }));
      await supabase
        .from("revenue_snapshots")
        .upsert(snapRows, { onConflict: "store_id,date,source" });
    } else {
      results.orders = 0;
    }
  } catch (e: any) { errors.push(`orders: ${e.message}`); }

  // ── Finalise ───────────────────────────────────────────────────────────────
  const total = Object.values(results).reduce((s, n) => s + n, 0);
  const syncType = isFirstSync ? "full_sync" : "incremental_sync";

  await supabase.from("sync_log").insert({
    store_id: store.id,
    source: "shopify",
    entity: syncType,
    status: errors.length === 0 ? "success" : "partial",
    records_synced: total,
    error_message: errors.length ? errors.join("; ") : null,
  });

  // Always update last_synced_at so next run is incremental
  if (errors.length === 0 || total > 0) {
    await supabase
      .from("stores")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", store.id);
  }

  return { results, errors, type: syncType };
}

// ─── Sync all active stores (used by cron) ────────────────────────────────────
export async function syncAllStores() {
  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, shop_domain")
    .eq("is_active", true);

  if (error || !stores?.length) return { error: "No active stores" };

  const storeResults = await Promise.allSettled(
    stores.map((s) => syncStore(s.id))
  );

  return stores.map((store, i) => {
    const r = storeResults[i];
    return {
      shop: store.shop_domain,
      status: r.status,
      ...(r.status === "fulfilled" ? r.value : { error: (r.reason as Error).message }),
    };
  });
}
