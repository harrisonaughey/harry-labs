/**
 * GET  /api/content-calendar  — list all entries
 * POST /api/content-calendar  — create entry
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
    .from("content_calendar")
    .select("*")
    .order("send_at", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, brief, sendDate, sendTime, listId, destinationUrl, templateType } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let send_at: string | null = null;
  if (sendDate) {
    const t = sendTime || "09:00";
    send_at = new Date(`${sendDate}T${t}:00`).toISOString();
  }

  const { data, error } = await db()
    .from("content_calendar")
    .insert({
      store_id:        STORE_ID,
      name:            name.trim(),
      brief:           brief?.trim()          || null,
      send_at,
      list_id:         listId?.trim()         || null,
      destination_url: destinationUrl?.trim() || null,
      template_type:   templateType?.trim()   || null,
      status:          "planned",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data }, { status: 201 });
}
