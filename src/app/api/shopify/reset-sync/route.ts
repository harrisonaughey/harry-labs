import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Resets last_synced_at so the next sync does a full pull
export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await supabase
    .from("stores")
    .update({ last_synced_at: null })
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, message: "last_synced_at cleared — next sync will be a full pull" });
}
