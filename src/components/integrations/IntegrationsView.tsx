"use client";
import { useState } from "react";

type EnvVar = { key: string; label: string; hint: string; secret?: boolean };
type Step   = { title: string; body: string };

type Integration = {
  id:          string;
  name:        string;
  icon:        string;
  category:    string;
  status:      "connected" | "partial" | "not_connected" | "planned";
  description: string;
  powers:      string[];
  envVars:     EnvVar[];
  steps:       Step[];
  docsUrl:     string;
  connected?:  boolean; // runtime check passed from server
};

const INTEGRATIONS: Integration[] = [
  /* ── LIVE ─────────────────────────────────────────────────────────────────── */
  {
    id:       "shopify",
    name:     "Shopify",
    icon:     "🛍️",
    category: "Ecommerce",
    status:   "connected",
    description: "OAuth-based connection to your Shopify store. Syncs orders, customers, products and revenue snapshots into Supabase on demand and nightly via cron.",
    powers:   ["Orders page", "Customers page", "Products page", "Revenue chart on Overview", "Nightly cron sync", "Incremental sync (updated_at_min)"],
    envVars: [
      { key: "SHOPIFY_CLIENT_ID",     label: "OAuth Client ID",     hint: "From Shopify Partners app settings" },
      { key: "SHOPIFY_CLIENT_SECRET", label: "OAuth Client Secret",  hint: "From Shopify Partners app settings", secret: true },
      { key: "SHOPIFY_SCOPES",        label: "OAuth Scopes",         hint: "read_orders,read_customers,read_products,read_inventory,read_fulfillments" },
    ],
    steps: [
      { title: "Create a Shopify Partner app", body: "Go to partners.shopify.com → Apps → Create app → Custom app. Set the App URL to your Vercel URL and the redirect URL to https://harry-labs.vercel.app/api/shopify/callback" },
      { title: "Copy Client ID & Secret", body: "In your app's API credentials tab, copy the API key (Client ID) and API secret key (Client Secret) into Vercel environment variables." },
      { title: "Install via OAuth", body: "Navigate to https://harry-labs.vercel.app/api/shopify/install?shop=YOUR-STORE.myshopify.com — this kicks off the OAuth flow and stores the access token in Supabase." },
      { title: "Run first sync", body: "Click 'Sync Shopify' on the Products or Overview page. The first sync is a full pull of all data; subsequent syncs are incremental." },
    ],
    docsUrl: "https://shopify.dev/docs/apps/auth/oauth",
  },
  {
    id:       "klaviyo",
    name:     "Klaviyo",
    icon:     "📧",
    category: "Email Marketing",
    status:   "connected",
    description: "Private API key connection to Klaviyo. Fetches campaign metrics, flow metrics, lists, and templates. Supports creating and scheduling campaigns from the dashboard.",
    powers:   ["Email > Campaigns tab", "Email > Flows tab", "KPI metrics (open rate, click rate, delivered)", "Campaign scheduler (New Campaign modal)", "Nightly Klaviyo sync via cron"],
    envVars: [
      { key: "KLAVIYO_API_KEY",        label: "Private API Key", hint: "Starts with pk_. From Klaviyo → Account → API Keys", secret: true },
      { key: "KLAVIYO_PUBLIC_API_KEY", label: "Public API Key",  hint: "Optional — for client-side tracking only" },
    ],
    steps: [
      { title: "Get your Private API Key", body: "Log into Klaviyo → click your account name (bottom left) → Settings → API Keys → Create Private API Key. Select Full Access or at minimum: Campaigns (read/write), Flows (read), Lists (read), Templates (read), Metrics (read)." },
      { title: "Add to Vercel", body: "In Vercel → harry-labs project → Settings → Environment Variables, add KLAVIYO_API_KEY with the pk_... value. Redeploy." },
      { title: "Sync data", body: "Go to harry-labs.vercel.app/email and click 'Sync Klaviyo'. This fetches all campaigns, flow metrics, lists and templates and stores them in Supabase." },
    ],
    docsUrl: "https://developers.klaviyo.com/en/reference/api_overview",
  },
  {
    id:       "supabase",
    name:     "Supabase",
    icon:     "🗄️",
    category: "Database",
    status:   "connected",
    description: "PostgreSQL database used to store all synced data. All API data (Shopify, Klaviyo, ads) is written here so subsequent page loads are instant without re-fetching from third-party APIs.",
    powers:   ["All dashboard data storage", "Email metrics history", "Flow metrics", "Order / customer / product tables", "Revenue snapshots", "Sync logs", "Store & access token registry"],
    envVars: [
      { key: "NEXT_PUBLIC_SUPABASE_URL",      label: "Project URL",         hint: "https://YOUR_REF.supabase.co" },
      { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Anon / Public Key",   hint: "Legacy JWT key (eyJ...) from API Keys section", secret: true },
      { key: "SUPABASE_SERVICE_ROLE_KEY",     label: "Service Role Key",    hint: "Legacy JWT key (eyJ...) — never expose client-side", secret: true },
    ],
    steps: [
      { title: "Create Supabase project", body: "Go to supabase.com → New Project. Choose a region close to your users (Singapore or Sydney for AU)." },
      { title: "Get legacy JWT keys", body: "In your project → Settings → API → scroll to Legacy API Keys section. Copy the anon key and service_role key (both start with eyJ)." },
      { title: "Run SQL migrations", body: "In Supabase SQL Editor, run the migration scripts to create tables: stores, customers, orders, products, revenue_snapshots, email_metrics, flow_metrics, sync_log. Scripts are in the project README." },
      { title: "Enable RLS", body: "Row Level Security is enabled on all tables. The dashboard only accesses data via the service role key (server-side), so RLS is enforced but not blocking." },
    ],
    docsUrl: "https://supabase.com/docs",
  },
  {
    id:       "vercel",
    name:     "Vercel",
    icon:     "▲",
    category: "Deployment",
    status:   "connected",
    description: "Hosts the Next.js dashboard. Manages environment variables securely and runs the nightly 2AM cron job that syncs Shopify and Klaviyo data automatically.",
    powers:   ["Hosts harry-labs.vercel.app", "Stores all API keys securely", "Nightly cron at 2AM AEST (syncs Shopify + Klaviyo)", "Serverless API routes for all data fetching"],
    envVars: [
      { key: "CRON_SECRET", label: "Cron Secret", hint: "Random secret to secure /api/cron/sync — must match vercel.json cron config", secret: true },
      { key: "NEXT_PUBLIC_APP_URL", label: "App URL", hint: "https://harry-labs.vercel.app (your production URL)" },
    ],
    steps: [
      { title: "Deploy from CLI", body: "Run: export PATH='/opt/homebrew/bin:$PATH' && cd ~/Desktop/harry-labs && vercel --yes --prod" },
      { title: "Set environment variables", body: "In Vercel dashboard → Project → Settings → Environment Variables. Add all keys for Supabase, Shopify, Klaviyo, Meta, Google Ads etc. Never commit .env.local to git." },
      { title: "Cron job", body: "vercel.json already configures a cron at '0 2 * * *' (2AM UTC daily) targeting /api/cron/sync. This auto-runs after every deploy — no extra setup needed." },
    ],
    docsUrl: "https://vercel.com/docs",
  },

  /* ── TO CONNECT ───────────────────────────────────────────────────────────── */
  {
    id:       "meta",
    name:     "Meta Ads",
    icon:     "📘",
    category: "Paid Traffic",
    status:   "not_connected",
    description: "Meta Marketing API connection. Powers the Traffic > Meta Ads tab with full campaign performance breakdown, ROAS, and the ability to pause/activate campaigns and adjust budgets directly from the dashboard.",
    powers:   ["Traffic > Meta Ads tab", "Spend / Impressions / Reach / CTR / CPC / CPM", "ROAS & purchase attribution", "Pause / activate campaigns", "Bulk campaign actions"],
    envVars: [
      { key: "META_ACCESS_TOKEN",  label: "System User Access Token", hint: "Long-lived token from Business Settings → System Users. Must have ads_read, ads_management, read_insights", secret: true },
      { key: "META_AD_ACCOUNT_ID", label: "Ad Account ID",            hint: "Numeric ID from Ads Manager (no act_ prefix needed)" },
    ],
    steps: [
      { title: "Create a System User", body: "Go to business.facebook.com → Settings → System Users → Add. Name it harry-labs-api, set role to Admin. System User tokens don't expire like personal tokens." },
      { title: "Add Ad Account access", body: "On the System User page, click 'Add Assets' → Ad Accounts → select your account → assign Full Control permission." },
      { title: "Generate token", body: "Click 'Generate New Token' on the System User → select your app → tick: ads_read, ads_management, business_management, read_insights → Generate. Copy immediately." },
      { title: "Get Ad Account ID", body: "Go to adsmanager.facebook.com — the 10-digit number in the top-left dropdown is your Ad Account ID. Add it to Vercel without the act_ prefix." },
      { title: "Add to Vercel & redeploy", body: "Add META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to Vercel environment variables, then redeploy. The Traffic > Meta Ads tab will activate automatically." },
    ],
    docsUrl: "https://developers.facebook.com/docs/marketing-api/get-started",
  },
  {
    id:       "google_ads",
    name:     "Google Ads",
    icon:     "🔵",
    category: "Paid Traffic",
    status:   "not_connected",
    description: "Google Ads API connection. Powers the Traffic > Google Ads tab with campaign-level spend, conversions, CTR, ROAS and channel type breakdown (Search, Shopping, PMax, Display, Video).",
    powers:   ["Traffic > Google Ads tab", "Spend / Impressions / Clicks / CTR", "Avg CPC / Conversions / ROAS", "Campaign type breakdown (Search, PMax, Shopping)", "30/90 day trend view"],
    envVars: [
      { key: "GOOGLE_ADS_DEVELOPER_TOKEN", label: "Developer Token",   hint: "From Google Ads → Tools → API Center. Apply for Basic Access.", secret: true },
      { key: "GOOGLE_ADS_CLIENT_ID",       label: "OAuth Client ID",   hint: "From Google Cloud Console → APIs & Services → Credentials → OAuth client" },
      { key: "GOOGLE_ADS_CLIENT_SECRET",   label: "OAuth Client Secret", hint: "Same OAuth client as above", secret: true },
      { key: "GOOGLE_ADS_REFRESH_TOKEN",   label: "Refresh Token",     hint: "Generated via OAuth Playground (developers.google.com/oauthplayground). Scope: https://www.googleapis.com/auth/adwords", secret: true },
      { key: "GOOGLE_ADS_CUSTOMER_ID",     label: "Customer ID",       hint: "10-digit Google Ads account ID (XXX-XXX-XXXX format, dashes optional)" },
    ],
    steps: [
      { title: "Apply for Developer Token", body: "Sign in to ads.google.com → Tools icon → API Center (under Setup) → Apply for access. Basic Access is approved quickly and is sufficient for this dashboard." },
      { title: "Create OAuth credentials in Google Cloud", body: "Go to console.cloud.google.com → New project → APIs & Services → Library → enable 'Google Ads API'. Then Credentials → Create OAuth client ID → Web application. Add https://developers.google.com/oauthplayground as an authorised redirect URI." },
      { title: "Generate Refresh Token via OAuth Playground", body: "Go to developers.google.com/oauthplayground → gear icon → tick 'Use your own OAuth credentials' → paste Client ID & Secret. Find Google Ads API v17 → tick https://www.googleapis.com/auth/adwords → Authorise → Exchange code for tokens → copy Refresh Token (starts with 1//)." },
      { title: "Get Customer ID", body: "Log in to ads.google.com — the 10-digit number in the top right (format XXX-XXX-XXXX) is your Customer ID. If using a manager account, use the individual account ID not the MCC ID." },
      { title: "Add to Vercel & redeploy", body: "Add all 5 keys to Vercel environment variables. Redeploy. The Traffic > Google Ads tab will activate showing live campaign data." },
    ],
    docsUrl: "https://developers.google.com/google-ads/api/docs/first-call/overview",
  },
  {
    id:       "stripe",
    name:     "Stripe",
    icon:     "💳",
    category: "Payments",
    status:   "planned",
    description: "Stripe API for payment and subscription analytics. Would power a dedicated Payments section showing MRR, churn, failed payments, refunds and subscription cohorts.",
    powers:   ["Planned: Payments page", "MRR / ARR tracking", "Subscription cohort analysis", "Failed payment alerts", "Refund reporting"],
    envVars: [
      { key: "STRIPE_SECRET_KEY",       label: "Secret Key",       hint: "sk_live_... from Stripe Dashboard → Developers → API Keys", secret: true },
      { key: "STRIPE_PUBLISHABLE_KEY",  label: "Publishable Key",   hint: "pk_live_... from same page" },
      { key: "STRIPE_WEBHOOK_SECRET",   label: "Webhook Secret",    hint: "whsec_... from Stripe → Webhooks → your endpoint", secret: true },
    ],
    steps: [
      { title: "Get API Keys", body: "Go to dashboard.stripe.com → Developers → API Keys. Copy the Secret Key (sk_live_...) and Publishable Key (pk_live_...)." },
      { title: "Set up Webhook (optional)", body: "In Stripe → Developers → Webhooks → Add endpoint. Set URL to https://harry-labs.vercel.app/api/stripe/webhook. Select events: payment_intent.succeeded, charge.refunded, customer.subscription.updated." },
      { title: "Add to Vercel", body: "Add STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY and STRIPE_WEBHOOK_SECRET to Vercel environment variables. The Payments section will be built once connected." },
    ],
    docsUrl: "https://stripe.com/docs/api",
  },
  {
    id:       "xero",
    name:     "Xero",
    icon:     "📒",
    category: "Accounting",
    status:   "planned",
    description: "Xero accounting integration. Would power a Finance section with P&L statements, expense categorisation, cash flow, and reconciliation against Shopify revenue data.",
    powers:   ["Planned: Finance / P&L page", "Revenue vs expenses reconciliation", "Cash flow view", "Invoice tracking", "Tax summary"],
    envVars: [
      { key: "XERO_CLIENT_ID",     label: "OAuth Client ID",     hint: "From developer.xero.com → My Apps → your app → OAuth 2.0 credentials" },
      { key: "XERO_CLIENT_SECRET", label: "OAuth Client Secret", hint: "Same page as Client ID", secret: true },
      { key: "XERO_REDIRECT_URI",  label: "Redirect URI",        hint: "https://harry-labs.vercel.app/api/xero/callback" },
    ],
    steps: [
      { title: "Create a Xero App", body: "Go to developer.xero.com → My Apps → New App. Set redirect URI to https://harry-labs.vercel.app/api/xero/callback. Copy Client ID and Client Secret." },
      { title: "OAuth flow", body: "An OAuth flow will be built at /api/xero/install. Navigate to it while logged into Xero to authorise access and store the refresh token in Supabase." },
      { title: "Add to Vercel", body: "Add XERO_CLIENT_ID, XERO_CLIENT_SECRET and XERO_REDIRECT_URI to Vercel. The Finance page will be built once credentials are connected." },
    ],
    docsUrl: "https://developer.xero.com/documentation/",
  },
  {
    id:       "tiktok",
    name:     "TikTok Ads",
    icon:     "🎵",
    category: "Paid Traffic",
    status:   "planned",
    description: "TikTok Marketing API. Would add a third tab to the Traffic section showing TikTok Ads campaign performance, ROAS, CPM and creative-level analytics.",
    powers:   ["Planned: Traffic > TikTok tab", "Campaign spend & ROAS", "Creative performance", "Audience insights"],
    envVars: [
      { key: "TIKTOK_ACCESS_TOKEN",  label: "Access Token",   hint: "From TikTok for Business → Business Center → API", secret: true },
      { key: "TIKTOK_APP_ID",        label: "App ID",         hint: "From TikTok Developers portal → Your app" },
      { key: "TIKTOK_ADVERTISER_ID", label: "Advertiser ID",  hint: "Numeric ID from TikTok Ads Manager" },
    ],
    steps: [
      { title: "Apply for TikTok Marketing API", body: "Go to ads.tiktok.com → Tools → TikTok API → Apply for access. Requires a Business Center account with active ad spend." },
      { title: "Create an app", body: "In TikTok Developers portal, create a new app → Web → add your redirect URI. Note your App ID and App Secret." },
      { title: "Generate Access Token", body: "Via Business Center → API → Generate a long-lived token with scope: campaign.read, adgroup.read, ad.read, report.read." },
    ],
    docsUrl: "https://business-api.tiktok.com/portal/docs",
  },
  {
    id:       "ga4",
    name:     "Google Analytics 4",
    icon:     "📉",
    category: "Web Analytics",
    status:   "planned",
    description: "GA4 Data API connection. Would power a Web Analytics section showing sessions, users, bounce rate, conversion funnels and traffic source breakdown.",
    powers:   ["Planned: Analytics page — web traffic", "Sessions / Users / Bounce rate", "Traffic source breakdown", "Conversion funnel", "Top pages"],
    envVars: [
      { key: "GA4_PROPERTY_ID",       label: "GA4 Property ID",  hint: "9-digit number from GA4 → Admin → Property Settings" },
      { key: "GA4_CLIENT_EMAIL",      label: "Service Account Email", hint: "From Google Cloud service account JSON" },
      { key: "GA4_PRIVATE_KEY",       label: "Service Account Private Key", hint: "From service account JSON — include \\n newlines", secret: true },
    ],
    steps: [
      { title: "Create a Service Account", body: "Go to console.cloud.google.com → IAM & Admin → Service Accounts → Create. Download the JSON key file." },
      { title: "Enable Analytics Data API", body: "In Google Cloud → APIs & Services → Library → enable 'Google Analytics Data API'." },
      { title: "Add Service Account to GA4", body: "In GA4 → Admin → Property Access Management → Add users → paste service account email → Viewer role." },
      { title: "Get Property ID", body: "GA4 → Admin → Property Settings → Property ID (9-digit number at top right)." },
    ],
    docsUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Ecommerce":       "#10b981",
  "Email Marketing": "#818cf8",
  "Database":        "#06b6d4",
  "Deployment":      "#ffffff",
  "Paid Traffic":    "#f59e0b",
  "Payments":        "#a78bfa",
  "Accounting":      "#34d399",
  "Web Analytics":   "#fb923c",
};

const STATUS_CONFIG = {
  connected:     { label: "Connected",     bg: "#10b98120", text: "#10b981", dot: "#10b981" },
  partial:       { label: "Partial",       bg: "#f59e0b20", text: "#fbbf24", dot: "#fbbf24" },
  not_connected: { label: "Not connected", bg: "#6b728020", text: "#9ca3af", dot: "#6b7280" },
  planned:       { label: "Planned",       bg: "#6366f120", text: "#818cf8", dot: "#6366f1" },
};

export default function IntegrationsView({ connectedIds }: { connectedIds: string[] }) {
  const [selected, setSelected] = useState("shopify");
  const [search,   setSearch]   = useState("");
  const [copied,   setCopied]   = useState<string | null>(null);

  const filtered = INTEGRATIONS.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const current = INTEGRATIONS.find(i => i.id === selected) ?? INTEGRATIONS[0];
  const statusCfg = STATUS_CONFIG[current.status];

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="flex gap-6 h-full">
      {/* ── Left: Integration list ── */}
      <div className="w-64 flex-shrink-0">
        <input
          type="text"
          placeholder="Search integrations…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        <div className="space-y-1">
          {filtered.map(i => {
            const sc = STATUS_CONFIG[i.status];
            const isSelected = selected === i.id;
            return (
              <button
                key={i.id}
                onClick={() => setSelected(i.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: isSelected ? "#1e1e30" : "transparent",
                  border: `1px solid ${isSelected ? "#3730a3" : "transparent"}`,
                }}
              >
                <span className="text-lg flex-shrink-0">{i.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{i.name}</p>
                  <p className="text-xs" style={{ color: CATEGORY_COLORS[i.category] ?? "var(--text-muted)" }}>
                    {i.category}
                  </p>
                </div>
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: sc.dot }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Detail panel ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="rounded-xl p-6 mb-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: "var(--border)" }}>
                {current.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{current.name}</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: statusCfg.bg, color: statusCfg.text }}>
                    {statusCfg.label}
                  </span>
                </div>
                <span className="text-xs" style={{ color: CATEGORY_COLORS[current.category] }}>
                  {current.category}
                </span>
              </div>
            </div>
            <a href={current.docsUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
              style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px solid #3730a3" }}>
              View Docs →
            </a>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{current.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Powers */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              Powers in Dashboard
            </h3>
            <ul className="space-y-1.5">
              {current.powers.map(p => (
                <li key={p} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span style={{ color: statusCfg.dot }}>✓</span> {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Env vars */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              Environment Variables
            </h3>
            <div className="space-y-3">
              {current.envVars.map(v => (
                <div key={v.key} className="rounded-lg p-3" style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{v.label}</span>
                    <button onClick={() => copyKey(v.key)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-all hover:opacity-80"
                      style={{ background: "#1e1e30", color: copied === v.key ? "#10b981" : "#818cf8" }}>
                      <code>{v.key}</code>
                      <span>{copied === v.key ? "✓" : "⧉"}</span>
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>{v.hint}</p>
                  {v.secret && (
                    <span className="text-xs mt-1 inline-block" style={{ color: "#374151" }}>🔒 Keep secret — Vercel only</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Setup steps */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            Setup Guide
          </h3>
          <div className="space-y-4">
            {current.steps.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: statusCfg.bg, color: statusCfg.text, border: `1px solid ${statusCfg.dot}40` }}>
                  {i + 1}
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>{step.title}</p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vercel link for not-connected */}
        {(current.status === "not_connected" || current.status === "planned") && (
          <div className="mt-4 rounded-xl p-4 flex items-center justify-between"
            style={{ background: "#6366f110", border: "1px solid #6366f130" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "#a5b4fc" }}>
                Ready to connect?
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Add the environment variables to Vercel, then redeploy.
              </p>
            </div>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity flex-shrink-0"
              style={{ background: "#6366f1", color: "white" }}>
              Open Vercel →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
