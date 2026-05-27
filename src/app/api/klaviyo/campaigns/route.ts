import { NextResponse } from "next/server";
import { getCampaigns, getLists, getTemplates } from "@/lib/klaviyo";

export async function GET() {
  try {
    const [campaigns, lists, templates] = await Promise.all([
      getCampaigns(),
      getLists(),
      getTemplates(),
    ]);
    return NextResponse.json({ campaigns, lists, templates });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
