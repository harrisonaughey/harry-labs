import { NextRequest, NextResponse } from "next/server";
import {
  getStoreCredentials,
  logAction,
  updateProductPrice,
  updateProductStatus,
  updateProductInventory,
  updateProductTitle,
  fulfillOrder,
  cancelOrder,
  refundOrder,
  createDiscountCode,
  addProductTags,
  getPrimaryLocationId,
} from "@/lib/shopify-actions";

export async function POST(req: NextRequest) {
  let storeId: string | undefined;
  let actionType: string | undefined;

  try {
    const body = await req.json();
    ({ store_id: storeId, action: actionType } = body);

    if (!actionType) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const store = await getStoreCredentials(storeId);
    const { id, shop_domain: shop, access_token: token } = store;
    storeId = id;

    let result: any;
    let logTitle: string;
    let logCategory: "price" | "product" | "promo" | "inventory" | "store" | "shipping" | "ads" | "other";
    let logDesc: string | undefined;

    switch (actionType) {
      // ── Product: update price ──────────────────────────────────────────────
      case "update_price": {
        const { variant_id, price, compare_at_price } = body;
        if (!variant_id || !price) throw new Error("variant_id and price required");
        result = await updateProductPrice(shop, token, String(variant_id), String(price), compare_at_price ? String(compare_at_price) : undefined);
        logCategory = "price";
        logTitle = `Price updated → $${price}`;
        logDesc = `Variant ${variant_id}${compare_at_price ? ` | Compare at $${compare_at_price}` : ""}`;
        break;
      }

      // ── Product: update status ─────────────────────────────────────────────
      case "update_product_status": {
        const { product_id, status } = body;
        if (!product_id || !status) throw new Error("product_id and status required");
        result = await updateProductStatus(shop, token, String(product_id), status);
        logCategory = "product";
        logTitle = `Product status → ${status}`;
        logDesc = `Product ${product_id}`;
        break;
      }

      // ── Product: update title/description ─────────────────────────────────
      case "update_product_title": {
        const { product_id, title, body_html } = body;
        if (!product_id || !title) throw new Error("product_id and title required");
        result = await updateProductTitle(shop, token, String(product_id), title, body_html);
        logCategory = "product";
        logTitle = `Product renamed: "${title}"`;
        logDesc = `Product ${product_id}`;
        break;
      }

      // ── Inventory: set stock level ─────────────────────────────────────────
      case "update_inventory": {
        const { inventory_item_id, available, location_id } = body;
        if (!inventory_item_id || available === undefined) throw new Error("inventory_item_id and available required");
        const locId = location_id ?? (await getPrimaryLocationId(shop, token));
        result = await updateProductInventory(shop, token, String(inventory_item_id), String(locId), Number(available));
        logCategory = "inventory";
        logTitle = `Inventory set → ${available} units`;
        logDesc = `Item ${inventory_item_id} @ location ${locId}`;
        break;
      }

      // ── Product: add tags ──────────────────────────────────────────────────
      case "add_product_tags": {
        const { product_id, tags } = body;
        if (!product_id || !tags?.length) throw new Error("product_id and tags required");
        result = await addProductTags(shop, token, String(product_id), tags);
        logCategory = "product";
        logTitle = `Tags added: ${tags.join(", ")}`;
        logDesc = `Product ${product_id}`;
        break;
      }

      // ── Order: fulfill ────────────────────────────────────────────────────
      case "fulfill_order": {
        const { order_id, tracking_number, tracking_company, notify_customer } = body;
        if (!order_id) throw new Error("order_id required");
        result = await fulfillOrder(shop, token, String(order_id), tracking_number, tracking_company, notify_customer ?? true);
        logCategory = "other";
        logTitle = `Order #${order_id} fulfilled`;
        logDesc = tracking_number ? `Tracking: ${tracking_company ?? ""} ${tracking_number}` : undefined;
        break;
      }

      // ── Order: cancel ─────────────────────────────────────────────────────
      case "cancel_order": {
        const { order_id, reason, notify_customer } = body;
        if (!order_id) throw new Error("order_id required");
        result = await cancelOrder(shop, token, String(order_id), reason ?? "customer", notify_customer ?? true);
        logCategory = "other";
        logTitle = `Order #${order_id} cancelled`;
        logDesc = reason ? `Reason: ${reason}` : undefined;
        break;
      }

      // ── Order: refund ─────────────────────────────────────────────────────
      case "refund_order": {
        const { order_id, amount, note } = body;
        if (!order_id || !amount) throw new Error("order_id and amount required");
        result = await refundOrder(shop, token, String(order_id), String(amount), note);
        logCategory = "other";
        logTitle = `Order #${order_id} refunded $${amount}`;
        logDesc = note;
        break;
      }

      // ── Discount: create code ─────────────────────────────────────────────
      case "create_discount": {
        const { code, type, value, usage_limit, starts_at, ends_at } = body;
        if (!code || !type || !value) throw new Error("code, type, and value required");
        result = await createDiscountCode(shop, token, { code, type, value: String(value), usageLimit: usage_limit, startsAt: starts_at, endsAt: ends_at });
        logCategory = "promo";
        logTitle = `Discount created: ${code}`;
        logDesc = `${type} — ${type === "percentage" ? `${value}% off` : type === "fixed_amount" ? `$${value} off` : "free shipping"}${usage_limit ? ` (${usage_limit} uses)` : ""}`;
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${actionType}` }, { status: 400 });
    }

    // Log success to store_adjustments (dashboard change feed)
    await logAction({
      storeId: id,
      actionType,
      category: logCategory!,
      title: logTitle!,
      description: logDesc,
      payload: body,
      result,
      status: "success",
    });

    return NextResponse.json({ ok: true, action: actionType, result });
  } catch (err: any) {
    // Log failure too so the dashboard shows what was attempted
    if (storeId && actionType) {
      await logAction({
        storeId,
        actionType,
        category: "other",
        title: `FAILED: ${actionType}`,
        description: err.message,
        payload: {},
        result: {},
        status: "failed",
      }).catch(() => {});
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
