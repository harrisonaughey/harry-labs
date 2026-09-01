/**
 * POST /api/agent/build-campaign-entry
 *
 * Immediately builds a single campaign entry end-to-end:
 *   1. Upserts the entry to content_calendar (create or update)
 *   2. Creates a Klaviyo campaign draft using the AI Template (no HTML generation)
 *   3. Writes the campaign ID back to the DB, marks status "done"
 *
 * Used by the "Build Now" button in the campaign entry modal.
 * No look-ahead date filter — builds immediately regardless of send_at.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCampaign } from "@/lib/klaviyo";

const STORE_ID = "50f89d8a-ae07-4999-9ec7-4304a2f6c51b";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    entryId,
    name,
    brief,
    templateType,
    sendDate,
    sendTime,
    destinationUrl,
  } = body as {
    entryId?: string;
    name?: string;
    brief?: string;
    templateType?: string;
    sendDate?: string;
    sendTime?: string;
    destinationUrl?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }

  const supabase = db();

  // Build send_at from date + time fields
  let send_at: string | null = null;
  if (sendDate) {
    const t = sendTime || "09:00";
    send_at = new Date(`${sendDate}T${t}:00`).toISOString();
  }

  // ── 1. Upsert to content_calendar ─────────────────────────────────────────
  let id = entryId;

  if (id) {
    await supabase.from("content_calendar").update({
      name:            name.trim(),
      brief:           brief?.trim()    || null,
      send_at,
      destination_url: destinationUrl   || null,
      template_type:   templateType     || null,
      status:          "generating",
      error_message:   null,
      updated_at:      new Date().toISOString(),
    }).eq("id", id);
  } else {
    const { data: newEntry, error } = await supabase
      .from("content_calendar")
      .insert({
        store_id:        STORE_ID,
        name:            name.trim(),
        brief:           brief?.trim()  || null,
        send_at,
        destination_url: destinationUrl || null,
        template_type:   templateType   || null,
        status:          "generating",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    id = newEntry.id as string;
  }

  try {
    // ── 2. Create Klaviyo campaign using AI Template — no HTML generation ──────
    // Audience left empty so Harrison can select the segment manually in Klaviyo.
    const { campaignId, templateId } = await createCampaign({
      name:         name.trim(),
      subject:      name.trim(),
      fromEmail:    "info@thinkle.com.au",
      fromName:     "Thinkle",
      audienceIds:  [],
      scheduledAt:  send_at ?? undefined,
    });

    // ── 3. Write results to DB ────────────────────────────────────────────────
    await supabase.from("content_calendar").update({
      klaviyo_campaign_id: campaignId,
      klaviyo_template_id: templateId ?? null,
      status:              "done",
      updated_at:          new Date().toISOString(),
    }).eq("id", id!);

    // ── 4. Log to agent_actions ───────────────────────────────────────────────
    await supabase.from("agent_actions").insert({
      store_id:            STORE_ID,
      agent_name:          "campaign-designer",
      calendar_entry_id:   id,
      klaviyo_campaign_id: campaignId,
      klaviyo_template_id: templateId ?? null,
      prompt_snapshot:     name.trim().slice(0, 2000),
      status:              "success",
    });

    return NextResponse.json({
      ok:         true,
      entryId:    id,
      campaignId,
      templateId,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    await supabase.from("content_calendar").update({
      status:        "error",
      error_message: message,
      updated_at:    new Date().toISOString(),
    }).eq("id", id!);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
