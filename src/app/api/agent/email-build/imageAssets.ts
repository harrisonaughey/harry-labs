/**
 * Thinkle Drive image catalogue — updated 2026-06-01
 * All images visually inspected. Drive folder: 1jFprq92MYAomUn4shK6RnalHwqh52TfH
 *
 * CRITICAL RULE: Most images have promotional text BAKED IN to the artwork.
 * Using a "30% OFF" image in an "EOFY 20% off" email will confuse customers.
 * Match images to campaigns using the COMPATIBLE_WITH field below.
 */

export type DriveImage = {
  id: string;
  filename: string;
  embedUrl: string;
  description: string;
  hasBakedText: boolean;
  bakedTextDetails: string | null;
  compatibleWith: string[];
  tags: string[];
};

export const DRIVE_IMAGES: DriveImage[] = [
  {
    id: "1YICh6ZPZy4yzcYBN9LZsbXv40RctyAs6",
    filename: "photo.jpg",
    // Uploaded to Klaviyo CDN 2026-06-11 — permanent URL, no auth required
    embedUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/X7G8qZ/images/95855230-298a-414a-a3ed-32ad8f65c4dc.jpeg",
    description: "High-resolution professional lifestyle photo: young woman laughing joyfully at a table during a game, warm natural light, clean background. NO promotional text. Premium editorial quality.",
    hasBakedText: false,
    bakedTextDetails: null,
    compatibleWith: ["any"],
    tags: ["lifestyle", "hero", "emotion", "versatile", "no-text", "premium"],
  },
  {
    id: "1p2Nai0JWxlYNueqaic9HxBvRr2-V8g7x",
    filename: "1.png",
    // Uploaded to Klaviyo CDN 2026-06-11 — permanent URL
    embedUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/X7G8qZ/images/7952003d-8e67-44e6-8ec1-bee0f07fa243.png",
    description: "Black Friday promotional banner: dark chalkboard background, bold 'BLACK FRIDAY SPECIAL SUPER SALE' text, 'DISCOUNT $10 OFF', Thinkle orange card box product shot, confetti. Text baked in.",
    hasBakedText: true,
    bakedTextDetails: "BLACK FRIDAY | $10 OFF | SPECIAL SUPER SALE",
    compatibleWith: ["black-friday", "10-off"],
    tags: ["black-friday", "sale", "product-shot", "dark-bg"],
  },
  {
    id: "1U5NpqLbeEUUgyOWROPG-RcFVLSZ9UzZG",
    filename: "2.png",
    embedUrl: "https://drive.usercontent.google.com/download?id=1U5NpqLbeEUUgyOWROPG-RcFVLSZ9UzZG&export=view",
    description: "Black Friday lifestyle + product: women playing Thinkle around a table laughing, Thinkle product box, '$10 OFF' and 'DEAL LIVE NOW' text, confetti, 'SHOP and SAVE NOW' CTA. Text baked in.",
    hasBakedText: true,
    bakedTextDetails: "BLACK FRIDAY | $10 OFF | DEAL LIVE NOW",
    compatibleWith: ["black-friday", "10-off"],
    tags: ["black-friday", "lifestyle", "people-playing", "product-shot"],
  },
  {
    id: "1d8L__1wvN-YUlJpWhB3wEEpmh7NhIt39",
    filename: "3.png",
    embedUrl: "https://drive.usercontent.google.com/download?id=1d8L__1wvN-YUlJpWhB3wEEpmh7NhIt39&export=view",
    description: "Lifestyle + sale: people playing at table (close-up, engaged faces), tagline 'Speed, chaos, and connection — thinkle is the word game', '30% OFF' banner, 'SHOP BLACK FRIDAY SALE NOW'. Text baked in.",
    hasBakedText: true,
    bakedTextDetails: "30% OFF | SHOP BLACK FRIDAY SALE NOW",
    compatibleWith: ["30-off", "black-friday"],
    tags: ["lifestyle", "people-playing", "30-off", "social"],
  },
  {
    id: "1FRY1QGI6O7BzexcLU9PPh6qdZqI6-DOf",
    filename: "4.png",
    embedUrl: "https://drive.usercontent.google.com/download?id=1FRY1QGI6O7BzexcLU9PPh6qdZqI6-DOf&export=view",
    description: "Social proof + sale: large quote 'WE COULDN'T STOP LAUGHING FOR HOURS!', 5-star rating, group of friends playing outdoors, '30% OFF' and 'BLACK FRIDAY SALE' banners. Text baked in.",
    hasBakedText: true,
    bakedTextDetails: "30% OFF | BLACK FRIDAY SALE | social proof quote",
    compatibleWith: ["30-off", "black-friday"],
    tags: ["social-proof", "testimonial", "lifestyle", "outdoor", "30-off"],
  },
  {
    id: "1UsRi7xuSztnA14dbB5ivwHn_rBI9qOz4",
    filename: "5.png",
    embedUrl: "https://drive.usercontent.google.com/download?id=1UsRi7xuSztnA14dbB5ivwHn_rBI9qOz4&export=view",
    description: "Multi-review social proof panel: 'SEE WHY thinkle HAS BECOME THE GO-TO GAME FOR FAMILIES, MATES, AND PARTY NIGHTS' headline, three customer reviews (Jenny C, Christina M, Vicki G) with 5-star ratings, '30% OFF GRAB IT NOW'. Text baked in.",
    hasBakedText: true,
    bakedTextDetails: "30% OFF | multiple customer reviews | GRAB IT NOW",
    compatibleWith: ["30-off"],
    tags: ["social-proof", "multi-review", "30-off", "families"],
  },
  {
    id: "1N_Qv2mMISaEwLXWUdbWJooABV9GcZ8kk",
    filename: "6.png",
    // Uploaded to Klaviyo CDN 2026-06-11 — permanent URL
    embedUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/X7G8qZ/images/75bbe290-84d0-4643-832e-7f55ac038de0.png",
    description: "Christmas promotional: cream background, illustrated Christmas tree with Thinkle boxes as gifts, child opening present photo, '$10 OFF | SHOP NOW' CTA, 'WRAP UP SOME FUN THIS YEAR WHILE STOCK LASTS'. Text baked in.",
    hasBakedText: true,
    bakedTextDetails: "$10 OFF | Christmas | WHILE STOCK LASTS",
    compatibleWith: ["christmas", "10-off", "gifting"],
    tags: ["christmas", "seasonal", "gifting", "family", "product-shot"],
  },
  {
    id: "1c1srt5q_3PAov9trgAfkRdMu9YU9DZ1w",
    filename: "7.png",
    embedUrl: "https://drive.usercontent.google.com/download?id=1c1srt5q_3PAov9trgAfkRdMu9YU9DZ1w&export=view",
    description: "Product close-up lifestyle: Thinkle orange card box among scattered chocolates/sweets on table, 'Forget boring board games. thinkle is quick, creative, and guaranteed.' tagline, '30% OFF', 'Ready. Set. thinkle. SHOP NOW'. Text baked in.",
    hasBakedText: true,
    bakedTextDetails: "30% OFF | product lifestyle close-up",
    compatibleWith: ["30-off"],
    tags: ["product-shot", "lifestyle", "close-up", "30-off"],
  },
  {
    id: "1axJOOVMwqLn9Dp6y0PTgJ-rF_eqNCVs1",
    filename: "8.png",
    embedUrl: "https://drive.usercontent.google.com/download?id=1axJOOVMwqLn9Dp6y0PTgJ-rF_eqNCVs1&export=view",
    description: "Mid-sale urgency: orange gradient background, hand holding Thinkle box against sunset sky, 'HALFWAY THROUGH THE MADNESS' headline, '30% OFF', 'SHOP AND SAVE NOW'. Text baked in.",
    hasBakedText: true,
    bakedTextDetails: "HALFWAY THROUGH THE MADNESS | 30% OFF",
    compatibleWith: ["30-off", "mid-sale-urgency"],
    tags: ["urgency", "mid-sale", "30-off", "product-shot", "outdoor"],
  },
  {
    id: "11XZT65Zg83Aa4GFtzMr14bJUB8o19MON",
    filename: "10.png",
    embedUrl: "https://drive.usercontent.google.com/download?id=11XZT65Zg83Aa4GFtzMr14bJUB8o19MON&export=view",
    description: "Black Friday dark variant: dark textured background, 'DISCOUNT $10 OFF ALL thinkle GAMES' header bar, large 'BLACK FRIDAY SPECIAL SUPER SALE' text, Thinkle product box. Text baked in.",
    hasBakedText: true,
    bakedTextDetails: "BLACK FRIDAY | SPECIAL SUPER SALE | $10 OFF ALL thinkle GAMES",
    compatibleWith: ["black-friday", "10-off"],
    tags: ["black-friday", "dark-bg", "product-shot", "bold"],
  },
  {
    id: "1pE50uQlV9UQO_Hhj6EsshMdPZTBr2gYW",
    filename: "11.png",
    embedUrl: "https://drive.usercontent.google.com/download?id=1pE50uQlV9UQO_Hhj6EsshMdPZTBr2gYW&export=view",
    description: "Lifestyle collage: 4-panel grid of real people playing Thinkle in different settings (young adults outdoors, kitchen, mixed-age family group, children and adults). 'DISCOUNT $10 OFF' and 'BLACK FRIDAY' overlay text baked in.",
    hasBakedText: true,
    bakedTextDetails: "BLACK FRIDAY | $10 OFF | collage lifestyle",
    compatibleWith: ["black-friday", "10-off"],
    tags: ["black-friday", "lifestyle", "collage", "diverse-settings", "families"],
  },
  {
    id: "1F3zR5_quW5fVTStLFPy38bA5la7fdjmQ",
    filename: "12.png",
    embedUrl: "https://drive.usercontent.google.com/download?id=1F3zR5_quW5fVTStLFPy38bA5la7fdjmQ&export=view",
    description: "Lifestyle collage variant (same images as 11, slightly different crop): people playing in homes and outdoors, 'DISCOUNT $10 OFF', 'BLACK FRIDAY' overlay. Text baked in.",
    hasBakedText: true,
    bakedTextDetails: "BLACK FRIDAY | $10 OFF | collage variant",
    compatibleWith: ["black-friday", "10-off"],
    tags: ["black-friday", "lifestyle", "collage", "families"],
  },
];

/**
 * Given a brief + offer context, return the images the agent should consider.
 * Always returns photo.jpg first (most versatile), then matched campaign images.
 */
export function selectImages(brief: string): DriveImage[] {
  const b = brief.toLowerCase();
  const is30Off = /30\s*%/.test(b);
  const is10Off = /\$10/.test(b) || /10\s*(dollar|off)/.test(b);
  const isBF = /black.?friday|bf sale/.test(b);
  const isChristmas = /christmas|xmas/.test(b);
  const isGifting = /gift/.test(b);

  const photo = DRIVE_IMAGES.find(i => i.filename === "photo.jpg")!;
  const matched = DRIVE_IMAGES.filter(img => {
    if (img.filename === "photo.jpg") return false;
    if (img.compatibleWith.includes("any")) return true;
    if (isBF && img.compatibleWith.includes("black-friday")) return true;
    if (is10Off && !isBF && img.compatibleWith.includes("10-off") && !img.compatibleWith.includes("black-friday")) return true;
    if (is30Off && img.compatibleWith.includes("30-off")) return true;
    if (isChristmas && img.compatibleWith.includes("christmas")) return true;
    if (isGifting && img.compatibleWith.includes("gifting")) return true;
    return false;
  });

  return [photo, ...matched].slice(0, 4);
}

/** Build the image section text for the system prompt */
export function buildImageCatalogueText(selectedImages: DriveImage[]): string {
  const lines = selectedImages.map((img, i) => {
    const textNote = img.hasBakedText
      ? `⚠️ Has baked-in text: "${img.bakedTextDetails}" — only use if campaign matches`
      : `✅ No promotional text — safe for any campaign`;
    return `Image ${i + 1} — ${img.filename}
  URL: ${img.embedUrl}
  Visual: ${img.description}
  Usage: ${textNote}`;
  });

  return `## Images available for this campaign
The following images have been pre-selected based on the campaign brief.
IMPORTANT: Images marked ⚠️ have discount amounts or seasonal branding baked into the artwork — only use them if the campaign offer exactly matches.

${lines.join("\n\n")}

LOGO: Always use the verified Shopify CDN logo — https://thinkle.com.au/cdn/shop/files/thinkle_logo_reverse.png?v=1751999403&width=600 (width 160px)`;
}
