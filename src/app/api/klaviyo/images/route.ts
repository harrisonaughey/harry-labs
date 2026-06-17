/**
 * GET /api/klaviyo/images
 *
 * Proxies the Klaviyo image library to the client.
 * Used by EmailBuilder to show image previews and let the user
 * verify which images will be used before generating.
 */
import { NextResponse } from "next/server";
import { fetchKlaviyoImages } from "@/lib/klaviyo-images";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const images = await fetchKlaviyoImages(100);
    return NextResponse.json({ images, count: images.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, images: [] }, { status: 500 });
  }
}
