"use client";

type Flow = {
  flow_id: string;
  flow_name: string;
  status: string;
  trigger_type: string | null;
  delivered: number;
  opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
  recipients: number;
  unsubscribes: number;
  bounced: number;
  updated_at: string;
};

const TRIGGER_COLOR: Record<string, { bg: string; text: string }> = {
  Metric:        { bg: "#6366f120", text: "#818cf8" },
  "Added to List":{ bg: "#10b98120", text: "#10b981" },
  "Date Based":  { bg: "#f59e0b20", text: "#fbbf24" },
  "Price Drop":  { bg: "#ec489920", text: "#f472b6" },
  "Low Inventory":{ bg: "#ef444420", text: "#ef4444" },
};

function pct(v: number) {
  if (!v) return "—";
  return (v * 100).toFixed(1) + "%";
}

export default function FlowsView({
  flows,
  days,
}: {
  flows: Flow[];
  days: number | null;
}) {
  const sorted = [...flows].sort((a, b) => b.delivered - a.delivered);

  // KPI aggregates
  const totalDelivered   = sorted.reduce((s, f) => s + Number(f.delivered   ?? 0), 0);
  const totalOpens       = sorted.reduce((s, f) => s + Number(f.opened      ?? 0), 0);
  const totalClicks      = sorted.reduce((s, f) => s + Number(f.clicked     ?? 0), 0);
  const totalUnsubs      = sorted.reduce((s, f) => s + Number(f.unsubscribes?? 0), 0);

  const withRates = sorted.filter((f) => Number(f.open_rate) > 0);
  const avgOpen  = withRates.length
    ? withRates.reduce((s, f) => s + Number(f.open_rate),  0) / withRates.length
    : totalDelivered > 0 ? totalOpens  / totalDelivered : 0;
  const avgClick = withRates.length
    ? withRates.reduce((s, f) => s + Number(f.click_rate), 0) / withRates.length
    : totalDelivered > 0 ? totalClicks / totalDelivered : 0;

  const kpis = [
    { label: "Live Flows",      value: sorted.length.toString(),          icon: "🔁", sub: "active flows" },
    { label: "Emails Delivered",value: totalDelivered.toLocaleString(),   icon: "✅", sub: days ? `last ${days}d` : "all time" },
    { label: "Avg Open Rate",   value: (avgOpen  * 100).toFixed(1) + "%", icon: "👁",  sub: "avg across flows" },
    { label: "Avg Click Rate",  value: (avgClick * 100).toFixed(1) + "%", icon: "🖱️", sub: "avg across flows" },
    { label: "Unsubscribes",    value: totalUnsubs.toLocaleString(),       icon: "🚫", sub: "total unsubs" },
  ];

  return (
    <div>
      {/* KPI row */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {kpis.map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </span>
              <span>{s.icon}</span>
            </div>
            <p className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Flow table */}
      <div className="rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Live Flows</h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#1e1e30", color: "var(--text-muted)" }}
            >
              {sorted.length} flows
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            Sorted by delivered emails ↓
          </span>
        </div>

        {sorted.length === 0 ? (
          <div
            className="flex items-center justify-center py-12 text-sm"
            style={{ color: "var(--text-faint)" }}
          >
            No flow data — click Sync Klaviyo to load flows
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--text-faint)" }}>
                {[
                  "Flow",
                  "Trigger",
                  "Recipients",
                  "Delivered",
                  "Opens",
                  "Open Rate",
                  "Click Rate",
                  "Unsubs",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left font-medium uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => {
                const trigStyle =
                  TRIGGER_COLOR[f.trigger_type ?? ""] ??
                  { bg: "#6b728020", text: "#9ca3af" };
                return (
                  <tr
                    key={f.flow_id}
                    style={{ borderTop: "1px solid var(--border-subtle)" }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium" style={{ color: "var(--text-primary)" }}>{f.flow_name}</p>
                    </td>
                    <td className="px-5 py-3">
                      {f.trigger_type ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: trigStyle.bg, color: trigStyle.text }}
                        >
                          {f.trigger_type}
                        </span>
                      ) : (
                        <span style={{ color: "#374151" }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--text-primary)" }}>
                      {Number(f.recipients) > 0
                        ? Number(f.recipients).toLocaleString()
                        : <span style={{ color: "#374151" }}>—</span>}
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--text-primary)" }}>
                      {Number(f.delivered) > 0
                        ? Number(f.delivered).toLocaleString()
                        : <span style={{ color: "#374151" }}>—</span>}
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--text-primary)" }}>
                      {Number(f.opened) > 0
                        ? Number(f.opened).toLocaleString()
                        : <span style={{ color: "#374151" }}>—</span>}
                    </td>
                    <td className="px-5 py-3" style={{ color: "#10b981" }}>
                      {pct(Number(f.open_rate))}
                    </td>
                    <td className="px-5 py-3" style={{ color: "#818cf8" }}>
                      {pct(Number(f.click_rate))}
                    </td>
                    <td className="px-5 py-3" style={{ color: "#f87171" }}>
                      {Number(f.unsubscribes) > 0
                        ? Number(f.unsubscribes).toLocaleString()
                        : <span style={{ color: "#374151" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
