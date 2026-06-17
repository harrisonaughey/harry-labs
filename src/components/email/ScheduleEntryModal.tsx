"use client";

import { useState, useEffect, useRef } from "react";

type List = { id: string; attributes: { name: string } };

interface Props {
  lists: List[];
  defaultDate?: string; // YYYY-MM-DD — pre-filled when clicking a calendar cell
  onClose: () => void;
  onSuccess?: () => void; // optional — caller can refresh data after success
}

const DEFAULT_FROM_NAME  = "Thinkle";
const DEFAULT_FROM_EMAIL = "hello@thinkle.com.au";

function pad(n: number) { return String(n).padStart(2, "0"); }

/** Format a Date to yyyy-MM-dd */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Format a Date to HH:mm */
function toTimeInput(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse date + time strings → ISO string for the API */
function toIso(date: string, time: string): string | null {
  if (!date) return null;
  const t = time || "09:00";
  return new Date(`${date}T${t}:00`).toISOString();
}

export default function ScheduleEntryModal({ lists, defaultDate, onClose, onSuccess }: Props) {
  const now         = new Date();
  const defaultTime = "09:00";

  const firstListId = lists[0]?.id ?? "";

  const [form, setForm] = useState({
    name:          defaultDate ? `Campaign — ${new Date(defaultDate + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}` : "",
    subject:       "",
    previewText:   "",
    fromName:      DEFAULT_FROM_NAME,
    fromEmail:     DEFAULT_FROM_EMAIL,
    listId:        firstListId,
    sendDate:      defaultDate ?? toDateInput(now),
    sendTime:      defaultTime,
    destinationUrl:"",
    brief:         "",
    smartSending:  true,
    trackingParams:true,
    asDraft:       false,
  });

  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  const [result, setResult]           = useState<{ campaignId: string; templateId?: string } | null>(null);

  // Focus campaign name on open
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const previewLen = form.previewText.length;
  const previewColor = previewLen > 90 ? "#ef4444" : previewLen > 70 ? "#f59e0b" : "#6b7280";

  async function handleSubmit(asDraft = false) {
    setError("");
    setSubmitting(true);
    try {
      const scheduledAt = !asDraft && form.sendDate
        ? toIso(form.sendDate, form.sendTime)
        : null;

      const res = await fetch("/api/schedule-entry", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:           form.name.trim(),
          subject:        form.subject.trim(),
          previewText:    form.previewText.trim() || undefined,
          fromName:       form.fromName.trim()    || DEFAULT_FROM_NAME,
          fromEmail:      form.fromEmail.trim()   || DEFAULT_FROM_EMAIL,
          listId:         form.listId,
          scheduledAt:    scheduledAt             || undefined,
          destinationUrl: form.destinationUrl.trim() || undefined,
          brief:          form.brief.trim()       || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Failed to create campaign");
      setResult({ campaignId: data.campaignId, templateId: data.templateId });
      onSuccess?.();
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (result) {
    const campaignUrl = `https://www.klaviyo.com/omnicampaigns`;
    return (
      <Overlay onClose={onClose}>
        <ModalShell onClose={onClose} title="Campaign Created ✓" width={480}>
          {/* Success banner */}
          <div className="rounded-xl p-5 mb-5" style={{ background: "#10b98112", border: "1px solid #10b98140" }}>
            <div className="flex items-center gap-2 mb-4">
              <span style={{ fontSize: 22 }}>✅</span>
              <span className="font-semibold text-sm" style={{ color: "#10b981" }}>
                {form.sendDate && !form.asDraft ? "Campaign scheduled in Klaviyo!" : "Campaign draft created!"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <IdRow label="Campaign ID" value={result.campaignId} />
              {result.templateId && <IdRow label="Template ID"  value={result.templateId} />}
            </div>
          </div>

          {/* One-step instruction */}
          {result.templateId && (
            <div className="rounded-lg px-4 py-3 mb-5 text-xs flex gap-3"
              style={{ background: "var(--bg-subtle)", border: "1px solid #f59e0b40" }}>
              <span style={{ color: "#f59e0b", fontSize: 15 }}>⚡</span>
              <div style={{ color: "var(--text-secondary)" }}>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>One step remaining:</span>
                {" "}Open your campaign in Klaviyo → <em>Edit Content</em> → <em>Use existing template</em> → select &ldquo;<strong>{form.name}</strong>&rdquo; → Save.
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <a
              href={campaignUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 text-sm font-medium rounded-lg text-center hover:opacity-80 transition-opacity"
              style={{ background: "#6366f1", color: "white" }}>
              Open Klaviyo →
            </a>
            <button
              onClick={() => {
                setResult(null);
                setForm((f) => ({
                  ...f,
                  name: "", subject: "", previewText: "", brief: "", destinationUrl: "", sendDate: toDateInput(now), sendTime: defaultTime,
                }));
              }}
              className="py-2.5 px-5 text-sm rounded-lg"
              style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              + Another
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-5 text-sm rounded-lg"
              style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              Done
            </button>
          </div>
        </ModalShell>
      </Overlay>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────
  const canSubmit = !!form.name.trim() && !!form.subject.trim() && !!form.listId && !submitting;

  return (
    <Overlay onClose={onClose}>
      <ModalShell onClose={onClose} title="Schedule Email Campaign" width={560}>
        <div className="space-y-5">

          {/* ── CAMPAIGN SETUP ── */}
          <Section label="Campaign Setup">
            <Field label="Campaign Name" required>
              <input
                ref={nameRef}
                type="text"
                placeholder="e.g. June EOFY Sale 2026"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Subject Line" required hint="Keep under 50 chars · emoji ✅ · avoid ALL CAPS">
              <input
                type="text"
                placeholder="e.g. 🎉 Big sale — 20% off everything this weekend"
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field
              label="Preview Text"
              hint={
                <span style={{ color: previewColor }}>
                  {previewLen}/90 chars — inbox snippet after subject
                </span>
              }
            >
              <input
                type="text"
                placeholder="e.g. Shop your favourites before midnight Sunday…"
                value={form.previewText}
                onChange={(e) => set("previewText", e.target.value)}
                style={{ ...inputStyle, borderColor: previewLen > 90 ? "#ef444460" : undefined }}
              />
            </Field>
          </Section>

          {/* ── SENDER & AUDIENCE ── */}
          <Section label="Sender & Audience">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From Name" required>
                <input
                  type="text"
                  value={form.fromName}
                  onChange={(e) => set("fromName", e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="From Email" required>
                <input
                  type="email"
                  value={form.fromEmail}
                  onChange={(e) => set("fromEmail", e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Send To List" required>
              {lists.length === 0 ? (
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
                  No Klaviyo lists found — sync Klaviyo first
                </div>
              ) : (
                <select
                  value={form.listId}
                  onChange={(e) => set("listId", e.target.value)}
                  style={inputStyle}>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.attributes.name}</option>
                  ))}
                </select>
              )}
            </Field>
          </Section>

          {/* ── SCHEDULING ── */}
          <Section label="Scheduling">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Send Date">
                <input
                  type="date"
                  value={form.sendDate}
                  onChange={(e) => set("sendDate", e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Send Time (UTC)">
                <input
                  type="time"
                  value={form.sendTime}
                  onChange={(e) => set("sendTime", e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
              Leave date blank to save as a draft — you can schedule it in Klaviyo later.
            </p>

            <div className="flex items-center gap-6 mt-3">
              <Toggle
                checked={form.smartSending}
                onChange={(v) => set("smartSending", v)}
                label="Smart Sending"
                hint="Skips recently-emailed contacts"
              />
              <Toggle
                checked={form.trackingParams}
                onChange={(v) => set("trackingParams", v)}
                label="UTM Tracking"
                hint="Adds source/medium/campaign params"
              />
            </div>
          </Section>

          {/* ── CONTENT NOTES ── */}
          <Section label="Content Notes" optional>
            <Field label="CTA Destination URL" hint="Primary link in the email body">
              <input
                type="url"
                placeholder="https://thinkle.com.au/sale"
                value={form.destinationUrl}
                onChange={(e) => set("destinationUrl", e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field
              label="Brief / Campaign Notes"
              hint="Stored in content calendar — used by Campaign Designer agent to generate HTML">
              <textarea
                rows={3}
                placeholder="e.g. EOFY sale — 20% off sitewide, upbeat tone, urgency, ends Sunday midnight. Push the Thinkle hoodie range."
                value={form.brief}
                onChange={(e) => set("brief", e.target.value)}
                style={{ ...inputStyle, resize: "none", lineHeight: "1.5" }}
              />
            </Field>
          </Section>

          {/* ── Error ── */}
          {error && (
            <div className="px-4 py-3 rounded-lg text-xs" style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#ef4444" }}>
              ⚠ {error}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={submitting}
              className="py-2.5 px-5 text-sm rounded-lg disabled:opacity-40"
              style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              Cancel
            </button>

            <button
              onClick={() => handleSubmit(true)}
              disabled={!canSubmit}
              className="py-2.5 px-5 text-sm rounded-lg font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
              style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid #6366f140" }}>
              {submitting ? "Creating…" : "Save as Draft"}
            </button>

            <button
              onClick={() => handleSubmit(false)}
              disabled={!canSubmit || !form.sendDate}
              className="flex-1 py-2.5 text-sm rounded-lg font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
              style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "white" }}>
              {submitting
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Scheduling…
                  </span>
                : `Schedule Campaign →`}
            </button>
          </div>

        </div>
      </ModalShell>
    </Overlay>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Close on backdrop click
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function ModalShell({
  children, onClose, title, width,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  width?: number;
}) {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden flex flex-col"
      style={{
        maxWidth:  width ?? 560,
        maxHeight: "92vh",
        background: "var(--bg-card)",
        border:    "1px solid #2a2a3a",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid #1e1e30" }}>
        <div className="flex items-center gap-2.5">
          <span className="text-base">📅</span>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-colors hover:bg-white/10"
          style={{ color: "var(--text-muted)" }}>
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="px-6 py-5 overflow-y-auto flex-1">
        {children}
      </div>
    </div>
  );
}

function Section({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</p>
        {optional && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#6b728020", color: "#9ca3af" }}>optional</span>
        )}
        <div className="flex-1 h-px" style={{ background: "#1e1e30" }} />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label, required, hint, children,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}
          {required && <span className="ml-0.5" style={{ color: "#6366f1" }}>*</span>}
        </label>
        {hint && <span className="text-xs" style={{ color: "var(--text-faint)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked, onChange, label, hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 group">
      {/* pill toggle */}
      <div
        className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? "#6366f1" : "#374151" }}>
        <div
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
        />
      </div>
      <div className="text-left">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
        {hint && <span className="text-xs ml-1.5" style={{ color: "var(--text-faint)" }}>{hint}</span>}
      </div>
    </button>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg"
      style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-mono text-xs" style={{ color: "#a5b4fc" }}>{value}</span>
    </div>
  );
}

// ── Shared input style ─────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width:        "100%",
  fontSize:     "13px",
  padding:      "8px 12px",
  borderRadius: "8px",
  outline:      "none",
  background:   "var(--bg-subtle)",
  border:       "1px solid #2a2a3a",
  color:        "var(--text-primary)",
};
