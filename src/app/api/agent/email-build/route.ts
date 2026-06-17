import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { detectEmailType, getTemplate, TEMPLATE_META } from "./templates";
import { selectImages, buildImageCatalogueText } from "./imageAssets";
import { EMAIL_SYSTEM_PROMPT } from "./systemPrompt";
import {
  fetchKlaviyoImages,
  matchImagesToSlots,
  buildKlaviyoImageCatalogue,
  type MatchedImage,
} from "@/lib/klaviyo-images";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { brief, campaignName, listId, listName } = await req.json();

  if (!brief?.trim()) {
    return new Response(JSON.stringify({ error: "Brief is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── 1. Detect template type ──────────────────────────────────────────────
  const emailType    = detectEmailType(brief);
  const templateMeta = TEMPLATE_META[emailType];
  const templateHtml = getTemplate(emailType);

  // ── 2. Fetch & match images ──────────────────────────────────────────────
  // Try Klaviyo image library first; fall back to Google Drive catalogue
  let imageCatalogue: string;
  let matchedImages:  MatchedImage[] = [];
  let imageSource:    "klaviyo" | "drive" = "klaviyo";

  const klaviyoImages = await fetchKlaviyoImages();

  if (klaviyoImages.length > 0) {
    matchedImages  = matchImagesToSlots(klaviyoImages, emailType, brief);
    imageCatalogue = buildKlaviyoImageCatalogue(matchedImages, emailType);
    imageSource    = "klaviyo";
  } else {
    // Fallback — Google Drive images (legacy)
    const driveImages = selectImages(brief);
    imageCatalogue    = buildImageCatalogueText(driveImages);
    imageSource       = "drive";
    matchedImages     = driveImages.map((img, i) => ({
      slot:  i === 0 ? "IMAGE_1" : `IMAGE_${i + 1}`,
      image: {
        id:        img.id,
        name:      img.filename,
        imageUrl:  img.embedUrl,
        format:    img.filename.split(".").pop() ?? "jpg",
        hidden:    false,
        updatedAt: "",
      },
    }));
  }

  // ── 3. Build user message ────────────────────────────────────────────────
  const userMessage = [
    campaignName ? `Campaign name: ${campaignName}` : null,
    listName     ? `Target list: ${listName}`        : null,
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
    .filter((l): l is string => l !== null)
    .join("\n");

  // ── 4. Stream response ───────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model:      "claude-opus-4-7",
          max_tokens: 8192,
          system: [
            {
              type:          "text",
              text:          EMAIL_SYSTEM_PROMPT,
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

        // Done event — include image metadata so the UI can render thumbnails
        const imageMeta = matchedImages.map((m) => ({
          slot:   m.slot,
          name:   m.image.name,
          url:    m.image.imageUrl,
          format: m.image.format,
          source: imageSource,
        }));

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done:         true,
              emailType,
              templateName: templateMeta.name,
              images:       imageMeta,
              imageSource,
            })}\n\n`
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
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      Connection:      "keep-alive",
    },
  });
}
