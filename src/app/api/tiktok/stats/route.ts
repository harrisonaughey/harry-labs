import { NextRequest, NextResponse } from "next/server";
import { isTikTokConnected, getTikTokStats } from "@/lib/tiktok";

export async function GET(req: NextRequest) {
  if (!isTikTokConnected()) {
    return NextResponse.json({ error: "TikTok not connected" }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  let since = p.get("since") ?? "";
  let until = p.get("until") ?? "";
  if (!since || !until) {
    const days  = parseInt(p.get("days") ?? "30", 10);
    const today = new Date();
    until = today.toISOString().slice(0, 10);
    const start = new Date(today); start.setDate(start.getDate() - days + 1);
    since = start.toISOString().slice(0, 10);
  }

  try {
    const data = await getTikTokStats({ since, until });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
