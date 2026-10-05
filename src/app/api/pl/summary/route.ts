import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStores } from "@/lib/stores";
import { getAmazonMonthData } from "@/lib/amazon";

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });

  const [year, m] = month.split("-").map(Number);
  const since = `${month}-01`;
  const lastDay = new Date(year, m, 0).getDate();
  const until = `${month}-${String(lastDay).padStart(2, "0")}`;

  try {
    const stores  = await getStores();
    const storeId = stores[0]?.id;
    const supabase = svc();

    // Revenue from Shopify orders + Amazon (parallel fetch)
    let orderQ = supabase
      .from("orders")
      .select("total_price, financial_status")
      .gte("created_at", `${since}T00:00:00.000Z`)
      .lte("created_at", `${until}T23:59:59.999Z`);
    if (storeId) orderQ = orderQ.eq("store_id", storeId);

    const [{ data: orders }, amz] = await Promise.all([
      orderQ,
      getAmazonMonthData(storeId ?? "default", month),
    ]);

    const allOrders   = orders ?? [];
    const shopifyRev  = allOrders.reduce((s, o) => s + (parseFloat(String(o.total_price)) || 0), 0);
    const shopifyRef  = allOrders
      .filter((o) => o.financial_status === "refunded" || o.financial_status === "partially_refunded")
      .reduce((s, o) => s + (parseFloat(String(o.total_price)) || 0), 0);

    // Combine channels
    const grossRev   = shopifyRev + amz.revenue;
    const refundsRev = shopifyRef + amz.refunds;
    const netRevenue = grossRev - refundsRev;

    // Bank transactions for the month grouped by category
    const { data: txns } = await supabase
      .from("bank_transactions")
      .select("amount, category_id, pl_categories(id, name, pl_section, color, sort_order)")
      .eq("store_id", storeId ?? "default")
      .eq("month", month);

    const allTxns = txns ?? [];

    // Aggregate by category
    const byCategory: Record<string, { name: string; pl_section: string; color: string; sort_order: number; total: number }> = {};
    let uncategorisedTotal = 0;
    let uncategorisedCount = 0;

    for (const t of allTxns) {
      const cat = (t as any).pl_categories;
      const amt = Math.abs(parseFloat(String(t.amount)) || 0); // expenses are stored negative
      if (cat) {
        const key = cat.id;
        if (!byCategory[key]) {
          byCategory[key] = { name: cat.name, pl_section: cat.pl_section, color: cat.color, sort_order: cat.sort_order, total: 0 };
        }
        byCategory[key].total += amt;
      } else {
        uncategorisedTotal += amt;
        uncategorisedCount++;
      }
    }

    const categories = Object.values(byCategory).sort((a, b) => a.sort_order - b.sort_order);

    const sum = (section: string) => categories.filter((c) => c.pl_section === section).reduce((s, c) => s + c.total, 0);

    // Amazon costs folded into the right P&L buckets
    const cogs         = sum("cogs")         + amz.cogs;
    const grossProfit  = netRevenue - cogs;
    const marketing    = sum("marketing")    + amz.ppc_spend;
    const merchantFees = sum("merchant_fees") + amz.amazon_fees + amz.fba_fees;
    const wages        = sum("wages");
    const shipping     = sum("shipping");
    const software     = sum("software");
    const otherOpex    = sum("other_opex")   + amz.other_costs;
    const totalOpex    = marketing + merchantFees + wages + shipping + software + otherOpex + uncategorisedTotal;
    const ebitda       = grossProfit - totalOpex;

    return NextResponse.json({
      month,
      since,
      until,
      grossRevenue:    grossRev,
      shopifyRevenue:  shopifyRev,
      amazonRevenue:   amz.revenue,
      refunds:         refundsRev,
      netRevenue,
      cogs,
      grossProfit,
      grossMarginPct:  netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0,
      opex: { marketing, merchantFees, wages, shipping, software, otherOpex },
      totalOpex,
      ebitda,
      ebitdaPct:       netRevenue > 0 ? (ebitda / netRevenue) * 100 : 0,
      categories,
      uncategorisedTotal,
      uncategorisedCount,
      txnCount: allTxns.length,
      amazon: amz.hasData ? {
        revenue:    amz.revenue,
        orders:     amz.orders,
        units:      amz.units,
        ppcSpend:   amz.ppc_spend,
        amazonFees: amz.amazon_fees,
        fbaFees:    amz.fba_fees,
        cogs:       amz.cogs,
        refunds:    amz.refunds,
        netProfit:  amz.net_profit,
      } : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
