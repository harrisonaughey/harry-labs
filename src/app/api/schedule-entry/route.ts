/**
 * POST /api/schedule-entry
 *
 * Creates a fully-formed Klaviyo campaign (template + campaign draft/scheduled)
 * AND inserts a matching row into content_calendar so the Campaign Designer
 * agent has visibility over it.
 *
 * Body:
 *   name          string   required  — campaign name
 *   subject       string   required  — subject line
 *   previewText   string?           — inbox preview snippet
 *   fromName      string?           — defaults to "Thinkle"
 *   fromEmail     string?           — defaults to "hello@thinkle.com.au"
 *   listId        string   required  — Klaviyo list ID
 *   scheduledAt   string?           — ISO datetime; omit → save as draft
 *   destinationUrl string?          — primary CTA URL (stored in calendar)
 *   brief         string?           — notes for Campaign Designer agent
 *   smartSending  boolean?          — default true
 *   trackingParams boolean?         — default true
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCampaign } from "@/lib/klaviyo";

const STORE_ID = "50f89d8a-ae07-4999-9ec7-4304a2f6c51b"; // thinkle.com.au

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      subject,
      previewText,
      fromName,
      fromEmail,
      listId,
      scheduledAt,
      destinationUrl,
      brief,
    } = body;

    if (!name?.trim() || !subject?.trim() || !listId?.trim()) {
      return NextResponse.json(
        { error: "name, subject, and listId are required" },
        { status: 400 }
      );
    }

    // 1. Create Klaviyo template + campaign
    const { campaignId, templateId } = await createCampaign({
      name: name.trim(),
      subject: subject.trim(),
      fromName:     (fromName?.trim())  || "Thinkle",
      fromEmail:    (fromEmail?.trim()) || "hello@thinkle.com.au",
      listId:       listId.trim(),
      previewText:  previewText?.trim() || undefined,
      scheduledAt:  scheduledAt        || undefined,
    });

    // 2. Write to content_calendar
    //    status = 'done' since the campaign is already created in Klaviyo
    const supabase = db();
    const { error: dbErr } = await supabase.from("content_calendar").insert({
      store_id:            STORE_ID,
      name:                name.trim(),
      brief:               brief?.trim() || null,
      send_at:             scheduledAt   || null,
      list_id:             listId.trim(),
      destination_url:     destinationUrl?.trim() || null,
      klaviyo_campaign_id: campaignId,
      klaviyo_template_id: templateId ?? null,
      status:              "done",
    });

    if (dbErr) {
      // Non-fatal: campaign was already created in Klaviyo — just log and continue
      console.warn("[schedule-entry] content_calendar insert failed:", dbErr.message);
    }

    return NextResponse.json({ success: true, campaignId, templateId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
