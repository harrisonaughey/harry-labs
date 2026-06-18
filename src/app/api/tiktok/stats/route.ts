import { NextRequest, NextResponse } from "next/server";
import { isTikTokConnected, getTikTokStats } from "@/lib/tiktok";

export async function GET(req: NextRequest) {
  if (!isTikTokConnected()) {
    return NextResponse.json({ error: "TikTok not connected" }, { status: 401 });
  }

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);

  try {
    const data = await getTikTokStats(days);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
