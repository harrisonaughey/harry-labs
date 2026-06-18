import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStores } from "@/lib/stores";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since");
  const until = req.nextUrl.searchParams.get("until");

  if (!since || !until) {
    return NextResponse.json({ error: "since and until are required" }, { status: 400 });
  }

  try {
    const stores = await getStores();
    const storeId = stores[0]?.id;
    const supabase = getServiceClient();

    // Fetch orders in range
    let q = supabase
      .from("orders")
      .select("total_price, financial_status")
      .gte("created_at", `${since}T00:00:00.000Z`)
      .lte("created_at", `${until}T23:59:59.999Z`);

    if (storeId) q = q.eq("store_id", storeId);
    const { data: orders, error } = await q;

    if (error) throw new Error(error.message);

    const allOrders = orders ?? [];
    const revenue = allOrders
      .filter((o) => o.financial_status !== "refunded" && o.financial_status !== "voided")
      .reduce((s, o) => s + (parseFloat(String(o.total_price)) || 0), 0);

    const refunds = allOrders
      .filter((o) => o.financial_status === "refunded")
      .reduce((s, o) => s + (parseFloat(String(o.total_price)) || 0), 0);

    const orderCount = allOrders.filter(
      (o) => o.financial_status !== "refunded" && o.financial_status !== "voided"
    ).length;

    return NextResponse.json({ revenue, refunds, netRevenue: revenue - refunds, orderCount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
