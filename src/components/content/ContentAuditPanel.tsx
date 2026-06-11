"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────

type Decision = "green_light" | "amber" | "red" | "kill" | "unknown";
type AuditMode = "pre-live" | "post-live";
type UploadType = "link" | "file";
type View = "list" | "form" | "running";
type PostPlatform = "meta" | "tiktok" | "ig" | "youtube";

interface ContentAudit {
  id: string;
  created_at: string;
  title: string;
  content_type: string | null;
  platforms: string[] | null;
  duration_s: number | null;
  mode: string;
  score: number | null;
  decision: Decision | null;
  hook_type: string | null;
  report: string | null;
  status: string;
  _local?: boolean;
}

interface UploadFormState {
  title: string;
  uploadType: UploadType;
  file: File | null;
  link: string;
  contentType: string;
  platforms: string[];
  mode: AuditMode;
  aov: string;
  duration: string;
  context: string;
  // post-live metrics
  meta: Record<string, string>;
  tiktok: Record<string, string>;
  ig: Record<string, string>;
  youtube: Record<string, string>;
}

// ── Constants ──────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { value: "ugc",              label: "UGC / Creator" },
  { value: "founder",          label: "Founder / Personal Brand" },
  { value: "product_demo",     label: "Product Demo" },
  { value: "problem_solution", label: "Problem / Solution" },
  { value: "listicle",         label: "Listicle / Educational" },
  { value: "testimonial",      label: "Testimonial" },
  { value: "trending_audio",   label: "Trending Audio" },
  { value: "other",            label: "Other" },
];

const PLATFORMS = [
  { id: "meta",    label: "Meta Ads",   icon: "📘" },
  { id: "tiktok",  label: "TikTok",     icon: "🎵" },
  { id: "ig",      label: "IG Organic", icon: "📸" },
  { id: "youtube", label: "YouTube",    icon: "▶️" },
];

const PLATFORM_LABEL: Record<string, string> = {
  meta: "Meta", tiktok: "TikTok", ig: "IG", youtube: "YouTube",
};

const DECISION_CONFIG: Record<Decision, { label: string; bg: string; color: string; dot: string }> = {
  green_light: { label: "GREEN LIGHT", bg: "#10b98115", color: "#10b981", dot: "#10b981" },
  amber:       { label: "AMBER",       bg: "#f59e0b15", color: "#f59e0b", dot: "#f59e0b" },
  red:         { label: "REWORK",      bg: "#ef444415", color: "#ef4444", dot: "#ef4444" },
  kill:        { label: "KILL",        bg: "#6b728015", color: "#9ca3af", dot: "#6b7280" },
  unknown:     { label: "—",           bg: "var(--bg-subtle)", color: "var(--text-faint)", dot: "#6b7280" },
};

const POST_METRICS: Record<PostPlatform, { key: string; label: string; unit: string; hint: string }[]> = {
  meta: [
    { key: "hookRate",    label: "Hook Rate (3s)",  unit: "%", hint: "3s views ÷ impressions" },
    { key: "holdRate",    label: "Hold Rate (25%)", unit: "%", hint: "25% plays ÷ impressions" },
    { key: "ctr",         label: "All CTR",          unit: "%", hint: "All clicks ÷ impressions" },
    { key: "outboundCtr", label: "Outbound CTR",     unit: "%", hint: "Link clicks ÷ impressions" },
    { key: "cpm",         label: "CPM",              unit: "$", hint: "Cost per 1,000 impr." },
    { key: "cpa",         label: "CPA",              unit: "$", hint: "Cost per purchase" },
    { key: "roas",        label: "ROAS",             unit: "×", hint: "Return on ad spend" },
    { key: "frequency",   label: "Frequency",        unit: "×", hint: "Avg impressions/person" },
  ],
  tiktok: [
    { key: "hookRate",       label: "Hook Rate (2s)",  unit: "%", hint: "2s views ÷ total views" },
    { key: "watchTime",      label: "Avg Watch Time",  unit: "%", hint: "Avg watch ÷ duration" },
    { key: "engagementRate", label: "Engagement",      unit: "%", hint: "(likes+comments+shares) ÷ views" },
    { key: "shares",         label: "Shares",          unit: "",  hint: "Total share count" },
    { key: "ctr",            label: "CTR",             unit: "%", hint: "Click-through rate" },
  ],
  ig: [
    { key: "completion",     label: "Completion",      unit: "%", hint: "% watched to end" },
    { key: "saveRate",       label: "Save Rate",       unit: "%", hint: "Saves ÷ reach × 100" },
    { key: "shareRate",      label: "Share Rate",      unit: "%", hint: "Shares ÷ reach × 100" },
    { key: "engagementRate", label: "Engagement",      unit: "%", hint: "(likes+comments+saves+shares) ÷ reach" },
    { key: "reach",          label: "Reach",           unit: "",  hint: "Unique accounts reached" },
  ],
  youtube: [
    { key: "retention", label: "Avg Retention", unit: "%", hint: "Avg view ÷ duration" },
    { key: "likeRate",  label: "Like Rate",     unit: "%", hint: "Likes ÷ views × 100" },
    { key: "shares",    label: "Shares",        unit: "",  hint: "Total shares" },
  ],
};

// ── Drive URL parser ───────────────────────────────────────────────────

function parseDriveFileId(input: string): string | null {
  // Full URL: https://drive.google.com/file/d/{ID}/view
  const urlMatch = input.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  // open?id= format
  const openMatch = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];
  // Raw file ID (no slashes, looks like a Drive ID)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(input.trim())) return input.trim();
  return null;
}

// ── Client-side frame extractor ────────────────────────────────────────

async function extractVideoFrames(
  file: File,
  onProgress: (msg: string) => void
): Promise<{ frames: string[]; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.onloadedmetadata = async () => {
      const dur = video.duration;
      const W = 720;
      const H = video.videoHeight && video.videoWidth
        ? Math.round(W * (video.videoHeight / video.videoWidth))
        : 1280;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Deduplicated timestamps
      const raw = [0, 1.5, 3.0, dur * 0.25, dur * 0.5, dur * 0.75, Math.max(dur - 0.5, 0)];
      const stamps = [...new Set(raw.map((t) => Math.min(t, Math.max(dur - 0.1, 0))))];

      const frames: string[] = [];
      for (let i = 0; i < stamps.length; i++) {
        onProgress(`Extracting frame ${i + 1} of ${stamps.length}…`);
        await new Promise<void>((res) => {
          video.currentTime = stamps[i];
          video.onseeked = () => res();
        });
        ctx.drawImage(video, 0, 0, W, H);
        frames.push(canvas.toDataURL("image/jpeg", 0.75));
      }

      URL.revokeObjectURL(objectUrl);
      resolve({ frames, duration: Math.round(dur) });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load video — ensure it is a supported format (MP4, MOV, WebM)"));
    };

    video.load();
  });
}

// ── Small UI atoms ─────────────────────────────────────────────────────

function ScoreBadge({ score, decision }: { score: number | null; decision: Decision | null }) {
  const cfg = DECISION_CONFIG[decision ?? "unknown"];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {score != null ? `${score}/100` : "—"}
      <span className="font-normal opacity-75">{cfg.label}</span>
    </span>
  );
}

function PlatformPill({ id }: { id: string }) {
  const p = PLATFORMS.find((p) => p.id === id);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md"
      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
      {p?.icon} {PLATFORM_LABEL[id] ?? id}
    </span>
  );
}

function SmallInput({
  label, hint, value, onChange, unit, placeholder, type = "text",
}: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void; unit?: string;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        {label}
        {hint && <span className="ml-1 font-normal" style={{ color: "var(--text-faint)" }}>{hint}</span>}
      </label>
      <div className="flex items-center">
        {unit === "$" && (
          <span className="text-xs px-2.5 py-2 rounded-l-lg border-r-0"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-faint)" }}>
            $
          </span>
        )}
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? label}
          className="flex-1 text-sm px-3 py-2 outline-none"
          style={{
            background: "var(--bg-subtle)", border: "1px solid var(--border)",
            color: "var(--text-primary)",
            borderRadius: unit === "$" ? "0 8px 8px 0" : "8px",
          }}
        />
        {unit && unit !== "$" && (
          <span className="text-xs pl-2" style={{ color: "var(--text-faint)" }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

// ── Audit row (expandable) ─────────────────────────────────────────────

function AuditRow({
  audit, expanded, onToggle,
}: {
  audit: ContentAudit; expanded: boolean; onToggle: () => void;
}) {
  const relTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Row header */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}>
        {/* Decision dot */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: DECISION_CONFIG[audit.decision ?? "unknown"].dot }}
        />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {audit.title}
            </span>
            {audit._local && (
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: "#6366f115", color: "#a5b4fc", fontSize: "10px" }}>
                local
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
              {audit.mode === "pre-live" ? "Pre-Live" : "Post-Live"}
            </span>
            {audit.content_type && (
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                · {CONTENT_TYPES.find((c) => c.value === audit.content_type)?.label ?? audit.content_type}
              </span>
            )}
            {audit.duration_s && (
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>· {audit.duration_s}s</span>
            )}
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              · {relTime(audit.created_at)}
            </span>
          </div>
        </div>

        {/* Score badge */}
        <ScoreBadge score={audit.score} decision={audit.decision} />

        {/* Platform pills */}
        <div className="hidden sm:flex gap-1 flex-wrap max-w-[160px]">
          {(audit.platforms ?? []).map((p) => <PlatformPill key={p} id={p} />)}
        </div>

        {/* Expand chevron */}
        <svg
          className="shrink-0 transition-transform"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            color: "var(--text-faint)",
          }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded report */}
      {expanded && audit.report && (
        <div className="px-5 pb-5">
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ background: "#0d0d1a", borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
                <span className="text-xs font-medium" style={{ color: "#a5b4fc" }}>Audit Report</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(audit.report!)}
                className="text-xs px-2.5 py-1 rounded-md hover:opacity-70 transition-opacity"
                style={{ background: "#1e1e30", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                Copy
              </button>
            </div>
            <div className="p-4 overflow-x-auto max-h-[60vh] overflow-y-auto" style={{ background: "#0a0a14" }}>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono"
                style={{ color: "#e2e8f0" }}>
                {audit.report}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Upload form ────────────────────────────────────────────────────────

function UploadForm({
  onRun, onBack,
}: {
  onRun: (data: object, meta: Omit<ContentAudit, "id" | "created_at" | "report" | "score" | "decision" | "hook_type" | "status">) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState<UploadFormState>({
    title: "", uploadType: "link", file: null, link: "",
    contentType: "ugc", platforms: ["meta", "tiktok", "ig", "youtube"],
    mode: "pre-live", aov: "", duration: "", context: "",
    meta: {}, tiktok: {}, ig: {}, youtube: {},
  });
  const [postTab, setPostTab] = useState<PostPlatform>("meta");
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setF = <K extends keyof UploadFormState>(k: K, v: UploadFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function togglePlatform(id: string) {
    setF("platforms", form.platforms.includes(id)
      ? form.platforms.filter((p) => p !== id)
      : [...form.platforms, id]);
  }

  function setMetric(platform: PostPlatform, key: string, val: string) {
    setF(platform, { ...form[platform], [key]: val });
  }

  function setFileFromInput(f: File | null) {
    if (!f) return;
    setF("file", f);
    if (!form.title) setF("title", f.name.replace(/\.[^/.]+$/, ""));
  }

  async function handleSubmit() {
    if (!form.title.trim()) return;
    setExtracting(true);

    try {
      let payload: Record<string, unknown> = {
        mode: form.mode,
        title: form.title,
        contentType: form.contentType,
        platforms: form.platforms,
        aov: form.aov ? parseFloat(form.aov) : undefined,
        context: form.context,
      };

      const meta: Omit<ContentAudit, "id" | "created_at" | "report" | "score" | "decision" | "hook_type" | "status"> = {
        title: form.title,
        content_type: form.contentType,
        platforms: form.platforms,
        duration_s: form.duration ? parseInt(form.duration) : null,
        mode: form.mode,
      };

      if (form.mode === "pre-live") {
        if (form.uploadType === "file" && form.file) {
          setExtractMsg("Loading video…");
          const { frames, duration } = await extractVideoFrames(form.file, setExtractMsg);
          payload = { ...payload, frames, duration };
          meta.duration_s = duration;
        } else if (form.uploadType === "link" && form.link.trim()) {
          const driveId = parseDriveFileId(form.link);
          if (driveId) {
            // Drive thumbnails require auth — skip image fetch, rely on description for visual scoring
            payload = { ...payload, driveFileId: driveId };
            Object.assign(meta, { drive_file_id: driveId, file_url: form.link });
          } else {
            payload = { ...payload, context: `${form.context}\nSource URL: ${form.link}`.trim() };
            Object.assign(meta, { file_url: form.link });
          }
          if (form.duration) {
            meta.duration_s = parseInt(form.duration);
            payload = { ...payload, duration: parseInt(form.duration) };
          }
        }
      } else {
        // Post-live: attach metrics
        const parse = (obj: Record<string, string>) =>
          Object.fromEntries(
            Object.entries(obj)
              .filter(([, v]) => v.trim() !== "")
              .map(([k, v]) => [k, parseFloat(v)])
          );
        payload = {
          ...payload,
          videoName: form.title,
          daysLive: form.duration ? parseInt(form.duration) : undefined,
          margin: form.aov,
          meta: parse(form.meta),
          tiktok: parse(form.tiktok),
          ig: parse(form.ig),
          youtube: parse(form.youtube),
        };
      }

      onRun(payload, meta);
    } catch (err) {
      setExtractMsg((err as Error).message ?? "Error preparing video");
      setExtracting(false);
    }
  }

  const canSubmit = form.title.trim() &&
    (form.mode === "post-live" ||
      (form.uploadType === "file" ? !!form.file : !!form.link.trim()));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-muted)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All audits
        </button>
        <span style={{ color: "var(--border)" }}>·</span>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>New Audit</span>
      </div>

      <div className="space-y-5">
        {/* Audit mode toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg w-fit"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {([
            { id: "pre-live",  label: "Pre-Live",  icon: "🎬" },
            { id: "post-live", label: "Post-Live",  icon: "📊" },
          ] as { id: AuditMode; label: string; icon: string }[]).map((m) => (
            <button key={m.id}
              onClick={() => setF("mode", m.id)}
              className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-md font-medium transition-all"
              style={{
                background: form.mode === m.id ? "#1e1e30" : "transparent",
                color: form.mode === m.id ? "#a5b4fc" : "var(--text-muted)",
              }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <SmallInput
          label="Title"
          placeholder="e.g. Thinkle UGC — Melissa v1"
          value={form.title}
          onChange={(v) => setF("title", v)}
        />

        {/* Pre-live: upload section */}
        {form.mode === "pre-live" && (
          <>
            {/* Upload type tabs */}
            <div>
              <div className="flex items-center gap-1 mb-3">
                {([
                  { id: "link", label: "🔗 Paste link" },
                  { id: "file", label: "📎 Upload file" },
                ] as { id: UploadType; label: string }[]).map((t) => (
                  <button key={t.id}
                    onClick={() => setF("uploadType", t.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                    style={{
                      background: form.uploadType === t.id ? "#6366f120" : "var(--bg-subtle)",
                      border: `1px solid ${form.uploadType === t.id ? "#6366f150" : "var(--border)"}`,
                      color: form.uploadType === t.id ? "#a5b4fc" : "var(--text-muted)",
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {form.uploadType === "link" ? (
                <div>
                  <input
                    value={form.link}
                    onChange={(e) => setF("link", e.target.value)}
                    placeholder="https://drive.google.com/file/d/… or any video URL"
                    className="w-full text-sm px-3 py-2.5 rounded-lg outline-none font-mono"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                  {form.link && parseDriveFileId(form.link) && (
                    <p className="text-xs mt-1.5" style={{ color: "#10b981" }}>
                      ✓ Google Drive file detected — add a description below to improve visual scoring, or upload the file directly for full frame analysis
                    </p>
                  )}
                  {form.link && !parseDriveFileId(form.link) && (
                    <p className="text-xs mt-1.5" style={{ color: "var(--text-faint)" }}>
                      Non-Drive link detected — audit will use your description for visual scoring
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="relative rounded-xl border-2 border-dashed transition-colors cursor-pointer"
                  style={{
                    borderColor: dragOver ? "#6366f1" : "var(--border)",
                    background: dragOver ? "#6366f108" : "var(--bg-subtle)",
                    padding: "32px 24px",
                    textAlign: "center",
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f) setFileFromInput(f);
                  }}
                  onClick={() => fileRef.current?.click()}>
                  <input
                    ref={fileRef} type="file" accept="video/*" className="hidden"
                    onChange={(e) => setFileFromInput(e.target.files?.[0] ?? null)}
                  />
                  {form.file ? (
                    <div>
                      <div className="text-2xl mb-2">🎬</div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {form.file.name}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        {(form.file.size / 1024 / 1024).toFixed(1)} MB — frames will be extracted client-side
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl mb-3">📤</div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        Drop video file here
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        or click to browse · MP4, MOV, WebM
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Post-live: metric inputs */}
        {form.mode === "post-live" && (
          <div>
            <SmallInput
              label="Days live"
              hint="1–3 = early signal, 7+ = scaling assessment"
              value={form.duration}
              onChange={(v) => setF("duration", v)}
              placeholder="e.g. 7"
              type="number"
            />
            <div className="mt-4">
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Enter metrics per platform (leave blank if unavailable)
              </p>
              <div className="flex gap-1 mb-3 p-1 rounded-lg w-fit"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {(["meta", "tiktok", "ig", "youtube"] as PostPlatform[]).map((t) => (
                  <button key={t}
                    onClick={() => setPostTab(t)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all"
                    style={{
                      background: postTab === t ? "#1e1e30" : "transparent",
                      color: postTab === t ? "#a5b4fc" : "var(--text-muted)",
                    }}>
                    {PLATFORMS.find((p) => p.id === t)?.icon} {PLATFORM_LABEL[t]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {POST_METRICS[postTab].map((m) => (
                  <SmallInput
                    key={m.key}
                    label={m.label}
                    hint={m.hint}
                    value={form[postTab][m.key] ?? ""}
                    onChange={(v) => setMetric(postTab, m.key, v)}
                    placeholder="—"
                    unit={m.unit || undefined}
                    type="number"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content type + duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Content Type
            </label>
            <select
              value={form.contentType}
              onChange={(e) => setF("contentType", e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              {CONTENT_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>
          {form.mode === "pre-live" && (
            <SmallInput
              label="Duration (seconds)"
              hint="auto-detected from file"
              value={form.duration}
              onChange={(v) => setF("duration", v)}
              placeholder="e.g. 24"
              type="number"
            />
          )}
          {form.mode === "post-live" && (
            <SmallInput
              label="Store AOV (AUD)"
              hint="for CPA target calc"
              value={form.aov}
              onChange={(v) => setF("aov", v)}
              placeholder="e.g. 80"
              unit="$"
              type="number"
            />
          )}
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            Platforms to audit
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const on = form.platforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                  style={{
                    background: on ? "#6366f120" : "var(--bg-subtle)",
                    border: `1px solid ${on ? "#6366f150" : "var(--border)"}`,
                    color: on ? "#a5b4fc" : "var(--text-muted)",
                  }}>
                  {p.icon} {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* AOV (pre-live) */}
        {form.mode === "pre-live" && (
          <SmallInput
            label="Store AOV (AUD)"
            hint="for CPA target calculations"
            value={form.aov}
            onChange={(v) => setF("aov", v)}
            placeholder="e.g. 80"
            unit="$"
            type="number"
          />
        )}

        {/* Context */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Context
            <span className="ml-1 font-normal" style={{ color: "var(--text-faint)" }}>
              optional — describe hook, pacing, audio, CTA
            </span>
          </label>
          <textarea
            value={form.context}
            onChange={(e) => setF("context", e.target.value)}
            rows={3}
            placeholder="e.g. Opens with creator at a dinner table, UGC-style, trending audio, product shown at 15s, CTA at end…"
            className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Extracting progress */}
        {extracting && extractMsg && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "#a5b4fc" }}>
            <div className="w-3 h-3 rounded-full border-2 animate-spin"
              style={{ borderColor: "#6366f1", borderTopColor: "transparent" }} />
            {extractMsg}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || extracting}
          className="w-full py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white" }}>
          {extracting ? extractMsg || "Preparing…" : "Run Audit →"}
        </button>
      </div>
    </div>
  );
}

// ── Stream view ────────────────────────────────────────────────────────

function StreamView({
  title, text, loading, onDone,
}: {
  title: string; text: string; loading: boolean; onDone: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="w-3 h-3 rounded-full border-2 animate-spin"
              style={{ borderColor: "#6366f1", borderTopColor: "transparent" }} />
          ) : (
            <div className="w-3 h-3 rounded-full" style={{ background: "#10b981" }} />
          )}
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {loading ? `Analysing "${title}"…` : `Audit complete — "${title}"`}
          </span>
        </div>
        {!loading && (
          <button
            onClick={onDone}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg font-medium hover:opacity-80 transition-opacity"
            style={{ background: "#6366f120", color: "#a5b4fc", border: "1px solid #6366f130" }}>
            View in list →
          </button>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-4 py-2.5"
          style={{ background: "#0d0d1a", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full"
              style={{ background: loading ? "#f59e0b" : "#10b981" }} />
            <span className="text-xs font-medium" style={{ color: "#a5b4fc" }}>
              {loading ? "Running…" : "Complete"}
            </span>
          </div>
          {text && (
            <button
              onClick={() => navigator.clipboard.writeText(text)}
              className="text-xs px-2.5 py-1 rounded-md hover:opacity-70 transition-opacity"
              style={{ background: "#1e1e30", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              Copy
            </button>
          )}
        </div>
        <div className="p-4 overflow-x-auto overflow-y-auto" style={{ background: "#0a0a14", maxHeight: "70vh" }}>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono" style={{ color: "#e2e8f0" }}>
            {text}
            {loading && <span className="animate-pulse" style={{ color: "#6366f1" }}>▋</span>}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────

const STORAGE_KEY = "thinkle_content_audits";

function loadLocal(): ContentAudit[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveLocal(audit: ContentAudit) {
  if (typeof window === "undefined") return;
  const existing = loadLocal();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([audit, ...existing]));
}

export default function ContentAuditPanel() {
  const [view, setView] = useState<View>("list");
  const [audits, setAudits] = useState<ContentAudit[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamTitle, setStreamTitle] = useState("");
  const [error, setError] = useState("");
  const pendingMeta = useRef<Omit<ContentAudit, "id" | "created_at" | "report" | "score" | "decision" | "hook_type" | "status"> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load audit history ──────────────────────────────────────────────────
  const loadAudits = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/content-audit/history");
      const data: ContentAudit[] = await res.json();
      if (data.length > 0) {
        setAudits(data);
      } else {
        // DB table not set up yet — fall back to localStorage
        setAudits(loadLocal());
      }
    } catch {
      setAudits(loadLocal());
    }
  }, []);

  useEffect(() => { loadAudits(); }, [loadAudits]);

  // Save completed audit ────────────────────────────────────────────────
  async function saveAudit(report: string) {
    if (!pendingMeta.current) return null;
    const body = { ...pendingMeta.current, report };
    try {
      const res = await fetch("/api/agent/content-audit/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const saved: ContentAudit = await res.json();
      setAudits((prev) => [saved, ...prev]);
      saveLocal(saved); // mirror to localStorage as backup
      return saved.id;
    } catch {
      // Fallback: build local record
      const local: ContentAudit = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...pendingMeta.current,
        report,
        score: null,
        decision: null,
        hook_type: null,
        status: "completed",
        _local: true,
      };
      setAudits((prev) => [local, ...prev]);
      saveLocal(local);
      return local.id;
    }
  }

  // Run audit ───────────────────────────────────────────────────────────
  async function runAudit(
    payload: object,
    meta: Omit<ContentAudit, "id" | "created_at" | "report" | "score" | "decision" | "hook_type" | "status">
  ) {
    abortRef.current?.abort();
    pendingMeta.current = meta;
    setStreamText("");
    setStreamTitle(meta.title);
    setError("");
    setView("running");
    setStreamLoading(true);

    const abort = new AbortController();
    abortRef.current = abort;
    let fullText = "";

    try {
      const res = await fetch("/api/agent/content-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abort.signal,
      });

      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Request failed");
        setStreamLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const p = JSON.parse(part.slice(6));
          if (p.error) { setError(p.error); break; }
          if (p.done) break;
          if (p.text) {
            fullText += p.text;
            setStreamText(fullText);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message ?? "Unknown error");
      }
    } finally {
      setStreamLoading(false);
    }

    if (fullText) await saveAudit(fullText);
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl">
      {/* Panel header — always visible */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Content Audit
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            DTC creative scoring — pre-live quality & post-live performance
          </p>
        </div>
        {view === "list" && (
          <button
            onClick={() => setView("form")}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white" }}>
            <span className="text-base leading-none">+</span> New Audit
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-xs"
          style={{ background: "#ef444420", border: "1px solid #ef444440", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* LIST view */}
      {view === "list" && (
        <div className="rounded-xl overflow-hidden"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {/* Stage legend */}
          <div className="flex items-center gap-3 px-5 py-3"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card-inner)" }}>
            {([
              { d: "green_light", label: "Green Light" },
              { d: "amber",       label: "Amber — Revise" },
              { d: "red",         label: "Red — Rework" },
              { d: "kill",        label: "Kill" },
            ] as { d: Decision; label: string }[]).map(({ d, label }) => {
              const cfg = DECISION_CONFIG[d];
              return (
                <div key={d} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>{label}</span>
                </div>
              );
            })}
            <span className="ml-auto text-xs" style={{ color: "var(--text-faint)" }}>
              {audits.length} audit{audits.length !== 1 ? "s" : ""}
            </span>
          </div>

          {audits.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-4xl mb-4">🎬</div>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                No audits yet
              </p>
              <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
                Upload a video or paste a Drive link to run your first pre-live audit
              </p>
              <button
                onClick={() => setView("form")}
                className="text-sm px-5 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white" }}>
                Run First Audit →
              </button>
            </div>
          ) : (
            audits.map((a) => (
              <AuditRow
                key={a.id}
                audit={a}
                expanded={expandedId === a.id}
                onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
              />
            ))
          )}
        </div>
      )}

      {/* FORM view */}
      {view === "form" && (
        <div className="rounded-xl p-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <UploadForm
            onRun={runAudit}
            onBack={() => setView("list")}
          />
        </div>
      )}

      {/* RUNNING view */}
      {view === "running" && (
        <StreamView
          title={streamTitle}
          text={streamText}
          loading={streamLoading}
          onDone={() => { setView("list"); setExpandedId(null); }}
        />
      )}

      {/* Migration note (shown only when list is empty) */}
      {view === "list" && audits.length === 0 && (
        <div className="mt-4 px-4 py-3 rounded-lg text-xs"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-faint)" }}>
          <span className="font-medium" style={{ color: "var(--text-muted)" }}>DB setup: </span>
          To persist audits across sessions, run{" "}
          <code className="font-mono" style={{ color: "#a5b4fc" }}>
            supabase/migrations/20260603_create_content_audits.sql
          </code>{" "}
          in your{" "}
          <a
            href="https://supabase.com/dashboard/project/pepntsyrvtlpbmnjzorx/sql/new"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#6366f1" }}>
            Supabase SQL editor ↗
          </a>
          . Until then, audits are saved to localStorage.
        </div>
      )}
    </div>
  );
}
