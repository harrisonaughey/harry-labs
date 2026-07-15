import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/app/api/agent/campaign-designer/route";

export const maxDuration = 300;

/**
 * Cron trigger for the Campaign Designer agent.
 * Runs daily at 08:00 UTC — calls runAgent() directly (no HTTP indirection).
 * Schedule configured in vercel.json: "0 8 * * *"
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAgent();
    console.log("[cron/campaign-designer]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron/campaign-designer] Error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
