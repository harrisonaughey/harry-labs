"use client";
import { useState, useEffect } from "react";

type MCData = { name: string; pageId: string; subscribers: number };

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Setup Card ───────────────────────────────────────────────────────────────

function SetupCard() {
  return (
    <div className="flex items-start justify-center pt-6">
      <div className="w-full max-w-xl rounded-2xl p-8" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "#00B9EB15", border: "1px solid #00B9EB30" }}>💬</div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Connect ManyChat</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Subscriber count and DM funnel performance for your IG automation
            </p>
          </div>
        </div>

        <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Setup</p>
        <div className="space-y-2 mb-6">
          {[
            { step: "1", text: "Go to ManyChat → Settings → API → Generate API Key" },
            { step: "2", text: "Add MANYCHAT_API_KEY to your Vercel environment variables" },
            { step: "3", text: "Redeploy — subscriber count will appear here automatically" },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}>
              <span className="text-xs font-bold w-4 text-center flex-shrink-0 mt-0.5"
                style={{ color: "#6366f1" }}>{s.step}</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.text}</span>
            </div>
          ))}
        </div>

        {/* Preview of what it shows */}
        <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>
          What you'll see
        </p>
        <div className="grid grid-cols-2 gap-3 mb-6 opacity-40 pointer-events-none select-none">
          {[
            { label: "Active Subscribers", value: "—" },
            { label: "New This Month",     value: "—" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl p-4"
              style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>{k.label}</p>
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{k.value}</p>
            </div>
          ))}
        </div>

        <a href="https://manychat.com/settings/api" target="_blank" rel="noopener noreferrer"
          className="block w-full text-center text-sm py-2.5 px-4 rounded-lg font-medium hover:opacity-80 transition-opacity"
          style={{ background: "#00B9EB20", color: "#00B9EB", border: "1px solid #00B9EB40" }}>
          ManyChat API Settings →
        </a>
      </div>
    </div>
  );
}

// ─── Connected View ───────────────────────────────────────────────────────────

function ConnectedView({ data }: { data: MCData }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl p-5 flex items-center gap-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: "#00B9EB15", border: "1px solid #00B9EB30" }}>💬</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{data.name}</p>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#10b98118", color: "#10b981" }}>live</span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>ManyChat · Instagram DM Automation</p>
        </div>
        <div className="text-center flex-shrink-0">
          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{fmt(data.subscribers)}</p>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Active Subscribers</p>
        </div>
      </div>

      {/* What's coming */}
      <div className="rounded-xl p-6" style={{ background: "var(--bg-card)", border: "1px solid #6366f120" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#a5b4fc" }}>
          🚧 Flow Analytics — Coming Soon
        </p>
        <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
          ManyChat's public API currently exposes subscriber counts but not flow-level analytics.
          When they ship analytics endpoints, this section will show:
        </p>
        <div className="grid grid-cols-3 gap-3 opacity-50 pointer-events-none select-none">
          {[
            { label: "Top Flows",        icon: "⚡", desc: "Ranked by subscriber volume and conversion" },
            { label: "Keyword Triggers", icon: "🗝", desc: "Which keywords are driving the most DMs" },
            { label: "DM Revenue",       icon: "💰", desc: "Purchases attributed to ManyChat flows" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg p-4"
              style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}>
              <div className="text-xl mb-2">{c.icon}</div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{c.label}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function ManyChatView() {
  const [data,    setData]    = useState<MCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notCfg,  setNotCfg]  = useState(false);

  useEffect(() => {
    fetch("/api/manychat/stats")
      .then((r) => r.json())
      .then((json) => {
        if (json.error === "not_configured") { setNotCfg(true); return; }
        if (json.subscribers !== undefined)  { setData(json); return; }
        setNotCfg(true);
      })
      .catch(() => setNotCfg(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-6 h-6 rounded-full border-2 animate-spin mb-3"
          style={{ borderColor: "#6366f1", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Connecting to ManyChat…</p>
      </div>
    );
  }

  if (notCfg || !data) return <SetupCard />;
  return <ConnectedView data={data} />;
}
