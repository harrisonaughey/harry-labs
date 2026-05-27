"use client";
import { useState } from "react";

type Campaign = {
  campaign_id: string;
  campaign_name: string;
  date: string;
  status: string;
  subject: string | null;
  delivered: number;
  opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
  revenue: number;
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  sent:      { bg: "#10b98120", text: "#10b981" },
  Sent:      { bg: "#10b98120", text: "#10b981" },
  scheduled: { bg: "#6366f120", text: "#818cf8" },
  Scheduled: { bg: "#6366f120", text: "#818cf8" },
  draft:     { bg: "#6b728020", text: "#9ca3af" },
  Draft:     { bg: "#6b728020", text: "#9ca3af" },
  cancelled: { bg: "#ef444420", text: "#ef4444" },
  Cancelled: { bg: "#ef444420", text: "#ef4444" },
};

type Props = {
  campaigns: Campaign[];        // all campaigns (used for calendar dots)
  filtered: Campaign[];         // date-range filtered (used for list view)
  days: number | null;
};

export default function CampaignCalendar({ campaigns, filtered, days }: Props) {
  const [view, setView] = useState<"calendar" | "list">("list");
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Group ALL campaigns by date for the calendar
  const byDate: Record<string, Campaign[]> = {};
  campaigns.forEach((c) => {
    if (!byDate[c.date]) byDate[c.date] = [];
    byDate[c.date].push(c);
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthName = new Date(currentYear, currentMonth).toLocaleString("en-AU", {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // List view uses the date-filtered set, sorted newest first
  const listCampaigns = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="rounded-xl" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid #1e1e2e" }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Campaign Schedule</h2>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "#6b7280" }}>
            {days === null ? "All time" : `Last ${days} days`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["list", "calendar"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="text-xs px-3 py-1.5 rounded-md capitalize"
              style={{
                background: view === v ? "#1e1e30" : "transparent",
                color: view === v ? "#a5b4fc" : "#6b7280",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "list" ? (
        <div>
          {listCampaigns.length === 0 ? (
            <div
              className="flex items-center justify-center py-12 text-sm"
              style={{ color: "#4b5563" }}
            >
              No campaigns in this range — try a wider date filter or sync Klaviyo
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "#4b5563" }}>
                  {["Campaign", "Date", "Delivered", "Opens", "Open Rate", "Click Rate", "Status"].map((h) => (
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
                {listCampaigns.map((c) => {
                  const openRateDisplay =
                    Number(c.open_rate) > 0
                      ? (Number(c.open_rate) * 100).toFixed(1) + "%"
                      : c.delivered > 0
                      ? ((c.opened / c.delivered) * 100).toFixed(1) + "%"
                      : "—";

                  const clickRateDisplay =
                    Number(c.click_rate) > 0
                      ? (Number(c.click_rate) * 100).toFixed(1) + "%"
                      : c.delivered > 0
                      ? ((c.clicked / c.delivered) * 100).toFixed(1) + "%"
                      : "—";

                  const style =
                    STATUS_COLOR[c.status] ?? { bg: "#6b728020", text: "#9ca3af" };

                  return (
                    <tr
                      key={c.campaign_id}
                      style={{ borderTop: "1px solid #1a1a24" }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="text-white font-medium">{c.campaign_name}</p>
                        {c.subject && (
                          <p
                            style={{ color: "#4b5563" }}
                            className="text-xs mt-0.5 truncate max-w-xs"
                          >
                            {c.subject}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3" style={{ color: "#9ca3af" }}>
                        {new Date(c.date).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3 text-white">
                        {Number(c.delivered) > 0
                          ? Number(c.delivered).toLocaleString()
                          : <span style={{ color: "#374151" }}>—</span>}
                      </td>
                      <td className="px-5 py-3 text-white">
                        {Number(c.opened) > 0
                          ? Number(c.opened).toLocaleString()
                          : <span style={{ color: "#374151" }}>—</span>}
                      </td>
                      <td className="px-5 py-3" style={{ color: "#10b981" }}>
                        {openRateDisplay}
                      </td>
                      <td className="px-5 py-3" style={{ color: "#818cf8" }}>
                        {clickRateDisplay}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full font-medium capitalize"
                          style={{ background: style.bg, color: style.text }}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                if (currentMonth === 0) {
                  setCurrentMonth(11);
                  setCurrentYear((y) => y - 1);
                } else setCurrentMonth((m) => m - 1);
              }}
              className="text-xs px-2 py-1 rounded"
              style={{ color: "#6b7280" }}
            >
              ← Prev
            </button>
            <span className="text-sm font-medium text-white">{monthName}</span>
            <button
              onClick={() => {
                if (currentMonth === 11) {
                  setCurrentMonth(0);
                  setCurrentYear((y) => y + 1);
                } else setCurrentMonth((m) => m + 1);
              }}
              className="text-xs px-2 py-1 rounded"
              style={{ color: "#6b7280" }}
            >
              Next →
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center text-xs py-1"
                style={{ color: "#4b5563" }}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayCampaigns = byDate[dateStr] ?? [];
              const isToday =
                day === today.getDate() &&
                currentMonth === today.getMonth() &&
                currentYear === today.getFullYear();

              return (
                <div
                  key={i}
                  className="rounded-lg p-1 min-h-[52px]"
                  style={{
                    background: isToday ? "#1e1e30" : "#0d0d14",
                    border: `1px solid ${isToday ? "#3730a3" : "#1e1e2e"}`,
                  }}
                >
                  <span
                    className="text-xs block mb-1"
                    style={{ color: isToday ? "#a5b4fc" : "#6b7280" }}
                  >
                    {day}
                  </span>
                  {dayCampaigns.slice(0, 2).map((c) => {
                    const style =
                      STATUS_COLOR[c.status] ?? { bg: "#6b728020", text: "#9ca3af" };
                    return (
                      <div
                        key={c.campaign_id}
                        className="text-xs px-1 py-0.5 rounded truncate mb-0.5"
                        style={{ background: style.bg, color: style.text }}
                        title={c.campaign_name}
                      >
                        {c.campaign_name.slice(0, 12)}
                      </div>
                    );
                  })}
                  {dayCampaigns.length > 2 && (
                    <span className="text-xs" style={{ color: "#4b5563" }}>
                      +{dayCampaigns.length - 2} more
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
