const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const REVISION = "2024-10-15";

function headers() {
  return {
    Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`,
    revision: REVISION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function kGet(path: string) {
  const res = await fetch(`${KLAVIYO_BASE}${path}`, { headers: headers() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo ${res.status}: ${err}`);
  }
  return res.json();
}

async function kPost(path: string, body: object) {
  const res = await fetch(`${KLAVIYO_BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo ${res.status}: ${err}`);
  }
  return res.json();
}

async function kPatch(path: string, body: object) {
  const res = await fetch(`${KLAVIYO_BASE}${path}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo PATCH ${res.status}: ${err}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

// ─── Campaigns ────────────────────────────────────────────────────────────────
export async function getCampaigns() {
  const data = await kGet(
    "/campaigns/?filter=equals(messages.channel,'email')&sort=-created_at"
  );
  return data.data ?? [];
}

// ─── Conversion metric ID (required by Klaviyo reporting endpoints) ───────────
async function getConversionMetricId(): Promise<string> {
  const data = await kGet("/metrics/");
  const metrics: any[] = data.data ?? [];
  const priority = ["Placed Order", "Ordered Product", "Order Purchased", "Order Processed"];
  for (const name of priority) {
    const found = metrics.find((m: any) => m.attributes?.name === name);
    if (found) return found.id;
  }
  // Fall back to first metric
  return metrics[0]?.id ?? "";
}

// ─── Campaign metrics — one single batch call ─────────────────────────────────
// Returns a map of campaign_id -> statistics object
export async function getCampaignMetricsMap(): Promise<Record<string, any>> {
  try {
    const conversionMetricId = await getConversionMetricId();
    const body = {
      data: {
        type: "campaign-values-report",
        attributes: {
          timeframe: { key: "last_12_months" },
          conversion_metric_id: conversionMetricId,
          statistics: [
            "delivered",
            "opens",
            "opens_unique",
            "clicks",
            "clicks_unique",
            "open_rate",
            "click_rate",
            "recipients",
            "unsubscribes",
            "bounced",
            "delivery_rate",
          ],
        },
      },
    };
    const data = await kPost("/campaign-values-reports/", body);
    const results: any[] = data.data?.attributes?.results ?? [];

    const map: Record<string, any> = {};
    for (const row of results) {
      // API returns campaign_id at top level OR nested under groupings
      const id = row.campaign_id ?? row.groupings?.campaign_id;
      if (id) {
        map[id] = row.statistics ?? row;
      }
    }
    return map;
  } catch (e: any) {
    console.error("getCampaignMetricsMap error:", e.message);
    return {};
  }
}

// ─── Lists ────────────────────────────────────────────────────────────────────
export async function getLists() {
  const data = await kGet("/lists/");
  return data.data ?? [];
}

export async function getTemplates() {
  const data = await kGet("/templates/?sort=-created");
  return data.data ?? [];
}

export async function getMetricsSummary() {
  const data = await kGet("/metrics/");
  return data.data ?? [];
}

// ─── Flows ───────────────────────────────────────────────────────────────────
export async function getLiveFlows() {
  const data = await kGet(
    "/flows/?filter=equals(status,'live')&fields[flow]=name,status,trigger_type,created,updated"
  );
  return data.data ?? [];
}

// Returns a map of flow_id -> aggregated statistics (summed across messages)
export async function getFlowMetricsMap(): Promise<Record<string, any>> {
  try {
    const conversionMetricId = await getConversionMetricId();
    const body = {
      data: {
        type: "flow-values-report",
        attributes: {
          timeframe: { key: "last_12_months" },
          conversion_metric_id: conversionMetricId,
          statistics: [
            "delivered",
            "opens",
            "opens_unique",
            "clicks",
            "clicks_unique",
            "open_rate",
            "click_rate",
            "recipients",
            "unsubscribes",
            "bounced",
            "delivery_rate",
          ],
        },
      },
    };
    const data = await kPost("/flow-values-reports/", body);
    const results: any[] = data.data?.attributes?.results ?? [];

    // Results are per-message; aggregate up to flow level
    const map: Record<string, any> = {};
    for (const row of results) {
      const id = row.flow_id ?? row.groupings?.flow_id;
      const stats = row.statistics ?? row;
      if (!id) continue;

      if (!map[id]) {
        map[id] = {
          delivered: 0, opens: 0, clicks: 0,
          opens_unique: 0, clicks_unique: 0,
          recipients: 0, unsubscribes: 0, bounced: 0,
          _open_rate_sum: 0, _click_rate_sum: 0, _count: 0,
        };
      }
      const m = map[id];
      m.delivered   += Number(stats.delivered   ?? 0);
      m.opens       += Number(stats.opens       ?? 0);
      m.clicks      += Number(stats.clicks      ?? 0);
      m.opens_unique+= Number(stats.opens_unique?? 0);
      m.clicks_unique+=Number(stats.clicks_unique??0);
      m.recipients  += Number(stats.recipients  ?? 0);
      m.unsubscribes+= Number(stats.unsubscribes?? 0);
      m.bounced     += Number(stats.bounced     ?? 0);
      m._open_rate_sum  += Number(stats.open_rate  ?? 0);
      m._click_rate_sum += Number(stats.click_rate ?? 0);
      m._count++;
    }

    // Finalise rates
    for (const id of Object.keys(map)) {
      const m = map[id];
      m.open_rate  = m._count > 0 ? m._open_rate_sum  / m._count : (m.delivered > 0 ? m.opens  / m.delivered : 0);
      m.click_rate = m._count > 0 ? m._click_rate_sum / m._count : (m.delivered > 0 ? m.clicks / m.delivered : 0);
      delete m._open_rate_sum; delete m._click_rate_sum; delete m._count;
    }
    return map;
  } catch (e: any) {
    console.error("getFlowMetricsMap error:", e.message);
    return {};
  }
}

// ─── Create template ─────────────────────────────────────────────────────────
export async function createTemplate(params: {
  name: string;
  html: string;
  text?: string;
}): Promise<string> {
  const resp = await kPost("/templates/", {
    data: {
      type: "template",
      attributes: {
        name: params.name,
        editor_type: "CODE",
        html: params.html,
        text: params.text ?? "",
      },
    },
  });
  return resp.data.id as string;
}

// ─── Create campaign ──────────────────────────────────────────────────────────
export async function createCampaign(params: {
  name: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  listId: string;
  html?: string;          // If provided, creates a Klaviyo template and links it to the message
  previewText?: string;
  scheduledAt?: string;
}): Promise<{ campaignId: string; templateId?: string }> {
  // 1. Create standalone Klaviyo template from HTML (if provided)
  let templateId: string | undefined;
  if (params.html) {
    templateId = await createTemplate({
      name: params.name,
      html: params.html,
      text: `${params.subject}\n\nUnsubscribe: {{ unsubscribe_url }}`,
    });
  }

  const content: Record<string, unknown> = {
    subject:        params.subject,
    reply_to_email: params.fromEmail,
    from_email:     params.fromEmail,
    from_label:     params.fromName,
  };
  if (params.previewText) content.preview_text = params.previewText;

  // 2. Create the campaign shell with an inline campaign-message.
  //    NOTE: Klaviyo rejects 'template' as an inline relationship on creation
  //    ("not an allowed relation on campaign-messages resource"). Template linking
  //    is done in a separate PATCH after creation (step 3 below).
  const inlineMessage = {
    type: "campaign-message",
    attributes: { channel: "email", label: params.name, content },
  };

  const campaign = await kPost("/campaigns/", {
    data: {
      type: "campaign",
      attributes: {
        name: params.name,
        audiences: { included: [params.listId], excluded: [] },
        send_options: { use_smart_sending: true },
        tracking_options: { add_tracking_params: true },
        "campaign-messages": { data: [inlineMessage] },
      },
    },
  });

  const campaignId = campaign.data.id as string;

  // 3. Assign the template to the campaign-message.
  //    The POST /campaigns/ response does NOT include campaign-message IDs in its
  //    relationships.data array (only links). We do a separate GET to get the ID
  //    reliably, then POST to the assign-template sub-resource.
  //
  //    Klaviyo clones the reusable template and attaches the non-reusable clone
  //    to the message — this is the only officially-supported assignment method.
  //    (PATCH /campaign-messages/{id}/ with relationships.template silently fails
  //    and PATCH /campaign-messages/{id}/relationships/template/ is not a real endpoint.)
  if (templateId) {
    try {
      const msgResp  = await kGet(`/campaigns/${campaignId}/campaign-messages/`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageId = (msgResp.data as any[])?.[0]?.id as string | undefined;

      if (messageId) {
        await kPost(`/campaign-messages/${messageId}/assign-template/`, {
          data: {
            type: "campaign-message",
            id: messageId,
            relationships: {
              template: { data: { type: "template", id: templateId } },
            },
          },
        });
        console.log(`[klaviyo] ✓ Template ${templateId} assigned to message ${messageId}`);
      } else {
        console.warn(`[klaviyo] Campaign ${campaignId} returned no campaign-messages`);
      }
    } catch (e: unknown) {
      // Non-fatal — both Klaviyo objects exist; log and continue
      console.error(`[klaviyo] Template assign failed (campaign still created):`, e);
    }
  }

  // 4. Schedule if requested
  if (params.scheduledAt) {
    await kPost(`/campaign-send-jobs/`, {
      data: {
        type: "campaign-send-job",
        attributes: { scheduled_at: params.scheduledAt },
        relationships: {
          campaign: { data: { type: "campaign", id: campaignId } },
        },
      },
    });
  }

  return { campaignId, templateId };
}
