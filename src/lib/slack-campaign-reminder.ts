/**
 * Slack Campaign Reminder
 *
 * Posts a rich message to #email-agent 10 days before each scheduled email campaign.
 * Includes campaign details + Shopify action checklist tailored to the campaign type.
 *
 * Requires env: SLACK_BOT_TOKEN  (xoxb-... from your Slack app)
 * The bot must be invited to #email-agent (private channel C0BH6DLMWJH).
 */

import { buildImagePrompt, inferImageParams } from "@/lib/image-prompt-template";

const SLACK_API           = "https://slack.com/api/chat.postMessage";
const EMAIL_AGENT_CHANNEL = "C0BH6DLMWJH"; // #email-agent (private)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReminderEntry {
  id:                  string;
  name:                string;
  send_at:             string;
  status:              string;
  brief:               string | null;
  klaviyo_campaign_id: string | null;
  list_id:             string | null;
}

// ─── Shopify action generator ─────────────────────────────────────────────────

/**
 * Returns a list of Shopify-specific actions to complete before the campaign sends.
 * Mapped from campaign name patterns — keeps the AI agent from having to infer these.
 */
function getShopifyActions(name: string): string[] {
  const n = name.toLowerCase();

  // ── EOFY ──
  if (/eofy|end of financial/i.test(n)) return [
    "☑ Activate EOFY sale discount codes in *Shopify → Discounts*",
    "☑ Verify all sale prices and SKUs are correct",
    "☑ Upload EOFY sale banners + hero images to *Shopify → Content → Files*",
    "☑ Ensure the EOFY sale collection / landing page is live and linked correctly",
    "☑ Enable the sale announcement bar in the theme editor",
    "☑ Test checkout end-to-end with discount codes before send",
  ];

  // ── Black Friday / Cyber Monday ──
  if (/black friday|cyber monday/i.test(n)) return [
    "☑ Activate Black Friday / Cyber Monday discount codes in *Shopify → Discounts*",
    "☑ Set up automatic discounts or tiered pricing if applicable",
    "☑ Upload BF/CM banners, hero images and countdown assets to Shopify Files",
    "☑ Confirm BF landing page / collection is live and tracking pixels are firing",
    "☑ Add 'Black Friday Deal' product badges via metafields if applicable",
    "☑ Test discount codes end-to-end in a fresh checkout before send",
  ];

  // ── Boxing Day / Week ──
  if (/boxing day|boxing week/i.test(n)) return [
    "☑ Activate Boxing Day / Week sale discount codes in Shopify",
    "☑ Review clearance stock levels — update quantities and prices",
    "☑ Upload Boxing Day sale creative assets to Shopify Files",
    "☑ Ensure the sale/clearance collection is live and visible",
  ];

  // ── Christmas ──
  if (/christmas eve|christmas gift|christmas/i.test(n)) return [
    "☑ Verify all gift-related products are in stock and priced correctly",
    "☑ Upload Christmas creative assets and festive banners to Shopify Files",
    "☑ Display the last shipping date clearly on the homepage / product pages",
    "☑ Ensure gift card product is active and purchasable",
    "☑ Enable gift messaging or wrapping option if applicable",
  ];

  // ── New Year ──
  if (/new year/i.test(n)) return [
    "☑ Set up New Year promotion or discount code in Shopify",
    "☑ Upload New Year creative assets and banners to Shopify Files",
    "☑ Check featured products are in stock and correctly priced",
  ];

  // ── Christmas in July ──
  if (/christmas in july/i.test(n)) return [
    "☑ Set up Christmas in July promotion / discount code in Shopify",
    "☑ Upload Christmas in July themed creative assets (banners, product shots)",
    "☑ Check featured products are in stock and correctly priced",
  ];

  // ── Afterpay Day ──
  if (/afterpay/i.test(n)) return [
    "☑ Confirm Afterpay is active and configured correctly in *Shopify Payments*",
    "☑ Upload Afterpay Day branded creative assets (follow Afterpay brand guidelines)",
    "☑ Ensure Afterpay promotional messaging is visible on product + cart pages",
    "☑ Set up Afterpay Day discount code if applicable",
  ];

  // ── Father's Day ──
  if (/father.s day/i.test(n)) return [
    "☑ Ensure Father's Day gift products are in stock and featured prominently",
    "☑ Create or update a Father's Day gift collection in Shopify if needed",
    "☑ Upload Father's Day themed banners and creative assets",
    "☑ Confirm gift card is available and purchasable",
  ];

  // ── Spring ──
  if (/spring/i.test(n)) return [
    "☑ Upload Spring / new season creative assets and banners to Shopify Files",
    "☑ Ensure spring / new season products are featured and in stock",
    "☑ Set up any seasonal discount or promotion in Shopify",
  ];

  // ── Halloween ──
  if (/halloween/i.test(n)) return [
    "☑ Set up Halloween-themed promotion or discount code in Shopify",
    "☑ Upload Halloween creative assets and themed banners",
    "☑ Check relevant product availability and stock levels",
  ];

  // ── Mid-Year Clearance ──
  if (/clearance|mid.year/i.test(n)) return [
    "☑ Review clearance / sale stock levels and prices in Shopify",
    "☑ Create or update the clearance collection with reduced-price items",
    "☑ Upload clearance sale creative assets to Shopify Files",
    "☑ Apply automatic discount or sale badge to clearance items",
  ];

  // ── Flash Sale / Weekend Push / Revenue Push ──
  if (/flash sale|weekend push|revenue push/i.test(n)) return [
    "☑ Create or activate a time-limited discount code in *Shopify → Discounts*",
    "☑ Confirm the sale end date/time in Shopify matches the email copy exactly",
    "☑ Check stock levels on all featured products",
    "☑ Upload any new sale creative assets to Shopify Files",
  ];

  // ── VIP / Early Access / Waitlist ──
  if (/vip|early access|waitlist/i.test(n)) return [
    "☑ Create an exclusive VIP discount code in Shopify (single-use or limited quantity)",
    "☑ Confirm the early-access window, discount rate and expiry in the brief",
    "☑ Check featured products are in stock before the VIP window opens",
  ];

  // ── Payday / Mid-Month ──
  if (/payday|mid-month/i.test(n)) return [
    "☑ Set up or activate a payday discount code in *Shopify → Discounts*",
    "☑ Confirm featured products are in stock and correctly priced",
    "☑ Upload payday promotional creative assets if new ones are needed",
  ];

  // ── Gift Guide / Top Gifts ──
  if (/gift guide|top gifts/i.test(n)) return [
    "☑ Curate the gift guide collection in Shopify — verify all products are available",
    "☑ Check gift products are priced, stocked and have complete imagery",
    "☑ Upload gift guide banners and creative assets to Shopify Files",
    "☑ Confirm gift card product is active and purchasable",
  ];

  // ── Bundle ──
  if (/bundle/i.test(n)) return [
    "☑ Set up the bundle product or collection in Shopify",
    "☑ Confirm bundle pricing is correct and the offer is clearly described",
    "☑ Check all bundle component products are in stock",
  ];

  // ── Last Chance / Ends Tonight / Final Hours ──
  if (/last chance|ends tonight|final hours|final day/i.test(n)) return [
    "☑ Confirm the sale / discount is still active and runs until the end time in the email",
    "☑ Verify the sale end time in Shopify matches the email exactly",
    "☑ Check stock levels — update campaign brief if key products are sold out",
  ];

  // ── Sale Launch / Any 'Sale' ──
  if (/sale launch|launch/i.test(n)) return [
    "☑ Activate sale discount codes in *Shopify → Discounts*",
    "☑ Verify all sale prices and product availability are correct",
    "☑ Upload sale creative assets (banners, hero images) to Shopify Files",
    "☑ Ensure the sale collection / landing page is live",
    "☑ Enable the sale announcement bar in the theme editor",
  ];

  // ── Best Sellers ──
  if (/best seller|customer fav/i.test(n)) return [
    "☑ Confirm best-selling products are in stock and correctly priced",
    "☑ Update the 'Best Sellers' collection in Shopify if needed",
    "☑ Upload any new product images or creative assets",
  ];

  // ── Default ──
  return [
    "☑ Review and update relevant product availability and pricing in Shopify",
    "☑ Upload any new creative assets for this campaign to *Shopify → Content → Files*",
    "☑ Check discount codes are valid and active in *Shopify → Discounts*",
    "☑ Confirm featured products are in stock and have complete imagery",
  ];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatAEST(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    weekday:  "long",
    day:      "numeric",
    month:    "long",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: "Australia/Sydney",
  }) + " AEST";
}

function agentBuildDate(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - 7);
  return d.toLocaleString("en-AU", {
    weekday:  "long",
    day:      "numeric",
    month:    "long",
    timeZone: "Australia/Sydney",
  });
}

// ─── Slack Block Kit builder ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMessage(entries: ReminderEntry[]): { blocks: any[]; text: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [];

  const todayStr = new Date().toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Australia/Sydney",
  });

  // ── Header ──
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: "📅  Email Campaign Reminder — 10 days to send", emoji: true },
  });

  blocks.push({
    type: "context",
    elements: [{
      type: "mrkdwn",
      text: `_${entries.length} campaign${entries.length > 1 ? "s" : ""} scheduled in 10 days · ${todayStr}_`,
    }],
  });

  // ── One section per campaign ──
  for (const entry of entries) {
    blocks.push({ type: "divider" });

    const sendDateStr    = formatAEST(entry.send_at);
    const buildDateStr   = agentBuildDate(entry.send_at);
    const shopifyActions = getShopifyActions(entry.name);

    const statusEmoji: Record<string, string> = {
      planned:    "🔵",
      generating: "🟡",
      done:       "🟢",
      error:      "🔴",
    };
    const sEmoji = statusEmoji[entry.status] ?? "⚪";

    // Campaign info fields
    const fields = [
      { type: "mrkdwn", text: `*📧 Campaign*\n${entry.name}` },
      { type: "mrkdwn", text: `*📆 Send Date*\n${sendDateStr}` },
      { type: "mrkdwn", text: `*${sEmoji} Status*\n${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}` },
      ...(entry.klaviyo_campaign_id
        ? [{ type: "mrkdwn", text: `*🔗 Klaviyo*\n<https://www.klaviyo.com/omnicampaigns|View in Klaviyo>` }]
        : []),
    ];

    blocks.push({ type: "section", fields });

    // Brief
    if (entry.brief) {
      const truncated = entry.brief.length > 280
        ? entry.brief.slice(0, 280) + "…"
        : entry.brief;
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*📝 Brief*\n${truncated}` },
      });
    }

    // Shopify action checklist
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🛍 Shopify — Actions Required Before Send*\n${shopifyActions.join("\n")}`,
      },
    });

    // ChatGPT image prompt
    const imgParams = inferImageParams(entry.name);
    const imgPrompt = buildImagePrompt({ campaignName: entry.name, ...imgParams });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🎨 ChatGPT Image Prompt — paste this to generate the campaign creative*\n\`\`\`${imgPrompt}\`\`\``,
      },
    });
    blocks.push({
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `📐 *Spec:* 1200×2100px PNG · Upload at full resolution (no resizing) · Drop in Claude chat or upload via harry-labs dashboard`,
      }],
    });

    // Agent timeline footer
    blocks.push({
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `🤖 Campaign Designer agent auto-builds this email on *${buildDateStr}* (7 days before send) · <https://harry-labs.vercel.app/content-calendar|Open Campaign Calendar>`,
      }],
    });
  }

  // Plain-text fallback (for notifications)
  const text = `📅 Campaign Reminder (10 days): ${entries.map((e) => e.name).join(", ")}`;

  return { blocks, text };
}

// ─── Send function ────────────────────────────────────────────────────────────

export async function sendCampaignReminder(entries: ReminderEntry[]): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error(
      "SLACK_BOT_TOKEN is not set. Add it in Vercel → Settings → Environment Variables. " +
      "Get it from api.slack.com/apps → your app → OAuth & Permissions → Bot User OAuth Token."
    );
  }

  const { blocks, text } = buildMessage(entries);

  const res = await fetch(SLACK_API, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel: EMAIL_AGENT_CHANNEL,
      text,
      blocks,
      unfurl_links: false,
    }),
  });

  const data = await res.json();

  if (!data.ok) {
    throw new Error(
      `Slack API returned error: ${data.error}` +
      (data.needed ? ` (needs scope: ${data.needed})` : "")
    );
  }
}
