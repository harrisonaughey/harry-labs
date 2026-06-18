import { NextRequest, NextResponse } from "next/server";
import { getStores } from "@/lib/stores";
import { getTopProductsByRevenue } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30");
  try {
    const stores  = await getStores();
    const storeId = stores[0]?.id;
    const products = await getTopProductsByRevenue(days, storeId, 15);
    return NextResponse.json({ products });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
