import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncStore } from "@/lib/sync";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — sync the first store. Pass ?full=true to force a complete re-pull from Shopify.
export async function GET(req: NextRequest) {
  const full = req.nextUrl.searchParams.get("full") === "true";

  const { data: store, error } = await supabase
    .from("stores")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  try {
    const result = await syncStore(store.id, full);
    return NextResponse.json({ success: result.errors.length === 0, full, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — sync a specific store by shop_domain
export async function POST(req: NextRequest) {
  const { shop_domain } = await req.json();

  const { data: store, error } = await supabase
    .from("stores")
    .select("id")
    .eq("shop_domain", shop_domain)
    .single();

  if (error || !store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  try {
    const result = await syncStore(store.id);
    return NextResponse.json({ success: result.errors.length === 0, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
