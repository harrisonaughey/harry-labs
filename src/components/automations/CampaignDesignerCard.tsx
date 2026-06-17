"use client";

import { useState } from "react";

interface CalendarEntry {
  id: string;
  name: string;
  send_at: string | null;
  status: string;
  klaviyo_campaign_id: string | null;
  klaviyo_template_id: string | null;
}

interface AgentAction {
  id: string;
  agent_name: string;
  status: string;
  created_at: string;
}

interface Props {
  calendarEntries: CalendarEntry[];
  lastRun: string | null;
  recentActions: AgentAction[];
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  done:       { label: "Done",       bg: "#10b98115", color: "#10b981", dot: "#10b981" },
  generating: { label: "Generating", bg: "#f59e0b15", color: "#fbbf24", dot: "#f59e0b" },
  planned:    { label: "Planned",    bg: "#6366f115", color: "#a5b4fc", dot: "#6366f1" },
  error:      { label: "Error",      bg: "#ef444415", color: "#ef4444", dot: "#ef4444" },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] ?? { label: status, bg: "#6b728015", color: "#9ca3af", dot: "#9ca3af" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

export default function CampaignDesignerCard({ calendarEntries, lastRun, recentActions }: Props) {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ processed: number; errors: number; message?: string } | null>(null);
  const [runError, setRunError] = useState("");

  async function handleRunNow() {
    setRunning(true);
    setRunResult(null);
    setRunError("");
    try {
      const res = await fetch("/api/agent/campaign-designer", { method: "POST", body: JSON.stringify({}), headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent run failed");
      setRunResult({ processed: data.processed ?? 0, errors: data.errors ?? 0, message: data.message });
    } catch (e: any) {
      setRunError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const successfulRuns = recentActions.filter((a) => a.status === "success").length;
  const failedRuns     = recentActions.filter((a) => a.status === "error").length;
  const queueCount     = calendarEntries.filter((e) => !e.klaviyo_campaign_id && e.status !== "error").length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid #6366f140" }}>
      {/* ── Header ── */}
      <div className="px-6 py-5 flex items-start justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)", boxShadow: "0 0 20px #6366f140" }}>
            ✦
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Klaviyo Agent: Campaign Designer
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "#10b98115", color: "#10b981", border: "1px solid #10b98130" }}>
                ● Active
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Runs daily at 8:00 AM UTC · Scans content_calendar for entries due within 7 days
            </p>
          </div>
        </div>

        {/* Run Now button */}
        <button
          onClick={handleRunNow}
          disabled={running}
          className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50"
          style={{ background: "#6366f1", color: "white" }}>
          {running ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running…
            </>
          ) : (
            <>▶ Run Now</>
          )}
        </button>
      </div>

      {/* ── Run result toast ── */}
      {runResult && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg text-xs flex items-center justify-between"
          style={{ background: "#10b98115", border: "1px solid #10b98130", color: "#10b981" }}>
          <span>
            ✓ Agent completed — {runResult.message ?? `${runResult.processed} campaign${runResult.processed !== 1 ? "s" : ""} designed${runResult.errors > 0 ? `, ${runResult.errors} error${runResult.errors !== 1 ? "s" : ""}` : ""}`}
          </span>
          <button onClick={() => setRunResult(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      {runError && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg text-xs flex items-center justify-between"
          style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#ef4444" }}>
          <span>⚠ {runError}</span>
          <button onClick={() => setRunError("")} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="p-6 grid grid-cols-3 gap-6">
        {/* ── Stats ── */}
        <div className="col-span-1 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Agent Stats</p>

          <div className="space-y-2">
            {[
              { label: "Last run", value: lastRun ?? "Never" },
              { label: "Schedule",  value: "Daily · 08:00 UTC" },
              { label: "Look-ahead", value: "7 days" },
              { label: "Recent runs", value: `${successfulRuns} success · ${failedRuns} error` },
              { label: "Queue",       value: `${queueCount} entry${queueCount !== 1 ? "ies" : "y"} pending` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>{label}</span>
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-faint)" }}>How it works</p>
            <ol className="space-y-1.5">
              {[
                "Reads content_calendar entries due ≤ 7 days",
                "Generates on-brand HTML via Claude",
                "Creates Klaviyo template (POST /templates/)",
                "Creates Klaviyo campaign draft (POST /campaigns/)",
                "Writes both IDs back to content_calendar",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-faint)" }}>
                  <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold mt-0.5"
                    style={{ background: "#6366f120", color: "#a5b4fc" }}>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* ── Content Calendar queue ── */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Upcoming Content Calendar
            </p>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--border)", color: "var(--text-muted)" }}>
              next 14 days
            </span>
          </div>

          {calendarEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 rounded-xl text-center"
              style={{ background: "var(--bg-card-inner)", border: "1px dashed var(--border)" }}>
              <p className="text-sm mb-1" style={{ color: "var(--text-faint)" }}>No upcoming entries</p>
              <p className="text-xs" style={{ color: "var(--text-faint)", opacity: 0.6 }}>
                Add rows to content_calendar to queue campaigns for the agent
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "var(--text-faint)", background: "var(--bg-card-inner)" }}>
                    {["Campaign", "Send date", "Status", "Klaviyo IDs"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-white/[0.02]"
                      style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <td className="px-3 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>
                        {e.name}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                        {e.send_at
                          ? new Date(e.send_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={e.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        {e.klaviyo_campaign_id ? (
                          <div className="space-y-0.5">
                            <div className="font-mono opacity-70" style={{ color: "var(--text-faint)", fontSize: "10px" }}>
                              C: {e.klaviyo_campaign_id}
                            </div>
                            {e.klaviyo_template_id && (
                              <div className="font-mono opacity-70" style={{ color: "var(--text-faint)", fontSize: "10px" }}>
                                T: {e.klaviyo_template_id}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-faint)", opacity: 0.5 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent agent run log */}
          {recentActions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
                Recent Agent Runs
              </p>
              <div className="space-y-1">
                {recentActions.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: a.status === "success" ? "#10b981" : "#ef4444" }}>
                        {a.status === "success" ? "✓" : "⚠"}
                      </span>
                      <span style={{ color: "var(--text-secondary)" }}>campaign-designer</span>
                    </div>
                    <span style={{ color: "var(--text-faint)" }}>
                      {new Date(a.created_at).toLocaleString("en-AU", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
