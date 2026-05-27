type Props = { campaigns: any[] };

export default function EmailMetrics({ campaigns }: Props) {
  const sent = campaigns.filter(
    (c) => (c.status ?? "").toLowerCase() === "sent"
  );

  const totalDelivered = sent.reduce((s, c) => s + Number(c.delivered ?? 0), 0);
  const totalOpened    = sent.reduce((s, c) => s + Number(c.opened    ?? 0), 0);
  const totalClicked   = sent.reduce((s, c) => s + Number(c.clicked   ?? 0), 0);
  const totalRevenue   = sent.reduce((s, c) => s + Number(c.revenue   ?? 0), 0);

  // Prefer stored rates from Klaviyo; fall back to computing from counts
  const avgOpenRate = (() => {
    const withRates = sent.filter((c) => Number(c.open_rate) > 0);
    if (withRates.length) {
      const avg = withRates.reduce((s, c) => s + Number(c.open_rate), 0) / withRates.length;
      return (avg * 100).toFixed(1);
    }
    return totalDelivered > 0
      ? ((totalOpened / totalDelivered) * 100).toFixed(1)
      : "0";
  })();

  const avgClickRate = (() => {
    const withRates = sent.filter((c) => Number(c.click_rate) > 0);
    if (withRates.length) {
      const avg = withRates.reduce((s, c) => s + Number(c.click_rate), 0) / withRates.length;
      return (avg * 100).toFixed(1);
    }
    return totalDelivered > 0
      ? ((totalClicked / totalDelivered) * 100).toFixed(1)
      : "0";
  })();

  const stats = [
    {
      label: "Campaigns Sent",
      value: sent.length.toString(),
      icon: "📨",
      sub: "in selected range",
    },
    {
      label: "Emails Delivered",
      value: totalDelivered.toLocaleString(),
      icon: "✅",
      sub: "total delivered",
    },
    {
      label: "Open Rate",
      value: `${avgOpenRate}%`,
      icon: "👁",
      sub: "avg across campaigns",
    },
    {
      label: "Click Rate",
      value: `${avgClickRate}%`,
      icon: "🖱️",
      sub: "avg across campaigns",
    },
    {
      label: "Email Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      icon: "💰",
      sub: "attributed revenue",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl p-4"
          style={{ background: "#111118", border: "1px solid #1e1e2e" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: "#6b7280" }}
            >
              {s.label}
            </span>
            <span>{s.icon}</span>
          </div>
          <p className="text-xl font-semibold text-white">{s.value}</p>
          <p className="text-xs mt-1" style={{ color: "#4b5563" }}>
            {s.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
