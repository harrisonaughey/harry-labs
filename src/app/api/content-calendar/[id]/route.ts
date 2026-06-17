/**
 * PATCH  /api/content-calendar/[id]  — update entry
 * DELETE /api/content-calendar/[id]  — delete entry
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
  const { id } = await params;
  const body   = await req.json();
  const { name, brief, sendDate, sendTime, listId, destinationUrl, templateType, status, requeue } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (name           !== undefined) updates.name            = name?.trim()            || null;
  if (brief          !== undefined) updates.brief           = brief?.trim()           || null;
  if (listId         !== undefined) updates.list_id         = listId?.trim()          || null;
  if (destinationUrl !== undefined) updates.destination_url = destinationUrl?.trim()  || null;
  if (templateType   !== undefined) updates.template_type   = templateType?.trim()    || null;
  if (status         !== undefined) updates.status          = status;

  if (sendDate !== undefined) {
    if (sendDate) {
      const t  = sendTime || "09:00";
      updates.send_at = new Date(`${sendDate}T${t}:00`).toISOString();
    } else {
      updates.send_at = null;
    }
  }

  // "Re-queue for agent" — clears Klaviyo IDs + resets to planned
  if (requeue) {
    updates.klaviyo_campaign_id = null;
    updates.klaviyo_template_id = null;
    updates.status              = "planned";
    updates.error_message       = null;
  }

  const { data, error } = await db()
    .from("content_calendar")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await db()
    .from("content_calendar")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
