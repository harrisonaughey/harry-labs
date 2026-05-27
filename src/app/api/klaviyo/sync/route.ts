import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getCampaigns,
  getCampaignMetricsMap,
  getLiveFlows,
  getFlowMetricsMap,
} from "@/lib/klaviyo";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    // ── Fetch all data in parallel ──────────────────────────────────────────
    const [campaigns, metricsMap, flows, flowMetricsMap] = await Promise.all([
      getCampaigns(),
      getCampaignMetricsMap(),
      getLiveFlows(),
      getFlowMetricsMap(),
    ]);

    // ── Upsert campaigns ────────────────────────────────────────────────────
    let campaignRows = 0;
    if (campaigns.length) {
      const rows = campaigns.map((c: any) => {
        const attrs = c.attributes ?? {};
        const m = metricsMap[c.id] ?? {};
        const delivered  = Number(m.delivered   ?? 0);
        const opens      = Number(m.opens       ?? 0);
        const clicks     = Number(m.clicks      ?? 0);
        const openRate   = Number(m.open_rate   ?? (delivered > 0 ? opens  / delivered : 0));
        const clickRate  = Number(m.click_rate  ?? (delivered > 0 ? clicks / delivered : 0));
        const sentAt     = attrs.send_time ?? attrs.scheduled_at ?? attrs.created_at;
        return {
          campaign_id:   c.id,
          platform:      "klaviyo",
          campaign_name: attrs.name,
          date: sentAt ? sentAt.split("T")[0] : new Date().toISOString().split("T")[0],
          sent:          delivered,
          delivered,
          opened:        opens,
          clicked:       clicks,
          open_rate:     openRate,
          click_rate:    clickRate,
          recipients:    Number(m.recipients   ?? 0),
          unsubscribes:  Number(m.unsubscribes ?? 0),
          bounced:       Number(m.bounced      ?? 0),
          revenue:       0,
          status:        attrs.status,
          subject:       attrs.messages?.data?.[0]?.attributes?.content?.subject ?? null,
          scheduled_at:  attrs.scheduled_at ?? null,
        };
      });

      const { error } = await supabase
        .from("email_metrics")
        .upsert(rows, { onConflict: "platform,campaign_id" });
      if (error) throw new Error(`Campaign upsert: ${error.message}`);
      campaignRows = rows.length;
    }

    // ── Upsert flows ────────────────────────────────────────────────────────
    let flowRows = 0;
    if (flows.length) {
      const rows = flows.map((f: any) => {
        const attrs = f.attributes ?? {};
        const m = flowMetricsMap[f.id] ?? {};
        const delivered = Number(m.delivered  ?? 0);
        const opens     = Number(m.opens      ?? 0);
        const clicks    = Number(m.clicks     ?? 0);
        return {
          flow_id:      f.id,
          platform:     "klaviyo",
          flow_name:    attrs.name,
          status:       attrs.status,
          trigger_type: attrs.trigger_type ?? attrs.triggerType ?? null,
          delivered,
          opened:       opens,
          clicked:      clicks,
          open_rate:    Number(m.open_rate  ?? (delivered > 0 ? opens  / delivered : 0)),
          click_rate:   Number(m.click_rate ?? (delivered > 0 ? clicks / delivered : 0)),
          recipients:   Number(m.recipients   ?? 0),
          unsubscribes: Number(m.unsubscribes ?? 0),
          bounced:      Number(m.bounced      ?? 0),
          updated_at:   attrs.updated ?? attrs.updated_at ?? new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from("flow_metrics")
        .upsert(rows, { onConflict: "platform,flow_id" });
      if (error) throw new Error(`Flow upsert: ${error.message}`);
      flowRows = rows.length;
    }

    return NextResponse.json({
      success: true,
      results: { campaigns: campaignRows, flows: flowRows },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
