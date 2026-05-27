import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "@/components/Sidebar";
import EmailDashboard from "@/components/email/EmailDashboard";
import EmailBuilder from "@/components/email/EmailBuilder";
import KlaviyoSyncButton from "@/components/email/KlaviyoSyncButton";
import { getStores } from "@/lib/stores";

export const revalidate = 300;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getEmailData() {
  const { data } = await db()
    .from("email_metrics")
    .select("*")
    .eq("platform", "klaviyo")
    .order("date", { ascending: false });
  return data ?? [];
}

async function getFlowData() {
  try {
    const { data } = await db()
      .from("flow_metrics")
      .select("*")
      .eq("platform", "klaviyo")
      .order("delivered", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

async function getKlaviyoLists() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/klaviyo/campaigns`, {
      cache: "no-store",
    });
    if (!res.ok) return { lists: [], templates: [] };
    return res.json();
  } catch {
    return { lists: [], templates: [] };
  }
}

export default async function EmailPage() {
  const [stores, campaigns, flows, { lists, templates }] = await Promise.all([
    getStores(),
    getEmailData(),
    getFlowData(),
    getKlaviyoLists(),
  ]);

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--bg-app)" }}>
      <Suspense>
        <Sidebar stores={stores} activePage="Email" />
      </Suspense>

      <main className="flex-1 overflow-y-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Email</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Klaviyo campaigns · flows · metrics · scheduling
            </p>
          </div>
          <div className="flex items-center gap-3">
            <KlaviyoSyncButton />
            <Suspense>
              <EmailBuilder lists={lists} templates={templates} />
            </Suspense>
          </div>
        </div>

        {/* Dashboard — tabs, filters, metrics, calendar/flows */}
        <EmailDashboard campaigns={campaigns} flows={flows} />
      </main>
    </div>
  );
}
