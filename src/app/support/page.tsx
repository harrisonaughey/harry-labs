import PageLayout from "@/components/shared/PageLayout";
import { getStores } from "@/lib/stores";

export const revalidate = 300;

const PLACEHOLDER_SECTIONS = [
  { icon: "🎫", label: "Open Tickets",       desc: "Volume, priority, age" },
  { icon: "⏱",  label: "Resolution Time",    desc: "First reply & resolution SLA" },
  { icon: "😊", label: "CSAT Score",         desc: "Customer satisfaction rating" },
  { icon: "🧠", label: "AI Categorisation",  desc: "Topics, sentiment, trending issues" },
];

export default async function SupportPage() {
  const stores = await getStores();

  return (
    <PageLayout
      stores={stores}
      activePage="Support"
      title="Customer Service"
      subtitle="Zendesk · ticket volume · CSAT · AI analysis"
    >
      {/* Connect card */}
      <div className="flex items-start justify-center mb-8">
        <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: "#03363D20", border: "1px solid #03363D80" }}>🎧</div>
            <div>
              <h2 className="text-base font-semibold text-white">Connect Zendesk</h2>
              <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
                Track support tickets, CSAT, and get AI-powered topic analysis on customer issues.
              </p>
            </div>
          </div>
          <div className="space-y-2 mb-6">
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "#4b5563" }}>Required</p>
            {[
              { key: "ZENDESK_SUBDOMAIN",   hint: "Your Zendesk subdomain (e.g. thinkle)" },
              { key: "ZENDESK_EMAIL",        hint: "Admin email address" },
              { key: "ZENDESK_API_TOKEN",    hint: "API token from Zendesk Admin → API" },
            ].map((v) => (
              <div key={v.key} className="flex items-center justify-between px-4 py-3 rounded-lg"
                style={{ background: "#0d0d14", border: "1px solid #1e1e2e" }}>
                <span className="text-xs" style={{ color: "#6b7280" }}>{v.hint}</span>
                <span className="text-xs font-mono font-medium" style={{ color: "#a5b4fc" }}>{v.key}</span>
              </div>
            ))}
          </div>
          <p className="text-xs mb-5" style={{ color: "#4b5563" }}>
            Add these keys to Vercel environment variables, then redeploy.
          </p>
          <div className="flex gap-3">
            <a href="https://www.zendesk.com/" target="_blank" rel="noopener noreferrer"
              className="flex-1 text-sm py-2.5 px-4 rounded-lg font-medium text-center hover:opacity-80 transition-opacity"
              style={{ background: "#03363D20", color: "#03B585", border: "1px solid #03363D60" }}>
              Zendesk Admin →
            </a>
            <a href="https://developer.zendesk.com/api-reference/" target="_blank" rel="noopener noreferrer"
              className="flex-1 text-sm py-2.5 px-4 rounded-lg text-center hover:opacity-80 transition-opacity"
              style={{ background: "#1a1a24", color: "#9ca3af", border: "1px solid #2a2a3a" }}>
              API Docs →
            </a>
          </div>
        </div>
      </div>

      {/* Coming soon */}
      <div className="rounded-xl p-4 mb-6 flex items-start gap-3"
        style={{ background: "#6366f110", border: "1px solid #6366f130" }}>
        <span className="text-lg">✦</span>
        <div>
          <p className="text-xs font-semibold text-white mb-1">AI-powered ticket analysis — coming soon</p>
          <p className="text-xs" style={{ color: "#6b7280" }}>
            Once connected, Claude will automatically categorise tickets by topic, detect trending issues, identify high-value customer complaints, and surface coaching opportunities for your support team.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {PLACEHOLDER_SECTIONS.map((s) => (
          <div key={s.label} className="rounded-xl p-5 opacity-40"
            style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <span className="text-2xl mb-3 block">{s.icon}</span>
            <p className="text-sm font-semibold text-white mb-1">{s.label}</p>
            <p className="text-xs" style={{ color: "#4b5563" }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
