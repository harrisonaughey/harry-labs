type Props = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: string;
};

export default function KpiCard({ label, value, change, positive, icon }: Props) {
  const isPercentChange = /^[+\-]?\d/.test(change) && change.includes("%");
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{value}</p>
      <span
        className="text-xs font-medium px-2 py-0.5 rounded-full"
        style={{
          background: positive ? "#10b98120" : "#ef444420",
          color: positive ? "#10b981" : "#ef4444",
        }}
      >
        {isPercentChange ? `${change} vs last period` : change}
      </span>
    </div>
  );
}
