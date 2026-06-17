/**
 * Notion → content_calendar sync
 *
 * Reads the "Year Campaign Calendar" Notion page (flat page with 12 monthly
 * tables — NOT a Notion database) via the Blocks API and upserts upcoming
 * campaigns into content_calendar.
 *
 * Table columns (per month):
 *   [0] Build Trigger   e.g. "Jun 9"
 *   [1] Send Date       e.g. "Jun 10"
 *   [2] Campaign        e.g. "EOFY Best Sellers"
 */

import { createClient } from "@supabase/supabase-js";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORE_ID          = "50f89d8a-ae07-4999-9ec7-4304a2f6c51b";
const NOTION_VERSION    = "2022-06-28";
const DEFAULT_SEND_HOUR = 9;   // 9 AM UTC  ≈ 7 PM AEST (adjustable per-entry via edit modal)

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Notion Blocks API ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchBlocks(blockId: string, token: string): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let all: any[]        = [];
  let cursor: string | undefined;

  do {
    const qs  = cursor ? `&start_cursor=${cursor}` : "";
    const url = `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100${qs}`;

    const res = await fetch(url, {
      headers: {
        Authorization:    `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
      },
      // Always fresh — cron/manual sync
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Notion API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    all        = all.concat(data.results ?? []);
    cursor     = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return all;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4,  Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * Parse "Jun 10" into a Date.
 *
 * Year assignment:
 *   - If month/day in the current year is >= today  → use current year
 *   - Otherwise (date already past this year)       → use next year
 *
 * Returns null if the string cannot be parsed.
 */
function parseSendDate(monthDay: string): Date | null {
  const trimmed = (monthDay ?? "").trim();
  if (!trimmed || trimmed === "--" || trimmed === "—") return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;

  const [monthStr, dayStr] = parts;
  const month = MONTH_MAP[monthStr];
  const day   = parseInt(dayStr, 10);

  if (month === undefined || isNaN(day) || day < 1 || day > 31) return null;

  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const thisYear = today.getFullYear();

  // Try current year
  const dateThisYear = new Date(thisYear, month, day, DEFAULT_SEND_HOUR, 0, 0, 0);
  if (dateThisYear >= today) return dateThisYear;

  // Past this year → next year
  return new Date(thisYear + 1, month, day, DEFAULT_SEND_HOUR, 0, 0, 0);
}

// ─── Brief generation ─────────────────────────────────────────────────────────

/**
 * Auto-generate a campaign brief from the campaign name and send date.
 * The Campaign Designer agent uses this as seed context when building the email.
 */
function generateBrief(name: string, sendDate: Date): string {
  const n       = name.toLowerCase();
  const dateStr = sendDate.toLocaleDateString("en-AU", {
    day: "numeric", month: "long", year: "numeric",
  });

  // Urgency closers
  if (/final hours|ends tonight|last chance|final day/i.test(n))
    return `${name} — urgency close email. Sale ends today. Maximum urgency language, specific end time (midnight AEST), countdown copy. Single CTA only.`;

  // VIP / Early access
  if (/vip access|early access|waitlist/i.test(n))
    return `${name} — exclusive early access for VIP/email subscribers. Reward loyalty, limited window, make them feel special. Scheduled ${dateStr}.`;

  // Sale launches
  if (/sale launch|launch/i.test(n))
    return `${name} — announce the sale opening. Lead with the offer, build excitement, strong hero CTA. Scheduled ${dateStr}.`;

  // Payday
  if (/payday/i.test(n))
    return `${name} — payday treat angle. Customers have cash available. Time-sensitive offer to capture payday spending. Scheduled ${dateStr}.`;

  // Best sellers / social proof
  if (/best seller|customer fav/i.test(n))
    return `${name} — showcase top-selling products with social proof. Reviews, star ratings, "most popular" framing. FOMO-driven. Scheduled ${dateStr}.`;

  // Gift guides
  if (/gift guide|top gifts/i.test(n))
    return `${name} — position Thinkle as the perfect gift. Easy to shop for someone else, fast delivery, gifting angle. Scheduled ${dateStr}.`;

  // Shipping / deadline
  if (/last shipping|last.*chance.*ship|last.*order/i.test(n))
    return `${name} — last chance to order for guaranteed on-time delivery. Urgency is the shipping cutoff, not price. Clear deadline, simple CTA. Scheduled ${dateStr}.`;

  // Flash / weekend / push
  if (/flash sale|weekend push|mid-month|revenue push/i.test(n))
    return `${name} — short-window flash sale. High urgency, specific end time, single strong discount. Scheduled ${dateStr}.`;

  // Preview / sneak peek
  if (/preview|sneak peek/i.test(n))
    return `${name} — tease the upcoming sale without full reveal. Build anticipation and desire. Scheduled ${dateStr}.`;

  // Clearance
  if (/clearance/i.test(n))
    return `${name} — end-of-period clearance. Stock limited, prices reduced. Urgency from scarcity, not just time. Scheduled ${dateStr}.`;

  // Bundle
  if (/bundle/i.test(n))
    return `${name} — bundle offer. "Get more for less" angle. Present Thinkle as part of a value set. Scheduled ${dateStr}.`;

  // Wishlist
  if (/wishlist/i.test(n))
    return `${name} — engagement/discovery email. Help customers find what they want. Soft sell, link to collections. Scheduled ${dateStr}.`;

  // Low stock
  if (/low stock/i.test(n))
    return `${name} — scarcity email. Popular lines running low. Social proof + scarcity combination, act fast. Scheduled ${dateStr}.`;

  // Cyber Monday
  if (/cyber monday/i.test(n))
    return `${name} — digital-only deals, best prices of the year. Online shopping day, strong discount, streamlined CTA. Scheduled ${dateStr}.`;

  // Mid-year
  if (/mid.year|mid year/i.test(n))
    return `${name} — mid-year sale. Warm but urgent tone. Highlight key products and limited-time offer. Scheduled ${dateStr}.`;

  // Christmas in July
  if (/christmas in july/i.test(n))
    return `${name} — Christmas in July. Playful, festive angle out-of-season. Great excuse to shop and treat yourself. Scheduled ${dateStr}.`;

  // Father's Day
  if (/father.s day/i.test(n))
    return `${name} — Father's Day. Gift-giving angle, easy to shop for dad. Thinkle as the ideal gift. Scheduled ${dateStr}.`;

  // Afterpay Day
  if (/afterpay/i.test(n))
    return `${name} — Afterpay Day. Highlight buy-now-pay-later, remove price barrier. Big discount, strong CTA. Scheduled ${dateStr}.`;

  // Halloween
  if (/halloween/i.test(n))
    return `${name} — Halloween-themed campaign. Playful, seasonal angle. Limited-time spooky offer. Scheduled ${dateStr}.`;

  // Black Friday
  if (/black friday/i.test(n))
    return `${name} — Black Friday campaign. Biggest sale of the year. Maximum urgency, clear savings, hero CTA. Scheduled ${dateStr}.`;

  // Christmas
  if (/christmas eve|christmas gift|christmas/i.test(n))
    return `${name} — Christmas campaign. Festive, warm tone. Last-chance gifts, holiday spirit. Scheduled ${dateStr}.`;

  // Boxing Day / Week
  if (/boxing day|boxing week/i.test(n))
    return `${name} — Boxing Day/Week sale. Post-Christmas deals, treat yourself angle. Strong discounts on remaining stock. Scheduled ${dateStr}.`;

  // New Year
  if (/new year/i.test(n))
    return `${name} — New Year campaign. Fresh start angle. "Set yourself up for the year" with Thinkle. Scheduled ${dateStr}.`;

  // EOFY
  if (/eofy|end of financial/i.test(n))
    return `${name} — EOFY. Australian tax-year end, last chance to buy before June 30. Business gifting angle, stock up. Scheduled ${dateStr}.`;

  // Spring
  if (/spring/i.test(n))
    return `${name} — Spring campaign. New season, fresh start, lighter tone. Seasonal offer. Scheduled ${dateStr}.`;

  // Default
  return `${name}. Campaign scheduled for ${dateStr}. Thinkle card game — warm, confident, Australian tone.`;
}

// ─── Public sync interface ────────────────────────────────────────────────────

export interface SyncResult {
  inserted: number;
  skipped:  number;
  errors:   string[];
  total:    number;
}

/**
 * Main sync: fetch all Notion blocks → parse 12 monthly tables → upsert into
 * content_calendar.  Existing entries (matched by name + date) are left untouched.
 */
export async function syncNotionCalendar(
  token:  string,
  pageId: string
): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, skipped: 0, errors: [], total: 0 };
  const supabase = db();

  // 1. Fetch top-level blocks from the Notion page
  let blocks;
  try {
    blocks = await fetchBlocks(pageId, token);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.errors.push(`Failed to fetch Notion page: ${msg}`);
    return result;
  }

  // 2. Find all table blocks (one per month)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableBlocks = blocks.filter((b: any) => b.type === "table");
  if (tableBlocks.length === 0) {
    result.errors.push("No table blocks found on the Notion page — check the page ID or integration access");
    return result;
  }

  // 3. Process each table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const table of tableBlocks as any[]) {
    let rows;
    try {
      rows = await fetchBlocks(table.id, token);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`Table ${table.id}: ${msg}`);
      continue;
    }

    // Respect Notion's has_column_header flag — skip row 0 when true
    const hasHeader = table.table?.has_column_header ?? true;
    const startIdx  = hasHeader ? 1 : 0;

    for (let i = startIdx; i < rows.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = rows[i] as any;
      if (row.type !== "table_row") continue;

      const cells       = row.table_row?.cells ?? [];
      // Col 1: Send Date, Col 2: Campaign (Col 0 is Build Trigger — not stored)
      const sendDateStr = (cells[1]?.[0]?.plain_text ?? "").trim();
      const campaign    = (cells[2]?.[0]?.plain_text ?? "").trim();

      if (!campaign || !sendDateStr) continue;

      const sendDate = parseSendDate(sendDateStr);
      if (!sendDate) continue;  // skip unparseable / past dates

      result.total++;

      // 4. Dedup: skip if an entry with the same name + send date already exists
      const dateOnly = sendDate.toISOString().slice(0, 10);  // "2026-06-10"
      const { data: existing, error: lookupErr } = await supabase
        .from("content_calendar")
        .select("id")
        .ilike("name", campaign)
        .gte("send_at", `${dateOnly}T00:00:00.000Z`)
        .lte("send_at", `${dateOnly}T23:59:59.999Z`)
        .limit(1);

      if (lookupErr) {
        result.errors.push(`Lookup failed for "${campaign}": ${lookupErr.message}`);
        continue;
      }

      if (existing && existing.length > 0) {
        result.skipped++;
        continue;
      }

      // 5. Insert new entry
      const brief = generateBrief(campaign, sendDate);
      const { error: insertErr } = await supabase.from("content_calendar").insert({
        store_id: STORE_ID,
        name:     campaign,
        brief,
        send_at:  sendDate.toISOString(),
        status:   "planned",
        // list_id, destination_url left null — user fills via edit modal
      });

      if (insertErr) {
        result.errors.push(`Insert failed for "${campaign}": ${insertErr.message}`);
      } else {
        result.inserted++;
      }
    }
  }

  return result;
}
