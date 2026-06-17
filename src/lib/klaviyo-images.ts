/**
 * Klaviyo Image Library — server-side utilities
 *
 * Fetches images from the Klaviyo image library (GET /images/) and matches
 * them to the correct slots for each email template type (A–E).
 *
 * Why Klaviyo images over Google Drive:
 * - Permanent CDN URLs (Cloudfront) — never expire, no auth redirect
 * - Guaranteed to load in every major email client
 * - Already in the Klaviyo account — no cross-origin issues
 * - Fast: images are globally cached on Klaviyo's CDN
 *
 * Template → slot mapping:
 * - Template A (Hero CTA):  IMAGE_1 [600px hero]
 * - Template B (Split):     IMAGE_1 [300px left] + IMAGE_2 [300px right]
 * - Template C (Grid):      IMAGE_1 [600px hero] + PRODUCT_1_IMAGE + PRODUCT_2_IMAGE
 * - Template D (Minimal):   IMAGE_1 [600px supporting, below copy]
 * - Template E (Urgency):   IMAGE_1 [600px hero — must convey urgency/energy]
 */

import type { EmailType } from "@/app/api/agent/email-build/templates";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KlaviyoImage {
  id:        string;
  name:      string;      // user-assigned name in Klaviyo
  imageUrl:  string;      // permanent CDN URL — use directly in <img src="...">
  format:    string;      // jpg | png | gif | webp
  hidden:    boolean;
  updatedAt: string;      // ISO timestamp — used to prefer recent images
}

export interface ImageSlot {
  placeholder:  string;   // {{IMAGE_1}}, {{PRODUCT_1_IMAGE}}, etc.
  role:         "hero" | "split" | "product" | "supporting";
  idealWidth:   number;   // px
  description:  string;   // passed to agent so it writes accurate alt text
}

export interface MatchedImage {
  slot:     string;       // same as ImageSlot.placeholder
  image:    KlaviyoImage;
}

// ─── Template slot definitions ────────────────────────────────────────────────

export const TEMPLATE_SLOTS: Record<EmailType, ImageSlot[]> = {
  "urgency": [
    {
      placeholder: "IMAGE_1",
      role:        "hero",
      idealWidth:  600,
      description: "LANDSCAPE hero banner (600×380px display / 1200×760 source). " +
                   "Used as CSS background-image with offer text overlaid on top. " +
                   "Prefer campaign-specific images with existing text/design (Boxing Day, Christmas, BF). " +
                   "Lifestyle or product shot — must be wider than tall (landscape only).",
    },
  ],
  "hero-cta": [
    {
      placeholder: "IMAGE_1",
      role:        "hero",
      idealWidth:  600,
      description: "LANDSCAPE hero banner (600×380px display / 1200×760 source). " +
                   "Used as CSS background-image with headline text overlaid on top. " +
                   "Premium lifestyle shot or campaign banner — wider than tall (landscape only). " +
                   "Prefer thinkle-lifestyle-hero or campaign-specific banners.",
    },
  ],
  "split": [
    {
      placeholder: "IMAGE_1",
      role:        "split",
      idealWidth:  300,
      description: "Left side of a split row (300 × ~300px). Lifestyle or people shot — " +
                   "group interaction, friends playing, family moment.",
    },
    {
      placeholder: "IMAGE_2",
      role:        "split",
      idealWidth:  300,
      description: "Right side of second split row (300 × ~300px). Product close-up or " +
                   "complementary lifestyle angle — different from IMAGE_1.",
    },
  ],
  "grid": [
    {
      placeholder: "IMAGE_1",
      role:        "hero",
      idealWidth:  600,
      description: "Full-width header image (600 × ~300px). Wide product overview or lifestyle scene. " +
                   "Sets the visual tone for the whole email.",
    },
    {
      placeholder: "PRODUCT_1_IMAGE",
      role:        "product",
      idealWidth:  232,
      description: "First product card image (232 × ~232px). Individual product shot — clean background, " +
                   "full product visible. Use the primary SKU.",
    },
    {
      placeholder: "PRODUCT_2_IMAGE",
      role:        "product",
      idealWidth:  232,
      description: "Second product card image (232 × ~232px). Complementary product, bundle, or " +
                   "alternate angle of the same product.",
    },
  ],
  "minimal": [
    {
      placeholder: "IMAGE_1",
      role:        "supporting",
      idealWidth:  600,
      description: "Supporting image below the copy block (600 × ~300px). Warm, human, non-salesy. " +
                   "Lifestyle scene or product in a natural setting. Email must read perfectly without it.",
    },
  ],
};

// ─── Klaviyo API fetch ────────────────────────────────────────────────────────

async function klaviyoGet(path: string): Promise<any> {
  const res = await fetch(`https://a.klaviyo.com/api${path}`, {
    headers: {
      Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`,
      revision:      "2024-10-15",
      Accept:        "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Klaviyo images ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Fetch all visible images from the Klaviyo image library.
 * Returns newest-first, skips hidden images.
 * Never throws — returns [] on error so callers can fall back gracefully.
 */
export async function fetchKlaviyoImages(limit = 100): Promise<KlaviyoImage[]> {
  try {
    const resp = await klaviyoGet(
      `/images/?page[size]=${limit}&sort=-updated_at&fields[image]=name,image_url,format,size,hidden,updated_at`
    );

    return (resp.data ?? [])
      .filter((item: any) => !item.attributes?.hidden && item.attributes?.image_url)
      .map((item: any): KlaviyoImage => ({
        id:        item.id,
        name:      (item.attributes?.name ?? "").replace(/\.[a-z]+$/i, ""), // strip extension
        imageUrl:  item.attributes.image_url,
        format:    item.attributes?.format ?? "jpg",
        hidden:    item.attributes?.hidden ?? false,
        updatedAt: item.attributes?.updated_at ?? "",
      }));
  } catch (err: any) {
    console.warn("[klaviyo-images] fetch failed:", err.message);
    return [];
  }
}

// ─── Image scoring & matching ─────────────────────────────────────────────────

/**
 * Score a Klaviyo image for a given slot + campaign brief.
 * Higher = better match.
 */
function scoreImage(img: KlaviyoImage, brief: string, slot: ImageSlot): number {
  const n = img.name.toLowerCase();
  const b = brief.toLowerCase();
  let score = 0;

  // ── Role preference (image name hints) ──
  if (slot.role === "hero") {
    if (/hero|banner|feature|main|header|cover/.test(n)) score += 5;
    if (/lifestyle|people|group|friends|family|playing/.test(n)) score += 3;
    if (/thinkle.lifestyle|thinkle.hero/.test(n)) score += 6; // prefer our named uploads
    if (/product|box|pack/.test(n)) score += 1;
    // Penalise cropped/split variants as main hero
    if (/\.cropped|\.\d+$/.test(n)) score -= 2;
  }
  if (slot.role === "split") {
    if (/lifestyle|people|group|friends|family|playing/.test(n)) score += 4;
    if (/hero|banner/.test(n)) score += 2;
    if (/campaign|movement|connection/.test(n)) score += 3;
  }
  if (slot.role === "product") {
    if (/product|box|pack|item|variant|sku|close/.test(n)) score += 5;
    if (/thinkle ec|thinkle.product/.test(n)) score += 6; // prefer our named uploads
    if (/lifestyle|people/.test(n)) score -= 2; // prefer clean product shots
  }
  if (slot.role === "supporting") {
    if (/lifestyle|warm|natural|home|family|playing|fun|game/.test(n)) score += 4;
    if (/thinkle.lifestyle/.test(n)) score += 5; // prefer our named uploads
  }

  // ── Campaign type matching (name vs brief) ──
  if (/black.?friday|bf\b/.test(b)  && /black.?friday|bf\b/.test(n))    score += 6;
  if (/christmas|xmas/.test(b)      && /christmas|xmas|holiday/.test(n)) score += 6;
  if (/halloween/.test(b)           && /halloween/.test(n))              score += 6;
  if (/eofy|end.of.year/.test(b)    && /eofy|end.of.year/.test(n))       score += 5;
  if (/30\s*%/.test(b)              && /30.?off/.test(n))                score += 5;
  if (/\$10|10\s*off/.test(b)       && /10.?off|\$10/.test(n))           score += 5;
  if (/sale|discount|promo/.test(b) && /sale|discount|promo/.test(n))    score += 3;
  if (/gift/.test(b)                && /gift|present|wrap/.test(n))      score += 4;
  if (/urgency|last.?chance/.test(b)&& /urgent|last|final|end/.test(n))  score += 4;

  // ── Format preference per role ──
  if (slot.role !== "product" && img.format === "jpg") score += 1;
  if (slot.role === "product" && img.format === "png") score += 1;

  // Slight boost for recent images (assume newer = more relevant campaign)
  const ageDays = img.updatedAt
    ? (Date.now() - new Date(img.updatedAt).getTime()) / 86_400_000
    : 999;
  if (ageDays < 30)  score += 2;
  if (ageDays < 90)  score += 1;

  return score;
}

/**
 * Match images to each template slot for a campaign.
 * - Each slot gets the highest-scoring unused image.
 * - Returns an array of { slot, image } pairs (may be shorter than slots if images run out).
 */
export function matchImagesToSlots(
  images:    KlaviyoImage[],
  emailType: EmailType,
  brief:     string
): MatchedImage[] {
  const slots  = TEMPLATE_SLOTS[emailType] ?? [];
  const used   = new Set<string>();
  const result: MatchedImage[] = [];

  for (const slot of slots) {
    const candidates = images
      .filter((img) => !used.has(img.id))
      .map((img)    => ({ img, score: scoreImage(img, brief, slot) }))
      .sort((a, b)  => b.score - a.score);

    if (candidates[0]) {
      result.push({ slot: slot.placeholder, image: candidates[0].img });
      used.add(candidates[0].img.id);
    }
  }

  return result;
}

// ─── Agent prompt catalogue builder ──────────────────────────────────────────

/**
 * Build the image section text injected into the agent's user message.
 * Tells Claude exactly which Klaviyo CDN URL to drop into each template slot.
 */
export function buildKlaviyoImageCatalogue(
  matched:   MatchedImage[],
  emailType: EmailType
): string {
  const slots = TEMPLATE_SLOTS[emailType] ?? [];

  if (matched.length === 0) {
    return `## Images
No images were found in the Klaviyo image library for this campaign.
Use the verified Thinkle logo as a hero fallback: https://thinkle.com.au/cdn/shop/files/thinkle_logo_reverse.png?v=1751999403&width=600
Or use a styled solid-colour block instead — do NOT invent or guess image URLs.`;
  }

  const slotMap = new Map(matched.map((m) => [m.slot, m]));

  const lines = slots.map((slot) => {
    const match = slotMap.get(slot.placeholder);
    if (!match) {
      return `### {{${slot.placeholder}}} — NOT MATCHED
No suitable image found for this slot. Leave the src attribute as an empty string or omit this image block.`;
    }

    return `### {{${slot.placeholder}}} ← ${slot.role.toUpperCase()} SLOT (${slot.idealWidth}px wide)
Klaviyo CDN URL:  ${match.image.imageUrl}
Image name:       ${match.image.name}
Format:           ${match.image.format.toUpperCase()}
Slot requirement: ${slot.description}
Alt text hint:    Write descriptive alt text based on the image name and slot role.
Width attribute:  width="${slot.idealWidth}" (always set explicitly)
⚠️ CRITICAL: Copy this URL exactly — never truncate or modify Klaviyo CDN URLs.`;
  });

  return `## Klaviyo Image Library — use these CDN URLs in the HTML

These images are hosted in the Thinkle Klaviyo account.
Klaviyo CDN URLs (d3k81ch9hvuctc.cloudfront.net or similar) are permanent,
globally cached, and render in every major email client without auth.

RULES:
1. Copy each URL character-for-character — no shortening, no placeholders
2. Hero images (IMAGE_1) MUST be used as CSS background-image with text overlaid — NOT as a plain <img>
   Use the background-image hero pattern from the brand standards (rgba overlay + white headline on top)
3. Hero image container: min-height:380px, background-position:center top
4. Always include descriptive alt="" text
5. Images must be landscape (wider than tall) — portrait images will be cropped via background-size:cover

${lines.join("\n\n")}`;
}
