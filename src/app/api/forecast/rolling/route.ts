import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStores } from "@/lib/stores";
import { getAmazonMonthsData } from "@/lib/amazon";

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export async function GET() {
  try {
    const stores  = await getStores();
    const storeId = stores[0]?.id ?? "default";
    const sb      = svc();

    const now  = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;

    // 12-month window: 3 months back → 8 months forward
    const window: { year: number; month: number; str: string }[] = [];
    for (let delta = -2; delta <= 9; delta++) {
      let m = curM + delta;
      let y = curY;
      while (m <= 0) { m += 12; y--; }
      while (m > 12) { m -= 12; y++; }
      window.push({ year: y, month: m, str: `${y}-${String(m).padStart(2, "0")}` });
    }

    const firstStr = window[0].str;
    const lastStr  = window[window.length - 1].str;

    // ── Expense actuals from bank_transactions ────────────────────────────────
    const { data: txns } = await sb
      .from("bank_transactions")
      .select("amount, month, pl_categories(pl_section)")
      .eq("store_id", storeId)
      .gte("month", firstStr)
      .lte("month", lastStr);

    const expByMonth: Record<string, Record<string, number>> = {};
    for (const t of txns ?? []) {
      const section = (t as any).pl_categories?.pl_section ?? "other_opex";
      const abs     = Math.abs(parseFloat(String(t.amount)) || 0);
      if (!expByMonth[t.month]) expByMonth[t.month] = {};
      expByMonth[t.month][section] = (expByMonth[t.month][section] ?? 0) + abs;
    }

    const uploadedMonths = Object.keys(expByMonth).sort();
    const last3          = uploadedMonths.slice(-3);

    const SECTIONS = ["cogs","marketing","merchant_fees","wages","shipping","software","other_opex"];
    const avgExp: Record<string, number> = {};
    if (last3.length > 0) {
      for (const s of SECTIONS) {
        avgExp[s] = last3.reduce((sum, m) => sum + (expByMonth[m]?.[s] ?? 0), 0) / last3.length;
      }
    }

    // ── Revenue baseline + month targets ──────────────────────────────────────
    const [{ data: blRow }, { data: targets }] = await Promise.all([
      sb.from("forecast_baselines").select("*").eq("store_id", storeId).single(),
      sb.from("forecast_month_targets").select("*").eq("store_id", storeId),
    ]);

    const baseRev   = (blRow as any)?.revenue_target ?? 0;
    const targetMap: Record<string, number> = {};
    for (const t of targets ?? []) {
      targetMap[`${(t as any).year}-${String((t as any).month).padStart(2, "0")}`] = (t as any).revenue_target ?? 0;
    }

    // ── Shopify + Amazon revenue actuals ─────────────────────────────────────
    const [, m1] = lastStr.split("-").map(Number);
    const [y1]   = lastStr.split("-").map(Number);
    const sinceTs = `${firstStr}-01T00:00:00.000Z`;
    const untilTs = `${lastStr}-${String(daysInMonth(y1, m1)).padStart(2, "0")}T23:59:59.999Z`;

    const windowMonths = window.map((w) => w.str);

    let ordQ = sb
      .from("orders")
      .select("total_price, created_at")
      .gte("created_at", sinceTs)
      .lte("created_at", untilTs);
    if (storeId !== "default") ordQ = ordQ.eq("store_id", storeId);

    const [{ data: orders }, amazonByMonth] = await Promise.all([
      ordQ,
      getAmazonMonthsData(storeId, windowMonths),
    ]);

    const revByMonth: Record<string, number> = {};
    for (const o of orders ?? []) {
      const mStr = (o.created_at as string).slice(0, 7);
      revByMonth[mStr] = (revByMonth[mStr] ?? 0) + (parseFloat(String(o.total_price)) || 0);
    }
    // Add Amazon revenue per month
    for (const [m, amz] of Object.entries(amazonByMonth)) {
      if (amz.hasData) revByMonth[m] = (revByMonth[m] ?? 0) + amz.revenue;
    }

    // ── Build rows ────────────────────────────────────────────────────────────
    const rows = window.map(({ year, month, str }) => {
      const dim        = daysInMonth(year, month);
      const hasExpData = !!expByMonth[str];
      const shopifyRev = revByMonth[str] ?? 0;
      const hasRevData = shopifyRev > 0;
      const isActual   = hasExpData && hasRevData;
      const isCurrent  = year === curY && month === curM;

      const targetRev   = targetMap[str] ?? 0;
      const forecastRev = targetRev > 0 ? targetRev : baseRev > 0 ? baseRev * (dim / 30) : 0;
      const revenue     = hasRevData ? shopifyRev : forecastRev;

      const src          = hasExpData ? expByMonth[str] : avgExp;
      const cogs         = src["cogs"]          ?? 0;
      const marketing    = src["marketing"]     ?? 0;
      const merchantFees = src["merchant_fees"] ?? 0;
      const wages        = src["wages"]         ?? 0;
      const shipping     = src["shipping"]      ?? 0;
      const software     = src["software"]      ?? 0;
      const otherOpex    = src["other_opex"]    ?? 0;
      const totalOpex    = marketing + merchantFees + wages + shipping + software + otherOpex;
      const grossProfit  = revenue - cogs;
      const ebitda       = grossProfit - totalOpex;

      return {
        month: str,
        label: `${MONTH_LABELS[month - 1]} ${year}`,
        isActual,
        isCurrent,
        hasExpData,
        hasRevData,
        days: dim,
        revenue,
        forecastRevenue: forecastRev,
        cogs,
        grossProfit,
        grossMarginPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
        opex: { marketing, merchantFees, wages, shipping, software, otherOpex },
        totalOpex,
        ebitda,
        ebitdaPct: revenue > 0 ? (ebitda / revenue) * 100 : 0,
      };
    });

    return NextResponse.json({
      rows,
      basedOnMonths:  last3,
      avgExpenses:    avgExp,
      hasExpenseData: last3.length > 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
