/**
 * Design Rules — shared utilities used by both the campaign-designer cron
 * agent and the build-campaign-entry on-demand route.
 *
 * A "design rule" is a per-campaign-type brief that tells Claude exactly how
 * to build the email: layout directives, colour overrides, copy tone, CTA
 * wording, subject line formulas, etc.  Rules are stored in the
 * `campaign_design_rules` table and matched by keyword against the campaign
 * name + brief text.
 */

export interface DesignRule {
  id:               string;
  store_id:         string;
  name:             string;
  trigger_keywords: string;
  template_type:    string | null;
  design_brief:     string;
  subject_formula:  string | null;
  shopify_actions:  string | null;
  color_primary:    string | null;
  color_accent:     string | null;
  is_active:        boolean;
  sort_order:       number;
  created_at:       string;
  updated_at:       string;
}

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * Find the first active rule whose trigger keywords appear in the combined
 * campaign name + brief text.  Rules are checked in sort_order sequence so
 * the most specific rule (lowest sort_order) wins.
 */
export function matchDesignRule(
  name:  string,
  brief: string,
  rules: DesignRule[]
): DesignRule | null {
  const haystack = `${name} ${brief}`.toLowerCase();

  const active = [...rules]
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const rule of active) {
    const keywords = rule.trigger_keywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    if (keywords.some((kw) => haystack.includes(kw))) {
      return rule;
    }
  }

  return null;
}

// ─── Thinkle brand constants ──────────────────────────────────────────────────

/**
 * These are injected into EVERY email prompt regardless of which design rule
 * matched.  They enforce Thinkle's brand standards and evidence-based
 * conversion-optimisation practices.
 */
const THINKLE_BRAND_STANDARDS = `
## Thinkle Brand Standards — ALWAYS APPLY TO EVERY EMAIL

These override any generic defaults. Apply them to every campaign regardless of type.

### Logo
VERIFIED working logo URL (use EXACTLY this src — do not invent or alter the URL):
  https://thinkle.com.au/cdn/shop/files/thinkle_logo_reverse.png?v=1751999403&width=600

Always render it as a centred linked image in the header row. Width: 160px. The logo
is an orange thought-bubble with white "thinkle™" text — works on both dark and light backgrounds.
\`\`\`html
<tr>
  <td align="center" style="padding:24px 24px 20px;background:[HEADER_BG];">
    <a href="https://thinkle.com.au?utm_source=klaviyo&utm_medium=email&utm_campaign=[SLUG]"
       style="text-decoration:none;">
      <img src="https://thinkle.com.au/cdn/shop/files/thinkle_logo_reverse.png?v=1751999403&width=600"
           width="160" alt="Thinkle — The Family Card Game"
           style="width:160px;max-width:160px;height:auto;display:block;margin:0 auto;" />
    </a>
  </td>
</tr>
\`\`\`

### Image sourcing — CRITICAL RULE
ONLY use images from these two trusted sources:
1. **Klaviyo image library** — URLs starting with https://d3k81ch9hvuctc.cloudfront.net/company/X7G8qZ/
2. **Shopify CDN** — URLs starting with https://thinkle.com.au/cdn/shop/files/

DO NOT use Google Drive links (drive.google.com / drive.usercontent.google.com).
DO NOT use Dropbox, WeTransfer, or any redirect-based image URL.
DO NOT invent or guess image URLs.

If no suitable image URL is available from the catalogue provided, omit the background-image src
and use a solid dark colour block (#111118) as the hero background instead — never use a broken src.

### Hero image dimensions — MANDATORY
Thinkle campaigns (and The Oodie, the benchmark brand) use LANDSCAPE hero images.
- **Display size**: 600px wide × 380px tall (landscape, 3:2 ratio)
- **Source resolution**: 1200×760px (retina 2×) — the Klaviyo CDN images are already this size
- **NEVER use portrait images** (taller than wide) as heroes — they push content below the fold
- Set \`height="380"\` explicitly on the hero container so portrait images are cropped, not stretched

### Hero section with text ON the image — MANDATORY
Every email hero section MUST display the offer/campaign text visually ON TOP of the image.
This is how The Oodie and Thinkle's own best-performing campaigns look — the image IS the offer.

Use the background-image technique (works in Gmail, Apple Mail, Outlook 2019+):
\`\`\`html
<!-- HERO WITH TEXT OVERLAY — always use this pattern, not a plain <img> -->
<tr>
  <td background="{{IMAGE_1}}"
      style="background-image:url('{{IMAGE_1}}');background-size:cover;background-position:center top;
             background-color:#111118;padding:0;line-height:0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center"
            style="padding:56px 40px 52px;
                   background:rgba(0,0,0,0.45);
                   min-height:380px;">
          <!-- Campaign type label -->
          <p style="margin:0 0 10px;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;font-weight:800;color:#f97316;
                    text-transform:uppercase;letter-spacing:2.5px;">
            {{CAMPAIGN_LABEL}}</p>
          <!-- Big offer headline — centre of the image -->
          <h1 style="margin:0 0 10px;
                     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                     font-size:56px;font-weight:900;color:#ffffff;
                     line-height:1;letter-spacing:-1.5px;text-shadow:0 2px 8px rgba(0,0,0,0.4);">
            {{OFFER_HEADLINE}}</h1>
          <!-- Subline / deadline -->
          <p style="margin:0 0 28px;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:18px;font-weight:600;color:#f3f4f6;line-height:1.4;">
            {{OFFER_SUBLINE}}</p>
          <!-- CTA button inside the hero -->
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="#f97316"
                  style="border-radius:8px;mso-padding-alt:0;">
                <a href="{{CTA_URL}}"
                   style="display:inline-block;padding:16px 48px;
                          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                          font-size:17px;font-weight:800;color:#ffffff;
                          text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
                  {{CTA_TEXT}} →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>
\`\`\`

**Text style on the image (match The Oodie / Thinkle campaign aesthetic):**
- CAMPAIGN_LABEL: SHORT ALL-CAPS label, 11px, orange #f97316, e.g. "EOFY SALE", "FLASH SALE", "LAST 24 HRS"
- OFFER_HEADLINE: The core offer in 1–3 words max, very large (52–64px). Examples:
  ✅ "20% OFF"  /  "$10 OFF"  /  "LAST CHANCE"  /  "ENDS TONIGHT"
  ❌ Long sentences — keep it punchy, this text is what renders on the image
- OFFER_SUBLINE: 1 short line of context, 18px, light grey. E.g. "Sitewide — Ends midnight June 30"
- CTA inside hero: orange (#f97316) button, 17px bold white text

**Dark overlay**: Always include \`background:rgba(0,0,0,0.45)\` on the inner td so white text is
legible over any background image. Increase to 0.55 for light/busy images.

### Personalization
Always open the email with a personalized greeting using Klaviyo merge tags:
\`\`\`html
<p style="...">Hey {{ first_name|default:'there' }} 👋</p>
\`\`\`
Place this as the FIRST line of the main content block (after the hero image, before the headline).

### Product feature strip
Every email must include a 3-column feature strip BELOW the main CTA button.
Communicates what Thinkle is to new subscribers who don't know the product.
Use 3 benefit tiles with an emoji icon + 1-line label:
\`\`\`html
<!-- Feature strip -->
<tr><td style="padding:20px 24px 4px;background:[BG];">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" width="33%" style="padding:0 6px;">
        <p style="margin:0;font-size:22px;">🃏</p>
        <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                  font-size:11px;font-weight:700;color:[MUTED];text-transform:uppercase;letter-spacing:0.5px;">
          Card game</p>
      </td>
      <td align="center" width="33%" style="padding:0 6px;">
        <p style="margin:0;font-size:22px;">👨‍👩‍👧‍👦</p>
        <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                  font-size:11px;font-weight:700;color:[MUTED];text-transform:uppercase;letter-spacing:0.5px;">
          All ages 10+</p>
      </td>
      <td align="center" width="33%" style="padding:0 6px;">
        <p style="margin:0;font-size:22px;">🚀</p>
        <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                  font-size:11px;font-weight:700;color:[MUTED];text-transform:uppercase;letter-spacing:0.5px;">
          Fast AU shipping</p>
      </td>
    </tr>
  </table>
</td></tr>
\`\`\`

### Shipping trust badge
Include a standalone shipping reassurance line BELOW the feature strip:
\`\`\`html
<tr><td align="center" style="padding:12px 24px 20px;background:[BG];">
  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
            font-size:12px;font-weight:600;color:[ACCENT];letter-spacing:0.3px;">
    🚚 Free shipping on orders over $50 · Ships in 1–3 business days</p>
</td></tr>
\`\`\`

### Fonts
Use this exact stack everywhere — headings AND body:
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif
Do NOT use Georgia, serif, or any custom web fonts.
Headlines: font-weight 700–900. Body: font-weight 400. Minimum body font-size: 15px.

### Colours (Thinkle brand palette)
- **Primary brand orange (accent)**: #f97316
  → Use for: urgency bar background, CTA buttons, discount badges, star ratings, accent text labels, shipping badge text.
- **Dark background**: #111118. Deep section dividers: #0d0d0d.
- **Light background**: #ffffff. Off-white section: #f9fafb.
- **Dark body text on light**: #111118. Subtext / muted: #6b7280.
- **Light body text on dark**: #f3f4f6. Muted: #9ca3af.
- Do NOT use purple (#6366f1), indigo, teal, or any colour not listed above.

### Email width & structure
- Max width: 600px. Must be responsive (mobile stack at ≤480px).
- Outer wrapper: background #0d0d0d for dark campaigns, #f3f4f6 for light.
- **Hero images**: always landscape (wider than tall). Display at 600×380px.
  Use \`background-image\` technique (see above) — NOT a standalone \`<img>\` with text below it.
- Supporting / product images (below hero): \`max-width:100%;height:auto\` + descriptive alt text.

---

## Performance Optimisation — MUST FOLLOW (conversion-first)

Evidence-based email best practices. Each rule here is non-negotiable.

1. **SINGLE CTA**: ONE call-to-action button per email only. No secondary links styled as buttons.
2. **ABOVE THE FOLD + TEXT ON IMAGE**: Offer (discount %, dollar amount, or headline) must appear
   BOTH on the hero image (via the background-image overlay) AND as the main H1 below it.
   The image hero is the first thing seen — it MUST carry the offer visually.
3. **CTA BUTTON**: Min 48px tall, full-width up to 320px, centred. Action-led text:
   ✅ "Shop Now →" / "Grab 20% Off" / "Claim the Deal"
   ❌ "Click Here" / "Learn More" / "Find Out More"
   Thinkle orange (#f97316) background, white bold text, 8px border-radius.
4. **SUBJECT LINE**: Output ONLY the subject line text — no analysis, no brackets, no word count notes.
   Max 45 characters. Lead with the specific offer number.
   ✅ 20% Off Sitewide — Ends Sunday
   ✅ $10 Off This Weekend Only
   ❌ **20% Off Sitewide — Ends Sunday** (37 chars) — Primary, offer-first...
5. **PREHEADER**: 85–100 chars in a hidden div. Complements subject — adds info not in subject line.
6. **PERSONALIZATION**: Always use \`{{ first_name|default:'there' }}\` in the greeting line.
7. **SOCIAL PROOF**: ★★★★★ + italic 1–2 sentence review + "— Name, State". Place near CTA.
8. **URGENCY BAR**: Full-width orange (#f97316) top strip. Bold white uppercase. Include emoji ⏰ or ⚡.
9. **FEATURE STRIP**: 3-column emoji + label strip (as shown above) under CTA. Always include it.
10. **BODY COPY**: Max 50 words. Short sentences. Voice: warm, playful, direct.
    Evoke: family fun, game nights, replacing screen time, suits all ages 10+, fast AU shipping.
11. **MOBILE FIRST**: Body min 15px. Headlines min 30px. Touch targets min 48px.
12. **UTM TRACKING**: All links: \`?utm_source=klaviyo&utm_medium=email&utm_campaign=[slug]\`
13. **UNSUBSCRIBE**: \`{{ unsubscribe_url }}\` in footer. Non-negotiable.
14. **FOOTER**: Dark (#111118) background. Brand name bold white + tagline + thinkle.com.au link + unsubscribe.

---
`.trim();

// ─── Prompt injection ─────────────────────────────────────────────────────────

const TEMPLATE_LABEL: Record<string, string> = {
  urgency:      "Urgency (countdown / flash-sale format)",
  "dark-hero":  "Dark Hero (dramatic full-bleed image, single CTA)",
  "sale-grid":  "Sale Grid (hero + discount banner + product tiles)",
  countdown:    "Countdown (urgency bar + timer + single CTA)",
  "hero-cta":   "Hero + CTA (announcement / launch format)",
  split:        "Split (image + text side-by-side)",
  grid:         "Grid (hero + product grid)",
  minimal:      "Minimal (text-first, clean)",
};

/**
 * Returns a prompt section that instructs Claude to follow the matched rule.
 * Insert this block BEFORE the HTML template section in the user message.
 *
 * ALWAYS includes the Thinkle brand standards + performance guidelines at the top,
 * followed by the campaign-specific design rule directives.
 */
export function buildDesignRulesPrompt(rule: DesignRule): string {
  const lines: string[] = [
    THINKLE_BRAND_STANDARDS,
    ``,
    `## Campaign Design Rules — MUST FOLLOW`,
    `A design rule has been matched to this campaign. Apply every directive below`,
    `precisely — they override any generic defaults.`,
    ``,
    `**Matched rule**: ${rule.name}`,
  ];

  if (rule.template_type) {
    lines.push(`**Template format**: ${TEMPLATE_LABEL[rule.template_type] ?? rule.template_type}`);
  }

  // Colour overrides — only shown if they differ from the brand defaults
  if (rule.color_primary) {
    lines.push(`**Background colour for this campaign type**: ${rule.color_primary}`);
  }
  if (rule.color_accent) {
    lines.push(`**Accent colour** (should match Thinkle orange #f97316 unless overridden here): ${rule.color_accent}`);
  }

  if (rule.design_brief.trim()) {
    lines.push(``, `**Design & copy directives**:`, rule.design_brief.trim());
  }

  if (rule.subject_formula?.trim()) {
    lines.push(
      ``,
      `**Subject line formula** (adapt to this campaign's specifics — keep ≤45 chars):`,
      rule.subject_formula.trim()
    );
  }

  if (rule.shopify_actions?.trim()) {
    lines.push(
      ``,
      `**Note — Shopify actions required before sending** (mention in email footer or preview text if relevant):`,
      rule.shopify_actions.trim()
    );
  }

  lines.push(``, `---`);

  return lines.join("\n");
}

/**
 * Returns the brand standards + performance guidelines without a specific rule.
 * Used when no design rule matched — still enforces Thinkle brand on every email.
 */
export function buildBrandStandardsPrompt(): string {
  return [
    THINKLE_BRAND_STANDARDS,
    ``,
    `## Campaign Design — No specific rule matched`,
    `No keyword-matched design rule was found for this campaign. Use the brand standards`,
    `above and choose the most appropriate layout (hero + single CTA is a safe default).`,
    ``,
    `---`,
  ].join("\n");
}
