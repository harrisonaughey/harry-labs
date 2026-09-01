import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const filePath = () => join(process.cwd(), "src", "data", "creative-tracking.json");

export async function GET() {
  try {
    const raw = readFileSync(filePath(), "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json({ creatives: data.creatives ?? [], updated: data._meta?.updated ?? null });
  } catch {
    return NextResponse.json({ creatives: [], updated: null });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, field, value } = await req.json();
    if (!id || !field) return NextResponse.json({ error: "Missing id or field" }, { status: 400 });

    const raw = readFileSync(filePath(), "utf-8");
    const data = JSON.parse(raw);
    const idx = data.creatives.findIndex((c: { id: string }) => c.id === id);
    if (idx === -1) return NextResponse.json({ error: "Creative not found" }, { status: 404 });

    data.creatives[idx][field] = value;
    data._meta.updated = new Date().toISOString().split("T")[0];
    writeFileSync(filePath(), JSON.stringify(data, null, 2));

    return NextResponse.json({ ok: true, creative: data.creatives[idx] });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
