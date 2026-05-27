"use client";
import { useState } from "react";
import MetaAdsView from "@/components/traffic/MetaAdsView";
import ConnectCard from "@/components/traffic/ConnectCard";

type Props = { metaConnected: boolean };

const TABS = [
  { id: "meta",    label: "Meta Ads",      icon: "📘" },
  { id: "ig",      label: "Instagram",     icon: "📸" },
  { id: "tiktok",  label: "TikTok Ads",    icon: "🎵" },
  { id: "youtube", label: "YouTube",       icon: "▶️" },
  { id: "organic", label: "Organic Social",icon: "🌱" },
];

type OrganicPost = { platform: string; date: string; reach: string; engagement: string; link: string };

function YouTubeView() {
  return (
    <div className="flex items-start justify-center pt-8">
      <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "#FF000020", border: "1px solid #FF000040" }}>▶️</div>
          <div>
            <h2 className="text-base font-semibold text-white">YouTube Analytics</h2>
            <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>Views · Watch time · Subscribers · Revenue</p>
          </div>
        </div>
        <div className="space-y-2 mb-6">
          <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "#4b5563" }}>Required</p>
          {[
            { key: "YOUTUBE_API_KEY",       hint: "YouTube Data API v3 key (Google Cloud Console)" },
            { key: "GA4_MEASUREMENT_ID",    hint: "GA4 Property ID (e.g. G-XXXXXXXXXX)" },
            { key: "GA4_SERVICE_ACCOUNT",   hint: "GA4 service account JSON (base64 encoded)" },
          ].map((v) => (
            <div key={v.key} className="flex items-center justify-between px-4 py-3 rounded-lg"
              style={{ background: "#0d0d14", border: "1px solid #1e1e2e" }}>
              <span className="text-xs" style={{ color: "#6b7280" }}>{v.hint}</span>
              <span className="text-xs font-mono font-medium" style={{ color: "#a5b4fc" }}>{v.key}</span>
            </div>
          ))}
        </div>
        <p className="text-xs mb-5" style={{ color: "#4b5563" }}>Add these to Vercel environment variables, then redeploy.</p>
        <div className="flex gap-3">
          <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer"
            className="flex-1 text-sm py-2.5 px-4 rounded-lg font-medium text-center hover:opacity-80 transition-opacity"
            style={{ background: "#FF000020", color: "#FF5555", border: "1px solid #FF000040" }}>
            Google Cloud Console →
          </a>
          <a href="https://developers.google.com/youtube/v3" target="_blank" rel="noopener noreferrer"
            className="flex-1 text-sm py-2.5 px-4 rounded-lg text-center hover:opacity-80 transition-opacity"
            style={{ background: "#1a1a24", color: "#9ca3af", border: "1px solid #2a2a3a" }}>
            API Docs →
          </a>
        </div>
      </div>
    </div>
  );
}

function OrganicView() {
  const [posts, setPosts] = useState<OrganicPost[]>([]);
  const [form, setForm] = useState<OrganicPost>({ platform: "Instagram", date: "", reach: "", engagement: "", link: "" });

  function addPost() {
    if (!form.date || !form.platform) return;
    setPosts((p) => [form, ...p]);
    setForm({ platform: "Instagram", date: "", reach: "", engagement: "", link: "" });
  }

  const PLATFORMS = ["Instagram", "TikTok", "Facebook", "YouTube", "Twitter/X", "LinkedIn", "Pinterest"];

  return (
    <div>
      <div className="rounded-xl p-5 mb-6" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <h2 className="text-sm font-semibold text-white mb-4">Log Organic Post</h2>
        <div className="grid grid-cols-5 gap-3">
          <select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
            className="text-sm px-3 py-2 rounded-lg outline-none text-white"
            style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }}>
            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="text-sm px-3 py-2 rounded-lg outline-none text-white"
            style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }} />
          <input placeholder="Reach" value={form.reach} onChange={(e) => setForm((f) => ({ ...f, reach: e.target.value }))}
            className="text-sm px-3 py-2 rounded-lg outline-none text-white"
            style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }} />
          <input placeholder="Engagement" value={form.engagement} onChange={(e) => setForm((f) => ({ ...f, engagement: e.target.value }))}
            className="text-sm px-3 py-2 rounded-lg outline-none text-white"
            style={{ background: "#1a1a24", border: "1px solid #2a2a3a" }} />
          <button onClick={addPost}
            className="text-sm py-2 rounded-lg font-medium hover:opacity-80 transition-opacity"
            style={{ background: "#6366f1", color: "white" }}>
            + Add
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #1e1e2e" }}>
          <h2 className="text-sm font-semibold text-white">Post Log</h2>
          <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>Manual tracking across all organic channels</p>
        </div>
        {posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: "#4b5563" }}>No posts logged yet</p>
            <p className="text-xs mt-1" style={{ color: "#374151" }}>Use the form above to track organic post performance</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "#4b5563" }}>
                {["Platform", "Date", "Reach", "Engagement", "Link"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((p, i) => (
                <tr key={i} className="hover:bg-white/[0.02]" style={{ borderTop: "1px solid #1a1a24" }}>
                  <td className="px-4 py-3"><span className="text-white font-medium">{p.platform}</span></td>
                  <td className="px-4 py-3" style={{ color: "#9ca3af" }}>{p.date}</td>
                  <td className="px-4 py-3" style={{ color: "#9ca3af" }}>{p.reach || "—"}</td>
                  <td className="px-4 py-3" style={{ color: "#9ca3af" }}>{p.engagement || "—"}</td>
                  <td className="px-4 py-3">
                    {p.link ? <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1" }}>↗</a> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function ContentDashboard({ metaConnected }: Props) {
  const [tab, setTab] = useState("meta");

  return (
    <>
      <div className="flex items-center gap-1 mb-6 p-1 rounded-lg w-fit"
        style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        {TABS.map((t) => {
          const connected = (t.id === "meta" || t.id === "ig") ? metaConnected : false;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-md font-medium transition-all"
              style={{
                background: tab === t.id ? "#1e1e30" : "transparent",
                color:      tab === t.id ? "#a5b4fc" : "#6b7280",
              }}>
              <span>{t.icon}</span> {t.label}
              {(t.id === "meta" || t.id === "ig") && (
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: connected ? "#10b98120" : "#6b728020", color: connected ? "#10b981" : "#6b7280" }}>
                  {connected ? "live" : "connect"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "meta"    && <MetaAdsView connected={metaConnected} />}
      {tab === "ig"      && (metaConnected ? <MetaAdsView connected={true} /> : <ConnectCard platform="meta" />)}
      {tab === "tiktok"  && <ConnectCard platform="tiktok" />}
      {tab === "youtube" && <YouTubeView />}
      {tab === "organic" && <OrganicView />}
    </>
  );
}
