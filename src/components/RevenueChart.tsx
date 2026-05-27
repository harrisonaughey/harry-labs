"use client";

type DataPoint = { month: string; revenue: number; orders: number };

export default function RevenueChart({ data }: { data: DataPoint[] }) {
  const max = data.length > 0 ? Math.max(...data.map((d) => d.revenue)) : 1;
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const avgRevenue = data.length > 0 ? totalRevenue / data.length : 0;
  const peakRevenue = max;

  const isEmpty = data.length === 0;

  return (
    <div
      className="rounded-xl p-5 h-full"
      style={{ background: "#111118", border: "1px solid #1e1e2e" }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-white">Revenue</h2>
          <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>Monthly overview</p>
        </div>
        <div className="flex gap-4 text-xs" style={{ color: "#6b7280" }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#6366f1" }} />
            Revenue
          </span>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <p className="text-sm" style={{ color: "#4b5563" }}>No revenue data yet</p>
          <p className="text-xs" style={{ color: "#374151" }}>Connect Shopify or Stripe to populate</p>
        </div>
      ) : (
        <div className="flex items-end gap-3 h-40">
          {data.map((d) => (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center gap-1 justify-end" style={{ height: "100%" }}>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${(d.revenue / max) * 100}%`,
                    background:
                      d.month === data[data.length - 1]?.month
                        ? "linear-gradient(180deg, #818cf8, #6366f1)"
                        : "#1e1e30",
                    minHeight: 4,
                  }}
                  title={`$${d.revenue.toLocaleString()}`}
                />
              </div>
              <span className="text-xs" style={{ color: "#4b5563" }}>{d.month}</span>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex justify-between mt-5 pt-4 text-xs"
        style={{ borderTop: "1px solid #1e1e2e", color: "#6b7280" }}
      >
        <span>Peak: <span className="text-white">${peakRevenue.toLocaleString()}</span></span>
        <span>Avg: <span className="text-white">${Math.round(avgRevenue).toLocaleString()}</span></span>
        <span>Total: <span style={{ color: "#10b981" }}>${totalRevenue.toLocaleString()}</span></span>
      </div>
    </div>
  );
}
