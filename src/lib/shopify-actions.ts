import { createClient } from "@supabase/supabase-js";

const SHOPIFY_API_VERSION = "2026-04";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Store credential loader ──────────────────────────────────────────────────

export async function getStoreCredentials(storeId?: string): Promise<{
  id: string;
  shop_domain: string;
  access_token: string;
}> {
  const supabase = db();
  const query = supabase
    .from("stores")
    .select("id, shop_domain, access_token")
    .eq("is_active", true)
    .order("installed_at", { ascending: true });

  const { data, error } = storeId
    ? await query.eq("id", storeId).single()
    : await query.limit(1).single();

  if (error || !data) throw new Error(`Store not found: ${error?.message}`);
  return data;
}

// ─── Raw Shopify Admin REST caller ───────────────────────────────────────────

async function shopifyRequest(
  shop: string,
  token: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<any> {
  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    const msg = json?.errors
      ? JSON.stringify(json.errors)
      : `Shopify ${res.status}: ${path}`;
    throw new Error(msg);
  }
  return json;
}

// ─── Action logger ────────────────────────────────────────────────────────────

export async function logAction(opts: {
  storeId: string;
  actionType: string;
  category: "price" | "product" | "promo" | "inventory" | "store" | "shipping" | "ads" | "other";
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: "success" | "failed";
}) {
  const supabase = db();
  await supabase.from("store_adjustments").insert({
    store_id: opts.storeId,
    category: opts.category,
    title: opts.title,
    description: opts.description ?? null,
    metric_snapshot: {
      action_type: opts.actionType,
      payload: opts.payload ?? {},
      result: opts.result ?? {},
      status: opts.status,
      executed_at: new Date().toISOString(),
    },
  });
}

// ─── Product actions ──────────────────────────────────────────────────────────

export async function updateProductPrice(
  shop: string,
  token: string,
  variantId: string,
  price: string,
  compareAtPrice?: string
) {
  const body: any = { variant: { id: variantId, price } };
  if (compareAtPrice !== undefined) body.variant.compare_at_price = compareAtPrice;
  return shopifyRequest(shop, token, "PUT", `variants/${variantId}.json`, body);
}

export async function updateProductStatus(
  shop: string,
  token: string,
  productId: string,
  status: "active" | "draft" | "archived"
) {
  return shopifyRequest(shop, token, "PUT", `products/${productId}.json`, {
    product: { id: productId, status },
  });
}

export async function updateProductInventory(
  shop: string,
  token: string,
  inventoryItemId: string,
  locationId: string,
  available: number
) {
  return shopifyRequest(shop, token, "POST", "inventory_levels/set.json", {
    inventory_item_id: inventoryItemId,
    location_id: locationId,
    available,
  });
}

export async function updateProductTitle(
  shop: string,
  token: string,
  productId: string,
  title: string,
  bodyHtml?: string
) {
  const product: any = { id: productId, title };
  if (bodyHtml !== undefined) product.body_html = bodyHtml;
  return shopifyRequest(shop, token, "PUT", `products/${productId}.json`, { product });
}

// ─── Order actions ────────────────────────────────────────────────────────────

export async function fulfillOrder(
  shop: string,
  token: string,
  orderId: string,
  trackingNumber?: string,
  trackingCompany?: string,
  notifyCustomer = true
) {
  // Get fulfillment order id first
  const foRes = await shopifyRequest(shop, token, "GET", `orders/${orderId}/fulfillment_orders.json`);
  const fulfillmentOrderId = foRes?.fulfillment_orders?.[0]?.id;
  if (!fulfillmentOrderId) throw new Error("No fulfillment order found");

  const body: any = {
    fulfillment: {
      line_items_by_fulfillment_order: [{ fulfillment_order_id: fulfillmentOrderId }],
      notify_customer: notifyCustomer,
    },
  };
  if (trackingNumber) {
    body.fulfillment.tracking_info = {
      number: trackingNumber,
      company: trackingCompany ?? "",
    };
  }
  return shopifyRequest(shop, token, "POST", "fulfillments.json", body);
}

export async function cancelOrder(
  shop: string,
  token: string,
  orderId: string,
  reason = "customer",
  notifyCustomer = true
) {
  return shopifyRequest(shop, token, "POST", `orders/${orderId}/cancel.json`, {
    reason,
    notify_customer: notifyCustomer,
  });
}

export async function refundOrder(
  shop: string,
  token: string,
  orderId: string,
  amount: string,
  note?: string
) {
  return shopifyRequest(shop, token, "POST", `orders/${orderId}/refunds.json`, {
    refund: {
      notify: true,
      note: note ?? "Refund issued",
      transactions: [{ kind: "refund", amount, gateway: "manual" }],
    },
  });
}

// ─── Discount actions ─────────────────────────────────────────────────────────

export async function createDiscountCode(
  shop: string,
  token: string,
  opts: {
    code: string;
    type: "percentage" | "fixed_amount" | "free_shipping";
    value: string; // e.g. "10.0" for 10% or $10
    usageLimit?: number;
    startsAt?: string;
    endsAt?: string;
  }
) {
  const priceRule = await shopifyRequest(shop, token, "POST", "price_rules.json", {
    price_rule: {
      title: opts.code,
      value_type: opts.type,
      value: opts.type === "percentage" ? `-${opts.value}` : opts.type === "fixed_amount" ? `-${opts.value}` : "0.0",
      customer_selection: "all",
      target_type: "line_item",
      target_selection: opts.type === "free_shipping" ? "all" : "all",
      allocation_method: "across",
      starts_at: opts.startsAt ?? new Date().toISOString(),
      ends_at: opts.endsAt ?? null,
      usage_limit: opts.usageLimit ?? null,
      once_per_customer: false,
    },
  });
  const priceRuleId = priceRule?.price_rule?.id;
  if (!priceRuleId) throw new Error("Price rule creation failed");

  return shopifyRequest(shop, token, "POST", `price_rules/${priceRuleId}/discount_codes.json`, {
    discount_code: { code: opts.code },
  });
}

// ─── Metafield / tag actions ──────────────────────────────────────────────────

export async function addProductTags(
  shop: string,
  token: string,
  productId: string,
  tags: string[]
) {
  // Get current tags first
  const current = await shopifyRequest(shop, token, "GET", `products/${productId}.json?fields=id,tags`);
  const existing: string[] = (current?.product?.tags ?? "").split(",").map((t: string) => t.trim()).filter(Boolean);
  const merged = Array.from(new Set([...existing, ...tags])).join(", ");
  return shopifyRequest(shop, token, "PUT", `products/${productId}.json`, {
    product: { id: productId, tags: merged },
  });
}

// ─── Location helper ──────────────────────────────────────────────────────────

export async function getPrimaryLocationId(shop: string, token: string): Promise<string> {
  const res = await shopifyRequest(shop, token, "GET", "locations.json");
  const primary = res?.locations?.[0];
  if (!primary) throw new Error("No locations found");
  return String(primary.id);
}
