import { createClient } from "@supabase/supabase-js";
import PageLayout from "@/components/shared/PageLayout";
import { getStores } from "@/lib/stores";
import { getLists } from "@/lib/klaviyo";
import CalendarPageTabs from "@/components/content-calendar/CalendarPageTabs";

export const revalidate = 0;

const STORE_ID = "50f89d8a-ae07-4999-9ec7-4304a2f6c51b";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getEntries() {
  const { data } = await db()
    .from("content_calendar")
    .select("*")
    .order("send_at", { ascending: true, nullsFirst: false });
  return data ?? [];
}

async function getDesignRules() {
  const { data } = await db()
    .from("campaign_design_rules")
    .select("*")
    .eq("store_id", STORE_ID)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export default async function ContentCalendarPage() {
  const [stores, entries, rawLists, rules] = await Promise.all([
    getStores(),
    getEntries(),
    getLists().catch(() => []),
    getDesignRules(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lists = rawLists.map((l: any) => ({
    id:         l.id,
    attributes: { name: l.attributes?.name ?? l.id },
  }));

  const planned = entries.filter((e: any) => e.status === "planned").length;
  const done    = entries.filter((e: any) => e.status === "done").length;
  const active  = rules.filter((r: any) => r.is_active).length;

  return (
    <PageLayout
      stores={stores}
      activePage="Campaigns"
      title="Campaign Calendar"
      subtitle={`${entries.length} entries · ${planned} planned · ${done} done · ${active} design rule${active !== 1 ? "s" : ""} active`}
    >
      <CalendarPageTabs entries={entries} lists={lists} rules={rules} />
    </PageLayout>
  );
}
