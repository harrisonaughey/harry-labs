"use client";
import { useState, useEffect } from "react";

type PlatformStatus =
  | "live" | "tested_paused" | "hold" | "revision"
  | "killed" | "not_tested" | "pending_submission" | "ready";

type Creative = {
  id: string;
  creator: string;
  brief: string;
  version: string | null;
  hook_concept: string;
  hook_type: string | null;
  audit_score: number | null;
  audit_decision: string | null;
  meta_status: PlatformStatus;
  tiktok_status: PlatformStatus;
  hold_reason: string | null;
  notes: string | null;
};

const STATUS_CONFIG: Record<PlatformStatus, { label: string; dot: string; bg: string; text: string }> = {
  live:               { label: "Live",       dot: "#22c55e", bg: "#dcfce7", text: "#15803d" },
  tested_paused:      { label: "Tested",     dot: "#94a3b8", bg: "#f1f5f9", text: "#475569" },
  hold:               { label: "Hold",       dot: "#f59e0b", bg: "#fef9c3", text: "#92400e" },
  revision:           { label: "Revision",   dot: "#f97316", bg: "#ffedd5", text: "#9a3412" },
  killed:             { label: "Killed",     dot: "#ef4444", bg: "#fee2e2", text: "#b91c1c" },
  ready:              { label: "Ready",      dot: "#3b82f6", bg: "#dbeafe", text: "#1d4ed8" },
  not_tested:         { label: "—",          dot: "#4b5563", bg: "transparent", text: "#9ca3af" },
  pending_submission: { label: "Pending",    dot: "#a78bfa", bg: "#ede9fe", text: "#6d28d9" },
};

const CREATOR_COLORS: Record<string, string> = {
  Nick:         "#6366f1",
  Jenne:        "#ec4899",
  Melissa:      "#14b8a6",
  UGC:          "#8b5cf6",
  "Hannah Dyson": "#8b5cf6",
  Other:        "#8b5cf6",
};

function ScoreBadge({ score, decision }: { score: number | null; decision: string | null }) {
  if (score === null) return <span style={{ color: "var(--text-faint)", fontSize: 12 }}>—</span>;
  const color = score >= 75 ? "#15803d" : score >= 60 ? "#92400e" : "#b91c1c";
  const bg    = score >= 75 ? "#dcfce7" : score >= 60 ? "#fef9c3" : "#fee2e2";
  return (
    <span title={decision ?? undefined} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
      background: bg, color,
    }}>
      {score}
    </span>
  );
}

function StatusPill({ status, holdReason }: { status: PlatformStatus; holdReason?: string | null }) {
  const cfg = STATUS_CONFIG[status];
  if (status === "not_tested") {
    return <span style={{ color: "var(--text-faint)", fontSize: 13 }}>—</span>;
  }
  return (
    <span title={holdReason ?? undefined} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: cfg.bg, color: cfg.text, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0, display: "inline-block" }} />
      {cfg.label}
    </span>
  );
}

function CreatorSection({ creator, rows }: { creator: string; rows: Creative[] }) {
  const color = CREATOR_COLORS[creator] ?? "#8b5cf6";
  const liveCount  = rows.filter(r => r.meta_status === "live" || r.tiktok_status === "live").length;
  const readyCount = rows.filter(r => r.meta_status === "ready" || r.tiktok_status === "ready").length;
  const holdCount  = rows.filter(r => r.meta_status === "hold" || r.tiktok_status === "hold" || r.meta_status === "revision").length;

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      {/* creator header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 20px",
        background: "var(--bg-subtle, #f9fafb)",
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, background: color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0,
        }}>
          {creator[0]}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{creator}</span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
          {rows.length} brief{rows.length !== 1 ? "s" : ""}
          {liveCount  > 0 && <> · <span style={{ color: "#22c55e" }}>{liveCount} live</span></>}
          {readyCount > 0 && <> · <span style={{ color: "#3b82f6" }}>{readyCount} ready</span></>}
          {holdCount  > 0 && <> · <span style={{ color: "#f59e0b" }}>{holdCount} on hold</span></>}
        </span>
      </div>

      {/* rows */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <colgroup>
          <col style={{ width: 70 }} />
          <col />
          <col style={{ width: 56 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 100 }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Brief", "Concept / Notes", "Score", "Meta", "TikTok"].map((h, i) => (
              <th key={h} style={{
                padding: i === 0 ? "7px 12px 7px 20px" : "7px 12px",
                textAlign: i >= 3 ? "center" : "left",
                fontSize: 10, fontWeight: 600, color: "var(--text-faint)",
                textTransform: "uppercase", letterSpacing: "0.05em",
                background: "var(--bg-subtle, #f9fafb)",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, idx) => (
            <tr key={c.id} style={{
              borderBottom: idx < rows.length - 1 ? "1px solid var(--border-faint, #f0f0f0)" : "none",
            }}>
              <td style={{ padding: "9px 12px 9px 20px", verticalAlign: "middle" }}>
                <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 12, lineHeight: 1.2 }}>
                  {c.brief}
                </div>
                {c.version && (
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 1 }}>{c.version}</div>
                )}
              </td>
              <td style={{ padding: "9px 12px", verticalAlign: "middle" }}>
                <div style={{ color: "var(--text-primary)", fontSize: 12, lineHeight: 1.3 }}>
                  {c.hook_concept !== "—" ? c.hook_concept : ""}
                </div>
                {c.hold_reason && (
                  <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2, lineHeight: 1.4 }}>
                    ⚠ {c.hold_reason}
                  </div>
                )}
                {!c.hold_reason && c.notes && (
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{c.notes}</div>
                )}
              </td>
              <td style={{ padding: "9px 12px", verticalAlign: "middle", textAlign: "center" }}>
                <ScoreBadge score={c.audit_score} decision={c.audit_decision} />
              </td>
              <td style={{ padding: "9px 12px", verticalAlign: "middle", textAlign: "center" }}>
                <StatusPill status={c.meta_status} holdReason={c.hold_reason} />
              </td>
              <td style={{ padding: "9px 12px", verticalAlign: "middle", textAlign: "center" }}>
                <StatusPill status={c.tiktok_status} holdReason={c.hold_reason} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CreativeMapPanel() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [updated, setUpdated]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch("/api/meta/creative-tracking")
      .then(r => r.json())
      .then(d => { setCreatives(d.creatives ?? []); setUpdated(d.updated); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const live    = creatives.filter(c => c.meta_status === "live" || c.tiktok_status === "live");
  const ready   = creatives.filter(c => c.meta_status === "ready" || c.tiktok_status === "ready");
  const hold    = creatives.filter(c => c.meta_status === "hold" || c.tiktok_status === "hold" || c.meta_status === "revision");
  const untested = creatives.filter(c =>
    (c.meta_status === "not_tested" || c.meta_status === "pending_submission") &&
    (c.tiktok_status === "not_tested" || c.tiktok_status === "pending_submission")
  );

  const CREATOR_ORDER = ["Nick", "Jenne", "Melissa", "UGC", "Hannah Dyson", "Other"];
  const grouped = CREATOR_ORDER
    .map(creator => ({ creator, rows: creatives.filter(c => c.creator === creator) }))
    .filter(g => g.rows.length > 0);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--text-faint)" }}>Loading creative map…</div>;
  }

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Creatives", value: creatives.length, color: "#a5b4fc" },
          { label: "Live / Tested",   value: live.length + creatives.filter(c => c.meta_status === "tested_paused").length, color: "#22c55e" },
          { label: "Ready to Upload", value: ready.length, color: "#3b82f6" },
          { label: "On Hold",         value: hold.length, color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} style={{
            borderRadius: 12, padding: "12px 16px",
            background: "var(--bg-card)", border: "1px solid var(--border)",
          }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, marginTop: 3, color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 16,
        padding: "8px 12px", borderRadius: 8,
        background: "var(--bg-card)", border: "1px solid var(--border)",
      }}>
        {(Object.entries(STATUS_CONFIG) as [PlatformStatus, typeof STATUS_CONFIG[PlatformStatus]][])
          .filter(([k]) => k !== "not_tested")
          .map(([, cfg]) => (
            <span key={cfg.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--text-muted)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
              {cfg.label}
            </span>
          ))}
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--text-muted)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid #6b7280", display: "inline-block" }} />
          Not tested
        </span>
        {updated && (
          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-faint)" }}>Updated {updated}</span>
        )}
      </div>

      {/* Untested callout */}
      {untested.length > 0 && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 8,
          background: "#fef9c320", border: "1px solid #f59e0b40",
          fontSize: 12, color: "#92400e",
        }}>
          <strong>{untested.length} creative{untested.length !== 1 ? "s" : ""} not yet tested on any platform</strong>
          {" "}— {untested.map(c => `${c.creator} ${c.brief}`).join(" · ")}
        </div>
      )}

      {/* Creator tables */}
      <div style={{ borderRadius: 12, overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {grouped.map(({ creator, rows }) => (
          <CreatorSection key={creator} creator={creator} rows={rows} />
        ))}
      </div>
    </div>
  );
}
