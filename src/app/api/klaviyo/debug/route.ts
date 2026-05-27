import { NextResponse } from "next/server";

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

export async function GET() {
  const results: Record<string, any> = {};

  // 1. Get conversion metric ID
  let conversionMetricId = "";
  try {
    const r = await fetch(`${KLAVIYO_BASE}/metrics/`, { headers: headers() });
    const body = await r.json();
    const metrics: any[] = body.data ?? [];
    const found = metrics.find((m: any) =>
      ["Placed Order", "Ordered Product", "Order Purchased", "Order Processed"].includes(m.attributes?.name)
    );
    conversionMetricId = found?.id ?? metrics[0]?.id ?? "";
    results.conversion_metric_id = conversionMetricId;
    results.conversion_metric_name = found?.attributes?.name ?? "not found";
  } catch (e: any) {
    results.metrics_error = e.message;
  }

  // 2. Campaign report with conversion metric
  try {
    const r = await fetch(`${KLAVIYO_BASE}/campaign-values-reports/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        data: {
          type: "campaign-values-report",
          attributes: {
            timeframe: { key: "last_12_months" },
            conversion_metric_id: conversionMetricId,
            statistics: ["delivered", "opens", "clicks", "open_rate", "click_rate", "recipients"],
          },
        },
      }),
    });
    const body = await r.json();
    results.campaign_report_status = r.status;
    results.campaign_result_count = body.data?.attributes?.results?.length ?? 0;
    results.campaign_first_result = body.data?.attributes?.results?.[0] ?? null;
    results.campaign_errors = body.errors ?? null;
  } catch (e: any) {
    results.campaign_error = e.message;
  }

  // 3. Flow report with conversion metric
  try {
    const r = await fetch(`${KLAVIYO_BASE}/flow-values-reports/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        data: {
          type: "flow-values-report",
          attributes: {
            timeframe: { key: "last_12_months" },
            conversion_metric_id: conversionMetricId,
            statistics: ["delivered", "opens", "clicks", "open_rate", "click_rate", "recipients"],
          },
        },
      }),
    });
    const body = await r.json();
    results.flow_report_status = r.status;
    results.flow_result_count = body.data?.attributes?.results?.length ?? 0;
    results.flow_first_result = body.data?.attributes?.results?.[0] ?? null;
    results.flow_errors = body.errors ?? null;
  } catch (e: any) {
    results.flow_error = e.message;
  }

  return NextResponse.json(results, { status: 200 });
}
