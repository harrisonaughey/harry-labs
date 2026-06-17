"use client";

type Point = { date: string; spend: number };

export default function SpendChart({
  data,
  color = "#6366f1",
  label = "Daily Spend",
}: {
  data: Point[];
  color?: string;
  label?: string;
}) {
  if (!data?.length) {
    return (
      <div className="h-24 flex items-center justify-center text-xs" style={{ color: "var(--text-faint)" }}>
        No spend data for this period
      </div>
    );
  }

  const max      = Math.max(...data.map((d) => d.spend), 0.01);
  const W        = 1000;
  const H        = 96;
  const PL       = 44;
  const PR       = 8;
  const PT       = 8;
  const PB       = 22;
  const cw       = W - PL - PR;
  const ch       = H - PT - PB;
  const barW     = Math.max((cw / data.length) - 1.5, 2);
  const showEvery = Math.max(Math.ceil(data.length / 8), 1);
  const yTicks   = [0, max / 2, max];
  const total    = data.reduce((s, d) => s + d.spend, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            Total: <span style={{ color: "var(--text-secondary)" }}>
              ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm" style={{ background: color, opacity: 0.75 }} />
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>spend / day</span>
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {yTicks.map((v, i) => {
          const y = PT + ch - ch * (v / max);
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth={0.5} />
              <text x={PL - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="var(--text-faint)">
                {v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const barH = Math.max((d.spend / max) * ch, d.spend > 0 ? 1 : 0);
          const x    = PL + (cw / data.length) * i + 0.75;
          const y    = PT + ch - barH;
          return (
            <g key={d.date ?? i}>
              <rect x={x} y={y} width={barW} height={barH} fill={color} opacity={0.75} rx={1} />
              {i % showEvery === 0 && (
                <text x={x + barW / 2} y={H - 5} textAnchor="middle" fontSize={7} fill="var(--text-faint)">
                  {(d.date ?? "").slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
