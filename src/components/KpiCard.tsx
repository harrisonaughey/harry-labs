type Props = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: string;
};

export default function KpiCard({ label, value, change, positive, icon }: Props) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "#111118", border: "1px solid #1e1e2e" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>
          {label}
        </span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-white mb-1">{value}</p>
      <span
        className="text-xs font-medium px-2 py-0.5 rounded-full"
        style={{
          background: positive ? "#10b98120" : "#ef444420",
          color: positive ? "#10b981" : "#ef4444",
        }}
      >
        {change} vs last period
      </span>
    </div>
  );
}
