import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role for server-side writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const state = searchParams.get("state");
  const storedState = req.cookies.get("shopify_oauth_state")?.value;

  // Validate CSRF state
  if (!state || !storedState || state !== storedState) {
    return NextResponse.json({ error: "Invalid state parameter" }, { status: 403 });
  }

  if (!code || !shop) {
    return NextResponse.json({ error: "Missing code or shop" }, { status: 400 });
  }

  // Exchange code for access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "Failed to exchange token" }, { status: 500 });
  }

  const tokenJson = await tokenRes.json();
  const { access_token, scope } = tokenJson;

  if (!access_token) {
    return NextResponse.json({ error: "No access token returned", detail: tokenJson }, { status: 500 });
  }

  // Fetch store info
  const shopRes = await fetch(`https://${shop}/admin/api/2026-04/shop.json`, {
    headers: { "X-Shopify-Access-Token": access_token },
  });
  const shopJson = await shopRes.json();
  const shopData = shopJson.shop;

  if (!shopData) {
    return NextResponse.json({ error: "Could not fetch shop data", detail: shopJson }, { status: 500 });
  }

  // Upsert store into Supabase
  const { error } = await supabase.from("stores").upsert(
    {
      shop_domain: shop,
      name: shopData.name,
      access_token,
      scopes: scope,
      currency: shopData.currency,
      timezone: shopData.iana_timezone,
      is_active: true,
      installed_at: new Date().toISOString(),
    },
    { onConflict: "shop_domain" }
  );

  if (error) {
    console.error("Supabase upsert error:", error);
    return NextResponse.json({ error: "Failed to save store", detail: error.message, code: error.code }, { status: 500 });
  }

  // Redirect back to dashboard
  const response = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}?store=${shop}&connected=true`
  );
  response.cookies.delete("shopify_oauth_state");
  return response;
}
