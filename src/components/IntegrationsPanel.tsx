type SyncEntry = {
  source: string;
  entity: string;
  status: string;
  records_synced: number;
  synced_at: string;
};

const API_META: Record<string, { icon: string; color: string }> = {
  shopify:  { icon: "🛍️", color: "#95bf47" },
  klaviyo:  { icon: "📧", color: "#6366f1" },
  meta:     { icon: "📢", color: "#1877f2" },
  google:   { icon: "🔍", color: "#f59e0b" },
  xero:     { icon: "📒", color: "#13b5ea" },
  stripe:   { icon: "💳", color: "#635bff" },
};

const ALL_INTEGRATIONS = ["shopify", "klaviyo", "meta", "google", "xero", "stripe"];

export default function IntegrationsPanel({ syncLog }: { syncLog: SyncEntry[] }) {
  // Build a map of latest sync per source
  const latestBySource: Record<string, SyncEntry> = {};
  syncLog.forEach((entry) => {
    const src = entry.source.toLowerCase();
    if (!latestBySource[src]) latestBySource[src] = entry;
  });

  return (
    <div
      className="rounded-xl p-5 h-full"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Integrations</h2>
        <button className="text-xs px-2 py-1 rounded-md" style={{ background: "#1e1e30", color: "#a5b4fc" }}>
          Manage
        </button>
      </div>

      <div className="space-y-3">
        {ALL_INTEGRATIONS.map((name) => {
          const meta = API_META[name];
          const sync = latestBySource[name];
          const connected = !!sync && sync.status === "success";
          const status = sync ? sync.status : "not connected";
          const metric = sync
            ? `${sync.records_synced.toLocaleString()} ${sync.entity} synced`
            : "Not connected";
          const statusColor = connected ? "#10b981" : sync ? "#ef4444" : "#f59e0b";

          return (
            <div key={name} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-base">{meta.icon}</span>
                <div>
                  <p className="text-xs font-medium capitalize" style={{ color: "var(--text-primary)" }}>{name}</p>
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>{metric}</p>
                </div>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                style={{ background: `${statusColor}20`, color: statusColor }}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>

      <button
        className="w-full mt-5 text-xs py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
        style={{ background: "#1e1e30", color: "#a5b4fc", border: "1px dashed #2a2a3a" }}
      >
        + Add Integration
      </button>
    </div>
  );
}
