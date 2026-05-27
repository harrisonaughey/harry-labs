type Props = {
  platform: string;
  onConnect?: () => void;
};

const CONFIG: Record<string, {
  icon: string; name: string; description: string; color: string;
  vars: { key: string; label: string; hint: string }[];
  docsUrl: string;
}> = {
  meta: {
    icon: "📘", color: "#1877F2", name: "Meta Ads",
    description: "Connect your Meta Ads account to see campaign performance, ROAS, spend, and take actions directly from this dashboard.",
    vars: [
      { key: "META_ACCESS_TOKEN",  label: "Access Token",   hint: "Long-lived user or system access token" },
      { key: "META_AD_ACCOUNT_ID", label: "Ad Account ID",  hint: "Numeric ID (e.g. act_123456789)" },
    ],
    docsUrl: "https://developers.facebook.com/docs/marketing-api/get-started",
  },
  google: {
    icon: "🔵", color: "#4285F4", name: "Google Ads",
    description: "Connect your Google Ads account to track campaign performance, conversions, and spend across all campaigns.",
    vars: [
      { key: "GOOGLE_ADS_DEVELOPER_TOKEN", label: "Developer Token",    hint: "From Google Ads API Center" },
      { key: "GOOGLE_ADS_CLIENT_ID",       label: "OAuth Client ID",    hint: "From Google Cloud Console" },
      { key: "GOOGLE_ADS_CLIENT_SECRET",   label: "OAuth Client Secret",hint: "From Google Cloud Console" },
      { key: "GOOGLE_ADS_REFRESH_TOKEN",   label: "Refresh Token",      hint: "Generated via OAuth flow" },
      { key: "GOOGLE_ADS_CUSTOMER_ID",     label: "Customer ID",        hint: "10-digit account ID (dashes optional)" },
    ],
    docsUrl: "https://developers.google.com/google-ads/api/docs/first-call/overview",
  },
  tiktok: {
    icon: "🎵", color: "#ee1d52", name: "TikTok Ads",
    description: "Connect TikTok Ads Manager to track video ad performance, spend, CPM, and conversions.",
    vars: [
      { key: "TIKTOK_ACCESS_TOKEN",  label: "Access Token",   hint: "Long-lived token from TikTok for Business" },
      { key: "TIKTOK_ADVERTISER_ID", label: "Advertiser ID",  hint: "TikTok Ads Manager advertiser ID" },
    ],
    docsUrl: "https://business-api.tiktok.com/portal/docs",
  },
};

export default function ConnectCard({ platform }: Props) {
  const cfg = CONFIG[platform.toLowerCase()] ?? CONFIG.meta;
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-full max-w-lg rounded-2xl p-8 text-center"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
          style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}40` }}>
          {cfg.icon}
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Connect {cfg.name}</h2>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>{cfg.description}</p>

        <div className="text-left space-y-3 mb-8">
          {cfg.vars.map((v) => (
            <div key={v.key} className="rounded-xl p-4" style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{v.label}</span>
                <code className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--border)", color: "#818cf8" }}>
                  {v.key}
                </code>
              </div>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>{v.hint}</p>
            </div>
          ))}
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--text-faint)" }}>
          Add these keys to your Vercel environment variables, then redeploy.
        </p>

        <div className="flex gap-3 justify-center">
          <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
            style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px solid #3730a3" }}>
            Open Vercel →
          </a>
          <a href={cfg.docsUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
            style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            API Docs →
          </a>
        </div>
      </div>
    </div>
  );
}
