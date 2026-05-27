import { NextResponse } from "next/server";

const META_BASE = "https://graph.facebook.com/v19.0";

export async function GET() {
  const token     = process.env.META_ACCESS_TOKEN ?? "";
  const rawAccId  = process.env.META_AD_ACCOUNT_ID ?? "";
  const accountId = rawAccId.startsWith("act_") ? rawAccId : `act_${rawAccId}`;

  const results: Record<string, any> = {
    env: {
      META_ACCESS_TOKEN:   token   ? `set (${token.slice(0, 8)}...)` : "MISSING",
      META_AD_ACCOUNT_ID:  rawAccId ? `set (${rawAccId})` : "MISSING",
      accountIdUsed:       accountId,
    },
  };

  if (!token) return NextResponse.json(results);

  // 1. Validate token + get token info
  try {
    const r = await fetch(`${META_BASE}/me?fields=id,name&access_token=${token}`);
    const d = await r.json();
    results.tokenCheck = r.ok ? { ok: true, id: d.id, name: d.name } : { ok: false, error: d?.error };
  } catch (e: any) {
    results.tokenCheck = { ok: false, error: e.message };
  }

  // 2. Check token permissions / scopes
  try {
    const r = await fetch(`${META_BASE}/me/permissions?access_token=${token}`);
    const d = await r.json();
    results.permissions = r.ok
      ? d.data?.map((p: any) => `${p.permission}:${p.status}`)
      : { error: d?.error };
  } catch (e: any) {
    results.permissions = { error: (e as Error).message };
  }

  // 3. Try to read the ad account
  try {
    const r = await fetch(`${META_BASE}/${accountId}?fields=id,name,account_status,currency&access_token=${token}`);
    const d = await r.json();
    results.adAccount = r.ok ? { ok: true, ...d } : { ok: false, error: d?.error };
  } catch (e: any) {
    results.adAccount = { ok: false, error: (e as Error).message };
  }

  // 4. Try insights (the actual call that's failing)
  try {
    const r = await fetch(`${META_BASE}/${accountId}/insights?fields=spend&date_preset=last_7_d&level=account&access_token=${token}`);
    const d = await r.json();
    results.insightsTest = r.ok ? { ok: true, data: d.data } : { ok: false, error: d?.error };
  } catch (e: any) {
    results.insightsTest = { ok: false, error: (e as Error).message };
  }

  return NextResponse.json(results, { status: 200 });
}
