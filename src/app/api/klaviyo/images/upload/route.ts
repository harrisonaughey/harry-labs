/**
 * POST /api/klaviyo/images/upload
 *
 * Accepts a campaign image, enforces retina-safe dimensions (min 1200px wide),
 * upscales with Lanczos if needed, then uploads to Klaviyo CDN.
 *
 * Returns: { url, width, height, upscaled, sizeKb }
 */
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const KLAVIYO_KEY = process.env.KLAVIYO_API_KEY!;
const MIN_WIDTH = 1200; // retina-safe minimum for 600px email columns

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const name = (form.get("name") as string | null) ?? "campaign-image";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    const srcWidth = meta.width ?? 0;
    const srcHeight = meta.height ?? 0;

    // Upscale to MIN_WIDTH if source is too small
    let finalBuffer: Buffer;
    let finalWidth = srcWidth;
    let finalHeight = srcHeight;
    let upscaled = false;

    if (srcWidth < MIN_WIDTH) {
      const scale = MIN_WIDTH / srcWidth;
      finalWidth = MIN_WIDTH;
      finalHeight = Math.round(srcHeight * scale);
      finalBuffer = Buffer.from(
        await sharp(buffer)
          .resize(finalWidth, finalHeight, { kernel: sharp.kernel.lanczos3 })
          .png({ compressionLevel: 6 })
          .toBuffer()
      );
      upscaled = true;
    } else {
      finalBuffer = Buffer.from(
        await sharp(buffer).png({ compressionLevel: 6 }).toBuffer()
      );
    }

    // Upload to Klaviyo CDN
    const boundary = crypto.randomUUID().replace(/-/g, "");
    const CRLF = "\r\n";
    const bodyParts = [
      `--${boundary}${CRLF}Content-Disposition: form-data; name="name"${CRLF}${CRLF}${name}`,
      `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${name}.png"${CRLF}Content-Type: image/png${CRLF}${CRLF}`,
    ];

    const encoder = new TextEncoder();
    const part1 = encoder.encode(bodyParts[0] + CRLF);
    const part2 = encoder.encode(bodyParts[1]);
    const closing = encoder.encode(`${CRLF}--${boundary}--${CRLF}`);

    const bodyBuffer = Buffer.concat([
      Buffer.from(part1),
      Buffer.from(part2),
      finalBuffer,
      Buffer.from(closing),
    ]);

    const klaviyoResp = await fetch("https://a.klaviyo.com/api/images/", {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${KLAVIYO_KEY}`,
        revision: "2024-10-15",
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Accept: "application/json",
      },
      body: bodyBuffer,
    });

    if (!klaviyoResp.ok) {
      const err = await klaviyoResp.text();
      throw new Error(`Klaviyo upload failed ${klaviyoResp.status}: ${err}`);
    }

    const klaviyoData = await klaviyoResp.json();
    const cdnUrl: string = klaviyoData.data.attributes.image_url;

    return NextResponse.json({
      url: cdnUrl,
      width: finalWidth,
      height: finalHeight,
      originalWidth: srcWidth,
      originalHeight: srcHeight,
      upscaled,
      sizeKb: Math.round(finalBuffer.length / 1024),
    });
  } catch (e: any) {
    console.error("[image-upload]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
