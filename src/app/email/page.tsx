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

async function getKlaviyoData() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/klaviyo/campaigns`, {
      cache: "no-store",
    });
    if (!res.ok) return { lists: [], templates: [], klaviyoCampaigns: [] };
    const data = await res.json();
    return {
      lists:            data.lists            ?? [],
      templates:        data.templates        ?? [],
      klaviyoCampaigns: data.campaigns        ?? [],
    };
  } catch {
    return { lists: [], templates: [], klaviyoCampaigns: [] };
  }
}

async function getCalendarEntries() {
  try {
    const { data } = await db()
      .from("content_calendar")
      .select("id, name, brief, send_at, status, klaviyo_campaign_id")
      .order("send_at", { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function EmailPage() {
  const [stores, campaigns, flows, { lists, templates, klaviyoCampaigns }, calendarEntries] = await Promise.all([
    getStores(),
    getEmailData(),
    getFlowData(),
    getKlaviyoData(),
    getCalendarEntries(),
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
        <EmailDashboard
          campaigns={campaigns}
          flows={flows}
          lists={lists}
          calendarEntries={calendarEntries}
          klaviyoCampaigns={klaviyoCampaigns}
        />
      </main>
    </div>
  );
}
