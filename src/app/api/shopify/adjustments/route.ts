import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStores } from "@/lib/stores";
import { getStoreAdjustments } from "@/lib/analytics";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const stores  = await getStores();
    const storeId = stores[0]?.id;
    if (!storeId) return NextResponse.json({ adjustments: [] });
    const adjustments = await getStoreAdjustments(storeId);
    return NextResponse.json({ adjustments });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json();
    const { category, title, description, metric_snapshot } = body;
    if (!category || !title) {
      return NextResponse.json({ error: "category and title are required" }, { status: 400 });
    }

    const stores  = await getStores();
    const storeId = stores[0]?.id;
    if (!storeId) return NextResponse.json({ error: "No store found" }, { status: 400 });

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("store_adjustments")
      .insert({ store_id: storeId, category, title, description: description ?? null, metric_snapshot: metric_snapshot ?? {} })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ adjustment: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
