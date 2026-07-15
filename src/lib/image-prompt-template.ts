/**
 * ChatGPT image generation prompt template for Thinkle email campaign creatives.
 *
 * Output spec: 1200×2100px PNG — retina-safe for 600px email columns on all devices.
 * Harrison pastes the returned string directly into ChatGPT image generation.
 *
 * Process after generating:
 *  1. Download the PNG from ChatGPT
 *  2. Upload to harry-labs dashboard (or drop in Claude chat)
 *  3. The pipeline auto-checks dimensions and uploads to Klaviyo CDN at full res
 */

export interface ImagePromptParams {
  campaignName:   string;   // e.g. "Mid-Year Clearance"
  headline:       string;   // 2–4 words max — appears large on hero
  subheadline:    string;   // 1 line supporting copy
  ctaText:        string;   // CTA button text e.g. "SHOP CLEARANCE NOW"
  photoGuidance?: string;   // optional extra direction for the lifestyle shot
}

/**
 * Derive smart defaults from the campaign name when explicit params aren't provided.
 */
export function inferImageParams(campaignName: string): Omit<ImagePromptParams, "campaignName"> {
  const n = campaignName.toLowerCase();

  if (/christmas in july/i.test(n)) return {
    headline:    "CHRISTMAS IN JULY",
    subheadline: "The cosy gift idea for quick thinking, big laughs & memorable game nights.",
    ctaText:     "SHOP CHRISTMAS GIFTS",
    photoGuidance: "Warm Christmas tree lights in background. People in cosy winter knits. Wrapped gifts on table.",
  };
  if (/eofy|end of financial/i.test(n)) return {
    headline:    "EOFY SALE",
    subheadline: "$10 off automatically applied at checkout. No code needed.",
    ctaText:     "SHOP THE EOFY SALE",
    photoGuidance: "Energetic, celebratory vibe. Mix of ages — families and young adults.",
  };
  if (/clearance|mid.year/i.test(n)) return {
    headline:    "CLEARANCE SALE",
    subheadline: "Stock is moving fast — grab it before it's gone.",
    ctaText:     "SHOP CLEARANCE NOW",
    photoGuidance: "Excited, urgent energy. Friends gathered, game mid-play, laughter.",
  };
  if (/black friday/i.test(n)) return {
    headline:    "BLACK FRIDAY",
    subheadline: "Our biggest sale of the year. One day only.",
    ctaText:     "SHOP BLACK FRIDAY",
    photoGuidance: "Dark, dramatic background. High-energy. Bold contrast. Confetti optional.",
  };
  if (/payday/i.test(n)) return {
    headline:    "PAYDAY TREAT",
    subheadline: "You've earned it. Treat the family to a game night.",
    ctaText:     "SHOP NOW",
  };
  if (/afterpay/i.test(n)) return {
    headline:    "AFTERPAY DAY",
    subheadline: "Buy now, pay later. 4 interest-free instalments.",
    ctaText:     "SHOP WITH AFTERPAY",
  };
  if (/bundle/i.test(n)) return {
    headline:    "BUNDLE & SAVE",
    subheadline: "More games, more laughs, more value.",
    ctaText:     "SHOP THE BUNDLE",
  };
  if (/flash sale|weekend/i.test(n)) return {
    headline:    "FLASH SALE",
    subheadline: "48 hours only. Don't miss it.",
    ctaText:     "SHOP THE FLASH SALE",
  };
  if (/gift guide/i.test(n)) return {
    headline:    "GIFT GUIDE",
    subheadline: "The game everyone actually wants to play.",
    ctaText:     "SHOP GIFT IDEAS",
    photoGuidance: "Wrapped presents. Gift bags. Warm gifting scene.",
  };

  // Generic fallback
  return {
    headline:    campaignName.toUpperCase(),
    subheadline: "Quick thinking, big laughs & memorable game nights.",
    ctaText:     "SHOP NOW",
  };
}

/**
 * Returns the full ChatGPT image generation prompt for a campaign creative.
 * Paste this directly into ChatGPT → image generation.
 */
export function buildImagePrompt(params: ImagePromptParams): string {
  const { campaignName, headline, subheadline, ctaText, photoGuidance } = params;

  return `Create a campaign email creative for Thinkle, the Australian family card game.

━━━ OUTPUT SPECIFICATION ━━━
• Size: 1200px wide × 2100px tall (portrait)
• Format: PNG
• No borders, outer shadows or frames

━━━ BRAND ━━━
• Hero background: Thinkle orange (#f97316) — fills top 55% of image
• Bottom strip background: warm cream (#fdf8f3) — fills bottom 20%
• Headline text: white, bold, heavy weight
• Logo wordmark: "thinkle™" with "first thought fun" below — white, centred, top of image
• CTA button: dark charcoal rounded pill (#111118) with white bold text

━━━ CAMPAIGN CONTENT ━━━
Campaign label : ${campaignName.toUpperCase()}
Headline       : ${headline}
Subheadline    : ${subheadline}
CTA button text: ${ctaText} →

━━━ LAYOUT (top → bottom) ━━━
1. Logo — "thinkle™ / first thought fun" white wordmark, centred, 32px top padding
2. Campaign label — small white ALL CAPS, 13px, wide letter-spacing
3. Headline — large bold white, 64–72px, 1–3 words
4. Subheadline — 1 line, 18px white, regular weight
5. CTA button — dark charcoal pill, white bold text, centred
6. Lifestyle photo — fills middle 35%: 2–4 people laughing around a table playing Thinkle,
   Thinkle orange box clearly visible on table, warm natural indoor lighting${photoGuidance ? `,\n   ${photoGuidance}` : ""}
7. Bottom feature strip (cream #fdf8f3, ~220px tall) — 4 items in a row with orange line icons:
   "Perfect for all ages" | "Gift-ready fun" | "Great for family & friends" | "Loved by 100,000+ players"
   Icons: simple orange outlines above each label. Labels: 11px uppercase bold dark text

━━━ IMPORTANT RULES ━━━
• Thinkle box must be orange, clearly recognisable, with the cloud thought-bubble logo
• Lifestyle photo: authentic — genuine laughter and surprise, NOT stiff stock-photo poses
• People: mixed ages (include at least one intergenerational pairing — parent/child or grandparent)
• No additional logos, watermarks or text beyond what is specified above
• Keep the orange hero area uncluttered — headline text must be the focal point
• Image must look sharp and print-quality at 1200px wide`.trim();
}
