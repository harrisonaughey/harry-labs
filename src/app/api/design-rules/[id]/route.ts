/**
 * PATCH  /api/design-rules/[id]  — update a rule
 * DELETE /api/design-rules/[id]  — delete a rule
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }  = await params;
  const body    = await req.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  const fields = [
    "name", "trigger_keywords", "template_type", "design_brief",
    "subject_formula", "shopify_actions", "color_primary",
    "color_accent", "is_active", "sort_order",
  ] as const;

  for (const f of fields) {
    if (f in body) {
      updates[f] = typeof body[f] === "string" ? (body[f].trim() || null) : body[f];
    }
  }

  // name and design_brief must not be null if provided
  if ("name" in body && !updates.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if ("design_brief" in body && !updates.design_brief) {
    return NextResponse.json({ error: "Design brief is required" }, { status: 400 });
  }

  const { data, error } = await db()
    .from("campaign_design_rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await db()
    .from("campaign_design_rules")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
