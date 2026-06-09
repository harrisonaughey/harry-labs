/**
 * GET  /api/design-rules  — list all rules for the store
 * POST /api/design-rules  — create a new rule
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STORE_ID = "50f89d8a-ae07-4999-9ec7-4304a2f6c51b";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const { data, error } = await db()
    .from("campaign_design_rules")
    .select("*")
    .eq("store_id", STORE_ID)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    trigger_keywords,
    template_type,
    design_brief,
    subject_formula,
    shopify_actions,
    color_primary,
    color_accent,
    is_active,
    sort_order,
  } = body;

  if (!name?.trim())          return NextResponse.json({ error: "Name is required" },          { status: 400 });
  if (!design_brief?.trim())  return NextResponse.json({ error: "Design brief is required" },  { status: 400 });

  const { data, error } = await db()
    .from("campaign_design_rules")
    .insert({
      store_id:        STORE_ID,
      name:            name.trim(),
      trigger_keywords: (trigger_keywords ?? "").trim(),
      template_type:   template_type  || null,
      design_brief:    design_brief.trim(),
      subject_formula: subject_formula?.trim() || null,
      shopify_actions: shopify_actions?.trim() || null,
      color_primary:   color_primary?.trim()   || null,
      color_accent:    color_accent?.trim()     || null,
      is_active:       is_active ?? true,
      sort_order:      sort_order ?? 99,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}
