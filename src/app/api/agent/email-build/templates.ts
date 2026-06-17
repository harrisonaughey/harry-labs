/**
 * Thinkle email templates — 5 production-ready HTML shells
 * Based on high-converting design patterns from top ecommerce email programmes.
 *
 * Performance benchmark (Klaviyo, Sep 2025–May 2026):
 *   Template E (Urgency):      $0.376 RPR, best single-send revenue
 *   Template A (Hero CTA):     $0.216 RPR, 5.0% CTOR — best content/launch
 *   Template B (Split):        $0.141 RPR — multi-product promos
 *   Template C (Grid):         $0.109 RPR — bundle/multi-product
 *   Template D (Minimal):      use for re-engagement / cart recovery
 *
 * Each template is a complete Klaviyo-compatible HTML string.
 * The AI fills in: {{HEADLINE}}, {{SUBHEADLINE}}, {{BODY_COPY}},
 * {{CTA_TEXT}}, {{CTA_URL}}, {{IMAGE_1}} etc., {{PREVIEW_TEXT}}.
 */

// ─── Shared pieces ────────────────────────────────────────────────────────────

const CSS = `<style>
  body{margin:0;padding:0;background-color:#f0f0f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  img{display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
  a{color:#6366f1;text-decoration:none}
  @media(max-width:480px){
    .ew{width:100%!important}
    .col{width:100%!important;display:block!important}
    .mob-hide{display:none!important}
    .mob-pad{padding:20px 16px!important}
    .mob-center{text-align:center!important}
    .mob-full{width:100%!important;display:block!important;box-sizing:border-box}
    .cta-btn{width:90%!important;text-align:center!important;display:block!important}
    h1{font-size:28px!important;line-height:1.2!important}
    h2{font-size:22px!important}
    .hero-img{height:220px!important}
  }
</style>`;

const PREHEADER = (preview: string) =>
  `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#ffffff;line-height:1px;">${preview}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`;

const WRAPPER_OPEN = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f0f5;"><tr><td align="center" style="padding:20px 10px;">`;
const WRAPPER_CLOSE = `</td></tr></table>`;

const CONTAINER_OPEN = `<table class="ew" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">`;
const CONTAINER_CLOSE = `</table>`;

const logoHeader = (logoUrl: string) => `
  <tr>
    <td style="padding:20px 32px;border-bottom:1px solid #f0f0f5;background:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><a href="https://thinkle.com.au" style="text-decoration:none;">
          <img src="${logoUrl}" alt="thinkle" width="110" height="auto" style="display:block;">
        </a></td>
      </tr></table>
    </td>
  </tr>`;

const footer = `
  <tr>
    <td style="padding:28px 32px;background:#f9f9fb;border-top:1px solid #ebebf0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center">
          <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.5;">
            © 2026 Thinkle · <a href="https://thinkle.com.au" style="color:#9ca3af;">thinkle.com.au</a>
          </p>
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.5;">
            You're receiving this because you subscribed at thinkle.com.au ·
            <a href="{{ unsubscribe_url }}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td>
  </tr>`;

const ctaButton = (text: string, url: string, fullWidth = false) => `
  <table cellpadding="0" cellspacing="0" border="0" ${fullWidth ? 'width="100%"' : ''}>
    <tr>
      <td align="center" bgcolor="#6366f1" style="border-radius:8px;mso-padding-alt:0;">
        <a href="${url}" class="cta-btn" style="display:inline-block;padding:16px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;mso-padding-alt:16px 40px;letter-spacing:0.3px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;

// ─── TEMPLATE A — Hero + Single CTA ─────────────────────────────────────────
// Based on: "Turn Dinner into a Game Night!" ($300, 45.9% OR, 5.0% CTOR)
// Best for: Product Launch, Flash Sale, Welcome, Newsletter
// Pattern: Logo (dark bg) → HERO WITH HEADLINE ON IMAGE (background-image, Oodie-style)
//          → Greeting + brief body → Feature strip → Social proof → Dark footer
// NOTE: Hero image must be landscape 600×380px. Offer/headline text overlaid ON the image.

export const TEMPLATE_A = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>{{SUBJECT}}</title>
${CSS}
</head><body>
{{PREHEADER}}
${WRAPPER_OPEN}
${CONTAINER_OPEN}
  <!-- Logo on dark background -->
  <tr>
    <td align="center" style="padding:20px 24px 18px;background:#111118;">
      <a href="https://thinkle.com.au?utm_source=klaviyo&utm_medium=email&utm_campaign={{CAMPAIGN_SLUG}}"
         style="text-decoration:none;">
        <img src="https://thinkle.com.au/cdn/shop/files/thinkle_logo_reverse.png?v=1751999403&width=600"
             width="140" alt="Thinkle — The Family Card Game"
             style="width:140px;max-width:140px;height:auto;display:block;margin:0 auto;" />
      </a>
    </td>
  </tr>
  <!-- ═══════════════════════════════════════════════════════════════════
       HERO WITH HEADLINE ON IMAGE — Oodie-style landscape banner
       background-image on <td> + dark overlay + white headline on top
       ═══════════════════════════════════════════════════════════════════ -->
  <tr>
    <td background="{{IMAGE_1}}"
        style="background-image:url('{{IMAGE_1}}');background-size:cover;background-position:center;
               background-color:#111118;padding:0;line-height:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center"
              style="padding:56px 40px 52px;background:rgba(0,0,0,0.45);min-height:380px;">
            <!-- Campaign label — small orange all-caps -->
            <p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:11px;font-weight:800;color:#f97316;text-transform:uppercase;letter-spacing:2.5px;">
              {{CAMPAIGN_LABEL}}</p>
            <!-- Main headline on the image -->
            <h1 style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                       font-size:48px;font-weight:900;color:#ffffff;line-height:1.05;
                       letter-spacing:-1px;text-shadow:0 2px 8px rgba(0,0,0,0.4);">
              {{HEADLINE}}</h1>
            <!-- Subline -->
            <p style="margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:17px;font-weight:500;color:#f3f4f6;line-height:1.5;">
              {{SUBHEADLINE}}</p>
            <!-- CTA inside the hero -->
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
  <!-- Personalized greeting + body copy -->
  <tr>
    <td class="mob-pad" style="padding:28px 48px 24px;text-align:center;background:#ffffff;">
      <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                font-size:16px;color:#111118;">
        Hey {{ first_name|default:'there' }} 👋</p>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                font-size:15px;color:#374151;line-height:1.7;">
        {{BODY_COPY}}</p>
    </td>
  </tr>
  <!-- 3-column feature strip -->
  <tr><td style="padding:16px 24px 4px;background:#ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" width="33%" style="padding:0 6px;">
          <p style="margin:0;font-size:22px;">🃏</p>
          <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
            Card game</p>
        </td>
        <td align="center" width="33%" style="padding:0 6px;">
          <p style="margin:0;font-size:22px;">👨‍👩‍👧‍👦</p>
          <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
            All ages 10+</p>
        </td>
        <td align="center" width="33%" style="padding:0 6px;">
          <p style="margin:0;font-size:22px;">🚀</p>
          <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
            Fast AU shipping</p>
        </td>
      </tr>
    </table>
  </td></tr>
  <!-- Shipping trust badge -->
  <tr><td align="center" style="padding:10px 24px 16px;background:#ffffff;">
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
              font-size:12px;font-weight:600;color:#f97316;letter-spacing:0.3px;">
      🚚 Free shipping on orders over $50 · Ships in 1–3 business days</p>
  </td></tr>
  <!-- Social proof -->
  <tr>
    <td style="padding:16px 48px 24px;text-align:center;background:#f9fafb;border-top:1px solid #f0f0f5;">
      <p style="margin:0 0 4px;font-size:18px;">⭐⭐⭐⭐⭐</p>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                font-size:13px;color:#6b7280;font-style:italic;line-height:1.5;">
        {{SOCIAL_PROOF_QUOTE}}</p>
    </td>
  </tr>
  <!-- Dark footer -->
  <tr>
    <td style="padding:24px 32px;background:#111118;border-top:2px solid #f97316;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center">
          <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:14px;font-weight:800;color:#ffffff;">Thinkle</p>
          <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:12px;color:#9ca3af;line-height:1.5;">
            The family card game that replaces screen time with face-to-face fun.</p>
          <p style="margin:0 0 8px;">
            <a href="https://thinkle.com.au?utm_source=klaviyo&utm_medium=email&utm_campaign={{CAMPAIGN_SLUG}}"
               style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:12px;color:#f97316;text-decoration:none;font-weight:600;">thinkle.com.au</a>
          </p>
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;color:#6b7280;line-height:1.5;">
            You're receiving this because you signed up at thinkle.com.au ·
            <a href="{{ unsubscribe_url }}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td>
  </tr>
${CONTAINER_CLOSE}
${WRAPPER_CLOSE}
</body></html>`;

// ─── TEMPLATE B — Split / Zig-Zag ───────────────────────────────────────────
// Based on: Gifting ($191), Campaign #5 Bundles ($120)
// Best for: Promotional with multiple products, Newsletter, Gifting emails
// Pattern: Logo → intro headline → 2 alternating image/text rows → CTA → footer

export const TEMPLATE_B = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>{{SUBJECT}}</title>
${CSS}
</head><body>
{{PREHEADER}}
${WRAPPER_OPEN}
${CONTAINER_OPEN}
  {{LOGO_HEADER}}
  <!-- Top intro banner -->
  <tr>
    <td style="padding:32px 48px 20px;text-align:center;background:#f9f9fb;">
      <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1.5px;">{{LABEL}}</p>
      <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:28px;font-weight:800;color:#111118;line-height:1.2;letter-spacing:-0.3px;">
        {{HEADLINE}}
      </h1>
      <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;color:#6b7280;line-height:1.6;">
        {{SUBHEADLINE}}
      </p>
    </td>
  </tr>
  <!-- Split row 1: Image left, text right -->
  <tr>
    <td style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="col" width="300" valign="middle" style="padding:0;line-height:0;">
            <img src="{{IMAGE_1}}" alt="{{IMAGE_1_ALT}}" width="300"
                 style="width:100%;display:block;height:auto;">
          </td>
          <td class="col" width="300" valign="middle" style="padding:32px 28px;background:#ffffff;">
            <h2 style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;color:#111118;line-height:1.3;">
              {{BLOCK_1_HEADLINE}}
            </h2>
            <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;color:#6b7280;line-height:1.6;">
              {{BLOCK_1_COPY}}
            </p>
            {{BLOCK_1_CTA}}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Divider -->
  <tr><td style="height:1px;background:#f0f0f5;line-height:1px;font-size:1px;">&nbsp;</td></tr>
  <!-- Split row 2: Text left, image right (zig-zag) -->
  <tr>
    <td style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="col" width="300" valign="middle" style="padding:32px 28px;background:#ffffff;">
            <h2 style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;color:#111118;line-height:1.3;">
              {{BLOCK_2_HEADLINE}}
            </h2>
            <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;color:#6b7280;line-height:1.6;">
              {{BLOCK_2_COPY}}
            </p>
            {{BLOCK_2_CTA}}
          </td>
          <td class="col" width="300" valign="middle" style="padding:0;line-height:0;">
            <img src="{{IMAGE_2}}" alt="{{IMAGE_2_ALT}}" width="300"
                 style="width:100%;display:block;height:auto;">
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Main CTA -->
  <tr>
    <td style="padding:32px 48px;text-align:center;background:#f9f9fb;border-top:1px solid #ebebf0;">
      <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;color:#4b5563;line-height:1.6;">{{CLOSING_COPY}}</p>
      {{CTA_BUTTON}}
    </td>
  </tr>
  {{FOOTER}}
${CONTAINER_CLOSE}
${WRAPPER_CLOSE}
</body></html>`;

// ─── TEMPLATE C — Hero + Product Grid ───────────────────────────────────────
// Based on: Bundle campaigns, post-purchase upsell, gift guides
// Best for: Multi-product promotions, bundle offers, seasonal gift packs
// Pattern: Logo (dark) → HERO WITH OFFER TEXT ON IMAGE (bg-image) → greeting
//          → 2-col product cards (orange accents) → single CTA → feature strip → dark footer
// NOTE: Hero uses background-image technique same as Templates A & E.
//       Product cards use Thinkle orange (#f97316) — NOT purple.

export const TEMPLATE_C = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>{{SUBJECT}}</title>
${CSS}
</head><body>
{{PREHEADER}}
${WRAPPER_OPEN}
${CONTAINER_OPEN}
  <!-- Logo on dark background -->
  <tr>
    <td align="center" style="padding:20px 24px 18px;background:#111118;">
      <a href="https://thinkle.com.au?utm_source=klaviyo&utm_medium=email&utm_campaign={{CAMPAIGN_SLUG}}"
         style="text-decoration:none;">
        <img src="https://thinkle.com.au/cdn/shop/files/thinkle_logo_reverse.png?v=1751999403&width=600"
             width="140" alt="Thinkle — The Family Card Game"
             style="width:140px;max-width:140px;height:auto;display:block;margin:0 auto;" />
      </a>
    </td>
  </tr>
  <!-- ═══════════════════════════════════════════
       HERO WITH OFFER TEXT ON IMAGE (landscape)
       ═══════════════════════════════════════════ -->
  <tr>
    <td background="{{IMAGE_1}}"
        style="background-image:url('{{IMAGE_1}}');background-size:cover;background-position:center;
               background-color:#111118;padding:0;line-height:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center"
              style="padding:48px 40px 44px;background:rgba(0,0,0,0.48);min-height:320px;">
            <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:11px;font-weight:800;color:#f97316;text-transform:uppercase;letter-spacing:2.5px;">
              {{CAMPAIGN_LABEL}}</p>
            <h1 style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                       font-size:48px;font-weight:900;color:#ffffff;line-height:1.05;
                       letter-spacing:-1px;text-shadow:0 2px 8px rgba(0,0,0,0.5);">
              {{OFFER_HEADLINE}}</h1>
            <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:17px;font-weight:600;color:#f3f4f6;line-height:1.4;">
              {{OFFER_SUBLINE}}</p>
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#f97316" style="border-radius:8px;mso-padding-alt:0;">
                  <a href="{{CTA_URL}}"
                     style="display:inline-block;padding:14px 44px;
                            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                            font-size:16px;font-weight:800;color:#ffffff;
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
  <!-- Greeting + intro -->
  <tr>
    <td style="padding:24px 40px 8px;text-align:center;background:#ffffff;">
      <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                font-size:16px;color:#111118;">
        Hey {{ first_name|default:'there' }} 👋</p>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                font-size:15px;color:#6b7280;line-height:1.6;">
        {{INTRO_COPY}}</p>
    </td>
  </tr>
  <!-- ─── 2-col Product grid ─────────────────────────────────────────── -->
  <tr>
    <td style="padding:16px 20px 8px;background:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <!-- Product 1 -->
          <td class="col" width="270" valign="top"
              style="padding:16px;background:#f9fafb;border-radius:10px;border:1px solid #f0f0f5;">
            <img src="{{PRODUCT_1_IMAGE}}" alt="{{PRODUCT_1_NAME}}" width="238"
                 style="width:100%;height:auto;display:block;border-radius:6px;margin-bottom:12px;">
            <p style="margin:0 0 3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:13px;font-weight:800;color:#111118;line-height:1.3;">{{PRODUCT_1_NAME}}</p>
            <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:12px;color:#6b7280;line-height:1.4;">{{PRODUCT_1_DESC}}</p>
            <p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:17px;font-weight:900;color:#f97316;">{{PRODUCT_1_PRICE}}</p>
            <a href="{{PRODUCT_1_URL}}"
               style="display:inline-block;padding:10px 22px;background:#111118;color:#fff;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:12px;font-weight:700;border-radius:6px;text-decoration:none;">
              Shop Now →</a>
          </td>
          <!-- Spacer -->
          <td width="12" style="width:12px;">&nbsp;</td>
          <!-- Product 2 -->
          <td class="col" width="270" valign="top"
              style="padding:16px;background:#f9fafb;border-radius:10px;border:1px solid #f0f0f5;">
            <img src="{{PRODUCT_2_IMAGE}}" alt="{{PRODUCT_2_NAME}}" width="238"
                 style="width:100%;height:auto;display:block;border-radius:6px;margin-bottom:12px;">
            <p style="margin:0 0 3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:13px;font-weight:800;color:#111118;line-height:1.3;">{{PRODUCT_2_NAME}}</p>
            <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:12px;color:#6b7280;line-height:1.4;">{{PRODUCT_2_DESC}}</p>
            <p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:17px;font-weight:900;color:#f97316;">{{PRODUCT_2_PRICE}}</p>
            <a href="{{PRODUCT_2_URL}}"
               style="display:inline-block;padding:10px 22px;background:#111118;color:#fff;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:12px;font-weight:700;border-radius:6px;text-decoration:none;">
              Shop Now →</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Main CTA below grid -->
  <tr>
    <td style="padding:20px 40px 16px;text-align:center;background:#ffffff;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="center" bgcolor="#f97316" style="border-radius:8px;mso-padding-alt:0;">
            <a href="{{CTA_URL}}"
               style="display:block;padding:16px 40px;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;
                      border-radius:8px;letter-spacing:0.3px;">
              {{MAIN_CTA_TEXT}} →</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- 3-column feature strip -->
  <tr><td style="padding:14px 24px 4px;background:#ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" width="33%" style="padding:0 6px;">
          <p style="margin:0;font-size:22px;">🃏</p>
          <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Card game</p>
        </td>
        <td align="center" width="33%" style="padding:0 6px;">
          <p style="margin:0;font-size:22px;">👨‍👩‍👧‍👦</p>
          <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">All ages 10+</p>
        </td>
        <td align="center" width="33%" style="padding:0 6px;">
          <p style="margin:0;font-size:22px;">🚀</p>
          <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Fast AU shipping</p>
        </td>
      </tr>
    </table>
  </td></tr>
  <!-- Shipping badge -->
  <tr><td align="center" style="padding:10px 24px 14px;background:#ffffff;">
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
              font-size:12px;font-weight:600;color:#f97316;letter-spacing:0.3px;">
      🚚 Free shipping on orders over $50 · Ships in 1–3 business days</p>
  </td></tr>
  <!-- Social proof -->
  <tr>
    <td style="padding:14px 40px 20px;text-align:center;background:#f9fafb;border-top:1px solid #f0f0f5;">
      <p style="margin:0 0 4px;font-size:18px;">⭐⭐⭐⭐⭐</p>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                font-size:13px;color:#6b7280;font-style:italic;line-height:1.5;">
        {{SOCIAL_PROOF_QUOTE}}</p>
    </td>
  </tr>
  <!-- Dark footer -->
  <tr>
    <td style="padding:24px 32px;background:#111118;border-top:2px solid #f97316;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center">
          <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:14px;font-weight:800;color:#ffffff;">Thinkle</p>
          <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:12px;color:#9ca3af;line-height:1.5;">
            The family card game that replaces screen time with face-to-face fun.</p>
          <p style="margin:0 0 8px;">
            <a href="https://thinkle.com.au?utm_source=klaviyo&utm_medium=email&utm_campaign={{CAMPAIGN_SLUG}}"
               style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:12px;color:#f97316;text-decoration:none;font-weight:600;">thinkle.com.au</a>
          </p>
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;color:#6b7280;line-height:1.5;">
            You're receiving this because you signed up at thinkle.com.au ·
            <a href="{{ unsubscribe_url }}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td>
  </tr>
${CONTAINER_CLOSE}
${WRAPPER_CLOSE}
</body></html>`;

// ─── TEMPLATE D — Minimal Text-Forward ──────────────────────────────────────
// Best for: Re-engagement, Abandoned Cart, personal/founder-style emails
// Pattern: Logo → punchy headline → 1–2 sentences → CTA → supporting image → footer
// Note: Designed to work even with images blocked (copy stands alone)

export const TEMPLATE_D = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>{{SUBJECT}}</title>
${CSS}
</head><body>
{{PREHEADER}}
${WRAPPER_OPEN}
${CONTAINER_OPEN}
  {{LOGO_HEADER}}
  <!-- Main content -->
  <tr>
    <td class="mob-pad" style="padding:44px 56px 36px;">
      <!-- Personal greeting -->
      <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;color:#9ca3af;">
        Hey {{ first_name | default: 'there' }} 👋
      </p>
      <h1 style="margin:0 0 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:30px;font-weight:800;color:#111118;line-height:1.25;letter-spacing:-0.3px;">
        {{HEADLINE}}
      </h1>
      <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;color:#374151;line-height:1.7;">
        {{BODY_COPY_1}}
      </p>
      <p style="margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;color:#374151;line-height:1.7;">
        {{BODY_COPY_2}}
      </p>
      {{CTA_BUTTON}}
      <p style="margin:24px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#9ca3af;line-height:1.5;">
        {{SIGN_OFF}}
      </p>
    </td>
  </tr>
  <!-- Supporting image (optional but recommended) -->
  <tr>
    <td style="padding:0;line-height:0;">
      <img src="{{IMAGE_1}}" alt="{{IMAGE_1_ALT}}" width="600"
           style="width:100%;max-width:600px;height:auto;display:block;">
    </td>
  </tr>
  {{FOOTER}}
${CONTAINER_CLOSE}
${WRAPPER_CLOSE}
</body></html>`;

// ─── TEMPLATE E — Last Chance / Urgency ─────────────────────────────────────
// HIGHEST CONVERTING — $0.376 RPR (Halloween #3 12h, 646 recipients → $242)
// Also: Afterpay Ending ($287), BF Launch Live #2 ($240)
// Best for: Flash sale ending, last chance, "X hours left", sale finale
// Pattern: Orange urgency bar → Logo (dark bg) → HERO WITH OFFER TEXT ON IMAGE (background-image)
//          → Greeting + brief body copy → Feature strip → Social proof → footer
// NOTE: The hero image must display the offer text ON the image (Oodie-style).
//       Use background-image on <td> with rgba dark overlay + white text on top.
//       IMAGE_1 should be landscape (600×380 display / 1200×760 source).

export const TEMPLATE_E = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>{{SUBJECT}}</title>
${CSS}
</head><body>
{{PREHEADER}}
${WRAPPER_OPEN}
${CONTAINER_OPEN}
  <!-- ⚡ URGENCY BAR — full-width orange, bold white, emoji -->
  <tr>
    <td align="center" style="padding:13px 24px;background:#f97316;">
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:800;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">
        {{URGENCY_BAR_TEXT}}
      </p>
    </td>
  </tr>
  <!-- Logo on dark background -->
  <tr>
    <td align="center" style="padding:20px 24px 18px;background:#111118;">
      <a href="https://thinkle.com.au?utm_source=klaviyo&utm_medium=email&utm_campaign={{CAMPAIGN_SLUG}}"
         style="text-decoration:none;">
        <img src="https://thinkle.com.au/cdn/shop/files/thinkle_logo_reverse.png?v=1751999403&width=600"
             width="140" alt="Thinkle — The Family Card Game"
             style="width:140px;max-width:140px;height:auto;display:block;margin:0 auto;" />
      </a>
    </td>
  </tr>
  <!-- ═══════════════════════════════════════════════════════════════════
       HERO WITH OFFER TEXT ON THE IMAGE — Oodie-style landscape banner
       background-image on <td> with dark rgba overlay + white text on top
       Image must be landscape 600×380px display / 1200×760 source
       ═══════════════════════════════════════════════════════════════════ -->
  <tr>
    <td background="{{IMAGE_1}}"
        style="background-image:url('{{IMAGE_1}}');background-size:cover;background-position:center top;
               background-color:#111118;padding:0;line-height:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center"
              style="padding:56px 40px 52px;background:rgba(0,0,0,0.48);min-height:380px;">
            <!-- Campaign label — small orange all-caps -->
            <p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:11px;font-weight:800;color:#f97316;text-transform:uppercase;letter-spacing:2.5px;">
              {{CAMPAIGN_LABEL}}</p>
            <!-- Core offer — very large, high contrast -->
            <h1 style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                       font-size:56px;font-weight:900;color:#ffffff;line-height:1;
                       letter-spacing:-1.5px;text-shadow:0 2px 8px rgba(0,0,0,0.5);">
              {{OFFER_HEADLINE}}</h1>
            <!-- Subline / deadline -->
            <p style="margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                      font-size:18px;font-weight:600;color:#f3f4f6;line-height:1.4;">
              {{OFFER_SUBLINE}}</p>
            <!-- CTA button inside the hero image -->
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
  <!-- Personalized greeting + brief body copy -->
  <tr>
    <td class="mob-pad" style="padding:28px 48px 8px;text-align:center;background:#ffffff;">
      <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                font-size:16px;color:#111118;line-height:1.6;">
        Hey {{ first_name|default:'there' }} 👋</p>
      <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                font-size:15px;color:#374151;line-height:1.7;">
        {{BODY_COPY}}</p>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                font-size:12px;color:#9ca3af;">
        {{PROMO_CODE_LINE}}</p>
    </td>
  </tr>
  <!-- 3-column feature strip -->
  <tr><td style="padding:16px 24px 4px;background:#ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" width="33%" style="padding:0 6px;">
          <p style="margin:0;font-size:22px;">🃏</p>
          <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
            Card game</p>
        </td>
        <td align="center" width="33%" style="padding:0 6px;">
          <p style="margin:0;font-size:22px;">👨‍👩‍👧‍👦</p>
          <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
            All ages 10+</p>
        </td>
        <td align="center" width="33%" style="padding:0 6px;">
          <p style="margin:0;font-size:22px;">🚀</p>
          <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
            Fast AU shipping</p>
        </td>
      </tr>
    </table>
  </td></tr>
  <!-- Shipping trust badge -->
  <tr><td align="center" style="padding:10px 24px 16px;background:#ffffff;">
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
              font-size:12px;font-weight:600;color:#f97316;letter-spacing:0.3px;">
      🚚 Free shipping on orders over $50 · Ships in 1–3 business days</p>
  </td></tr>
  <!-- Social proof -->
  <tr>
    <td style="padding:16px 48px 24px;text-align:center;background:#f9fafb;border-top:1px solid #f0f0f5;">
      <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:20px;">⭐⭐⭐⭐⭐</p>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#6b7280;font-style:italic;line-height:1.5;">
        {{SOCIAL_PROOF_QUOTE}}</p>
    </td>
  </tr>
  <!-- Dark footer -->
  <tr>
    <td style="padding:24px 32px;background:#111118;border-top:2px solid #f97316;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center">
          <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:14px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">
            Thinkle</p>
          <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:12px;color:#9ca3af;line-height:1.5;">
            The family card game that replaces screen time with face-to-face fun.</p>
          <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:12px;line-height:1.5;">
            <a href="https://thinkle.com.au?utm_source=klaviyo&utm_medium=email&utm_campaign={{CAMPAIGN_SLUG}}"
               style="color:#f97316;text-decoration:none;font-weight:600;">thinkle.com.au</a>
          </p>
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                    font-size:11px;color:#6b7280;line-height:1.5;">
            You're receiving this because you signed up at thinkle.com.au ·
            <a href="{{ unsubscribe_url }}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td>
  </tr>
${CONTAINER_CLOSE}
${WRAPPER_CLOSE}
</body></html>`;

// ─── Type detection ───────────────────────────────────────────────────────────

export type EmailType = "urgency" | "hero-cta" | "split" | "grid" | "minimal";

export function detectEmailType(brief: string): EmailType {
  const b = brief.toLowerCase();
  // Urgency / Last Chance — highest priority (best performing)
  if (/last.?chance|ending|ends (tonight|sunday|monday|midnight)|hours? left|final (hours?|day)|flash sale|today only|midnight|expires?|countdown/.test(b)) return "urgency";
  if (/urgent|hurry|running out|almost gone|selling fast|limited stock/.test(b)) return "urgency";
  // Multi-product / bundle → grid
  if (/bundle|gift (set|guide|pack)|multipl|2 for|pack of|collection of (products|items)/.test(b)) return "grid";
  // Split / Zig-Zag — multi-message or editorial
  if (/newsletter|round.?up|weekly|gifting|three|multiple (products?|offers?)/.test(b)) return "split";
  // Minimal — personal / recovery
  if (/re.?engage|win.?back|we miss|inactive|lapsed|cart|left behind|didn.t complet/.test(b)) return "minimal";
  // Hero CTA — product launch, general promo, sale launch (not urgency)
  return "hero-cta";
}

export const TEMPLATE_META: Record<EmailType, { name: string; bestFor: string; performanceBenchmark: string }> = {
  "urgency": {
    name: "E — Last Chance / Urgency",
    bestFor: "Flash sale ending, last-chance emails, X hours left",
    performanceBenchmark: "Best RPR: $0.376 (Halloween #3 12h). Urgency bar mandatory. Single CTA only.",
  },
  "hero-cta": {
    name: "A — Hero + Single CTA",
    bestFor: "Product launch, sale launch, flash sale start, welcome",
    performanceBenchmark: "Best CTOR: 5.0% (Launch Email #1, $300 revenue). One dominant image, one CTA.",
  },
  "split": {
    name: "B — Split / Zig-Zag",
    bestFor: "Gifting guides, newsletters, multi-message promos",
    performanceBenchmark: "$191 (Gifting), $120 (Bundles). Two alternating blocks, each with its own CTA.",
  },
  "grid": {
    name: "C — Product Grid",
    bestFor: "Bundle offers, multi-product promotions, post-purchase upsell",
    performanceBenchmark: "Use for 2+ distinct products. 2-column grid collapses to 1 on mobile.",
  },
  "minimal": {
    name: "D — Minimal Text-Forward",
    bestFor: "Re-engagement, abandoned cart, personal/founder-voice emails",
    performanceBenchmark: "Works without images. Personal greeting, short copy, strong single CTA.",
  },
};

/** Return the right template HTML for the detected type */
export function getTemplate(type: EmailType): string {
  switch (type) {
    case "urgency":  return TEMPLATE_E;
    case "hero-cta": return TEMPLATE_A;
    case "split":    return TEMPLATE_B;
    case "grid":     return TEMPLATE_C;
    case "minimal":  return TEMPLATE_D;
  }
}
