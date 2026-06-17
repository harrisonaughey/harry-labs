"use client";
import { useState } from "react";
import ScheduleEntryModal from "./ScheduleEntryModal";

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

type CalendarEntry = {
  id:                  string;
  name:                string;
  send_at:             string | null;
  status:              string;   // planned | generating | done | error
  brief:               string | null;
  klaviyo_campaign_id: string | null;
};

type List = { id: string; attributes: { name: string } };

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

// Status styling for content_calendar entries
const CAL_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  planned:    { bg: "#6366f118", text: "#818cf8", label: "Planned" },
  generating: { bg: "#f59e0b18", text: "#fbbf24", label: "Generating" },
  done:       { bg: "#10b98118", text: "#10b981", label: "Built" },
  error:      { bg: "#ef444418", text: "#ef4444", label: "Error" },
};

/** Convert an ISO send_at string to a local "YYYY-MM-DD" key matching the calendar grid. */
function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  campaigns:       Campaign[];
  filtered:        Campaign[];
  days:            number | null;
  lists:           List[];
  calendarEntries: CalendarEntry[];
};

export default function CampaignCalendar({ campaigns, filtered, days, lists, calendarEntries }: Props) {
  const [view, setView]               = useState<"calendar" | "list">("list");
  const today                         = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear,  setCurrentYear]  = useState(today.getFullYear());
  const [hoveredCell,  setHoveredCell]  = useState<string | null>(null);

  // Modal state
  const [modalOpen,  setModalOpen]  = useState(false);
  const [modalDate,  setModalDate]  = useState<string | undefined>();

  function openModal(dateStr?: string) {
    setModalDate(dateStr);
    setModalOpen(true);
  }

  // Group ALL Klaviyo campaigns by date for the calendar
  const byDate: Record<string, Campaign[]> = {};
  campaigns.forEach((c) => {
    if (!byDate[c.date]) byDate[c.date] = [];
    byDate[c.date].push(c);
  });

  // Group content_calendar entries by local date for the calendar
  const calByDate: Record<string, CalendarEntry[]> = {};
  calendarEntries.forEach((e) => {
    if (!e.send_at) return;
    const key = toLocalDateKey(e.send_at);
    if (!calByDate[key]) calByDate[key] = [];
    calByDate[key].push(e);
  });

  // Upcoming entries (send_at >= today, any status) — for the list view section
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const upcomingEntries = calendarEntries
    .filter((e) => e.send_at && new Date(e.send_at) >= todayMidnight)
    .sort((a, b) => new Date(a.send_at!).getTime() - new Date(b.send_at!).getTime());

  const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthName   = new Date(currentYear, currentMonth).toLocaleString("en-AU", { month: "long", year: "numeric" });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const listCampaigns = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <>
      <div className="rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Campaign Schedule</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e1e30", color: "var(--text-muted)" }}>
              {days === null ? "All time" : `Last ${days} days`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Manual Entry button — always visible */}
            <button
              onClick={() => openModal()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "white" }}>
              + Manual Entry
            </button>

            {/* View toggle */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "#1e1e30" }}>
              {(["list", "calendar"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="text-xs px-3 py-1.5 rounded-md capitalize transition-all"
                  style={{
                    background: view === v ? "#2a2a3a" : "transparent",
                    color:      view === v ? "#a5b4fc" : "var(--text-muted)",
                  }}>
                  {v === "list" ? "≡ List" : "⊞ Calendar"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── List View ── */}
        {view === "list" ? (
          <div>

            {/* ── Upcoming from Campaign Calendar ── */}
            {upcomingEntries.length > 0 && (
              <div>
                {/* Section header */}
                <div className="flex items-center justify-between px-5 py-2.5"
                  style={{ borderBottom: "1px solid var(--border)", background: "#6366f108" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#818cf8" }}>
                      ✦ Upcoming — Campaign Calendar
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "#6366f120", color: "#818cf8" }}>
                      {upcomingEntries.length}
                    </span>
                  </div>
                  <a href="/content-calendar"
                    className="text-xs hover:underline flex items-center gap-1"
                    style={{ color: "var(--text-faint)" }}>
                    Manage all →
                  </a>
                </div>

                {/* Upcoming rows */}
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border)" }}>
                      {["Campaign", "Send Date", "Status", "Brief", "Klaviyo"].map((h) => (
                        <th key={h} className="px-5 py-2.5 text-left font-medium uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingEntries.map((e) => {
                      const cs = CAL_STATUS[e.status] ?? { bg: "#6b728018", text: "#9ca3af", label: e.status };
                      return (
                        <tr key={e.id}
                          style={{ borderTop: "1px solid var(--border-subtle)" }}
                          className="hover:bg-white/[0.02] transition-colors">

                          {/* Name */}
                          <td className="px-5 py-3 max-w-[200px]">
                            <p className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{e.name}</p>
                          </td>

                          {/* Send date */}
                          <td className="px-5 py-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                            {e.send_at
                              ? new Date(e.send_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                              : "—"}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium"
                              style={{ background: cs.bg, color: cs.text }}>
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cs.text }} />
                              {cs.label}
                            </span>
                          </td>

                          {/* Brief */}
                          <td className="px-5 py-3 max-w-[260px]">
                            {e.brief
                              ? <span className="line-clamp-1 text-xs" style={{ color: "var(--text-faint)" }}>{e.brief}</span>
                              : <span style={{ color: "var(--text-faint)", opacity: 0.4 }}>—</span>}
                          </td>

                          {/* Klaviyo link if built */}
                          <td className="px-5 py-3">
                            {e.klaviyo_campaign_id
                              ? <a href="https://www.klaviyo.com/omnicampaigns" target="_blank" rel="noopener noreferrer"
                                  className="text-xs hover:underline font-mono"
                                  style={{ color: "#a5b4fc" }}>
                                  {e.klaviyo_campaign_id.slice(0, 8)}…
                                </a>
                              : <span style={{ color: "var(--text-faint)", opacity: 0.3 }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Recent Klaviyo Campaigns ── */}
            {(listCampaigns.length > 0 || upcomingEntries.length === 0) && (
              <>
                {/* Section header (only shown when there's also an upcoming section) */}
                {upcomingEntries.length > 0 && (
                  <div className="px-5 py-2.5" style={{ borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}>
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                      Recent — Klaviyo
                    </span>
                  </div>
                )}

                {listCampaigns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                      No campaigns in this range
                    </p>
                    <button
                      onClick={() => openModal()}
                      className="text-xs px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
                      style={{ background: "#6366f120", color: "#a5b4fc", border: "1px solid #6366f130" }}>
                      + Schedule your first campaign
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: "var(--text-faint)" }}>
                        {["Campaign", "Date", "Delivered", "Opens", "Open Rate", "Click Rate", "Status"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
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

                        const s = STATUS_COLOR[c.status] ?? { bg: "#6b728020", text: "#9ca3af" };

                        return (
                          <tr
                            key={c.campaign_id}
                            style={{ borderTop: "1px solid var(--border-subtle)" }}
                            className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{c.campaign_name}</p>
                              {c.subject && (
                                <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: "var(--text-faint)" }}>
                                  {c.subject}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>
                              {new Date(c.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-5 py-3" style={{ color: "var(--text-primary)" }}>
                              {Number(c.delivered) > 0
                                ? Number(c.delivered).toLocaleString()
                                : <span style={{ color: "#374151" }}>—</span>}
                            </td>
                            <td className="px-5 py-3" style={{ color: "var(--text-primary)" }}>
                              {Number(c.opened) > 0
                                ? Number(c.opened).toLocaleString()
                                : <span style={{ color: "#374151" }}>—</span>}
                            </td>
                            <td className="px-5 py-3" style={{ color: "#10b981" }}>{openRateDisplay}</td>
                            <td className="px-5 py-3" style={{ color: "#818cf8" }}>{clickRateDisplay}</td>
                            <td className="px-5 py-3">
                              <span className="px-2 py-0.5 rounded-full font-medium capitalize"
                                style={{ background: s.bg, color: s.text }}>
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        ) : (
          // ── Calendar View ──
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
                  else setCurrentMonth((m) => m - 1);
                }}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                ← Prev
              </button>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{monthName}</span>
              <button
                onClick={() => {
                  if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
                  else setCurrentMonth((m) => m + 1);
                }}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                Next →
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-xs py-1" style={{ color: "var(--text-faint)" }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;

                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayCampaigns  = byDate[dateStr]    ?? [];
                const dayCalendar   = calByDate[dateStr] ?? [];
                const totalCount    = dayCampaigns.length + dayCalendar.length;
                const isToday =
                  day === today.getDate() &&
                  currentMonth === today.getMonth() &&
                  currentYear === today.getFullYear();
                const isFuture = new Date(dateStr) >= new Date(today.toDateString());
                const isHovered = hoveredCell === dateStr;

                // Allocate pill slots: max 3 total before "+N more"
                const MAX_PILLS = 3;
                // Prioritise: calendar (planned) first on future dates, klaviyo first on past
                const orderedKlaviyo  = isFuture ? [] : dayCampaigns;
                const orderedCalendar = dayCalendar;
                const orderedKlaviyoPast = isFuture ? dayCampaigns : [];
                const allPills = [...orderedCalendar, ...orderedKlaviyo, ...orderedKlaviyoPast];
                const visiblePills = allPills.slice(0, MAX_PILLS);
                const hiddenCount  = totalCount - visiblePills.length;

                return (
                  <div
                    key={i}
                    className="rounded-lg p-1.5 min-h-[60px] relative cursor-pointer transition-all"
                    style={{
                      background: isToday       ? "#1e1e30"
                                : isHovered && isFuture ? "#6366f110"
                                : "var(--bg-card-inner)",
                      border: isToday           ? "1px solid #3730a3"
                            : isHovered && isFuture ? "1px solid #6366f140"
                            : "1px solid var(--border)",
                    }}
                    onMouseEnter={() => setHoveredCell(dateStr)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => isFuture && openModal(dateStr)}
                  >
                    {/* Day number */}
                    <span className="text-xs block mb-1 select-none"
                      style={{ color: isToday ? "#a5b4fc" : "var(--text-muted)" }}>
                      {day}
                    </span>

                    {/* Render mixed pills */}
                    {visiblePills.map((item, idx) => {
                      // Discriminate: CalendarEntry has "send_at", Campaign has "campaign_id"
                      if ("send_at" in item) {
                        // CalendarEntry pill — left border to distinguish from Klaviyo
                        const cs = CAL_STATUS[(item as CalendarEntry).status] ?? { bg: "#6b728018", text: "#9ca3af" };
                        return (
                          <div key={(item as CalendarEntry).id}
                            className="text-xs px-1 py-0.5 rounded truncate mb-0.5"
                            style={{
                              background:  cs.bg,
                              color:       cs.text,
                              borderLeft:  `2px solid ${cs.text}`,
                            }}
                            title={`📅 ${(item as CalendarEntry).name}`}>
                            {(item as CalendarEntry).name.slice(0, 13)}
                          </div>
                        );
                      } else {
                        // Klaviyo Campaign pill
                        const c  = item as Campaign;
                        const s  = STATUS_COLOR[c.status] ?? { bg: "#6b728020", text: "#9ca3af" };
                        return (
                          <div key={`${c.campaign_id}-${idx}`}
                            className="text-xs px-1 py-0.5 rounded truncate mb-0.5"
                            style={{ background: s.bg, color: s.text }}
                            title={c.campaign_name}>
                            {c.campaign_name.slice(0, 13)}
                          </div>
                        );
                      }
                    })}

                    {hiddenCount > 0 && (
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                        +{hiddenCount} more
                      </span>
                    )}

                    {/* "+" add button — appears on hover for future dates */}
                    {isFuture && isHovered && (
                      <div
                        className="absolute bottom-1 right-1 w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold"
                        style={{ background: "#6366f1", color: "white", lineHeight: 1 }}>
                        +
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Calendar legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 flex-wrap" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>Click any future date to schedule a campaign</span>
              <div className="flex items-center gap-3 ml-auto flex-wrap">
                {/* Klaviyo statuses */}
                {[
                  { label: "Sent",      ...STATUS_COLOR.sent },
                  { label: "Scheduled", ...STATUS_COLOR.scheduled },
                  { label: "Draft",     ...STATUS_COLOR.draft },
                ].map(({ label, bg, text }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
                    <span className="w-2 h-2 rounded-sm" style={{ background: bg, border: `1px solid ${text}` }} />
                    {label}
                  </span>
                ))}
                {/* Divider */}
                <span className="w-px h-3 flex-shrink-0" style={{ background: "var(--border)" }} />
                {/* Calendar pipeline statuses */}
                {[
                  { label: "Planned", bg: CAL_STATUS.planned.bg, text: CAL_STATUS.planned.text },
                  { label: "Built",   bg: CAL_STATUS.done.bg,    text: CAL_STATUS.done.text    },
                ].map(({ label, bg, text }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
                    <span className="w-2 h-2 rounded-sm" style={{ background: bg, borderLeft: `2px solid ${text}` }} />
                    {label} (pipeline)
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Schedule Entry Modal ── */}
      {modalOpen && (
        <ScheduleEntryModal
          lists={lists}
          defaultDate={modalDate}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
