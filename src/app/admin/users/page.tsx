import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import UsersView from "@/components/admin/UsersView";
import { getCurrentUser } from "@/lib/supabase/server";
import { getStores } from "@/lib/stores";

export default async function AdminUsersPage() {
  const [user, stores] = await Promise.all([getCurrentUser(), getStores()]);

  if (!user) redirect("/login");
  if (user.profile.role !== "admin") redirect("/");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar stores={stores} activePage="Users" />
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <UsersView currentUserId={user.id} />
      </main>
    </div>
  );
}
