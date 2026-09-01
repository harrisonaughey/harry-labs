import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const filePath = () => join(process.cwd(), "src", "data", "payment-tracking.json");

export async function GET() {
  try {
    const raw = readFileSync(filePath(), "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json({ entries: data.entries ?? [], rates: data.rates ?? {}, updated: data._meta?.updated ?? null });
  } catch {
    return NextResponse.json({ entries: [], rates: {}, updated: null });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, payment_status, payment_date, amount } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const raw = readFileSync(filePath(), "utf-8");
    const data = JSON.parse(raw);
    const idx = data.entries.findIndex((e: { id: string }) => e.id === id);
    if (idx === -1) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    if (payment_status !== undefined) data.entries[idx].payment_status = payment_status;
    if (payment_date !== undefined) data.entries[idx].payment_date = payment_date;
    if (amount !== undefined) data.entries[idx].amount = amount;
    data._meta.updated = new Date().toISOString().split("T")[0];

    writeFileSync(filePath(), JSON.stringify(data, null, 2));
    return NextResponse.json({ ok: true, entry: data.entries[idx] });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
