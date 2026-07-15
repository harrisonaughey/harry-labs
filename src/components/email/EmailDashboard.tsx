"use client";
import { useState, useMemo } from "react";
import EmailMetrics from "./EmailMetrics";
import CampaignCalendar from "./CampaignCalendar";
import FlowsView from "./FlowsView";
import type { KlaviyoCampaign } from "./CampaignDetailPanel";

const RANGES = [
  { label: "7d",        days: 7    },
  { label: "30d",       days: 30   },
  { label: "90d",       days: 90   },
  { label: "All time",  days: null },
];

type List = { id: string; attributes: { name: string } };

type Props = {
  campaigns:        any[];
  flows:            any[];
  lists:            List[];
  calendarEntries:  any[];
  klaviyoCampaigns: KlaviyoCampaign[];
};

export default function EmailDashboard({
  campaigns,
  flows,
  lists,
  calendarEntries,
  klaviyoCampaigns,
}: Props) {
  const [tab,  setTab]  = useState<"campaigns" | "flows">("campaigns");
  const [days, setDays] = useState<number | null>(30);

  const filteredCampaigns = useMemo(() => {
    if (days === null) return campaigns;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return campaigns.filter((c) => new Date(c.date) >= cutoff);
  }, [campaigns, days]);

  return (
    <>
      {/* ── Tab bar + date pills ── */}
      <div className="flex items-center justify-between mb-6">
        <div
          className="flex items-center gap-1 p-1 rounded-lg"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          {(["campaigns", "flows"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-sm px-4 py-1.5 rounded-md font-medium capitalize transition-all"
              style={{
                background: tab === t ? "#1e1e30" : "transparent",
                color:      tab === t ? "#a5b4fc" : "var(--text-muted)",
              }}
            >
              {t === "campaigns" ? "📧 Campaigns" : "🔁 Flows"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>Range:</span>
          {RANGES.map(({ label, days: d }) => (
            <button
              key={label}
              onClick={() => setDays(d)}
              className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
              style={{
                background: days === d ? "#1e1e30" : "transparent",
                color:      days === d ? "#a5b4fc" : "var(--text-muted)",
                border: `1px solid ${days === d ? "#3730a3" : "var(--border)"}`,
              }}
            >
              {label}
            </button>
          ))}
          <span className="text-xs ml-1" style={{ color: "#374151" }}>
            {tab === "campaigns"
              ? `${filteredCampaigns.length} campaign${filteredCampaigns.length !== 1 ? "s" : ""}`
              : `${flows.length} flow${flows.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      {tab === "campaigns" ? (
        <>
          <EmailMetrics campaigns={filteredCampaigns} />
          <CampaignCalendar
            campaigns={campaigns}
            filtered={filteredCampaigns}
            days={days}
            lists={lists}
            calendarEntries={calendarEntries}
            klaviyoCampaigns={klaviyoCampaigns}
          />
        </>
      ) : (
        <FlowsView flows={flows} days={days} />
      )}
    </>
  );
}
