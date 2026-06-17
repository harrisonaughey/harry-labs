"use client";
import { useState, useRef } from "react";

type List = { id: string; attributes: { name: string } };
type Template = { id: string; attributes: { name: string } };

type AiResult = {
  raw: string;
  subjects: string[];
  previewText: string;
  sendTime: string;
  html: string;
};

type ImageMeta = {
  slot:   string;
  name:   string;
  url:    string;
  format: string;
  source: "klaviyo" | "drive";
};

function parseAiResult(raw: string): AiResult {
  const section = (header: string) => {
    const re = new RegExp(`## ${header}\\s*([\\s\\S]*?)(?=\\n## |$)`, "i");
    return (raw.match(re)?.[1] ?? "").trim();
  };

  const subjectBlock = section("Subject Line Variants");
  const subjects = subjectBlock
    .split("\n")
    .filter((l) => /^\d\./.test(l.trim()))
    .map((l) => l.replace(/^\d\.\s*/, "").trim())
    .filter(Boolean);

  const htmlBlock = section("HTML Email");
  const htmlMatch = htmlBlock.match(/```html\s*([\s\S]*?)```/i);
  const html = htmlMatch ? htmlMatch[1].trim() : htmlBlock;

  return {
    raw,
    subjects,
    previewText: section("Preview Text"),
    sendTime: section("Recommended Send Time"),
    html,
  };
}

export default function EmailBuilder({ lists, templates }: { lists: List[]; templates: Template[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"manual" | "ai">("manual");

  // Manual form state
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; campaignId?: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    fromName: "Thinkle",
    fromEmail: "hello@thinkle.com.au",
    listId: lists[0]?.id ?? "",
    templateId: "",
    scheduledAt: "",
  });

  // AI build state
  const [aiBrief, setAiBrief] = useState("");
  const [aiCampaignName, setAiCampaignName] = useState("");
  const [aiListId, setAiListId] = useState(lists[0]?.id ?? "");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiStreamText, setAiStreamText] = useState("");
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiImages, setAiImages] = useState<ImageMeta[]>([]);
  const [aiImageSource, setAiImageSource] = useState<"klaviyo" | "drive" | null>(null);
  const [showImages, setShowImages] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(0);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [aiError, setAiError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // AI → campaign creation state
  const [aiCreateScheduleAt, setAiCreateScheduleAt] = useState("");
  const [aiCreateState, setAiCreateState] = useState<"idle" | "creating" | "done">("idle");
  const [aiCreateResult, setAiCreateResult] = useState<{ campaignId: string; templateId?: string } | null>(null);
  const [aiCreateError, setAiCreateError] = useState("");

  function setField(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSend() {
    if (!form.name || !form.subject || !form.listId) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/klaviyo/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledAt: form.scheduledAt || null,
          templateId: form.templateId || undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setForm({ name: "", subject: "", fromName: "Thinkle", fromEmail: "hello@thinkle.com.au", listId: lists[0]?.id ?? "", templateId: "", scheduledAt: "" });
        setTimeout(() => setOpen(false), 2000);
      }
    } catch {
      setResult({ error: "Network error" });
    } finally {
      setSending(false);
    }
  }

  async function handleAiBuild() {
    if (!aiBrief.trim()) return;
    setAiStreaming(true);
    setAiStreamText("");
    setAiResult(null);
    setAiError("");

    const abort = new AbortController();
    abortRef.current = abort;
    let accumulated = "";

    try {
      const res = await fetch("/api/agent/email-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: aiBrief,
          campaignName: aiCampaignName,
          listId: aiListId,
          listName: lists.find((l) => l.id === aiListId)?.attributes.name ?? "",
        }),
        signal: abort.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.error) { setAiError(parsed.error); break; }
            if (parsed.done) {
              setAiResult(parseAiResult(accumulated));
              if (parsed.images?.length)  { setAiImages(parsed.images); setShowImages(true); }
              if (parsed.imageSource)     setAiImageSource(parsed.imageSource);
              break;
            }
            if (parsed.text) {
              accumulated += parsed.text;
              setAiStreamText(accumulated);
            }
          } catch { /* incomplete JSON chunk */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setAiError((err as Error).message ?? "Failed to connect");
      }
    } finally {
      setAiStreaming(false);
    }
  }

  function handleUseEmail() {
    if (!aiResult) return;
    setForm((f) => ({
      ...f,
      name: aiCampaignName || f.name,
      subject: aiResult.subjects[selectedSubject] ?? f.subject,
      listId: aiListId,
    }));
    setTab("manual");
  }

  async function handleAiCreate(scheduledAt?: string) {
    if (!aiResult) return;
    setAiCreateState("creating");
    setAiCreateError("");
    try {
      const res = await fetch("/api/klaviyo/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: aiCampaignName || `Email Campaign — ${new Date().toLocaleDateString("en-AU")}`,
          subject: aiResult.subjects[selectedSubject] ?? aiResult.subjects[0] ?? "",
          fromName: "Thinkle",
          fromEmail: "hello@thinkle.com.au",
          listId: aiListId,
          html: aiResult.html,
          previewText: aiResult.previewText,
          scheduledAt: scheduledAt || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiCreateResult({ campaignId: data.campaignId, templateId: data.templateId });
        setAiCreateState("done");
      } else {
        setAiCreateError(data.error ?? "Campaign creation failed");
        setAiCreateState("idle");
      }
    } catch (err) {
      setAiCreateError((err as Error).message ?? "Network error");
      setAiCreateState("idle");
    }
  }

  function handleClose() {
    abortRef.current?.abort();
    setOpen(false);
    setTab("manual");
    setAiStreamText("");
    setAiResult(null);
    setAiImages([]);
    setAiImageSource(null);
    setShowImages(false);
    setAiError("");
    setAiCreateState("idle");
    setAiCreateResult(null);
    setAiCreateError("");
    setAiCreateScheduleAt("");
  }

  const listName = lists.find((l) => l.id === aiListId)?.attributes.name ?? "";

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
        style={{ background: "#6366f1", color: "white" }}
      >
        + New Campaign
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}>
          <div
            className="w-full rounded-2xl p-6 overflow-y-auto"
            style={{
              background: "var(--bg-card)",
              border: "1px solid #2a2a3a",
              maxWidth: aiResult ? "800px" : "512px",
              maxHeight: "90vh",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Email Campaign</h2>
              <button onClick={handleClose} style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
              {(["manual", "ai"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 text-sm py-1.5 rounded-md font-medium transition-all"
                  style={{
                    background: tab === t ? "#6366f1" : "transparent",
                    color: tab === t ? "white" : "var(--text-secondary)",
                  }}
                >
                  {t === "manual" ? "Manual" : "✦ AI Build"}
                </button>
              ))}
            </div>

            {/* ── MANUAL TAB ── */}
            {tab === "manual" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Campaign Name</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: "var(--text-primary)" }}
                    placeholder="e.g. May Newsletter"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Subject Line</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: "var(--text-primary)" }}
                    placeholder="e.g. 🎉 Big sale this weekend"
                    value={form.subject}
                    onChange={(e) => setField("subject", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>From Name</label>
                    <input
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: "var(--text-primary)" }}
                      value={form.fromName}
                      onChange={(e) => setField("fromName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>From Email</label>
                    <input
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: "var(--text-primary)" }}
                      value={form.fromEmail}
                      onChange={(e) => setField("fromEmail", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Send To List</label>
                  <select
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: "var(--text-primary)" }}
                    value={form.listId}
                    onChange={(e) => setField("listId", e.target.value)}
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>{l.attributes.name}</option>
                    ))}
                  </select>
                </div>
                {templates.length > 0 && (
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Template (optional)</label>
                    <select
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: form.templateId ? "var(--text-primary)" : "var(--text-muted)" }}
                      value={form.templateId}
                      onChange={(e) => setField("templateId", e.target.value)}
                    >
                      <option value="">No template — edit in Klaviyo</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.attributes.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    Schedule Send (optional — leave blank to save as draft)
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: "var(--text-primary)" }}
                    value={form.scheduledAt}
                    onChange={(e) => setField("scheduledAt", e.target.value)}
                  />
                </div>
                {result && (
                  <div className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: result.success ? "#10b98120" : "#ef444420", color: result.success ? "#10b981" : "#ef4444" }}>
                    {result.success
                      ? `✅ Campaign created${form.scheduledAt ? " & scheduled" : " as draft"}`
                      : `❌ ${result.error}`}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button onClick={handleClose} className="flex-1 text-sm py-2 rounded-lg" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !form.name || !form.subject || !form.listId}
                    className="flex-1 text-sm py-2 rounded-lg font-medium disabled:opacity-40"
                    style={{ background: "#6366f1", color: "white" }}
                  >
                    {sending ? "Creating…" : form.scheduledAt ? "Schedule Campaign" : "Create as Draft"}
                  </button>
                </div>
              </div>
            )}

            {/* ── AI BUILD TAB ── */}
            {tab === "ai" && (
              <div className="space-y-4">
                {/* Brief input — only show when not showing result */}
                {!aiResult && (
                  <>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Campaign Name (optional)</label>
                      <input
                        className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                        style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: "var(--text-primary)" }}
                        placeholder="e.g. EOFY Sale June 2026"
                        value={aiCampaignName}
                        onChange={(e) => setAiCampaignName(e.target.value)}
                        disabled={aiStreaming}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Send To List</label>
                      <select
                        className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                        style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: "var(--text-primary)" }}
                        value={aiListId}
                        onChange={(e) => setAiListId(e.target.value)}
                        disabled={aiStreaming}
                      >
                        {lists.map((l) => (
                          <option key={l.id} value={l.id}>{l.attributes.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                        Email Brief
                        <span className="ml-1 font-normal" style={{ color: "var(--text-faint)" }}>— describe the campaign, offer, tone, any specific products</span>
                      </label>
                      <textarea
                        className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
                        style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", minHeight: "100px", color: "var(--text-primary)" }}
                        placeholder="e.g. EOFY sale — 20% off everything sitewide, going to our full list, send Friday 27 June. Upbeat tone, push urgency, sale ends Sunday midnight."
                        value={aiBrief}
                        onChange={(e) => setAiBrief(e.target.value)}
                        disabled={aiStreaming}
                      />
                    </div>
                  </>
                )}

                {/* Streaming output */}
                {aiStreaming && (
                  <div
                    className="rounded-lg p-4 text-xs font-mono overflow-y-auto"
                    style={{ background: "var(--bg-card-inner)", border: "1px solid #2a2a3a", maxHeight: "280px", color: "#a5b4fc", whiteSpace: "pre-wrap" }}
                  >
                    <div className="flex items-center gap-2 mb-2" style={{ color: "#6366f1" }}>
                      <span className="animate-pulse">●</span>
                      <span className="text-xs font-sans font-medium">AI is building your email…</span>
                    </div>
                    {aiStreamText}
                  </div>
                )}

                {/* Error */}
                {aiError && (
                  <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#ef444420", color: "#ef4444" }}>
                    ❌ {aiError}
                  </div>
                )}

                {/* Result review panel */}
                {aiResult && !aiStreaming && (
                  <div className="space-y-4">
                    {/* Subject line picker */}
                    {aiResult.subjects.length > 0 && (
                      <div>
                        <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text-secondary)" }}>Subject Line — pick one</label>
                        <div className="space-y-2">
                          {aiResult.subjects.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedSubject(i)}
                              className="w-full text-left text-sm px-3 py-2 rounded-lg transition-all"
                              style={{
                                background: selectedSubject === i ? "#6366f120" : "var(--bg-subtle)",
                                border: `1px solid ${selectedSubject === i ? "#6366f1" : "#2a2a3a"}`,
                                color: selectedSubject === i ? "#a5b4fc" : "#e5e7eb",
                              }}
                            >
                              {i === 0 && <span className="text-xs mr-1" style={{ color: "#6366f1" }}>★ </span>}
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preview text */}
                    {aiResult.previewText && (
                      <div>
                        <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Preview Text</label>
                        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "var(--bg-subtle)", color: "#e5e7eb" }}>
                          {aiResult.previewText}
                        </p>
                      </div>
                    )}

                    {/* Send time */}
                    {aiResult.sendTime && (
                      <div>
                        <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Recommended Send Time</label>
                        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "var(--bg-subtle)", color: "#e5e7eb" }}>
                          {aiResult.sendTime}
                        </p>
                      </div>
                    )}

                    {/* Images Used — from Klaviyo or Drive */}
                    {aiImages.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                              Images Used
                            </label>
                            <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{
                                background: aiImageSource === "klaviyo" ? "#6366f120" : "#f59e0b20",
                                color:      aiImageSource === "klaviyo" ? "#a5b4fc"   : "#fbbf24",
                              }}>
                              {aiImageSource === "klaviyo" ? "✓ Klaviyo library" : "↩ Drive fallback"}
                            </span>
                          </div>
                          <button
                            onClick={() => setShowImages((v) => !v)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "var(--bg-subtle)", color: "#6366f1", border: "1px solid #2a2a3a" }}>
                            {showImages ? "Hide" : "Show"}
                          </button>
                        </div>

                        {showImages && (
                          <div className="grid gap-2"
                            style={{ gridTemplateColumns: `repeat(${Math.min(aiImages.length, 3)}, 1fr)` }}>
                            {aiImages.map((img) => (
                              <a
                                key={img.slot}
                                href={img.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group block rounded-lg overflow-hidden relative"
                                style={{ border: "1px solid #2a2a3a" }}>
                                {/* Thumbnail */}
                                <div className="w-full" style={{ background: "#111", aspectRatio: "16/9" }}>
                                  <img
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover"
                                    style={{ opacity: 0.9 }}
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                  />
                                </div>
                                {/* Overlay on hover */}
                                <div className="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}>
                                  <p className="text-xs font-medium text-white truncate">{img.name}</p>
                                  <p className="text-xs" style={{ color: "#a5b4fc" }}>
                                    {"{{"}{img.slot}{"}}"}
                                  </p>
                                </div>
                                {/* Slot badge */}
                                <span className="absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded font-mono"
                                  style={{ background: "#6366f1dd", color: "white", fontSize: "10px" }}>
                                  {img.slot}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}

                        {showImages && aiImageSource === "drive" && (
                          <p className="text-xs mt-1.5" style={{ color: "var(--text-faint)" }}>
                            ℹ️ No images found in Klaviyo library — used Google Drive fallback.
                            Upload images to <a href="https://www.klaviyo.com/content/images" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#a5b4fc" }}>Klaviyo Images</a> for better matching.
                          </p>
                        )}
                      </div>
                    )}

                    {/* HTML preview toggle */}
                    {aiResult.html && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Email HTML</label>
                          <button
                            onClick={() => setShowHtmlPreview((v) => !v)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "var(--bg-subtle)", color: "#6366f1", border: "1px solid #2a2a3a" }}
                          >
                            {showHtmlPreview ? "Hide preview" : "Show preview"}
                          </button>
                        </div>
                        {showHtmlPreview && (
                          <iframe
                            srcDoc={aiResult.html}
                            className="w-full rounded-lg"
                            style={{ height: "400px", border: "1px solid #2a2a3a", background: "white" }}
                            sandbox="allow-same-origin"
                            title="Email preview"
                          />
                        )}
                        {!showHtmlPreview && (
                          <div
                            className="text-xs font-mono px-3 py-2 rounded-lg overflow-auto"
                            style={{ background: "var(--bg-card-inner)", border: "1px solid #2a2a3a", color: "var(--text-muted)", maxHeight: "120px", whiteSpace: "pre" }}
                          >
                            {aiResult.html.slice(0, 300)}…
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Campaign launch section ── */}
                    {aiCreateState === "done" && aiCreateResult ? (
                      /* Success state */
                      <div className="rounded-xl p-4 space-y-3" style={{ background: "#10b98110", border: "1px solid #10b981" }}>
                        <div className="flex items-center gap-2">
                          <span style={{ color: "#10b981", fontSize: "18px" }}>✅</span>
                          <span className="text-sm font-semibold" style={{ color: "#10b981" }}>
                            Campaign draft created!
                          </span>
                        </div>
                        {aiCreateResult.templateId && (
                          <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                            <div className="flex items-center gap-2">
                              <span style={{ color: "#10b981" }}>✓</span>
                              <span>Email template saved in Klaviyo — <span className="font-mono" style={{ color: "#a5b4fc" }}>ID: {aiCreateResult.templateId}</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span style={{ color: "#10b981" }}>✓</span>
                              <span>Campaign draft created — <span className="font-mono" style={{ color: "#a5b4fc" }}>ID: {aiCreateResult.campaignId}</span></span>
                            </div>
                          </div>
                        )}

                        {/* One-step Klaviyo instruction */}
                        <div className="rounded-lg p-3 text-xs" style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a" }}>
                          <div className="flex items-start gap-2">
                            <span style={{ color: "#f59e0b", fontSize: "14px" }}>⚡</span>
                            <div style={{ color: "var(--text-secondary)" }}>
                              <span className="font-medium" style={{ color: "var(--text-primary)" }}>One step remaining in Klaviyo:</span>
                              {" "}Open your campaign → click <em>Edit Content</em> → select <em>Use existing template</em> → choose &quot;<strong>{aiCampaignName || "your template"}</strong>&quot; → Save.
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <a
                            href="https://www.klaviyo.com/omnicampaigns"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-sm py-2 rounded-lg font-medium text-center transition-opacity hover:opacity-80"
                            style={{ background: "#6366f1", color: "white", display: "block" }}
                          >
                            Open Campaigns in Klaviyo →
                          </a>
                          <button
                            onClick={() => {
                              setAiResult(null); setAiStreamText(""); setAiBrief("");
                              setAiImages([]); setAiImageSource(null); setShowImages(false);
                              setAiCreateState("idle"); setAiCreateResult(null); setAiCreateScheduleAt("");
                            }}
                            className="text-sm py-2 px-4 rounded-lg"
                            style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid #2a2a3a" }}
                          >
                            New Email
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Create campaign form */
                      <div className="space-y-3 pt-1">
                        <div className="h-px" style={{ background: "#2a2a3a" }} />
                        <label className="text-xs font-medium block" style={{ color: "var(--text-secondary)" }}>
                          Schedule (optional — leave blank to save as draft)
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                          style={{ background: "var(--bg-subtle)", border: "1px solid #2a2a3a", color: "var(--text-primary)" }}
                          value={aiCreateScheduleAt}
                          onChange={(e) => setAiCreateScheduleAt(e.target.value)}
                          disabled={aiCreateState === "creating"}
                        />
                        {aiCreateError && (
                          <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "#ef444420", color: "#ef4444" }}>
                            ❌ {aiCreateError}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setAiResult(null); setAiStreamText(""); setAiImages([]); setAiImageSource(null); setShowImages(false); setAiCreateState("idle"); }}
                            disabled={aiCreateState === "creating"}
                            className="text-sm py-2 px-4 rounded-lg disabled:opacity-40"
                            style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid #2a2a3a" }}
                          >
                            Rebuild
                          </button>
                          <button
                            onClick={() => handleAiCreate(aiCreateScheduleAt || undefined)}
                            disabled={aiCreateState === "creating"}
                            className="flex-1 text-sm py-2 rounded-lg font-medium disabled:opacity-40"
                            style={{ background: "#6366f1", color: "white" }}
                          >
                            {aiCreateState === "creating"
                              ? "Creating campaign…"
                              : aiCreateScheduleAt
                              ? "Schedule Campaign"
                              : "Save Campaign to Klaviyo"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Generate button */}
                {!aiResult && (
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleClose} className="text-sm py-2 px-4 rounded-lg" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                      Cancel
                    </button>
                    <button
                      onClick={aiStreaming ? () => { abortRef.current?.abort(); setAiStreaming(false); } : handleAiBuild}
                      disabled={!aiBrief.trim() && !aiStreaming}
                      className="flex-1 text-sm py-2 rounded-lg font-medium disabled:opacity-40"
                      style={{ background: aiStreaming ? "#374151" : "#6366f1", color: "white" }}
                    >
                      {aiStreaming ? "Stop" : "Generate with AI"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
