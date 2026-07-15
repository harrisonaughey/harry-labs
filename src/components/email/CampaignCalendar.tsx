"use client";

import { useState, useMemo } from "react";
import ScheduleEntryModal from "./ScheduleEntryModal";
import CampaignDetailPanel, {
  deriveCampaignStatus,
  type CampaignEntry,
  type EmailMetric,
  type KlaviyoCampaign,
} from "./CampaignDetailPanel";

type List = { id: string; attributes: { name: string } };

type Props = {
  campaigns:        EmailMetric[];
  filtered:         EmailMetric[];
  days:             number | null;
  lists:            List[];
  calendarEntries:  CampaignEntry[];
  klaviyoCampaigns: KlaviyoCampaign[];
};

/** Convert an ISO send_at to a local "YYYY-MM-DD" calendar key. */
function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CampaignCalendar({
  campaigns,
  filtered,
  days,
  lists,
  calendarEntries,
  klaviyoCampaigns,
}: Props) {
  const today = new Date();

  const [view,         setView]         = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear,  setCurrentYear]  = useState(today.getFullYear());
  const [hoveredCell,  setHoveredCell]  = useState<string | null>(null);

  // Modal state (add new entry)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string | undefined>();

  // Detail panel state
  const [selectedEntry, setSelectedEntry] = useState<CampaignEntry | null>(null);

  // Sync state
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done">("idle");
  const [syncResult, setSyncResult] = useState<{ linked: number } | null>(null);

  async function runSync() {
    setSyncState("syncing");
    try {
      const res = await fetch("/api/klaviyo/sync-calendar", { method: "POST" });
      const data = await res.json();
      setSyncResult({ linked: data.linked ?? 0 });
      setSyncState("done");
      setTimeout(() => setSyncState("idle"), 4000);
      if (data.linked > 0) window.location.reload();
    } catch {
      setSyncState("idle");
    }
  }

  // Build Klaviyo status map: { campaignId -> "Draft"|"Scheduled"|"Sent"|"Cancelled" }
  const klaviyoStatusMap = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    klaviyoCampaigns.forEach((k) => {
      if (k.id) m[k.id] = k.attributes?.status ?? "Draft";
    });
    // Also mark campaigns in email_metrics as sent
    campaigns.forEach((c) => {
      if (c.campaign_id && (c.status ?? "").toLowerCase() === "sent") {
        m[c.campaign_id] = "Sent";
      }
    });
    return m;
  }, [klaviyoCampaigns, campaigns]);

  // email_metrics lookup by klaviyo campaign id
  const metricByKlaviyoId = useMemo<Record<string, EmailMetric>>(() => {
    const m: Record<string, EmailMetric> = {};
    campaigns.forEach((c) => { m[c.campaign_id] = c; });
    return m;
  }, [campaigns]);

  function openModal(dateStr?: string) {
    setModalDate(dateStr);
    setModalOpen(true);
  }

  function openDetail(entry: CampaignEntry, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedEntry(entry);
  }

  // Group calendar entries by local date
  const calByDate = useMemo(() => {
    const m: Record<string, CampaignEntry[]> = {};
    calendarEntries.forEach((e) => {
      if (!e.send_at) return;
      const key = toLocalDateKey(e.send_at);
      if (!m[key]) m[key] = [];
      m[key].push(e);
    });
    return m;
  }, [calendarEntries]);

  // Upcoming (send_at >= today) for list view header
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const upcomingEntries = useMemo(
    () =>
      calendarEntries
        .filter((e) => e.send_at && new Date(e.send_at) >= todayMidnight)
        .sort((a, b) => new Date(a.send_at!).getTime() - new Date(b.send_at!).getTime()),
    [calendarEntries] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Past sent calendar entries for list view
  const pastEntries = useMemo(
    () =>
      calendarEntries
        .filter((e) => e.send_at && new Date(e.send_at) < todayMidnight)
        .sort((a, b) => new Date(b.send_at!).getTime() - new Date(a.send_at!).getTime()),
    [calendarEntries] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Calendar grid
  const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthName   = new Date(currentYear, currentMonth).toLocaleString("en-AU", {
    month: "long", year: "numeric",
  });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const listCampaigns = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const LEGEND = [
    { dotColor: "#ef4444", bg: "rgba(239,68,68,0.18)",  label: "Not Created" },
    { dotColor: "#6366f1", bg: "rgba(99,102,241,0.18)", label: "Awaiting Content" },
    { dotColor: "#10b981", bg: "rgba(16,185,129,0.22)", label: "Scheduled" },
    { dotColor: "#6ee7b7", bg: "rgba(16,185,129,0.10)", label: "Sent", faded: true },
  ];

  return (
    <>
      <div
        className="rounded-xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Campaign Calendar
            </h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#1e1e30", color: "var(--text-muted)" }}
            >
              {calendarEntries.length} planned
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Sync campaign IDs button */}
            <button
              onClick={runSync}
              disabled={syncState === "syncing"}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-50"
              style={{
                background: syncState === "done"
                  ? (syncResult?.linked ?? 0) > 0 ? "#10b98120" : "#ffffff10"
                  : "#ffffff10",
                color: syncState === "done"
                  ? (syncResult?.linked ?? 0) > 0 ? "#34d399" : "var(--text-muted)"
                  : "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {syncState === "syncing" ? (
                <>
                  <span className="animate-spin inline-block">↻</span> Syncing…
                </>
              ) : syncState === "done" ? (
                (syncResult?.linked ?? 0) > 0
                  ? `✓ ${syncResult!.linked} linked`
                  : "✓ Up to date"
              ) : (
                "↻ Sync IDs"
              )}
            </button>

            <button
              onClick={() => openModal()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{
                background: "linear-gradient(135deg, #6366f1, #818cf8)",
                color: "white",
              }}
            >
              + Manual Entry
            </button>

            <div
              className="flex items-center gap-1 p-0.5 rounded-lg"
              style={{ background: "#1e1e30" }}
            >
              {(["calendar", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="text-xs px-3 py-1.5 rounded-md capitalize transition-all"
                  style={{
                    background: view === v ? "#2a2a3a" : "transparent",
                    color:      view === v ? "#a5b4fc" : "var(--text-muted)",
                  }}
                >
                  {v === "calendar" ? "⊞ Calendar" : "≡ List"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Calendar View ── */}
        {view === "calendar" ? (
          <div className="p-5">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => {
                  if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
                  else setCurrentMonth((m) => m - 1);
                }}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff08")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                ← Prev
              </button>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {monthName}
              </span>
              <button
                onClick={() => {
                  if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
                  else setCurrentMonth((m) => m + 1);
                }}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff08")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Next →
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="text-center text-xs py-1 font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;

                const dateStr   = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEntries = calByDate[dateStr] ?? [];
                const isToday   = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                const isFuture  = new Date(dateStr) >= new Date(today.toDateString());
                const isHovered = hoveredCell === dateStr;
                const MAX_PILLS = 3;
                const visible   = dayEntries.slice(0, MAX_PILLS);
                const hidden    = dayEntries.length - visible.length;

                return (
                  <div
                    key={i}
                    className="rounded-lg p-1.5 min-h-[72px] relative transition-all"
                    style={{
                      background: isToday   ? "var(--cal-today-bg)"
                                : isHovered ? "var(--bg-subtle)"
                                : "var(--bg-card-inner)",
                      border: isToday   ? "1px solid var(--cal-today-border)"
                            : isHovered ? "1px solid var(--border)"
                            : "1px solid var(--border-subtle)",
                      cursor: isFuture ? "pointer" : "default",
                    }}
                    onMouseEnter={() => setHoveredCell(dateStr)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => { if (isFuture && dayEntries.length === 0) openModal(dateStr); }}
                  >
                    {/* Day number */}
                    <span
                      className="text-xs block mb-1 select-none font-medium"
                      style={{
                        color: isToday ? "var(--cal-today-text)" : isFuture ? "var(--text-secondary)" : "var(--text-faint)",
                      }}
                    >
                      {day}
                    </span>

                    {/* Entry pills */}
                    {visible.map((entry) => {
                      const ss = deriveCampaignStatus(entry, klaviyoStatusMap);
                      return (
                        <button
                          key={entry.id}
                          onClick={(e) => openDetail(entry, e)}
                          className={`w-full text-left text-xs px-1.5 py-0.5 rounded mb-0.5 truncate block transition-opacity hover:opacity-80 ${ss.pillClass}`}
                          title={`${ss.label} · ${entry.name}`}
                        >
                          {entry.name.slice(0, 14)}
                        </button>
                      );
                    })}

                    {hidden > 0 && (
                      <span className="text-xs pl-1" style={{ color: "var(--text-faint)" }}>
                        +{hidden} more
                      </span>
                    )}

                    {/* "+" add button on empty future cells */}
                    {isFuture && dayEntries.length === 0 && isHovered && (
                      <div
                        className="absolute bottom-1 right-1 w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold"
                        style={{ background: "#6366f1", color: "white", lineHeight: 1 }}
                      >
                        +
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div
              className="flex items-center gap-5 mt-5 pt-4 flex-wrap"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                Click any campaign to view details · Click empty future date to add
              </span>
              <div className="flex items-center gap-4 ml-auto flex-wrap">
                {LEGEND.map(({ dotColor, bg, label, faded }) => (
                  <span
                    key={label}
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: "var(--text-faint)", opacity: faded ? 0.75 : 1 }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: bg, borderLeft: `2px solid ${dotColor}` }}
                    />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── List View ── */
          <div>

            {/* Upcoming section */}
            {upcomingEntries.length > 0 && (
              <section>
                <div
                  className="flex items-center justify-between px-5 py-2.5"
                  style={{ borderBottom: "1px solid var(--border)", background: "#6366f106" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "#818cf8" }}
                    >
                      ✦ Upcoming
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "#6366f120", color: "#818cf8" }}
                    >
                      {upcomingEntries.length}
                    </span>
                  </div>
                  <a
                    href="/content-calendar"
                    className="text-xs hover:underline"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Manage all →
                  </a>
                </div>
                <ListEntryRows
                  entries={upcomingEntries}
                  klaviyoStatusMap={klaviyoStatusMap}
                  onSelect={setSelectedEntry}
                />
              </section>
            )}

            {/* Past / sent section */}
            {pastEntries.length > 0 && (
              <section>
                <div
                  className="flex items-center gap-2 px-5 py-2.5"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    borderTop: upcomingEntries.length > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Sent / Past
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: "#ffffff10", color: "var(--text-faint)" }}
                  >
                    {pastEntries.length}
                  </span>
                </div>
                <ListEntryRows
                  entries={pastEntries}
                  klaviyoStatusMap={klaviyoStatusMap}
                  onSelect={setSelectedEntry}
                />
              </section>
            )}

            {/* Recent Klaviyo performance (sent campaigns not in calendar) */}
            {listCampaigns.length > 0 && (
              <section>
                <div
                  className="px-5 py-2.5"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    borderTop: (upcomingEntries.length > 0 || pastEntries.length > 0) ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Klaviyo Performance · {days === null ? "All time" : `Last ${days} days`}
                  </span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: "var(--text-faint)" }}>
                      {["Campaign", "Date", "Delivered", "Open Rate", "Click Rate", "Status"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left font-medium uppercase tracking-wider">
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
                      const statusLower = (c.status ?? "").toLowerCase();
                      const statusColor =
                        statusLower === "sent"      ? "#6ee7b7"
                        : statusLower === "scheduled" ? "#10b981"
                        : "#9ca3af";
                      const statusBg =
                        statusLower === "sent"      ? "#10b98118"
                        : statusLower === "scheduled" ? "#10b98125"
                        : "#6b728018";

                      return (
                        <tr
                          key={c.campaign_id}
                          style={{ borderTop: "1px solid var(--border-subtle)" }}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-5 py-3">
                            <p className="font-medium truncate max-w-[180px]" style={{ color: "var(--text-primary)" }}>
                              {c.campaign_name}
                            </p>
                            {c.subject && (
                              <p className="text-xs mt-0.5 truncate max-w-[180px]" style={{ color: "var(--text-faint)" }}>
                                {c.subject}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                            {new Date(c.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-5 py-3" style={{ color: "var(--text-primary)" }}>
                            {Number(c.delivered) > 0 ? Number(c.delivered).toLocaleString() : "—"}
                          </td>
                          <td className="px-5 py-3" style={{ color: "#10b981" }}>{openRateDisplay}</td>
                          <td className="px-5 py-3" style={{ color: "#818cf8" }}>{clickRateDisplay}</td>
                          <td className="px-5 py-3">
                            <span
                              className="px-2 py-0.5 rounded-full font-medium capitalize"
                              style={{ background: statusBg, color: statusColor }}
                            >
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}

            {calendarEntries.length === 0 && listCampaigns.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-sm" style={{ color: "var(--text-faint)" }}>No campaigns yet</p>
                <button
                  onClick={() => openModal()}
                  className="text-xs px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
                  style={{
                    background: "#6366f120",
                    color: "#a5b4fc",
                    border: "1px solid #6366f130",
                  }}
                >
                  + Schedule your first campaign
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Schedule entry modal ── */}
      {modalOpen && (
        <ScheduleEntryModal
          lists={lists}
          defaultDate={modalDate}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* ── Campaign detail panel ── */}
      {selectedEntry && (
        <CampaignDetailPanel
          entry={selectedEntry}
          metric={selectedEntry.klaviyo_campaign_id ? (metricByKlaviyoId[selectedEntry.klaviyo_campaign_id] ?? null) : null}
          klaviyoStatusMap={klaviyoStatusMap}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </>
  );
}

// ── Shared list-row renderer ──────────────────────────────────────────────────
function ListEntryRows({
  entries,
  klaviyoStatusMap,
  onSelect,
}: {
  entries: CampaignEntry[];
  klaviyoStatusMap: Record<string, string>;
  onSelect: (e: CampaignEntry) => void;
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr style={{ color: "var(--text-faint)" }}>
          {["Campaign", "Send Date", "Status", "Brief", "Klaviyo"].map((h) => (
            <th key={h} className="px-5 py-2.5 text-left font-medium uppercase tracking-wider">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const ss = deriveCampaignStatus(entry, klaviyoStatusMap);
          return (
            <tr
              key={entry.id}
              style={{ borderTop: "1px solid var(--border-subtle)", cursor: "pointer" }}
              className="hover:bg-white/[0.025] transition-colors"
              onClick={() => onSelect(entry)}
            >
              <td className="px-5 py-3 max-w-[200px]">
                <p className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {entry.name}
                </p>
              </td>
              <td className="px-5 py-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {entry.send_at
                  ? new Date(entry.send_at).toLocaleDateString("en-AU", {
                      day: "numeric", month: "short", year: "numeric",
                    })
                  : "—"}
              </td>
              <td className="px-5 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${ss.badgeClass}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: ss.dot }}
                  />
                  {ss.label}
                </span>
              </td>
              <td className="px-5 py-3 max-w-[240px]">
                {entry.brief ? (
                  <span className="line-clamp-1" style={{ color: "var(--text-faint)" }}>
                    {entry.brief}
                  </span>
                ) : (
                  <span style={{ color: "var(--text-faint)", opacity: 0.35 }}>—</span>
                )}
              </td>
              <td className="px-5 py-3">
                {entry.klaviyo_campaign_id ? (
                  <span
                    className="font-mono"
                    style={{ color: "#a5b4fc" }}
                    title={entry.klaviyo_campaign_id}
                  >
                    {entry.klaviyo_campaign_id.slice(0, 8)}…
                  </span>
                ) : (
                  <span style={{ color: "var(--text-faint)", opacity: 0.3 }}>—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
