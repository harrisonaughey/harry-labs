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
  const [selectedSubject, setSelectedSubject] = useState(0);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [aiError, setAiError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

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
            if (parsed.done) { setAiResult(parseAiResult(accumulated)); break; }
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

  function handleClose() {
    abortRef.current?.abort();
    setOpen(false);
    setTab("manual");
    setAiStreamText("");
    setAiResult(null);
    setAiError("");
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
              background: "#111118",
              border: "1px solid #2a2a3a",
              maxWidth: aiResult ? "800px" : "512px",
              maxHeight: "90vh",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">New Email Campaign</h2>
              <button onClick={handleClose} style={{ color: "#6b7280" }}>✕</button>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "#1a1a24" }}>
              {(["manual", "ai"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 text-sm py-1.5 rounded-md font-medium transition-all"
                  style={{
                    background: tab === t ? "#6366f1" : "transparent",
                    color: tab === t ? "white" : "#9ca3af",
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
                  <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>Campaign Name</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none text-white"
                    style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }}
                    placeholder="e.g. May Newsletter"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>Subject Line</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none text-white"
                    style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }}
                    placeholder="e.g. 🎉 Big sale this weekend"
                    value={form.subject}
                    onChange={(e) => setField("subject", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>From Name</label>
                    <input
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none text-white"
                      style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }}
                      value={form.fromName}
                      onChange={(e) => setField("fromName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>From Email</label>
                    <input
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none text-white"
                      style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }}
                      value={form.fromEmail}
                      onChange={(e) => setField("fromEmail", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>Send To List</label>
                  <select
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none text-white"
                    style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }}
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
                    <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>Template (optional)</label>
                    <select
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "#1a1a24", border: "1px solid #2a2a3a", color: form.templateId ? "white" : "#6b7280" }}
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
                  <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>
                    Schedule Send (optional — leave blank to save as draft)
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full text-sm px-3 py-2 rounded-lg outline-none text-white"
                    style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }}
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
                  <button onClick={handleClose} className="flex-1 text-sm py-2 rounded-lg" style={{ background: "#1a1a24", color: "#6b7280" }}>
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
                      <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>Campaign Name (optional)</label>
                      <input
                        className="w-full text-sm px-3 py-2 rounded-lg outline-none text-white"
                        style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }}
                        placeholder="e.g. EOFY Sale June 2026"
                        value={aiCampaignName}
                        onChange={(e) => setAiCampaignName(e.target.value)}
                        disabled={aiStreaming}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>Send To List</label>
                      <select
                        className="w-full text-sm px-3 py-2 rounded-lg outline-none text-white"
                        style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }}
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
                      <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>
                        Email Brief
                        <span className="ml-1 font-normal" style={{ color: "#4b5563" }}>— describe the campaign, offer, tone, any specific products</span>
                      </label>
                      <textarea
                        className="w-full text-sm px-3 py-2 rounded-lg outline-none text-white resize-none"
                        style={{ background: "#1a1a24", border: "1px solid #2a2a3a", minHeight: "100px" }}
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
                    style={{ background: "#0d0d14", border: "1px solid #2a2a3a", maxHeight: "280px", color: "#a5b4fc", whiteSpace: "pre-wrap" }}
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
                        <label className="text-xs font-medium mb-2 block" style={{ color: "#9ca3af" }}>Subject Line — pick one</label>
                        <div className="space-y-2">
                          {aiResult.subjects.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedSubject(i)}
                              className="w-full text-left text-sm px-3 py-2 rounded-lg transition-all"
                              style={{
                                background: selectedSubject === i ? "#6366f120" : "#1a1a24",
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
                        <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>Preview Text</label>
                        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "#1a1a24", color: "#e5e7eb" }}>
                          {aiResult.previewText}
                        </p>
                      </div>
                    )}

                    {/* Send time */}
                    {aiResult.sendTime && (
                      <div>
                        <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>Recommended Send Time</label>
                        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "#1a1a24", color: "#e5e7eb" }}>
                          {aiResult.sendTime}
                        </p>
                      </div>
                    )}

                    {/* HTML preview toggle */}
                    {aiResult.html && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium" style={{ color: "#9ca3af" }}>Email HTML</label>
                          <button
                            onClick={() => setShowHtmlPreview((v) => !v)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "#1a1a24", color: "#6366f1", border: "1px solid #2a2a3a" }}
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
                            style={{ background: "#0d0d14", border: "1px solid #2a2a3a", color: "#6b7280", maxHeight: "120px", whiteSpace: "pre" }}
                          >
                            {aiResult.html.slice(0, 300)}…
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => { setAiResult(null); setAiStreamText(""); }}
                        className="text-sm py-2 px-4 rounded-lg"
                        style={{ background: "#1a1a24", color: "#9ca3af", border: "1px solid #2a2a3a" }}
                      >
                        Rebuild
                      </button>
                      <button
                        onClick={handleUseEmail}
                        className="flex-1 text-sm py-2 rounded-lg font-medium"
                        style={{ background: "#6366f1", color: "white" }}
                      >
                        Use this email →
                      </button>
                    </div>
                  </div>
                )}

                {/* Generate button */}
                {!aiResult && (
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleClose} className="text-sm py-2 px-4 rounded-lg" style={{ background: "#1a1a24", color: "#6b7280" }}>
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
