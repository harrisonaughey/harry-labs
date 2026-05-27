import PageLayout from "@/components/shared/PageLayout";
import { getStores } from "@/lib/stores";

export const revalidate = 300;

const PLACEHOLDER_METRICS = [
  { icon: "👁", label: "Sessions",         desc: "Total visits and unique users" },
  { icon: "↩", label: "Bounce Rate",       desc: "% of single-page sessions" },
  { icon: "🎯", label: "Conversion Rate",  desc: "Sessions → purchases" },
  { icon: "📄", label: "Top Pages",        desc: "Most visited product & landing pages" },
  { icon: "🔗", label: "Traffic Sources",  desc: "Organic, paid, email, direct, social" },
  { icon: "⚡", label: "Page Speed",       desc: "Core Web Vitals · LCP · CLS · FID" },
];

export default async function WebPage() {
  const stores = await getStores();

  return (
    <PageLayout
      stores={stores}
      activePage="Web"
      title="Web Performance"
      subtitle="Google Analytics 4 · Core Web Vitals · conversion analytics"
    >
      {/* Connect card */}
      <div className="flex items-start justify-center mb-8">
        <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: "#4285F420", border: "1px solid #4285F440" }}>🌐</div>
            <div>
              <h2 className="text-base font-semibold text-white">Connect Google Analytics 4</h2>
              <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
                See sessions, conversions, traffic sources, and page speed from your GA4 property.
              </p>
            </div>
          </div>
          <div className="space-y-2 mb-6">
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "#4b5563" }}>Required</p>
            {[
              { key: "GA4_MEASUREMENT_ID",     hint: "GA4 Property ID (e.g. G-XXXXXXXXXX)" },
              { key: "GA4_SERVICE_ACCOUNT",    hint: "Service account JSON (base64 encoded)" },
            ].map((v) => (
              <div key={v.key} className="flex items-center justify-between px-4 py-3 rounded-lg"
                style={{ background: "#0d0d14", border: "1px solid #1e1e2e" }}>
                <span className="text-xs" style={{ color: "#6b7280" }}>{v.hint}</span>
                <span className="text-xs font-mono font-medium" style={{ color: "#a5b4fc" }}>{v.key}</span>
              </div>
            ))}
          </div>
          <p className="text-xs mb-5" style={{ color: "#4b5563" }}>
            Create a service account in Google Cloud Console, grant it &quot;Viewer&quot; access to your GA4 property, then add the JSON key here.
          </p>
          <div className="flex gap-3">
            <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer"
              className="flex-1 text-sm py-2.5 px-4 rounded-lg font-medium text-center hover:opacity-80 transition-opacity"
              style={{ background: "#4285F420", color: "#4285F4", border: "1px solid #4285F440" }}>
              Google Cloud Console →
            </a>
            <a href="https://developers.google.com/analytics/devguides/reporting/data/v1" target="_blank" rel="noopener noreferrer"
              className="flex-1 text-sm py-2.5 px-4 rounded-lg text-center hover:opacity-80 transition-opacity"
              style={{ background: "#1a1a24", color: "#9ca3af", border: "1px solid #2a2a3a" }}>
              GA4 API Docs →
            </a>
          </div>
        </div>
      </div>

      {/* Placeholder metrics */}
      <h2 className="text-sm font-semibold text-white mb-3">Available Once Connected</h2>
      <div className="grid grid-cols-3 gap-4">
        {PLACEHOLDER_METRICS.map((m) => (
          <div key={m.label} className="rounded-xl p-5 opacity-40"
            style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <span className="text-2xl mb-3 block">{m.icon}</span>
            <p className="text-sm font-semibold text-white mb-1">{m.label}</p>
            <p className="text-xs" style={{ color: "#4b5563" }}>{m.desc}</p>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
