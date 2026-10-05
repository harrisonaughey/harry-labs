import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStores } from "@/lib/stores";

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type Delim = "tab" | "semicolon" | "comma";

function detectDelimiter(line: string): Delim {
  if (line.includes("\t"))  return "tab";
  if (line.includes(";"))   return "semicolon";
  return "comma";
}

function parseRow(line: string, delim: Delim): string[] {
  const sep = delim === "tab" ? "\t" : delim === "semicolon" ? ";" : ",";
  const cols: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === sep && !inQ) { cols.push(cur.trim().replace(/^"|"$/g, "")); cur = ""; }
    else { cur += ch; }
  }
  cols.push(cur.trim().replace(/^"|"$/g, ""));
  return cols;
}

function money(raw: string): number {
  if (!raw || raw === "-" || raw === "N/A") return 0;
  return parseFloat(raw.replace(/[^0-9.\-]/g, "")) || 0;
}

function num(raw: string): number {
  if (!raw || raw === "-" || raw === "N/A") return 0;
  return parseInt(raw.replace(/[^0-9]/g, ""), 10) || 0;
}

// ── Format detection ───────────────────────────────────────────────────────────
type ReportFormat = "sellerboard_dashboard" | "sellerboard_profit" | "sellerboard_orders" | "amazon_business" | "unknown";

function detectFormat(headers: string[]): ReportFormat {
  const raw = headers.map((x) => x.trim());
  const hasExact = (...terms: string[]) => terms.some((t) => raw.includes(t));
  const hasLower = (...terms: string[]) => terms.some((t) => raw.some((h) => h.toLowerCase().includes(t)));

  // Sellerboard "Dashboard by month" — semicolon-delimited, camelCase headers
  if (hasExact("SalesOrganic", "SalesPPC", "NetProfit")) return "sellerboard_dashboard";
  // Sellerboard profit/summary report (space-separated headers)
  if (hasLower("net profit", "net margin") && hasLower("amazon fees", "fba fees", "ppc")) return "sellerboard_profit";
  // Sellerboard orders report
  if (hasLower("order id") && hasLower("profit") && hasLower("asin")) return "sellerboard_orders";
  // Amazon Seller Central Business Report (ASIN detail page)
  if (hasLower("sessions") && hasLower("buy box") && hasLower("ordered product sales")) return "amazon_business";

  return "unknown";
}

// ── Sellerboard Profit report column map (space-separated legacy) ─────────────
const SB_MAP: Record<string, string> = {
  "date":             "report_date",
  "orders":           "orders",
  "units":            "units",
  "revenue":          "revenue",
  "sales":            "revenue",
  "refunds":          "refunds",
  "amazon fees":      "amazon_fees",
  "referral fee":     "amazon_fees",
  "fba fees":         "fba_fees",
  "fba fee":          "fba_fees",
  "fulfilment fee":   "fba_fees",
  "fulfillment fee":  "fba_fees",
  "ppc spend":        "ppc_spend",
  "ppc":              "ppc_spend",
  "advertising":      "ppc_spend",
  "ad spend":         "ppc_spend",
  "cogs":             "cogs",
  "cost of goods":    "cogs",
  "other costs":      "other_costs",
  "other":            "other_costs",
  "net profit":       "net_profit",
  "profit":           "net_profit",
};

// ── Amazon Business Report column map ─────────────────────────────────────────
const BIZ_MAP: Record<string, string> = {
  "asin":                   "asin",
  "title":                  "title",
  "units ordered":          "units",
  "total order items":      "orders",
  "ordered product sales":  "revenue",
  "sessions":               "sessions",
  "buy box percentage":     "buy_box_pct",
  "unit session percentage":"conv_pct",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File;
    const monthRaw = formData.get("month") as string;

    if (!file || !monthRaw) {
      return NextResponse.json({ error: "file and month are required" }, { status: 400 });
    }

    const text   = await file.text();
    const lines  = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return NextResponse.json({ error: "File appears empty." }, { status: 400 });
    }

    const delim      = detectDelimiter(lines[0]);
    const rawHeaders = parseRow(lines[0], delim);
    const headers    = rawHeaders.map((h) => h.toLowerCase().trim());
    const format     = detectFormat(rawHeaders);

    if (format === "unknown") {
      return NextResponse.json({
        error: "Unrecognised file format. Export a Sellerboard 'Dashboard by month' report or an Amazon Business Report (ASIN detail page).",
        detectedHeaders: rawHeaders.slice(0, 8),
      }, { status: 400 });
    }

    const stores  = await getStores();
    const storeId = stores[0]?.id ?? "default";
    const sb      = svc();

    const rows: Record<string, unknown>[] = [];
    let skipped = 0;

    if (format === "sellerboard_dashboard") {
      // Sellerboard "Dashboard by month" — semicolon-delimited, camelCase columns
      // Revenue = SalesOrganic + SalesPPC; costs stored as negatives → Math.abs
      const idx: Record<string, number> = {};
      rawHeaders.forEach((h, i) => { idx[h.trim()] = i; });

      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i], delim);
        if (cols.length < 5) { skipped++; continue; }

        const g = (col: string) => cols[idx[col]] ?? "";
        const salesOrganic = money(g("SalesOrganic"));
        const salesPpc     = money(g("SalesPPC"));
        const revenue      = salesOrganic + salesPpc;
        if (revenue === 0) { skipped++; continue; }

        rows.push({
          store_id:    storeId,
          month:       monthRaw,
          report_date: g("DateFrom") || null,
          revenue,
          units:       (num(g("UnitsOrganic")) + num(g("UnitsPPC"))),
          orders:      num(g("Orders")),
          amazon_fees: Math.abs(money(g("AmazonFees"))),
          fba_fees:    Math.abs(money(g("Shipping"))),
          ppc_spend:   Math.abs(money(g("SponsoredProducts"))) + Math.abs(money(g("SponsoredBrandsVideo"))),
          cogs:        Math.abs(money(g("Cost of Goods"))),
          other_costs: Math.abs(money(g("Expenses"))),
          refunds:     Math.abs(money(g("RefundCost"))),
          net_profit:  money(g("NetProfit")),
          source:      "sellerboard",
          raw_row:     { headers: rawHeaders, values: cols },
        });
      }
    } else if (format === "sellerboard_profit") {
      // Sellerboard legacy profit/summary report (tab or comma, space-separated headers)
      const colIdx: Record<string, number> = {};
      headers.forEach((h, i) => {
        for (const [key, field] of Object.entries(SB_MAP)) {
          if (h.includes(key) && !(field in colIdx)) colIdx[field] = i;
        }
      });

      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i], delim);
        if (cols.length < 3) { skipped++; continue; }

        const revenue = colIdx.revenue !== undefined ? money(cols[colIdx.revenue]) : 0;
        if (revenue === 0 && !cols.some((c) => c.trim())) { skipped++; continue; }

        rows.push({
          store_id:    storeId,
          month:       monthRaw,
          report_date: colIdx.report_date !== undefined ? cols[colIdx.report_date] || null : null,
          revenue,
          units:       colIdx.units       !== undefined ? num(cols[colIdx.units])       : 0,
          orders:      colIdx.orders      !== undefined ? num(cols[colIdx.orders])      : 0,
          amazon_fees: colIdx.amazon_fees !== undefined ? money(cols[colIdx.amazon_fees]) : 0,
          fba_fees:    colIdx.fba_fees    !== undefined ? money(cols[colIdx.fba_fees])    : 0,
          ppc_spend:   colIdx.ppc_spend   !== undefined ? money(cols[colIdx.ppc_spend])   : 0,
          cogs:        colIdx.cogs        !== undefined ? money(cols[colIdx.cogs])        : 0,
          other_costs: colIdx.other_costs !== undefined ? money(cols[colIdx.other_costs]) : 0,
          refunds:     colIdx.refunds     !== undefined ? money(cols[colIdx.refunds])     : 0,
          net_profit:  colIdx.net_profit  !== undefined ? money(cols[colIdx.net_profit])  : 0,
          source:      "sellerboard",
          raw_row:     { headers: rawHeaders, values: cols },
        });
      }
    } else if (format === "amazon_business") {
      // Store as ASIN-level rows, aggregate for summary
      const colIdx: Record<string, number> = {};
      headers.forEach((h, i) => {
        for (const [key, field] of Object.entries(BIZ_MAP)) {
          if (h.includes(key) && !(field in colIdx)) colIdx[field] = i;
        }
      });

      const aggregated = { revenue: 0, units: 0, orders: 0 };

      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i], delim);
        if (cols.length < 3) { skipped++; continue; }

        const revenue = colIdx.revenue !== undefined ? money(cols[colIdx.revenue]) : 0;
        if (revenue === 0) { skipped++; continue; }

        aggregated.revenue += revenue;
        aggregated.units   += colIdx.units  !== undefined ? num(cols[colIdx.units])  : 0;
        aggregated.orders  += colIdx.orders !== undefined ? num(cols[colIdx.orders]) : 0;
      }

      if (aggregated.revenue > 0) {
        rows.push({
          store_id:   storeId,
          month:      monthRaw,
          revenue:    aggregated.revenue,
          units:      aggregated.units,
          orders:     aggregated.orders,
          source:     "amazon_business_report",
        });
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({
        error: "No data rows found in this file.",
        skipped,
        format,
      }, { status: 400 });
    }

    // Replace existing uploaded data for this month
    await sb.from("amazon_pl")
      .delete()
      .eq("store_id", storeId)
      .eq("month", monthRaw)
      .in("source", ["sellerboard", "amazon_business_report"]);

    const { data: inserted, error } = await sb.from("amazon_pl").insert(rows).select();
    if (error) throw new Error(error.message);

    const totalRevenue = rows.reduce((s, r) => s + ((r.revenue as number) || 0), 0);
    const totalProfit  = rows.reduce((s, r) => s + ((r.net_profit as number) || 0), 0);
    const totalSpend   = rows.reduce((s, r) => s + ((r.ppc_spend as number) || 0), 0);

    return NextResponse.json({
      imported: inserted?.length ?? 0,
      skipped,
      format,
      totalRevenue,
      totalProfit,
      totalSpend,
      month: monthRaw,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
