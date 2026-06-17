import { NextRequest, NextResponse } from "next/server";

/**
 * Cron trigger for the Campaign Designer agent.
 * Runs daily at 08:00 UTC — calls the agent route which does the real work.
 * Schedule configured in vercel.json: "0 8 * * *"
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const agentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/agent/campaign-designer`;
    const res = await fetch(agentUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const result = await res.json();
    console.log("[cron/campaign-designer]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
