import { createClient } from "@supabase/supabase-js";
import PageLayout from "@/components/shared/PageLayout";
import { getStores } from "@/lib/stores";
import { getSyncLog } from "@/lib/data";
import SyncButton from "@/components/SyncButton";
import { Suspense } from "react";

export const revalidate = 0;

const INTEGRATIONS = [
  { key: "shopify",   label: "Shopify",         envVars: ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"] },
  { key: "klaviyo",   label: "Klaviyo",          envVars: ["KLAVIYO_API_KEY"] },
  { key: "meta",      label: "Meta Ads",         envVars: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"] },
  { key: "google",    label: "Google Ads",       envVars: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_REFRESH_TOKEN"] },
  { key: "anthropic", label: "Anthropic (AI)",   envVars: ["ANTHROPIC_API_KEY"] },
  { key: "tiktok",    label: "TikTok Ads",       envVars: ["TIKTOK_ACCESS_TOKEN"] },
  { key: "amazon",    label: "Amazon",           envVars: ["AMAZON_SELLER_ID"] },
  { key: "ga4",       label: "Google Analytics", envVars: ["GA4_MEASUREMENT_ID"] },
  { key: "zendesk",   label: "Zendesk",          envVars: ["ZENDESK_SUBDOMAIN", "ZENDESK_API_TOKEN"] },
  { key: "stripe",    label: "Stripe",           envVars: ["STRIPE_SECRET_KEY"] },
  { key: "xero",      label: "Xero",             envVars: ["XERO_CLIENT_ID"] },
];

function isConnected(envVars: string[]): boolean {
  return envVars.every((key) => {
    const val = process.env[key];
    return val && val.length > 0;
  });
}

export default async function SettingsPage() {
  const stores = await getStores();
  const store = stores[0] ?? null;
  const syncLog = store ? await getSyncLog(store.id) : [];
  const lastSync = syncLog.find((s) => s.source === "shopify");

  return (
    <PageLayout
      stores={stores}
      activePage="Settings"
      title="Settings"
      subtitle="Store config · API connections · sync controls"
    >
      <div className="grid grid-cols-2 gap-6">
        {/* Store info */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Store</h2>
            {store ? (
              <div className="space-y-3">
                {[
                  { label: "Name",      value: store.name },
                  { label: "Domain",    value: store.shop_domain },
                  { label: "Currency",  value: store.currency },
                  { label: "Last Sync", value: lastSync?.synced_at ? new Date(lastSync.synced_at).toLocaleString("en-AU") : "Never" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{row.label}</span>
                    <span className="text-xs" style={{ color: "var(--text-primary)" }}>{row.value}</span>
                  </div>
                ))}
                <div className="pt-2">
                  <Suspense>
                    <SyncButton shopDomain={store.shop_domain} />
                  </Suspense>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm mb-3" style={{ color: "var(--text-faint)" }}>No store connected</p>
                <a href="/api/shopify/install?shop=thinkle-com-au.myshopify.com"
                  className="text-sm px-4 py-2 rounded-lg inline-block hover:opacity-80 transition-opacity"
                  style={{ background: "#6366f1", color: "white" }}>
                  Connect Shopify →
                </a>
              </div>
            )}
          </div>

          {/* User */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>User</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: "#6366f1" }}>H</div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Harrison</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Admin · thinkle.com.au</p>
              </div>
            </div>
          </div>
        </div>

        {/* API connections */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>API Connections</h2>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
              style={{ background: "var(--bg-subtle)", color: "#a5b4fc", border: "1px solid #2a2a3a" }}>
              Edit in Vercel →
            </a>
          </div>
          <div className="space-y-2">
            {INTEGRATIONS.map((int) => {
              const connected = isConnected(int.envVars);
              return (
                <div key={int.key} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                  style={{ background: "var(--bg-card-inner)" }}>
                  <span className="text-xs" style={{ color: "var(--text-primary)" }}>{int.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: connected ? "#10b981" : "#2a2a3a" }} />
                    <span className="text-xs" style={{ color: connected ? "#10b981" : "var(--text-faint)" }}>
                      {connected ? "Connected" : "Not configured"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
