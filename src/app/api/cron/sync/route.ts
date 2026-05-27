import { NextRequest, NextResponse } from "next/server";
import { syncAllStores } from "@/lib/sync";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await syncAllStores();
  console.log("[cron/sync] completed:", JSON.stringify(summary));

  return NextResponse.json({
    success: true,
    synced_at: new Date().toISOString(),
    stores: summary,
  });
}
