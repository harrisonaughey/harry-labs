import PageLayout from "@/components/shared/PageLayout";
import { getStores } from "@/lib/stores";

export const revalidate = 300;

const PLACEHOLDER_SECTIONS = [
  { icon: "📋", label: "Listings",       desc: "Active listings, BSR, Buy Box %" },
  { icon: "💰", label: "Sales",          desc: "Orders, revenue, returns" },
  { icon: "📦", label: "FBA Inventory",  desc: "Units in warehouse, days of cover" },
  { icon: "⭐", label: "Reviews",        desc: "Star rating, review velocity, feedback" },
  { icon: "📈", label: "Advertising",    desc: "Sponsored Products, ACoS, ROAS" },
];

export default async function AmazonPage() {
  const stores = await getStores();

  return (
    <PageLayout
      stores={stores}
      activePage="Amazon"
      title="Amazon"
      subtitle="Seller Central · listings · FBA inventory · advertising"
    >
      {/* Connect card */}
      <div className="flex items-start justify-center mb-8">
        <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: "#FF990020", border: "1px solid #FF990040" }}>📫</div>
            <div>
              <h2 className="text-base font-semibold text-white">Connect Amazon Seller Central</h2>
              <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
                View listings, sales, FBA inventory, and advertising from one place.
              </p>
            </div>
          </div>
          <div className="space-y-2 mb-6">
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "#4b5563" }}>
              Required Environment Variables
            </p>
            {[
              { key: "AMAZON_SELLER_ID",       hint: "Your Seller Central merchant ID" },
              { key: "AMAZON_MWS_TOKEN",        hint: "SP-API refresh token" },
              { key: "AMAZON_MARKETPLACE_ID",   hint: "e.g. ANZBDZBGJWP2 for AU" },
              { key: "AMAZON_CLIENT_ID",        hint: "SP-API LWA App Client ID" },
              { key: "AMAZON_CLIENT_SECRET",    hint: "SP-API LWA App Client Secret" },
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
            <a href="https://sellercentral.amazon.com.au/" target="_blank" rel="noopener noreferrer"
              className="flex-1 text-sm py-2.5 px-4 rounded-lg font-medium text-center hover:opacity-80 transition-opacity"
              style={{ background: "#FF990020", color: "#FF9900", border: "1px solid #FF990040" }}>
              Seller Central →
            </a>
            <a href="https://developer-docs.amazon.com/sp-api/docs" target="_blank" rel="noopener noreferrer"
              className="flex-1 text-sm py-2.5 px-4 rounded-lg text-center hover:opacity-80 transition-opacity"
              style={{ background: "#1a1a24", color: "#9ca3af", border: "1px solid #2a2a3a" }}>
              SP-API Docs →
            </a>
          </div>
        </div>
      </div>

      {/* Placeholder sections */}
      <h2 className="text-sm font-semibold text-white mb-3">Coming Once Connected</h2>
      <div className="grid grid-cols-5 gap-4">
        {PLACEHOLDER_SECTIONS.map((s) => (
          <div key={s.label} className="rounded-xl p-5 relative overflow-hidden opacity-40"
            style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <div className="absolute top-2 right-2">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#6366f120", color: "#a5b4fc" }}>
                Soon
              </span>
            </div>
            <span className="text-2xl mb-3 block">{s.icon}</span>
            <p className="text-sm font-semibold text-white mb-1">{s.label}</p>
            <p className="text-xs" style={{ color: "#4b5563" }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
