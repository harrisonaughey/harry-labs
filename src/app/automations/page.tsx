import { createClient } from "@supabase/supabase-js";
import PageLayout from "@/components/shared/PageLayout";
import { getStores } from "@/lib/stores";
import Link from "next/link";
import CampaignDesignerCard from "@/components/automations/CampaignDesignerCard";

export const revalidate = 300;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getFlows() {
  const { data } = await db()
    .from("flow_metrics")
    .select("flow_id, flow_name, status, recipients, open_rate, click_rate, revenue, updated_at")
    .order("revenue", { ascending: false })
    .limit(20);
  return data ?? [];
}

async function getAgentStats() {
  try {
    const { data } = await db()
      .from("agent_actions")
      .select("id, agent_name, status, created_at")
      .eq("agent_name", "campaign-designer")
      .order("created_at", { ascending: false })
      .limit(10);
    return data ?? [];
  } catch { return []; }
}

async function getCalendarUpcoming() {
  try {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 14);
    const { data } = await db()
      .from("content_calendar")
      .select("id, name, send_at, status, klaviyo_campaign_id, klaviyo_template_id")
      .lte("send_at", horizon.toISOString())
      .order("send_at", { ascending: true })
      .limit(10);
    return data ?? [];
  } catch { return []; }
}

function fmt(n: number) {
  return n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + n.toFixed(2);
}

export default async function AutomationsPage() {
  const [stores, flows, agentActions, calendarEntries] = await Promise.all([
    getStores(),
    getFlows(),
    getAgentStats(),
    getCalendarUpcoming(),
  ]);

  const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
    live:    { bg: "#10b98120", text: "#10b981" },
    draft:   { bg: "#f59e0b20", text: "#fbbf24" },
    manual:  { bg: "#6b728020", text: "#9ca3af" },
    paused:  { bg: "#ef444420", text: "#ef4444" },
  };

  const lastRun = agentActions[0]?.created_at
    ? new Date(agentActions[0].created_at).toLocaleString("en-AU", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <PageLayout
      stores={stores}
      activePage="Automations"
      title="Automations"
      subtitle="Klaviyo flows · AI agents · automated campaign design"
      headerRight={
        <Link href="/email"
          className="text-sm px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
          style={{ background: "#6366f1", color: "white" }}>
          ✉ Email Builder
        </Link>
      }
    >
      {/* ── Campaign Designer Agent ──────────────────────────────────── */}
      <CampaignDesignerCard
        calendarEntries={calendarEntries}
        lastRun={lastRun}
        recentActions={agentActions}
      />

      {/* ── Klaviyo Flows ─────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden mb-6 mt-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Klaviyo Flows</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Automated email sequences — synced from Klaviyo</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--border)", color: "var(--text-muted)" }}>
            {flows.length} flows
          </span>
        </div>
        {flows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm mb-2" style={{ color: "var(--text-faint)" }}>No flows synced yet</p>
            <Link href="/email" className="text-xs" style={{ color: "#6366f1" }}>
              Go to Email → sync Klaviyo
            </Link>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--text-faint)" }}>
                {["Flow Name", "Status", "Recipients", "Open Rate", "Click Rate", "Revenue"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flows.map((f: any) => {
                const s = STATUS_STYLE[f.status?.toLowerCase()] ?? { bg: "var(--border)", text: "#9ca3af" };
                return (
                  <tr key={f.flow_id} className="hover:bg-white/[0.02]" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{f.flow_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs capitalize"
                        style={{ background: s.bg, color: s.text }}>{f.status}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{(f.recipients ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{((f.open_rate ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{((f.click_rate ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 font-medium" style={{ color: "#10b981" }}>{fmt(f.revenue ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── More agents coming soon ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl p-6" style={{ background: "var(--bg-card)", border: "1px solid #6366f130" }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Workflow Builder</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#6366f120", color: "#a5b4fc" }}>
                Coming soon
              </span>
            </div>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Build multi-step automation workflows across Shopify, Klaviyo, and other tools — triggered by orders, customer actions, or custom events.
          </p>
          <div className="space-y-2">
            {["Order → Tag customer → Send email → Delay 3d → Follow-up",
              "Low stock → Alert → Pause ads → Restock reminder",
              "New customer → Welcome series → Review request → Loyalty offer",
            ].map((ex) => (
              <div key={ex} className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--bg-card-inner)", color: "var(--text-faint)" }}>
                {ex}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">✦</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>AI Flow Optimisation</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#6366f120", color: "#a5b4fc" }}>Coming soon</span>
            </div>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Claude will analyse your flow performance data and suggest improvements: timing changes, subject line variants, split paths based on customer behaviour.
          </p>
          <Link href="/email"
            className="block text-sm py-2.5 px-4 rounded-lg font-medium text-center hover:opacity-80 transition-opacity"
            style={{ background: "#6366f120", color: "#a5b4fc", border: "1px solid #6366f130" }}>
            Build emails now with AI →
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
