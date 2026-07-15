"use client";

import { useEffect } from "react";

export type KlaviyoCampaign = {
  id: string;
  attributes: {
    name?: string;
    status?: string;
    scheduled_at?: string;
  };
};

export type CampaignEntry = {
  id: string;
  name: string;
  send_at: string | null;
  status: string;
  brief: string | null;
  klaviyo_campaign_id: string | null;
};

export type EmailMetric = {
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

export type StatusStyle = {
  bg: string;
  border: string;
  text: string;
  dot: string;
  pillClass: string;
  badgeClass: string;
  label: string;
  description: string;
};

export function deriveCampaignStatus(
  entry: CampaignEntry,
  klaviyoStatusMap: Record<string, string>
): StatusStyle {
  if (!entry.klaviyo_campaign_id) {
    return {
      bg:         "rgba(239,68,68,0.12)",
      border:     "rgba(239,68,68,0.25)",
      text:       "#f87171",
      dot:        "#ef4444",
      pillClass:  "cal-pill-red",
      badgeClass: "cal-badge-red",
      label: "Not Created",
      description:
        "This campaign hasn't been built in Klaviyo yet. The agent auto-builds it 7 days before send.",
    };
  }

  const ks = (klaviyoStatusMap[entry.klaviyo_campaign_id] ?? "Draft").toLowerCase();

  if (ks === "sent") {
    return {
      bg:         "rgba(16,185,129,0.08)",
      border:     "rgba(16,185,129,0.20)",
      text:       "#6ee7b7",
      dot:        "#6ee7b7",
      pillClass:  "cal-pill-sent",
      badgeClass: "cal-badge-sent",
      label: "Sent",
      description:
        "Campaign has been sent. Performance metrics reflect results since delivery.",
    };
  }

  if (ks === "scheduled") {
    return {
      bg:         "rgba(16,185,129,0.14)",
      border:     "rgba(16,185,129,0.30)",
      text:       "#34d399",
      dot:        "#10b981",
      pillClass:  "cal-pill-green",
      badgeClass: "cal-badge-green",
      label: "Scheduled",
      description:
        "Campaign is scheduled in Klaviyo with creative uploaded and ready to send.",
    };
  }

  // Draft or unknown — created but waiting for creative / scheduling
  return {
    bg:         "rgba(99,102,241,0.12)",
    border:     "rgba(99,102,241,0.25)",
    text:       "#a5b4fc",
    dot:        "#6366f1",
    pillClass:  "cal-pill-blue",
    badgeClass: "cal-badge-blue",
    label: "Awaiting Content",
    description:
      "Campaign created in Klaviyo. Upload your creative image and schedule it to send.",
  };
}

type Props = {
  entry: CampaignEntry | null;
  metric: EmailMetric | null;
  klaviyoStatusMap: Record<string, string>;
  onClose: () => void;
};

export default function CampaignDetailPanel({
  entry,
  metric,
  klaviyoStatusMap,
  onClose,
}: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  if (!entry) return null;

  const ss = deriveCampaignStatus(entry, klaviyoStatusMap);
  const isSent      = ss.label === "Sent";
  const isScheduled = ss.label === "Scheduled";

  const sendDate = entry.send_at
    ? new Date(entry.send_at).toLocaleDateString("en-AU", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        timeZone: "Australia/Sydney",
      })
    : null;

  const sentDate = metric?.date
    ? new Date(metric.date).toLocaleDateString("en-AU", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const fmt = (n: number) => n.toLocaleString();

  const openRatePct = metric
    ? (Number(metric.open_rate) > 0
        ? (Number(metric.open_rate) * 100).toFixed(1)
        : metric.delivered > 0
          ? ((metric.opened / metric.delivered) * 100).toFixed(1)
          : null)
    : null;

  const clickRatePct = metric
    ? (Number(metric.click_rate) > 0
        ? (Number(metric.click_rate) * 100).toFixed(1)
        : metric.delivered > 0
          ? ((metric.clicked / metric.delivered) * 100).toFixed(1)
          : null)
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.52)" }}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "420px",
          background: "var(--bg-card)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-24px 0 80px rgba(0,0,0,0.4)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between px-6 pt-6 pb-5 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex-1 min-w-0 pr-3">
            <p
              className="text-xs font-medium uppercase tracking-widest mb-1.5"
              style={{ color: "var(--text-faint)" }}
            >
              Email Campaign
            </p>
            <h2
              className="text-base font-semibold leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {entry.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xl leading-none transition-colors"
            style={{ color: "var(--text-muted)", background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff18")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Status badge */}
          <div
            className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
            style={{ background: ss.bg, border: `1px solid ${ss.border}` }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
              style={{ background: ss.dot, boxShadow: `0 0 10px ${ss.dot}90` }}
            />
            <div>
              <p className="text-sm font-semibold" style={{ color: ss.text }}>
                {ss.label}
              </p>
              <p
                className="text-xs mt-0.5 leading-relaxed"
                style={{ color: "var(--text-faint)" }}
              >
                {ss.description}
              </p>
            </div>
          </div>

          {/* Dates / subject */}
          <div
            className="rounded-lg px-4 py-3 space-y-2"
            style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border-subtle)" }}
          >
            {sendDate && (
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs flex-shrink-0 pt-0.5" style={{ color: "var(--text-faint)" }}>
                  Scheduled for
                </span>
                <span className="text-xs font-medium text-right" style={{ color: "var(--text-secondary)" }}>
                  {sendDate}
                </span>
              </div>
            )}
            {sentDate && isSent && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>
                  Sent on
                </span>
                <span className="text-xs font-medium" style={{ color: "#10b981" }}>
                  {sentDate}
                </span>
              </div>
            )}
            {metric?.subject && (
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs flex-shrink-0 pt-0.5" style={{ color: "var(--text-faint)" }}>
                  Subject
                </span>
                <span className="text-xs text-right leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {metric.subject}
                </span>
              </div>
            )}
          </div>

          {/* Brief */}
          {entry.brief && (
            <div
              className="rounded-lg px-4 py-3"
              style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border-subtle)" }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-faint)" }}
              >
                Brief
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {entry.brief}
              </p>
            </div>
          )}

          {/* ── Performance metrics (sent only) ── */}
          {isSent && metric && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--text-faint)" }}
              >
                Performance · since sent
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Delivered",    value: fmt(Number(metric.delivered)),                                          icon: "✅", color: "#818cf8" },
                  { label: "Unique Opens", value: fmt(Number(metric.opened)),                                             icon: "👁",  color: "#a78bfa" },
                  { label: "Open Rate",    value: openRatePct   ? `${openRatePct}%`   : "—",                             icon: "📊", color: "#10b981" },
                  { label: "Click Rate",   value: clickRatePct  ? `${clickRatePct}%`  : "—",                             icon: "🖱️", color: "#818cf8" },
                  { label: "Total Clicks", value: fmt(Number(metric.clicked)),                                            icon: "🔗", color: "#a78bfa" },
                  { label: "Revenue",      value: Number(metric.revenue) > 0 ? `$${fmt(Number(metric.revenue))}` : "—",  icon: "💰", color: "#10b981" },
                ].map(({ label, value, icon, color }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3.5"
                    style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>{label}</span>
                      <span className="text-sm">{icon}</span>
                    </div>
                    <p className="text-lg font-bold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Progress checklist (unsent) ── */}
          {!isSent && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--text-faint)" }}
              >
                Completion progress
              </p>
              <div className="space-y-3">
                {[
                  {
                    done: !!entry.klaviyo_campaign_id,
                    text: "Campaign built in Klaviyo",
                    detail: entry.klaviyo_campaign_id
                      ? `ID: ${entry.klaviyo_campaign_id.slice(0, 12)}…`
                      : "Auto-built by agent 7 days before send",
                  },
                  {
                    done: isScheduled || isSent,
                    text: "Creative image uploaded",
                    detail: "Upload via Klaviyo drag-and-drop editor",
                  },
                  {
                    done: isScheduled || isSent,
                    text: "Campaign scheduled to send",
                    detail: "Set send time in Klaviyo → Campaigns",
                  },
                ].map(({ done, text, detail }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                      style={{
                        background: done ? "#10b98120" : "var(--bg-card-inner)",
                        border: `1.5px solid ${done ? "#10b981" : "var(--border)"}`,
                        color: done ? "#10b981" : "var(--text-faint)",
                      }}
                    >
                      {done ? "✓" : ""}
                    </div>
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{
                          color: done ? "var(--text-muted)" : "var(--text-primary)",
                          textDecoration: done ? "line-through" : undefined,
                        }}
                      >
                        {text}
                      </p>
                      {!done && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                          {detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {entry.klaviyo_campaign_id && (
          <div
            className="flex-shrink-0 px-6 py-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <a
              href="https://www.klaviyo.com/omnicampaigns"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
                color: "white",
              }}
            >
              Open in Klaviyo →
            </a>
          </div>
        )}
      </div>
    </>
  );
}
