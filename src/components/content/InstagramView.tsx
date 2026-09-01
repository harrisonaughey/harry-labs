"use client";
import { useState, useEffect, useCallback } from "react";

type Post = {
  id: string;
  caption: string;
  mediaType: string;
  timestamp: string;
  thumbnailUrl: string | null;
  permalink: string;
  likes: number;
  comments: number;
  impressions: number;
  reach: number;
  saves: number;
  shares: number;
  engRate: number;
};

type IGData = {
  account: {
    id: string; name: string; username: string;
    followers: number; following: number; mediaCount: number;
    biography: string; website: string;
  };
  period: {
    days: number;
    impressions: number; reach: number;
    profileViews: number; websiteClicks: number;
    reachSeries: { date: string; value: number }[];
  };
  posts: Post[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function relDate(ts: string) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const TYPE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  IMAGE:          { label: "Post",      color: "#a5b4fc", bg: "#6366f115" },
  VIDEO:          { label: "Video",     color: "#f9a8d4", bg: "#ec489915" },
  CAROUSEL_ALBUM: { label: "Carousel",  color: "#fbbf24", bg: "#fbbf2415" },
  REEL:           { label: "Reel",      color: "#34d399", bg: "#10b98115" },
};

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_LABEL[type] ?? { label: type, color: "var(--text-faint)", bg: "var(--bg-subtle)" };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

// ─── Setup Card ───────────────────────────────────────────────────────────────

function SetupCard({ reason }: { reason: string }) {
  return (
    <div className="flex items-start justify-center pt-6">
      <div className="w-full max-w-xl rounded-2xl p-8" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "#E1306C15", border: "1px solid #E1306C30" }}>📸</div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Connect Instagram</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Real-time organic insights from your IG Business account</p>
          </div>
        </div>

        <div className="rounded-lg px-4 py-3 mb-5 text-xs" style={{ background: "#ef444410", border: "1px solid #ef444430", color: "#f87171" }}>
          {reason}
        </div>

        <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>To fix this</p>
        <div className="space-y-2 mb-6">
          {[
            { step: "1", text: "Ensure your Meta Access Token has instagram_basic + instagram_manage_insights permissions" },
            { step: "2", text: "Your Facebook Page must have an Instagram Business or Creator account linked in Meta Business Suite" },
            { step: "3", text: "Optionally add INSTAGRAM_BUSINESS_ACCOUNT_ID to Vercel env vars to skip auto-discovery" },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}>
              <span className="text-xs font-bold w-4 text-center flex-shrink-0 mt-0.5"
                style={{ color: "#6366f1" }}>{s.step}</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.text}</span>
            </div>
          ))}
        </div>

        <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer"
          className="block w-full text-center text-sm py-2.5 px-4 rounded-lg font-medium hover:opacity-80 transition-opacity"
          style={{ background: "#E1306C20", color: "#E1306C", border: "1px solid #E1306C40" }}>
          Meta Graph API Explorer →
        </a>
      </div>
    </div>
  );
}

// ─── Format Breakdown ─────────────────────────────────────────────────────────

function FormatBreakdown({ posts }: { posts: Post[] }) {
  const types = ["REEL", "CAROUSEL_ALBUM", "IMAGE", "VIDEO"];
  const rows = types.map((type) => {
    const group = posts.filter((p) => p.mediaType === type);
    if (group.length === 0) return null;
    const avgReach  = Math.round(group.reduce((s, p) => s + p.reach, 0) / group.length);
    const avgSaves  = Math.round(group.reduce((s, p) => s + p.saves, 0) / group.length);
    const avgEng    = group.reduce((s, p) => s + p.engRate, 0) / group.length;
    return { type, count: group.length, avgReach, avgSaves, avgEng };
  }).filter(Boolean) as { type: string; count: number; avgReach: number; avgSaves: number; avgEng: number }[];

  if (rows.length === 0) return null;

  const maxReach = Math.max(...rows.map((r) => r.avgReach), 1);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Format Performance</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Averages per post type</p>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        {rows.map((row) => {
          const cfg = TYPE_LABEL[row.type] ?? { label: row.type, color: "var(--text-faint)", bg: "var(--bg-subtle)" };
          const barW = Math.round((row.avgReach / maxReach) * 100);
          return (
            <div key={row.type} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <TypeBadge type={row.type} />
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>{row.count} post{row.count !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(row.avgReach)}</p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>avg reach</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(row.avgSaves)}</p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>avg saves</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: row.avgEng >= 3 ? "#10b981" : "var(--text-primary)" }}>{row.avgEng.toFixed(1)}%</p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>eng rate</p>
                  </div>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${barW}%`, background: cfg.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Posts Table ──────────────────────────────────────────────────────────────

type SortKey = "reach" | "saves" | "engRate" | "likes";

function PostsTable({ posts }: { posts: Post[] }) {
  const [sort, setSort] = useState<SortKey>("reach");

  const sorted = [...posts].sort((a, b) => b[sort] - a[sort]);

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    return (
      <button onClick={() => setSort(k)}
        className="text-xs px-3 py-1 rounded-md font-medium transition-all"
        style={{
          background: sort === k ? "#6366f120" : "transparent",
          color:      sort === k ? "#a5b4fc" : "var(--text-faint)",
        }}>
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Posts</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Last 30 posts · sorted by</p>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
          <SortBtn k="reach"   label="Reach" />
          <SortBtn k="saves"   label="Saves" />
          <SortBtn k="engRate" label="Eng %" />
          <SortBtn k="likes"   label="Likes" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["", "Post", "Type", "Date", "Reach", "Saves", "Eng %", "Likes", "Comments", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02] transition-colors"
                style={{ borderTop: "1px solid var(--border-subtle)" }}>
                {/* Thumbnail */}
                <td className="px-4 py-3 w-12">
                  {p.thumbnailUrl
                    ? <img src={p.thumbnailUrl} alt="" className="w-9 h-9 rounded-lg object-cover"
                        style={{ border: "1px solid var(--border)" }} />
                    : <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm"
                        style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)" }}>📷</div>
                  }
                </td>
                {/* Caption */}
                <td className="px-4 py-3 max-w-xs">
                  <p className="truncate font-medium" style={{ color: "var(--text-primary)", maxWidth: 240 }}
                    title={p.caption}>
                    {p.caption || <span style={{ color: "var(--text-faint)" }}>No caption</span>}
                  </p>
                </td>
                <td className="px-4 py-3"><TypeBadge type={p.mediaType} /></td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{relDate(p.timestamp)}</td>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{fmt(p.reach)}</td>
                <td className="px-4 py-3" style={{ color: p.saves > 0 ? "#fbbf24" : "var(--text-muted)" }}>
                  {fmt(p.saves)}
                </td>
                <td className="px-4 py-3" style={{ color: p.engRate >= 3 ? "#10b981" : p.engRate > 0 ? "var(--text-secondary)" : "var(--text-faint)" }}>
                  {p.engRate > 0 ? `${p.engRate.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmt(p.likes)}</td>
                <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmt(p.comments)}</td>
                <td className="px-4 py-3">
                  <a href={p.permalink} target="_blank" rel="noopener noreferrer"
                    className="text-xs hover:opacity-70 transition-opacity"
                    style={{ color: "#6366f1" }}>↗</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function InstagramView() {
  const [data,    setData]    = useState<IGData | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [setup,   setSetup]   = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/instagram/insights");
      const json = await res.json();
      if (!res.ok) {
        if (json.setup) { setSetup(true); setError(json.error); }
        else setError(json.error ?? "Failed to load Instagram data");
        return;
      }
      setData(json);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mb-3"
          style={{ borderColor: "#6366f1", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Loading Instagram insights…</p>
      </div>
    );
  }

  if (setup || (error && !data)) {
    return <SetupCard reason={error ?? "Instagram not connected"} />;
  }

  if (!data) return null;

  const { account, period, posts } = data;
  const topPost = [...posts].sort((a, b) => b.reach - a.reach)[0];

  return (
    <div className="space-y-6">
      {/* Account header */}
      <div className="rounded-xl p-5 flex items-center gap-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: "#E1306C15", border: "1px solid #E1306C30" }}>📸</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{account.name}</p>
            {account.username && (
              <span className="text-sm" style={{ color: "var(--text-faint)" }}>@{account.username}</span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#10b98118", color: "#10b981" }}>live</span>
          </div>
          {account.biography && (
            <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--text-muted)" }}>{account.biography}</p>
          )}
        </div>
        <div className="flex items-center gap-8 flex-shrink-0">
          {[
            { label: "Followers",  value: fmt(account.followers)  },
            { label: "Following",  value: fmt(account.following)  },
            { label: "Posts",      value: fmt(account.mediaCount) },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 28d KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPI label={`Reach (${period.days}d)`}         value={fmt(period.reach)}         sub="unique accounts" />
        <KPI label={`Impressions (${period.days}d)`}   value={fmt(period.impressions)}   sub="total views" />
        <KPI label={`Profile Views (${period.days}d)`} value={fmt(period.profileViews)}  sub="bio visits" />
        <KPI label="Website Clicks"                    value={fmt(period.websiteClicks)} sub={`last ${period.days}d`} />
      </div>

      {/* Top post callout */}
      {topPost && (
        <div className="rounded-xl p-4 flex items-center gap-4"
          style={{ background: "var(--bg-card)", border: "1px solid #6366f128" }}>
          <span className="text-lg flex-shrink-0">🏆</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold mb-0.5" style={{ color: "#a5b4fc" }}>Top Performing Post</p>
            <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
              {topPost.caption || "No caption"}</p>
          </div>
          <div className="flex items-center gap-6 flex-shrink-0 text-right">
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{fmt(topPost.reach)}</p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>reach</p>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#fbbf24" }}>{fmt(topPost.saves)}</p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>saves</p>
            </div>
            <TypeBadge type={topPost.mediaType} />
            <a href={topPost.permalink} target="_blank" rel="noopener noreferrer"
              className="text-sm hover:opacity-70 transition-opacity" style={{ color: "#6366f1" }}>↗</a>
          </div>
        </div>
      )}

      {/* Format breakdown */}
      <FormatBreakdown posts={posts} />

      {/* Posts table */}
      {posts.length > 0 && <PostsTable posts={posts} />}
    </div>
  );
}
