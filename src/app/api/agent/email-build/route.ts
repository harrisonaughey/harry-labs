import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { detectEmailType, getTemplate, TEMPLATE_META } from "./templates";
import { selectImages, buildImageCatalogueText } from "./imageAssets";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── System prompt (cached — store context + performance data + rules) ────────
const SYSTEM_PROMPT = `You are a senior ecommerce email strategist and HTML email developer for thinkle.com.au — an Australian Shopify store. You produce high-converting, beautifully designed Klaviyo-ready emails.

## Store context
- Brand: Thinkle | Store: thinkle.com.au | Currency: AUD
- Product: Thinkle is a family card/word game — quick to play, creative, suits all ages. Replaces screen time with face-to-face fun. Popular for game nights, gifting, and families.
- Tone: Warm, confident, Australian — conversational but never sloppy
- Primary colour: Indigo #6366f1 | Background: White #ffffff | Text: #111118
- From name: Thinkle | From email: hello@thinkle.com.au
- Logo: Try https://thinkle.com.au/cdn/shop/files/Thinkle_logo.png — if uncertain, render as styled HTML text: <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#111118;letter-spacing:-0.5px;">thinkle</span>

## Performance data — 37 Klaviyo campaigns (Sep 2025–May 2026)

### Revenue per recipient by email type:
- Last Chance / Urgency: **$0.159 avg RPR** — BEST PERFORMER. "Ending" always beats "launch".
- Product Launch / Hero CTA: **$0.216 RPR** at best (Launch Email #1 — top revenue $300)
- Split / Multi-product: **$0.141 RPR**
- Minimal / Re-engagement: use for recovery, not revenue
- Brand Storytelling (no offer): **$0.000 RPR** — DO NOT write these

### Proven subject lines:
- "Last chance to get 15% 🎃" → $242, 0.376 RPR from 646 people
- "Psst: About that $10.00 off..." → $287, 39.7% open rate
- "$10 + FREE Shipping Unlocked This Black Friday 🔓" → $240
- "Turn Dinner into a Game Night!" → $300, 45.9% OR, 5.0% CTOR
- "Only Hours Left: Snag 15% Off Today!" → $170, 43.0% OR
- "[URGENT] - Halloween SALE now LIVE 🎃" → $196, 38.9% OR
- "Join the FUN across generations! 🎉" → 48.3% OR (highest open rate with offer)

### Subject line patterns that KILL conversions:
- Inspiration without offer: "Let's Make 2026 Your Year of Connection!" → $0
- Feature language: "No complicated rules. JUST FUN!" → $0
- Vague announcement: "$10.00 OFF Now Live" → $0 (same offer, "Ending" version made $287)
- Pain-point story with no CTA path: "When did family time become everyone staring at screens?" → $0

### The urgency multiplier — most important insight:
Afterpay Launch ("$10.00 OFF Now Live") = $0. Afterpay Ending ("Psst...Sale ends tonight") = $287.
ALWAYS frame sale emails around the ending/scarcity, not the announcement.

### Preview text is non-negotiable:
Campaigns with no preview text consistently underperform. Best previews:
"Sale ends tonight" | "12 hours left..." | "USE CODE: HW15" | "Ends Sunday midnight"

## Copywriting rules

### Subject lines (under 45 chars — shorter wins on mobile):
DO: Lead with $ or % value, use "Psst:" / ellipsis for curiosity, add deadline signal ("Last chance", "Ends tonight"), 1 strategic emoji max
DON'T: Write brand/lifestyle copy with no offer, announce without intrigue, omit preview text

### Email body:
DO: Lead with offer in first 100px, state promo code in hero, single primary CTA (indigo #6366f1), include deadline with specific day/time, keep under 200 words for sale emails
DON'T: Write 3+ paragraphs of brand story without offer, add >2 CTA buttons, use generic lifestyle copy

## How to use the template provided

You will receive a pre-selected HTML template in the user message. Your job:
1. Read the template structure carefully — it defines layout, mobile behaviour, and styling
2. Replace ALL {{PLACEHOLDER}} tokens with real copy, image URLs, and URLs
3. Keep the HTML structure intact — do NOT restructure the table layout
4. Replace {{LOGO_HEADER}} with the logo header HTML
5. Replace {{PREHEADER}} with the hidden preheader div
6. Replace {{FOOTER}} with the footer HTML
7. Replace {{CTA_BUTTON}} with the CTA button HTML
8. For image URLs: use the provided Drive embed URLs exactly as given
9. Write alt text based on the image visual description provided
10. The {{URGENCY_BAR_TEXT}} in Template E is the most important line — make it specific ("⏰ 12 HOURS LEFT — SALE ENDS MIDNIGHT AEST")

## Output format — use these exact section headers:
## Email Brief Summary
## Email Type & Template Selected
## Images Used
## Subject Line Variants
1. [Primary — urgency/offer-led, under 45 chars]
2. [Alt A — curiosity angle]
3. [Alt B — direct/benefit-led]
## Preview Text
[85–100 chars, amplifies urgency, does not repeat subject]
## Recommended Send Time
## Klaviyo Campaign Settings
## HTML Email
\`\`\`html
[Complete production HTML — all {{PLACEHOLDER}} tokens replaced, Klaviyo merge tags kept]
\`\`\`

## Quality checklist (run before outputting):
- [ ] All {{PLACEHOLDER}} tokens replaced — zero remaining in output HTML
- [ ] Subject lines under 45 characters each
- [ ] Preview text 85–100 characters, not a repeat of subject
- [ ] Urgency bar text is specific (time + event) if Template E
- [ ] Promo code visible in hero if applicable
- [ ] {{ unsubscribe_url }} present in footer
- [ ] All images have descriptive alt text and explicit width attribute
- [ ] CTA button min 48px height, centred, #6366f1 background
- [ ] No <script> tags, all links https://
- [ ] Australian spelling throughout`;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { brief, campaignName, listId, listName } = await req.json();

  if (!brief?.trim()) {
    return new Response(JSON.stringify({ error: "Brief is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Detect email type from brief → select template + images
  const emailType = detectEmailType(brief);
  const templateMeta = TEMPLATE_META[emailType];
  const templateHtml = getTemplate(emailType);
  const selectedImages = selectImages(brief);
  const imageCatalogue = buildImageCatalogueText(selectedImages);

  // Build user message with template + image context injected
  const userMessage = [
    campaignName ? `Campaign name: ${campaignName}` : null,
    listName ? `Target list: ${listName}` : null,
    `Brief: ${brief}`,
    ``,
    `## Auto-selected email type`,
    `Based on this brief, the system has selected: **${templateMeta.name}**`,
    `Best for: ${templateMeta.bestFor}`,
    `Performance benchmark: ${templateMeta.performanceBenchmark}`,
    ``,
    imageCatalogue,
    ``,
    `## HTML template to use`,
    `Start with this template and fill in all {{PLACEHOLDER}} tokens with copy, URLs, and image URLs from the catalogue above.`,
    `Do NOT change the table structure or inline CSS — only replace the placeholder tokens and Klaviyo merge tags.`,
    ``,
    templateHtml,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 8192,
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: userMessage }],
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const data = JSON.stringify({ text: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        // Send detected type metadata alongside done signal
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, emailType, templateName: templateMeta.name })}\n\n`
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
