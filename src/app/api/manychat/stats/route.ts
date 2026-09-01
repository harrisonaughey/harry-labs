import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.MANYCHAT_API_KEY ?? "";
  if (!key) {
    return NextResponse.json({ error: "not_configured" }, { status: 400 });
  }

  const res = await fetch("https://api.manychat.com/fb/page/getInfo", {
    headers: { Authorization: `Bearer ${key}` },
    next: { revalidate: 300 },
  });

  const data = await res.json();

  if (!res.ok || data.status !== "success") {
    return NextResponse.json(
      { error: data.message ?? "ManyChat API error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    name:        data.data.name        ?? "",
    pageId:      data.data.id          ?? "",
    subscribers: data.data.subscribers_count ?? 0,
  });
}
