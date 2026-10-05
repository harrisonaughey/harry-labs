import { createClient } from "@supabase/supabase-js";

const SP_API_BASE = "https://sellingpartnerapi-fe.amazon.com";

// ── amazon_pl table helpers ────────────────────────────────────────────────────

function svcClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type AmazonMonthSummary = {
  revenue:     number;
  orders:      number;
  units:       number;
  amazon_fees: number;
  fba_fees:    number;
  ppc_spend:   number;
  cogs:        number;
  other_costs: number;
  refunds:     number;
  net_profit:  number;
  hasData:     boolean;
};

function summariseRows(rows: Record<string, unknown>[]): AmazonMonthSummary {
  const get = (f: string) => rows.reduce((s, r) => s + (parseFloat(String(r[f])) || 0), 0);
  return {
    revenue:     get("revenue"),
    orders:      rows.reduce((s, r) => s + (parseInt(String(r.orders), 10) || 0), 0),
    units:       rows.reduce((s, r) => s + (parseInt(String(r.units), 10) || 0), 0),
    amazon_fees: get("amazon_fees"),
    fba_fees:    get("fba_fees"),
    ppc_spend:   get("ppc_spend"),
    cogs:        get("cogs"),
    other_costs: get("other_costs"),
    refunds:     get("refunds"),
    net_profit:  get("net_profit"),
    hasData:     rows.length > 0,
  };
}

export async function getAmazonMonthData(storeId: string, month: string): Promise<AmazonMonthSummary> {
  const { data } = await svcClient()
    .from("amazon_pl")
    .select("*")
    .eq("store_id", storeId)
    .eq("month", month);
  return summariseRows((data ?? []) as Record<string, unknown>[]);
}

export async function getAmazonMonthsData(
  storeId: string,
  months: string[]
): Promise<Record<string, AmazonMonthSummary>> {
  if (months.length === 0) return {};
  const { data } = await svcClient()
    .from("amazon_pl")
    .select("*")
    .eq("store_id", storeId)
    .in("month", months);

  const grouped: Record<string, Record<string, unknown>[]> = {};
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const m = r.month as string;
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(r);
  }
  const result: Record<string, AmazonMonthSummary> = {};
  for (const m of months) result[m] = summariseRows(grouped[m] ?? []);
  return result;
}
const ADS_API_BASE = "https://advertising-api-fe.amazon.com";

export function isAmazonConnected(): boolean {
  return !!(
    process.env.AMAZON_SELLER_ID &&
    process.env.AMAZON_MWS_TOKEN &&
    process.env.AMAZON_CLIENT_ID &&
    process.env.AMAZON_CLIENT_SECRET
  );
}

export const AMAZON_MARKETPLACE_ID =
  process.env.AMAZON_MARKETPLACE_ID || "A39IBJ37TRP1C6";

// ── LWA token exchange ─────────────────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

export async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry - 60_000) return _cachedToken;

  const resp = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: process.env.AMAZON_MWS_TOKEN!,
      client_id:     process.env.AMAZON_CLIENT_ID!,
      client_secret: process.env.AMAZON_CLIENT_SECRET!,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LWA token exchange failed: ${resp.status} — ${text}`);
  }

  const json = await resp.json();
  _cachedToken = json.access_token as string;
  _tokenExpiry = Date.now() + (json.expires_in as number) * 1000;
  return _cachedToken;
}

// ── SP-API request helper ──────────────────────────────────────────────────────
async function spRequest<T = unknown>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const token = await getAccessToken();
  const qs    = new URLSearchParams(params).toString();
  const url   = `${SP_API_BASE}${path}${qs ? "?" + qs : ""}`;

  const resp = await fetch(url, {
    headers: {
      "x-amz-access-token": token,
      "Content-Type":       "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SP-API ${path} failed: ${resp.status} — ${text}`);
  }

  return resp.json() as Promise<T>;
}

// ── Orders ─────────────────────────────────────────────────────────────────────
export interface SpOrder {
  AmazonOrderId:       string;
  PurchaseDate:        string;
  OrderStatus:         string;
  OrderTotal?:         { Amount: string; CurrencyCode: string };
  NumberOfItemsShipped: number;
}

export async function getOrders(
  startDate: string,
  endDate:   string
): Promise<SpOrder[]> {
  const orders: SpOrder[] = [];
  let nextToken: string | undefined;

  do {
    const params: Record<string, string> = {
      MarketplaceIds: AMAZON_MARKETPLACE_ID,
      CreatedAfter:   startDate,
      CreatedBefore:  endDate,
      OrderStatuses:  "Unshipped,PartiallyShipped,Shipped,Delivered",
    };
    if (nextToken) params.NextToken = nextToken;

    const data = await spRequest<any>("/orders/v0/orders", params);
    orders.push(...(data.payload?.Orders ?? []));
    nextToken = data.payload?.NextToken;
  } while (nextToken);

  return orders;
}

// ── Order summary for a month ──────────────────────────────────────────────────
export async function getMonthOrderSummary(monthStr: string) {
  const [y, m]  = monthStr.split("-").map(Number);
  const start   = `${monthStr}-01T00:00:00Z`;
  const lastDay = new Date(y, m, 0).getDate();
  const end     = `${monthStr}-${String(lastDay).padStart(2, "0")}T23:59:59Z`;

  const orders  = await getOrders(start, end);
  const shipped = orders.filter((o) => o.OrderStatus !== "Canceled");

  const revenue = shipped.reduce((sum, o) => {
    return sum + (parseFloat(o.OrderTotal?.Amount ?? "0") || 0);
  }, 0);

  return {
    orders:  shipped.length,
    revenue,
    units:   shipped.reduce((s, o) => s + (o.NumberOfItemsShipped || 0), 0),
  };
}

// ── FBA Inventory ──────────────────────────────────────────────────────────────
export interface FbaItem {
  asin:              string;
  fnSku:             string;
  sellerSku:         string;
  condition:         string;
  inventoryDetails?: {
    fulfillableQuantity:        number;
    inboundWorkingQuantity:     number;
    inboundShippedQuantity:     number;
    inboundReceivingQuantity:   number;
  };
  lastUpdatedTime: string;
  productName:     string;
  totalQuantity:   number;
}

export async function getFbaInventory(): Promise<FbaItem[]> {
  const items: FbaItem[] = [];
  let nextToken: string | undefined;

  do {
    const params: Record<string, string> = {
      details:         "true",
      granularityType: "Marketplace",
      granularityId:   AMAZON_MARKETPLACE_ID,
      marketplaceIds:  AMAZON_MARKETPLACE_ID,
    };
    if (nextToken) params.nextToken = nextToken;

    const data = await spRequest<any>("/fba/inventory/v1/summaries", params);
    items.push(...(data.payload?.inventorySummaries ?? []));
    nextToken = data.payload?.pagination?.nextToken;
  } while (nextToken);

  return items;
}

// ── Advertising API ────────────────────────────────────────────────────────────
export const AMAZON_ADS_PROFILE_ID = "1832863987078536";

async function adsRequest<T = unknown>(
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getAccessToken();
  const resp  = await fetch(`${ADS_API_BASE}${path}`, {
    method:  body ? "POST" : "GET",
    headers: {
      "Authorization":          `Bearer ${token}`,
      "Amazon-Advertising-API-ClientId": process.env.AMAZON_CLIENT_ID!,
      "Amazon-Advertising-API-Scope":    AMAZON_ADS_PROFILE_ID,
      "Content-Type":           "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Ads API ${path} failed: ${resp.status} — ${text}`);
  }

  return resp.json() as Promise<T>;
}

export async function getAdsSummary(startDate: string, endDate: string) {
  try {
    const data = await adsRequest<any[]>("/v2/sp/campaigns", undefined);
    // Campaigns list — real spend pulled via reports; return campaign count for now
    return {
      campaigns:  (data ?? []).length,
      spend:      0,
      impressions: 0,
      clicks:     0,
      acos:       0,
    };
  } catch {
    return null;
  }
}
