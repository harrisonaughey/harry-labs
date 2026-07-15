import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return null;
  return user;
}

// GET /api/admin/users — list all users with profiles
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();

  const [{ data: authData }, { data: profiles }] = await Promise.all([
    adminClient.auth.admin.listUsers({ perPage: 200 }),
    adminClient.from("profiles").select("*").order("created_at", { ascending: true }),
  ]);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const users = (authData?.users ?? []).map((u) => {
    const profile = profileMap.get(u.id) as any;
    const totpFactors = (u as any).factors?.filter((f: any) => f.factor_type === "totp") ?? [];
    return {
      id: u.id,
      email: u.email,
      full_name: profile?.full_name ?? u.user_metadata?.full_name ?? "",
      role: profile?.role ?? "viewer",
      is_active: profile?.is_active ?? true,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      mfa_enabled: totpFactors.some((f: any) => f.status === "verified"),
      invited: !u.confirmed_at && !!u.invited_at,
    };
  });

  return NextResponse.json({ users });
}

// POST /api/admin/users — invite a new user
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, full_name, role } = await req.json();

  if (!email || !["admin", "viewer", "tester"].includes(role)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name ?? "", role },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Upsert profile (trigger may not fire for invited users)
  await adminClient.from("profiles").upsert({
    id: data.user.id,
    email,
    full_name: full_name ?? "",
    role,
    is_active: true,
  });

  return NextResponse.json({ success: true, id: data.user.id });
}
