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

  return profile?.role === "admin" ? user : null;
}

// PATCH /api/admin/users/[id] — update role or active status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const adminClient = createAdminClient();

  const profileUpdate: Record<string, any> = {};
  const metaUpdate: Record<string, any> = {};

  if (body.role !== undefined) {
    if (!["admin", "viewer", "tester"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    profileUpdate.role = body.role;
    metaUpdate.role = body.role;
  }

  if (body.full_name !== undefined) {
    profileUpdate.full_name = body.full_name;
    metaUpdate.full_name = body.full_name;
  }

  if (body.is_active !== undefined) {
    profileUpdate.is_active = body.is_active;
  }

  // Update auth user metadata
  if (Object.keys(metaUpdate).length > 0) {
    await adminClient.auth.admin.updateUserById(id, { user_metadata: metaUpdate });
  }

  // Update profiles table
  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await adminClient
      .from("profiles")
      .update(profileUpdate)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/users/[id] — remove a user
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Prevent self-deletion
  if (id === admin.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
