import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Record<string, any> = {
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "MISSING",
  };

  // Store status
  const { data: stores } = await supabase
    .from("stores")
    .select("id, shop_domain, is_active, last_synced_at, access_token");

  results.stores = (stores ?? []).map((s: any) => ({
    id: s.id,
    shop_domain: s.shop_domain,
    is_active: s.is_active,
    last_synced_at: s.last_synced_at,
    has_token: !!s.access_token,
  }));

  // Product count
  const { count: prodCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });
  results.product_count = prodCount;

  // Sample products
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, store_id, title, price, status, source")
    .limit(5);
  results.product_sample = products ?? [];
  results.product_error = prodErr?.message ?? null;

  // Test direct Shopify API call
  if (stores?.length) {
    const store = stores[0] as any;
    if (store.access_token) {
      try {
        const r = await fetch(
          `https://${store.shop_domain}/admin/api/2026-04/products.json?limit=5&status=any`,
          { headers: { "X-Shopify-Access-Token": store.access_token } }
        );
        const body = await r.json();
        results.shopify_status = r.status;
        results.shopify_product_count = body.products?.length ?? 0;
        results.shopify_first_product = body.products?.[0]
          ? { id: body.products[0].id, title: body.products[0].title, status: body.products[0].status }
          : null;
        results.shopify_error = body.errors ?? null;
      } catch (e: any) {
        results.shopify_fetch_error = e.message;
      }
    } else {
      results.shopify_error = "No access token stored";
    }
  }

  return NextResponse.json(results, { status: 200 });
}
