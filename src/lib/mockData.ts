// Placeholder data shown to Tester-role users. Realistic-looking but entirely fake.

export const MOCK_KPI = {
  revenue: 48_250.0,
  revenuePrev: 43_120.0,
  orders: 342,
  ordersPrev: 316,
  aov: 141.08,
  aovPrev: 136.45,
  newCustomers: 87,
  newCustomersPrev: 74,
};

export const MOCK_REVENUE_CHART = Array.from({ length: 30 }, (_, i) => {
  const date = new Date("2026-06-15");
  date.setDate(date.getDate() + i);
  return {
    date: date.toISOString().split("T")[0],
    revenue: 1_200 + Math.round(Math.sin(i / 3) * 400 + Math.random() * 300),
    orders: 10 + Math.round(Math.random() * 8),
  };
});

export const MOCK_RECENT_ORDERS = [
  { id: "ORD-8821", customer: "Emily Carter", total: 189.99, status: "fulfilled", created_at: "2026-07-14" },
  { id: "ORD-8820", customer: "James Whitfield", total: 64.50, status: "processing", created_at: "2026-07-14" },
  { id: "ORD-8819", customer: "Sophia Nguyen", total: 312.00, status: "fulfilled", created_at: "2026-07-13" },
  { id: "ORD-8818", customer: "Marcus Webb", total: 97.30, status: "fulfilled", created_at: "2026-07-13" },
  { id: "ORD-8817", customer: "Laura Chen", total: 225.75, status: "cancelled", created_at: "2026-07-12" },
];

export const MOCK_GOOGLE_STATS = {
  connected: true,
  account: {
    spend: 6_840.50,
    impressions: 284_200,
    clicks: 9_640,
    ctr: 3.39,
    avgCpc: 0.71,
    conversions: 142,
    conversionValue: 21_300,
    costPerConv: 48.17,
    roas: 3.11,
  },
  prevAccount: {
    spend: 6_120.80,
    impressions: 258_400,
    clicks: 8_750,
    ctr: 3.39,
    avgCpc: 0.70,
    conversions: 128,
    conversionValue: 19_200,
    costPerConv: 47.82,
    roas: 3.13,
  },
  campaigns: [
    { id: "1", name: "Brand – Search", status: "ENABLED", channelType: "SEARCH", spend: 1_820, impressions: 62_000, clicks: 3_100, ctr: 5.0, avgCpc: 0.59, conversions: 62, convValue: 9_300, costPerConv: 29.35, roas: 5.11 },
    { id: "2", name: "Shopping – All Products", status: "ENABLED", channelType: "SHOPPING", spend: 2_400, impressions: 98_000, clicks: 3_920, ctr: 4.0, avgCpc: 0.61, conversions: 48, convValue: 7_200, costPerConv: 50.0, roas: 3.0 },
    { id: "3", name: "Retargeting – Display", status: "ENABLED", channelType: "DISPLAY", spend: 1_100, impressions: 124_200, clicks: 1_860, ctr: 1.5, avgCpc: 0.59, conversions: 22, convValue: 3_300, costPerConv: 50.0, roas: 3.0 },
    { id: "4", name: "YouTube – Awareness", status: "PAUSED", channelType: "VIDEO", spend: 820, impressions: 48_000, clicks: 960, ctr: 2.0, avgCpc: 0.85, conversions: 8, convValue: 1_200, costPerConv: 102.5, roas: 1.46 },
  ],
  daily: Array.from({ length: 30 }, (_, i) => {
    const date = new Date("2026-06-15");
    date.setDate(date.getDate() + i);
    return {
      date: date.toISOString().split("T")[0],
      spend: 180 + Math.round(Math.sin(i / 4) * 60 + Math.random() * 40),
      impressions: 8_000 + Math.round(Math.random() * 3_000),
      clicks: 290 + Math.round(Math.random() * 80),
      conversions: 4 + Math.round(Math.random() * 3),
    };
  }),
};

export const MOCK_SHOPIFY_STATS = {
  revenue: 41_200,
  orders: 298,
  aov: 138.26,
  returnRate: 4.2,
  topProducts: [
    { name: "Classic Tee — White", sku: "CT-WH-M", sold: 84, revenue: 5_040 },
    { name: "Hoodie — Navy", sku: "HD-NV-L", sold: 62, revenue: 7_440 },
    { name: "Cap — Black", sku: "CP-BK-OS", sold: 118, revenue: 3_540 },
    { name: "Shorts — Olive", sku: "SH-OL-M", sold: 47, revenue: 3_760 },
  ],
};

export const MOCK_META_STATS = {
  connected: true,
  spend: 4_210.30,
  impressions: 512_800,
  clicks: 18_460,
  ctr: 3.6,
  cpc: 0.23,
  conversions: 168,
  roas: 4.2,
  campaigns: [
    { name: "TOF – Video Views", status: "ACTIVE", spend: 1_420, impressions: 210_000, clicks: 7_560, conversions: 48, roas: 3.4 },
    { name: "MOF – Engagement", status: "ACTIVE", spend: 980, impressions: 148_000, clicks: 5_920, conversions: 42, roas: 4.5 },
    { name: "BOF – Retarget", status: "ACTIVE", spend: 1_810, impressions: 154_800, clicks: 4_980, conversions: 78, roas: 5.1 },
  ],
};

export const MOCK_ANALYTICS = {
  mer: 6.2,
  roas: 3.8,
  netProfit: 12_480,
  netProfitMargin: 25.9,
  cac: 42.30,
  ltv: 312.0,
  blendedCpa: 38.50,
};

export const MOCK_CUSTOMERS = {
  total: 1_842,
  newThisMonth: 87,
  returning: 412,
  churnRate: 3.2,
  topSpenders: [
    { name: "Emily Carter", email: "e.carter@example.com", spent: 2_480, orders: 14 },
    { name: "James Whitfield", email: "j.whitfield@example.com", spent: 1_950, orders: 11 },
    { name: "Sophia Nguyen", email: "s.nguyen@example.com", spent: 1_720, orders: 9 },
  ],
};
