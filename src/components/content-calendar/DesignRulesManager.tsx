"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Rule {
  id:               string;
  name:             string;
  trigger_keywords: string;
  template_type:    string | null;
  design_brief:     string;
  subject_formula:  string | null;
  shopify_actions:  string | null;
  color_primary:    string | null;
  color_accent:     string | null;
  is_active:        boolean;
  sort_order:       number;
}

const TEMPLATE_OPTIONS = [
  { value: "",         label: "✦ Auto  (agent decides from brief)"   },
  { value: "urgency",  label: "⚡ Urgency  — countdown, flash sale"  },
  { value: "hero-cta", label: "🎯 Hero + CTA  — launch, announce"    },
  { value: "split",    label: "↔ Split  — image + text side-by-side" },
  { value: "grid",     label: "⊞ Grid  — hero + 2 products"          },
  { value: "minimal",  label: "✦ Minimal  — text-first, clean"        },
] as const;

// ─── Shared style ─────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", fontSize: "13px", padding: "8px 12px",
  borderRadius: "8px", outline: "none",
  background: "var(--bg-subtle)", border: "1px solid #2a2a3a",
  color: "var(--text-primary)",
};

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
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

// ─── Rule modal ───────────────────────────────────────────────────────────────

interface ModalProps {
  rule:    Rule | null;   // null = create mode
  onClose: () => void;
  onSave:  (r: Rule) => void;
}

function RuleModal({ rule, onClose, onSave }: ModalProps) {
  const isEdit = !!rule;

  const [name,            setName]           = useState(rule?.name             ?? "");
  const [keywords,        setKeywords]       = useState(rule?.trigger_keywords ?? "");
  const [templateType,    setTemplateType]   = useState(rule?.template_type    ?? "");
  const [designBrief,     setDesignBrief]    = useState(rule?.design_brief     ?? "");
  const [subjectFormula,  setSubjectFormula] = useState(rule?.subject_formula  ?? "");
  const [shopifyActions,  setShopifyActions] = useState(rule?.shopify_actions  ?? "");
  const [colorPrimary,    setColorPrimary]   = useState(rule?.color_primary    ?? "");
  const [colorAccent,     setColorAccent]    = useState(rule?.color_accent     ?? "");
  const [isActive,        setIsActive]       = useState(rule?.is_active        ?? true);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function handleSave() {
    if (!name.trim())        { setError("Rule name is required");    return; }
    if (!designBrief.trim()) { setError("Design brief is required"); return; }
    setSaving(true); setError("");
    try {
      const url    = isEdit ? `/api/design-rules/${rule!.id}` : "/api/design-rules";
      const method = isEdit ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, trigger_keywords: keywords, template_type: templateType || null,
          design_brief: designBrief, subject_formula: subjectFormula || null,
          shopify_actions: shopifyActions || null,
          color_primary: colorPrimary || null, color_accent: colorAccent || null,
          is_active: isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSave(data.rule);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full rounded-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: 600, maxHeight: "92vh", background: "var(--bg-card)", border: "1px solid #2a2a3a", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #1e1e30" }}>
          <div className="flex items-center gap-2.5">
            <span>🎨</span>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {isEdit ? "Edit Design Rule" : "New Design Rule"}
            </h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-sm hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
            style={{ background: isActive ? "#10b98108" : "#6b728010", border: `1px solid ${isActive ? "#10b98130" : "#6b728030"}` }}>
            <div>
              <p className="text-xs font-medium" style={{ color: isActive ? "#10b981" : "var(--text-muted)" }}>
                {isActive ? "Active — agent will apply this rule" : "Inactive — rule is disabled"}
              </p>
            </div>
            <button
              onClick={() => setIsActive(!isActive)}
              className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
              style={{ background: isActive ? "#10b981" : "#374151" }}>
              <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                style={{ left: isActive ? "22px" : "2px" }} />
            </button>
          </div>

          <Field label="Rule Name" required>
            <input ref={nameRef} type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. EOFY Sale"
              style={inp} />
          </Field>

          <Field label="Trigger Keywords"
            hint="Comma-separated — matched against campaign name + brief">
            <input type="text" value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="eofy, end of financial year, tax, june sale, 30 june"
              style={inp} />
            <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
              When any keyword matches the campaign name or brief, this rule is applied automatically.
            </p>
          </Field>

          <Field label="Force Template Type" hint="Overrides the agent's auto-selection">
            <select value={templateType} onChange={(e) => setTemplateType(e.target.value)} style={inp}>
              {TEMPLATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Design & Copy Rules" required
            hint="The agent reads and follows these exactly">
            <textarea
              value={designBrief}
              onChange={(e) => setDesignBrief(e.target.value)}
              rows={6}
              placeholder={`Write detailed directives for the agent. Examples:\n• Lead with the countdown timer as the hero element\n• Use orange (#f97316) accent for urgency\n• CTA must say "Shop Now — Ends Tonight"\n• Keep copy under 30 words per block`}
              style={{ ...inp, resize: "vertical", lineHeight: "1.6", fontFamily: "inherit" }} />
          </Field>

          <Field label="Subject Line Formula" hint="Agent adapts this to the specific campaign">
            <input type="text" value={subjectFormula}
              onChange={(e) => setSubjectFormula(e.target.value)}
              placeholder="e.g. [X]% Off Sitewide — Ends Tonight at Midnight"
              style={inp} />
          </Field>

          <Field label="Shopify Checklist" hint="Shown in Slack reminders + agent notes">
            <textarea value={shopifyActions}
              onChange={(e) => setShopifyActions(e.target.value)}
              rows={2}
              placeholder="e.g. Activate EOFY discount codes. Enable announcement bar. Upload sale creatives."
              style={{ ...inp, resize: "none", lineHeight: "1.5" }} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary Colour Override" hint="Hex or blank to use brand default">
              <div className="flex items-center gap-2">
                {colorPrimary && (
                  <span className="w-5 h-5 rounded flex-shrink-0 border border-white/10"
                    style={{ background: colorPrimary }} />
                )}
                <input type="text" value={colorPrimary}
                  onChange={(e) => setColorPrimary(e.target.value)}
                  placeholder="#6366f1"
                  style={{ ...inp, flex: 1 }} />
              </div>
            </Field>
            <Field label="Accent Colour Override" hint="Hex or blank to use brand default">
              <div className="flex items-center gap-2">
                {colorAccent && (
                  <span className="w-5 h-5 rounded flex-shrink-0 border border-white/10"
                    style={{ background: colorAccent }} />
                )}
                <input type="text" value={colorAccent}
                  onChange={(e) => setColorAccent(e.target.value)}
                  placeholder="#f59e0b"
                  style={{ ...inp, flex: 1 }} />
              </div>
            </Field>
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-lg text-xs"
              style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#ef4444" }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid #1e1e30" }}>
          <button onClick={onClose} disabled={saving}
            className="py-2.5 px-5 text-sm rounded-lg disabled:opacity-40"
            style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !designBrief.trim()}
            className="flex-1 py-2.5 text-sm rounded-lg font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
            style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "white" }}>
            {saving
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              : isEdit ? "Save Changes" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rule card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  deleteId,
  onConfirmDelete,
}: {
  rule:            Rule;
  onEdit:          () => void;
  onDelete:        () => void;
  onToggle:        () => void;
  deleteId:        string | null;
  onConfirmDelete: () => void;
}) {
  const tplLabel = TEMPLATE_OPTIONS.find((o) => o.value === rule.template_type)?.label ?? "✦ Auto";

  return (
    <div className="rounded-xl p-4 group transition-all"
      style={{
        background:   rule.is_active ? "var(--bg-card)" : "var(--bg-subtle)",
        border:       `1px solid ${rule.is_active ? "var(--border)" : "#1e1e30"}`,
        opacity:      rule.is_active ? 1 : 0.6,
      }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {rule.name}
          </h3>
          {/* Colour swatches */}
          {(rule.color_primary || rule.color_accent) && (
            <div className="flex gap-1">
              {rule.color_primary && (
                <span className="w-3.5 h-3.5 rounded-full border border-white/10 flex-shrink-0"
                  style={{ background: rule.color_primary }} title={`Primary: ${rule.color_primary}`} />
              )}
              {rule.color_accent && (
                <span className="w-3.5 h-3.5 rounded-full border border-white/10 flex-shrink-0"
                  style={{ background: rule.color_accent }} title={`Accent: ${rule.color_accent}`} />
              )}
            </div>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "#6366f115", color: "#a5b4fc" }}>
            {tplLabel.split("  ")[0]}
          </span>
          {!rule.is_active && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#6b728015", color: "#9ca3af" }}>
              Inactive
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onEdit}
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-muted)" }} title="Edit">✎</button>

          <button onClick={onToggle}
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-colors"
            style={{ color: rule.is_active ? "#10b981" : "#6b7280" }}
            title={rule.is_active ? "Disable rule" : "Enable rule"}>
            {rule.is_active ? "●" : "○"}
          </button>

          <button onClick={deleteId === rule.id ? onConfirmDelete : onDelete}
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-colors"
            style={{ color: deleteId === rule.id ? "#ef4444" : "var(--text-muted)", background: deleteId === rule.id ? "#ef444415" : "transparent" }}
            title={deleteId === rule.id ? "Click again to confirm" : "Delete"}>
            {deleteId === rule.id ? "✓?" : "✕"}
          </button>
        </div>
      </div>

      {/* Keywords */}
      {rule.trigger_keywords && (
        <div className="flex flex-wrap gap-1 mb-3">
          {rule.trigger_keywords.split(",").map((k) => k.trim()).filter(Boolean).map((kw) => (
            <span key={kw} className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#6366f10a", color: "var(--text-faint)", border: "1px solid #2a2a3a" }}>
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Design brief preview */}
      <p className="text-xs line-clamp-2" style={{ color: "var(--text-faint)", lineHeight: "1.6" }}>
        {rule.design_brief}
      </p>

      {/* Subject formula */}
      {rule.subject_formula && (
        <p className="text-xs mt-2 px-2 py-1.5 rounded-lg"
          style={{ background: "#6366f108", color: "#a5b4fc", borderLeft: "2px solid #6366f140" }}>
          Subject: {rule.subject_formula}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialRules: Rule[];
}

export default function DesignRulesManager({ initialRules }: Props) {
  const [rules,     setRules]     = useState<Rule[]>(initialRules);
  const [modal,     setModal]     = useState<Rule | null | "new">(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleteTimer, setDeleteTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  function handleSave(saved: Rule) {
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [...prev, saved].sort((a, b) => a.sort_order - b.sort_order);
    });
    setModal(null);
  }

  function handleConfirmDelete(id: string) {
    if (deleteTimer) clearTimeout(deleteTimer);
    setDeleteId(null);
    fetch(`/api/design-rules/${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  function handleDeleteClick(id: string) {
    if (deleteId === id) return; // already pending — wait for confirm
    setDeleteId(id);
    const t = setTimeout(() => setDeleteId(null), 3000);
    setDeleteTimer(t);
  }

  async function handleToggle(rule: Rule) {
    const updated = { ...rule, is_active: !rule.is_active };
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    await fetch(`/api/design-rules/${rule.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_active: !rule.is_active }),
    });
  }

  const active   = rules.filter((r) => r.is_active).length;
  const inactive = rules.filter((r) => !r.is_active).length;

  return (
    <>
      {/* ── Header bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "#10b98115", color: "#10b981", border: "1px solid #10b98130" }}>
              {active} active
            </span>
            {inactive > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: "#6b728015", color: "#9ca3af", border: "1px solid #6b728030" }}>
                {inactive} inactive
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setModal("new")}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
          style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "white" }}>
          + New Rule
        </button>
      </div>

      {/* ── How it works banner ─────────────────────────────────────── */}
      <div className="rounded-xl p-4 mb-6 flex items-start gap-3"
        style={{ background: "#6366f108", border: "1px solid #6366f120" }}>
        <span className="text-base flex-shrink-0 mt-0.5">🎨</span>
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: "#a5b4fc" }}>
            How design rules work
          </p>
          <p className="text-xs" style={{ color: "var(--text-faint)", lineHeight: "1.6" }}>
            When the agent builds an email — via <strong style={{ color: "var(--text-muted)" }}>Build Now</strong> or the daily cron — it scans the campaign name and brief for your trigger keywords.
            The first matching rule is injected into Claude&apos;s prompt as a set of hard directives: layout, colours, copy tone, CTA wording, and subject line formula.
            Rules are checked in order (sort_order), so more specific rules should have a lower number.
          </p>
        </div>
      </div>

      {/* ── Rules grid ──────────────────────────────────────────────── */}
      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ background: "#6366f115", border: "1px solid #6366f130" }}>🎨</div>
          <div className="text-center">
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              No design rules yet
            </p>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Create rules to give the agent specific instructions for each campaign type
            </p>
          </div>
          <button onClick={() => setModal("new")}
            className="text-xs px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
            style={{ background: "#6366f120", color: "#a5b4fc", border: "1px solid #6366f130" }}>
            + Create your first rule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => setModal(rule)}
              onDelete={() => handleDeleteClick(rule.id)}
              onToggle={() => handleToggle(rule)}
              deleteId={deleteId}
              onConfirmDelete={() => handleConfirmDelete(rule.id)}
            />
          ))}
        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────────────── */}
      {modal !== null && (
        <RuleModal
          rule={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
