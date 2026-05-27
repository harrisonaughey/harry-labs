import { NextRequest, NextResponse } from "next/server";
import { createCampaign } from "@/lib/klaviyo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createCampaign(body);
    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
