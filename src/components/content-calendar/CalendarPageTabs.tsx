"use client";

import { useState } from "react";
import ContentCalendarManager from "./ContentCalendarManager";
import DesignRulesManager from "./DesignRulesManager";

interface Entry {
  id: string; name: string; brief: string | null; send_at: string | null;
  list_id: string | null; destination_url: string | null;
  template_type: string | null; klaviyo_campaign_id: string | null;
  klaviyo_template_id: string | null; status: string; error_message: string | null;
  created_at: string; updated_at: string;
}
interface List  { id: string; attributes: { name: string } }
interface Rule  {
  id: string; name: string; trigger_keywords: string; template_type: string | null;
  design_brief: string; subject_formula: string | null; shopify_actions: string | null;
  color_primary: string | null; color_accent: string | null;
  is_active: boolean; sort_order: number;
  created_at: string; updated_at: string;
}

interface Props {
  entries: Entry[];
  lists:   List[];
  rules:   Rule[];
}

type Tab = "calendar" | "rules";

export default function CalendarPageTabs({ entries, lists, rules }: Props) {
  const [tab, setTab] = useState<Tab>("calendar");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {([
          { id: "calendar", label: "📅 Campaign Calendar" },
          { id: "rules",    label: "🎨 Design Rules"      },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className="text-xs px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              background: tab === id ? "linear-gradient(135deg,#6366f1,#818cf8)" : "transparent",
              color:      tab === id ? "white" : "var(--text-muted)",
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "calendar" && (
        <ContentCalendarManager initialEntries={entries} lists={lists} />
      )}
      {tab === "rules" && (
        <DesignRulesManager initialRules={rules} />
      )}
    </div>
  );
}
