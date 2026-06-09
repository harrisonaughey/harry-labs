"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Entry {
  id: string;
  name: string;
  brief: string | null;
  send_at: string | null;
  list_id: string | null;
  destination_url: string | null;
  template_type: string | null;
  klaviyo_campaign_id: string | null;
  klaviyo_template_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Email template options shown in the entry modal
const TEMPLATE_OPTIONS = [
  { value: "",          label: "✦ Auto  (agent decides from brief)",    hint: ""                                    },
  { value: "urgency",   label: "⚡ Urgency  — countdown, flash sale",   hint: "Best RPR · $0.376 · single CTA"     },
  { value: "hero-cta",  label: "🎯 Hero + CTA  — launch, announce",     hint: "Strong content · $0.216 · 5% CTOR"  },
  { value: "split",     label: "↔ Split  — image + text side-by-side",  hint: "Multi-product promos · $0.141"       },
  { value: "grid",      label: "⊞ Grid  — hero + 2 products",           hint: "Bundle / product range · $0.109"    },
  { value: "minimal",   label: "✦ Minimal  — text-first, clean",         hint: "Re-engagement / cart recovery"      },
] as const;

interface List { id: string; attributes: { name: string } }

type Filter = "all" | "planned" | "generating" | "done" | "error";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  planned:    { label: "Planned",    bg: "#6366f115", color: "#a5b4fc", dot: "#6366f1" },
  generating: { label: "Generating", bg: "#f59e0b15", color: "#fbbf24", dot: "#f59e0b" },
  done:       { label: "Done",       bg: "#10b98115", color: "#10b981", dot: "#10b981" },
  error:      { label: "Error",      bg: "#ef444415", color: "#ef4444", dot: "#ef4444" },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS[status] ?? { label: status, bg: "#6b728015", color: "#9ca3af", dot: "#9ca3af" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeInput(iso: string | null): string {
  if (!iso) return "09:00";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Build step messages ──────────────────────────────────────────────────────

const BUILD_STEPS = [
  "Analysing brief and selecting email type…",
  "Fetching images from Klaviyo library…",
  "Claude is generating email copy and HTML…",
  "Populating template with content and images…",
  "Creating Klaviyo template…",
  "Creating campaign draft in Klaviyo…",
  "Linking template to campaign…",
];

// ─── Entry modal ──────────────────────────────────────────────────────────────

interface BuildResult {
  entryId: string;
  campaignId: string;
  templateId?: string;
  emailType: string;
  subject: string;
  previewText: string;
  imagesUsed?: string;
}

interface ModalProps {
  entry: Entry | null;           // null = create mode
  lists: List[];
  onClose: () => void;
  onSave:  (entry: Entry) => void;
  onBuildComplete?: () => void;  // triggers a full entries refresh in the parent
}

function EntryModal({ entry, lists, onClose, onSave, onBuildComplete }: ModalProps) {
  const isEdit = !!entry;
  const alreadyBuilt = isEdit && !!entry!.klaviyo_campaign_id;

  const [name,           setName]           = useState(entry?.name            ?? "");
  const [brief,          setBrief]          = useState(entry?.brief           ?? "");
  const [sendDate,       setSendDate]       = useState(toDateInput(entry?.send_at ?? null));
  const [sendTime,       setSendTime]       = useState(toTimeInput(entry?.send_at ?? null));
  const [listId,         setListId]         = useState(entry?.list_id         ?? lists[0]?.id ?? "");
  const [destinationUrl, setDestinationUrl] = useState(entry?.destination_url ?? "");
  const [templateType,   setTemplateType]   = useState(entry?.template_type   ?? "");
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");

  // Build-now state machine
  const [buildPhase,   setBuildPhase]   = useState<"idle" | "building" | "done" | "error">("idle");
  const [buildStepIdx, setBuildStepIdx] = useState(0);
  const [buildResult,  setBuildResult]  = useState<BuildResult | null>(null);
  const [buildError,   setBuildError]   = useState("");

  const nameRef  = useRef<HTMLInputElement>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  // Cycle build step messages while building
  useEffect(() => {
    if (buildPhase === "building") {
      setBuildStepIdx(0);
      stepTimer.current = setInterval(() => {
        setBuildStepIdx((i) => (i + 1) % BUILD_STEPS.length);
      }, 3500);
    } else {
      if (stepTimer.current) { clearInterval(stepTimer.current); stepTimer.current = null; }
    }
    return () => { if (stepTimer.current) clearInterval(stepTimer.current); };
  }, [buildPhase]);

  async function handleSave() {
    if (!name.trim()) { setError("Campaign name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const url    = isEdit ? `/api/content-calendar/${entry!.id}` : "/api/content-calendar";
      const method = isEdit ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, brief, sendDate, sendTime, listId, destinationUrl, templateType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSave(data.entry);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleBuild() {
    if (!name.trim()) { setError("Campaign name is required"); return; }
    setError("");
    setBuildPhase("building");
    setBuildResult(null);
    setBuildError("");

    try {
      const res  = await fetch("/api/agent/build-campaign-entry", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId:        isEdit ? entry!.id : undefined,
          name,
          brief,
          templateType:   templateType || undefined,
          listId:         listId       || undefined,
          sendDate:       sendDate     || undefined,
          sendTime:       sendTime     || undefined,
          destinationUrl: destinationUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Build failed");
      setBuildResult(data as BuildResult);
      setBuildPhase("done");
    } catch (e: unknown) {
      setBuildError(e instanceof Error ? e.message : String(e));
      setBuildPhase("error");
    }
  }

  function handleCloseDone() {
    onBuildComplete?.();   // parent refreshes the entries list
    onClose();
  }

  const isBuilding = buildPhase === "building";
  const isDone     = buildPhase === "done";
  const isError    = buildPhase === "error";

  const selectedTplLabel =
    TEMPLATE_OPTIONS.find((o) => o.value === (buildResult?.emailType ?? templateType))?.label ?? buildResult?.emailType ?? "Auto";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (!isBuilding && e.target === e.currentTarget) onClose(); }}>
      <div className="w-full rounded-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: 540, maxHeight: "90vh", background: "var(--bg-card)", border: "1px solid #2a2a3a", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #1e1e30" }}>
          <div className="flex items-center gap-2.5">
            <span>{isDone ? "✅" : isBuilding ? "⚙️" : "📅"}</span>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {isDone     ? "Campaign Ready in Klaviyo"
               : isBuilding ? "Building Campaign…"
               : isEdit   ? "Edit Campaign Entry"
               :             "New Campaign Entry"}
            </h2>
          </div>
          {!isBuilding && (
            <button onClick={isDone ? handleCloseDone : onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-sm hover:bg-white/10 transition-colors"
              style={{ color: "var(--text-muted)" }}>✕</button>
          )}
        </div>

        {/* ── Building state ─────────────────────────────────────── */}
        {isBuilding && (
          <div className="flex flex-col items-center justify-center py-14 px-8 gap-6 flex-1 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "#6366f115", border: "1px solid #6366f130" }}>
              <span className="w-7 h-7 border-[3px] border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin block" />
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Building &ldquo;{name}&rdquo;
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Claude is generating your full email — this takes ~30 seconds
              </p>
            </div>
            <div className="w-full rounded-xl px-4 py-3 text-left transition-all"
              style={{ background: "#6366f10a", border: "1px solid #6366f125" }}>
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                  style={{ background: "#818cf8" }} />
                <span className="text-xs" style={{ color: "#a5b4fc" }}>
                  {BUILD_STEPS[buildStepIdx]}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Done state ─────────────────────────────────────────── */}
        {isDone && buildResult && (
          <div className="px-6 py-5 flex-1 overflow-y-auto space-y-4">
            {/* Success banner */}
            <div className="rounded-xl p-4 text-center"
              style={{ background: "#10b98110", border: "1px solid #10b98130" }}>
              <p className="text-2xl mb-1">✓</p>
              <p className="text-sm font-semibold" style={{ color: "#10b981" }}>
                Campaign built and ready in Klaviyo
              </p>
              <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>{name}</p>
            </div>

            {/* Details grid */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a" }}>
              {[
                ["Template type",  selectedTplLabel.split("  ")[0]],
                ["Subject line",   buildResult.subject],
                ["Preview text",   buildResult.previewText || "—"],
                ...(buildResult.imagesUsed ? [["Images used", buildResult.imagesUsed]] : []),
              ].map(([label, value], i) => (
                <div key={i}
                  className="flex items-start justify-between gap-3 px-4 py-3 text-xs"
                  style={{ borderTop: i > 0 ? "1px solid #2a2a3a" : "none" }}>
                  <span className="flex-shrink-0 font-medium" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </span>
                  <span className="text-right truncate max-w-64" style={{ color: "var(--text-primary)" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Klaviyo IDs */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a" }}>
              {[
                ["Campaign ID",  buildResult.campaignId],
                ...(buildResult.templateId ? [["Template ID", buildResult.templateId]] : []),
              ].map(([label, value], i) => (
                <div key={i}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                  style={{ borderTop: i > 0 ? "1px solid #2a2a3a" : "none" }}>
                  <span className="font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span className="font-mono" style={{ color: "#a5b4fc" }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Klaviyo link */}
            <a href="https://www.klaviyo.com/omnicampaigns" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ background: "#6366f120", color: "#a5b4fc", border: "1px solid #6366f130" }}>
              🔗 View campaigns in Klaviyo
            </a>
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────── */}
        {isError && (
          <div className="px-6 py-8 flex-1 flex flex-col items-center gap-5 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: "#ef444415", border: "1px solid #ef444430" }}>⚠</div>
            <div>
              <p className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Build failed</p>
              <p className="text-xs rounded-lg px-3 py-2" style={{ background: "#ef444410", color: "#ef4444", border: "1px solid #ef444430" }}>
                {buildError}
              </p>
            </div>
          </div>
        )}

        {/* ── Form body (shown in idle / error states) ───────────── */}
        {(buildPhase === "idle" || buildPhase === "error") && (
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">

            {/* Klaviyo IDs (read-only when editing + already built) */}
            {alreadyBuilt && (
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "#10b98108", border: "1px solid #10b98130" }}>
                <p className="text-xs font-medium mb-2" style={{ color: "#10b981" }}>✓ Already built in Klaviyo</p>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--text-muted)" }}>Campaign</span>
                  <span className="font-mono" style={{ color: "#a5b4fc" }}>{entry!.klaviyo_campaign_id}</span>
                </div>
                {entry!.klaviyo_template_id && (
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-muted)" }}>Template</span>
                    <span className="font-mono" style={{ color: "#a5b4fc" }}>{entry!.klaviyo_template_id}</span>
                  </div>
                )}
                <p className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>
                  To rebuild with new content, use the ↺ re-queue button in the table first.
                </p>
              </div>
            )}

            <Field label="Campaign Name" required>
              <input ref={nameRef} type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. June EOFY Sale"
                style={inp} />
            </Field>

            <Field label="Brief / Content Notes" hint="AI builds your full email from this">
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)}
                rows={3} placeholder="Describe the campaign — offer, tone, urgency, key messages, product focus…"
                style={{ ...inp, resize: "none", lineHeight: "1.5" }} />
            </Field>

            <Field label="Email Template" hint="AI auto-selects from brief if left on Auto">
              <select value={templateType} onChange={(e) => setTemplateType(e.target.value)} style={inp}>
                {TEMPLATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {templateType && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                  {TEMPLATE_OPTIONS.find((o) => o.value === templateType)?.hint}
                </p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Send Date">
                <input type="date" value={sendDate} onChange={(e) => setSendDate(e.target.value)} style={inp} />
              </Field>
              <Field label="Send Time (UTC)">
                <input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} style={inp} />
              </Field>
            </div>

            <Field label="Send To List">
              {lists.length === 0 ? (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#6b728015", color: "#9ca3af" }}>
                  No lists — sync Klaviyo first
                </p>
              ) : (
                <select value={listId} onChange={(e) => setListId(e.target.value)} style={inp}>
                  <option value="">— no list selected —</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.attributes.name}</option>)}
                </select>
              )}
            </Field>

            <Field label="CTA Destination URL">
              <input type="url" value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://thinkle.com.au/sale"
                style={inp} />
            </Field>

            {(error || buildPhase === "error") && (
              <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#ef4444" }}>
                ⚠ {error || buildError}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────── */}
        {isDone ? (
          <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #1e1e30" }}>
            <button onClick={handleCloseDone}
              className="w-full py-2.5 text-sm rounded-lg font-medium hover:opacity-80 transition-opacity"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "white" }}>
              ✓ Done — close
            </button>
          </div>
        ) : !isBuilding && (
          <div className="px-6 py-4 flex gap-2.5 flex-shrink-0" style={{ borderTop: "1px solid #1e1e30" }}>
            <button onClick={onClose} disabled={saving}
              className="py-2.5 px-4 text-sm rounded-lg disabled:opacity-40"
              style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              Cancel
            </button>

            {/* Save for Later — always available */}
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="py-2.5 px-4 text-sm rounded-lg font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
              style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {saving
                ? <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    Saving…
                  </span>
                : isEdit ? "Save Changes" : "Save for Later"}
            </button>

            {/* Build Now — primary action (hidden when already built) */}
            {!alreadyBuilt && (
              <button onClick={handleBuild} disabled={saving || !name.trim()}
                className="flex-1 py-2.5 text-sm rounded-lg font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "white" }}>
                <span className="flex items-center justify-center gap-2">
                  <span>✦</span>
                  <span>Build Now — Create in Klaviyo</span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main manager component ───────────────────────────────────────────────────

interface Props {
  initialEntries: Entry[];
  lists:          List[];
}

export default function ContentCalendarManager({ initialEntries, lists }: Props) {
  const [entries,     setEntries]     = useState<Entry[]>(initialEntries);
  const [filter,      setFilter]      = useState<Filter>("all");
  const [modalEntry,  setModalEntry]  = useState<Entry | null | "new">(null); // null=closed, "new"=create, Entry=edit
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [deleteTimer, setDeleteTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [agentState,  setAgentState]  = useState<"idle" | "running" | "done" | "error">("idle");
  const [agentResult, setAgentResult] = useState<string>("");
  const [requeueId,   setRequeueId]   = useState<string | null>(null);
  const [syncState,     setSyncState]     = useState<"idle" | "running" | "done" | "error">("idle");
  const [syncResult,    setSyncResult]    = useState<string>("");
  const [reminderState, setReminderState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [reminderResult,setReminderResult]= useState<string>("");

  // ── Stats ──
  const counts = {
    all:        entries.length,
    planned:    entries.filter((e) => e.status === "planned").length,
    generating: entries.filter((e) => e.status === "generating").length,
    done:       entries.filter((e) => e.status === "done").length,
    error:      entries.filter((e) => e.status === "error").length,
  };

  const filtered = filter === "all" ? entries : entries.filter((e) => e.status === filter);

  // ── Agent run ──
  async function runAgent() {
    setAgentState("running");
    setAgentResult("");
    try {
      const res  = await fetch("/api/agent/campaign-designer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent run failed");

      const msg = data.message
        ?? `${data.processed ?? 0} campaign${data.processed !== 1 ? "s" : ""} designed${data.errors > 0 ? `, ${data.errors} error${data.errors !== 1 ? "s" : ""}` : ""}`;
      setAgentResult(msg);
      setAgentState("done");

      // Refresh entries from server
      const r2 = await fetch("/api/content-calendar");
      const d2 = await r2.json();
      if (d2.entries) setEntries(d2.entries);
    } catch (e: any) {
      setAgentResult(e.message);
      setAgentState("error");
    }
  }

  // ── Notion sync ──
  async function syncNotion() {
    setSyncState("running");
    setSyncResult("");
    try {
      const res  = await fetch("/api/sync/notion", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      setSyncResult(data.message ?? `${data.inserted ?? 0} imported`);
      setSyncState("done");

      // Refresh entries list if anything was added
      if ((data.inserted ?? 0) > 0) {
        const r2 = await fetch("/api/content-calendar");
        const d2 = await r2.json();
        if (d2.entries) setEntries(d2.entries);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncResult(msg);
      setSyncState("error");
    }
  }

  // ── Test Slack reminder ──
  async function testReminder() {
    setReminderState("running");
    setReminderResult("");
    try {
      const res  = await fetch("/api/cron/campaign-reminders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reminder failed");
      setReminderResult(data.message ?? (data.sent > 0 ? `Slack DM sent for ${data.sent} campaign${data.sent !== 1 ? "s" : ""}` : "No campaigns in 10 days"));
      setReminderState("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setReminderResult(msg);
      setReminderState("error");
    }
  }

  // ── CRUD helpers ──
  function handleSave(saved: Entry) {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = saved; return next;
      }
      return [saved, ...prev].sort((a, b) =>
        (a.send_at ?? "9999") > (b.send_at ?? "9999") ? 1 : -1
      );
    });
    setModalEntry(null);
  }

  async function handleBuildComplete() {
    // Refresh entries list to pick up new status + Klaviyo IDs after a "Build Now"
    try {
      const r = await fetch("/api/content-calendar");
      const d = await r.json();
      if (d.entries) {
        setEntries(d.entries);
      }
    } catch { /* silent */ }
    setModalEntry(null);
  }

  function confirmDelete(id: string) {
    if (deleteId === id) {
      // Second click — actually delete
      if (deleteTimer) clearTimeout(deleteTimer);
      setDeleteId(null);
      performDelete(id);
    } else {
      setDeleteId(id);
      const t = setTimeout(() => setDeleteId(null), 3000);
      setDeleteTimer(t);
    }
  }

  async function performDelete(id: string) {
    await fetch(`/api/content-calendar/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function requeue(id: string) {
    setRequeueId(id);
    try {
      const res  = await fetch(`/api/content-calendar/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ requeue: true }),
      });
      const data = await res.json();
      if (data.entry) handleSave(data.entry);
    } finally {
      setRequeueId(null);
    }
  }

  const listName = (id: string | null) =>
    id ? (lists.find((l) => l.id === id)?.attributes.name ?? id) : "—";

  return (
    <>
      {/* ── Top action bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        {/* Stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "planned", "done", "error"] as Filter[]).map((f) => {
            const cfg = f === "all"
              ? { bg: "var(--bg-card)", color: "var(--text-secondary)", border: "var(--border)" }
              : f === "planned"   ? { bg: "#6366f110", color: "#a5b4fc", border: "#6366f130" }
              : f === "done"      ? { bg: "#10b98110", color: "#10b981", border: "#10b98130" }
              :                     { bg: "#ef444410", color: "#ef4444", border: "#ef444430" };
            const active = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)}
                className="text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-all"
                style={{
                  background: active ? cfg.bg : "transparent",
                  color:      active ? cfg.color : "var(--text-faint)",
                  border:     `1px solid ${active ? cfg.border : "transparent"}`,
                }}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1.5 opacity-70">
                  {counts[f as keyof typeof counts]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Notion sync result */}
          {syncState === "done" && (
            <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: "#6366f115", color: "#a5b4fc", border: "1px solid #6366f130" }}>
              ✦ {syncResult}
              <button onClick={() => setSyncState("idle")} className="opacity-60 hover:opacity-100 ml-1">✕</button>
            </span>
          )}
          {syncState === "error" && (
            <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
              ⚠ {syncResult}
              <button onClick={() => setSyncState("idle")} className="opacity-60 hover:opacity-100 ml-1">✕</button>
            </span>
          )}

          {/* Agent run result */}
          {agentState === "done" && (
            <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: "#10b98115", color: "#10b981", border: "1px solid #10b98130" }}>
              ✓ {agentResult}
              <button onClick={() => setAgentState("idle")} className="opacity-60 hover:opacity-100 ml-1">✕</button>
            </span>
          )}
          {agentState === "error" && (
            <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
              ⚠ {agentResult}
              <button onClick={() => setAgentState("idle")} className="opacity-60 hover:opacity-100 ml-1">✕</button>
            </span>
          )}

          {/* Reminder result */}
          {reminderState === "done" && (
            <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: "#10b98115", color: "#10b981", border: "1px solid #10b98130" }}>
              💬 {reminderResult}
              <button onClick={() => setReminderState("idle")} className="opacity-60 hover:opacity-100 ml-1">✕</button>
            </span>
          )}
          {reminderState === "error" && (
            <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
              ⚠ {reminderResult}
              <button onClick={() => setReminderState("idle")} className="opacity-60 hover:opacity-100 ml-1">✕</button>
            </span>
          )}

          {/* Test Slack Reminder */}
          <button
            onClick={testReminder}
            disabled={reminderState === "running"}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{ background: "var(--bg-card)", color: "#34d399", border: "1px solid #10b98130" }}
            title="Send a Slack DM for any campaigns exactly 10 days away (tests the daily reminder cron)"
          >
            {reminderState === "running"
              ? <><span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Sending…</>
              : <>💬 Test Reminder</>}
          </button>

          {/* Sync Notion */}
          <button
            onClick={syncNotion}
            disabled={syncState === "running" || agentState === "running"}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{ background: "var(--bg-card)", color: "#a5b4fc", border: "1px solid #6366f130" }}
            title="Pull upcoming campaigns from your Notion Year Campaign Calendar"
          >
            {syncState === "running"
              ? <><span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Syncing…</>
              : <>✦ Sync Notion</>}
          </button>

          {/* Run Agent */}
          <button onClick={runAgent} disabled={agentState === "running" || syncState === "running"}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            {agentState === "running"
              ? <><span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Running…</>
              : <>▶ Run Agent</>}
          </button>

          <button onClick={() => setModalEntry("new")}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
            style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "white" }}>
            + New Entry
          </button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: "#6366f115", border: "1px solid #6366f130" }}>📅</div>
            <div className="text-center">
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                {filter === "all" ? "No campaigns scheduled yet" : `No ${filter} entries`}
              </p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                {filter === "all"
                  ? "Add entries to queue them for the Campaign Designer agent"
                  : `Switch to "All" to see all entries`}
              </p>
            </div>
            {filter === "all" && (
              <button onClick={() => setModalEntry("new")}
                className="text-xs px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
                style={{ background: "#6366f120", color: "#a5b4fc", border: "1px solid #6366f130" }}>
                + Add your first entry
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border)" }}>
                {["Campaign", "Send Date", "List", "Brief", "Status", "Klaviyo", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id}
                  className="hover:bg-white/[0.015] transition-colors group"
                  style={{ borderTop: "1px solid var(--border-subtle)" }}>

                  {/* Name */}
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{entry.name}</p>
                    {entry.template_type && (
                      <span className="inline-block text-xs px-1.5 py-0.5 rounded mt-0.5"
                        style={{ background: "#6366f115", color: "#a5b4fc", fontSize: "10px" }}>
                        {TEMPLATE_OPTIONS.find((o) => o.value === entry.template_type)?.label.split("  ")[0] ?? entry.template_type}
                      </span>
                    )}
                    {entry.destination_url && (
                      <a href={entry.destination_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs truncate hover:underline block mt-0.5"
                        style={{ color: "var(--text-faint)" }}>
                        {entry.destination_url.replace(/^https?:\/\//, "").slice(0, 30)}
                      </a>
                    )}
                  </td>

                  {/* Send date */}
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {fmtDate(entry.send_at)}
                  </td>

                  {/* List */}
                  <td className="px-4 py-3 max-w-[120px]">
                    <span className="truncate block" style={{ color: "var(--text-muted)" }}>
                      {listName(entry.list_id)}
                    </span>
                  </td>

                  {/* Brief */}
                  <td className="px-4 py-3 max-w-[200px]">
                    {entry.brief
                      ? <span className="line-clamp-2" style={{ color: "var(--text-faint)" }}>{entry.brief}</span>
                      : <span style={{ color: "var(--text-faint)", opacity: 0.4 }}>—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <StatusPill status={entry.status} />
                      {entry.status === "error" && entry.error_message && (
                        <p className="text-xs max-w-[140px] truncate" style={{ color: "#ef4444" }}
                          title={entry.error_message}>
                          {entry.error_message}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Klaviyo IDs */}
                  <td className="px-4 py-3">
                    {entry.klaviyo_campaign_id ? (
                      <div className="space-y-0.5">
                        <a href="https://www.klaviyo.com/omnicampaigns"
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:underline"
                          style={{ color: "#a5b4fc" }}>
                          <span style={{ opacity: 0.6 }}>C:</span>
                          <span className="font-mono">{entry.klaviyo_campaign_id.slice(0, 8)}…</span>
                        </a>
                        {entry.klaviyo_template_id && (
                          <div className="flex items-center gap-1" style={{ color: "var(--text-faint)" }}>
                            <span style={{ opacity: 0.6 }}>T:</span>
                            <span className="font-mono">{entry.klaviyo_template_id.slice(0, 8)}…</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-faint)", opacity: 0.4 }}>—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Edit */}
                      <button onClick={() => setModalEntry(entry)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-colors hover:bg-white/10"
                        style={{ color: "var(--text-muted)" }}
                        title="Edit">✎</button>

                      {/* Re-queue (only for done/error) */}
                      {(entry.status === "done" || entry.status === "error") && (
                        <button
                          onClick={() => requeue(entry.id)}
                          disabled={requeueId === entry.id}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-colors hover:bg-white/10 disabled:opacity-40"
                          style={{ color: "#a5b4fc" }}
                          title="Re-queue for agent (clears Klaviyo IDs)">
                          {requeueId === entry.id ? "…" : "↺"}
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => confirmDelete(entry.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-colors"
                        style={{ color: deleteId === entry.id ? "#ef4444" : "var(--text-muted)", background: deleteId === entry.id ? "#ef444415" : "transparent" }}
                        title={deleteId === entry.id ? "Click again to confirm delete" : "Delete"}>
                        {deleteId === entry.id ? "✓?" : "✕"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── How it works info card ─────────────────────────────── */}
      <div className="mt-6 rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "#6366f115", border: "1px solid #6366f130", fontSize: 16 }}>✦</div>
          <div className="flex-1">
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
              Campaign Designer — two ways to build
            </p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="rounded-lg p-3" style={{ background: "#6366f108", border: "1px solid #6366f120" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#a5b4fc" }}>✦ Build Now (manual)</p>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  Click + New Entry → fill in brief + template → hit <strong style={{ color: "#a5b4fc" }}>Build Now</strong>.
                  Claude generates the full HTML, creates the Klaviyo template and campaign draft,
                  and links them — all in ~30 seconds. Go to Klaviyo just to review and send.
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#10b98108", border: "1px solid #10b98120" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#34d399" }}>⏰ Auto (daily cron)</p>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  Notion sync runs at 6 AM UTC → agent runs at 8 AM UTC. Any campaign due in 7 days
                  with no Klaviyo ID is auto-built overnight. Template + campaign are created and
                  linked — no manual action needed.
                </p>
              </div>
            </div>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Both paths create a <strong style={{ color: "var(--text-muted)" }}>fully linked</strong> Klaviyo campaign — template content is pre-loaded, just review and hit Send.
            </p>
          </div>
        </div>
      </div>

      {/* ── Modal ──────────────────────────────────────────────── */}
      {modalEntry !== null && (
        <EntryModal
          entry={modalEntry === "new" ? null : modalEntry}
          lists={lists}
          onClose={() => setModalEntry(null)}
          onSave={handleSave}
          onBuildComplete={handleBuildComplete}
        />
      )}
    </>
  );
}

// ── Shared input style ────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", fontSize: "13px", padding: "8px 12px",
  borderRadius: "8px", outline: "none",
  background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: "var(--text-primary)",
};

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}{required && <span className="ml-0.5" style={{ color: "#6366f1" }}>*</span>}
        </label>
        {hint && <span className="text-xs" style={{ color: "var(--text-faint)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
