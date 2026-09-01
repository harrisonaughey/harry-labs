"use client";
import { useState, useEffect, useCallback } from "react";
import ContentAuditPanel from "@/components/content/ContentAuditPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type RawPost = {
  id: string; caption: string; mediaType: string; timestamp: string;
  thumbnailUrl: string | null; permalink: string;
  likes: number; comments: number; impressions: number;
  reach: number; saves: number; shares: number; engRate: number;
};

type ScoredPost = RawPost & {
  score:       number;
  tier:        "top" | "avg" | "low";
  reachRatio:  number;
  saveRate:    number;
};

type Recommendation = {
  icon: string; title: string; detail: string; priority: "high" | "med" | "low";
};

type IGResponse = {
  account: { followers: number; mediaCount: number };
  period:  { reach: number; impressions: number; profileViews: number; websiteClicks: number };
  posts:   RawPost[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_NAME: Record<string, string> = {
  REEL:           "Reel",
  IMAGE:          "Post",
  CAROUSEL_ALBUM: "Carousel",
  VIDEO:          "Video",
};

const TYPE_CFG: Record<string, { color: string; bg: string }> = {
  REEL:           { color: "#34d399", bg: "#10b98115" },
  IMAGE:          { color: "#a5b4fc", bg: "#6366f115" },
  CAROUSEL_ALBUM: { color: "#fbbf24", bg: "#fbbf2415" },
  VIDEO:          { color: "#f9a8d4", bg: "#ec489915" },
};

const TIER_CFG = {
  top: { label: "Top",    color: "#10b981", bg: "#10b98115", dot: "#10b981" },
  avg: { label: "Avg",    color: "#fbbf24", bg: "#fbbf2415", dot: "#fbbf24" },
  low: { label: "Low",    color: "#ef4444", bg: "#ef444415", dot: "#ef4444" },
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function relDate(ts: string) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
  if (d === 0) return "today";
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scorePosts(posts: RawPost[]): ScoredPost[] {
  if (!posts.length) return [];

  const avgReach   = posts.reduce((s, p) => s + p.reach,   0) / posts.length;
  const avgSaves   = posts.reduce((s, p) => s + p.saves,   0) / posts.length;
  const avgEngRate = posts.reduce((s, p) => s + p.engRate, 0) / posts.length;

  return posts.map((p) => {
    const reachRatio = avgReach > 0 ? p.reach / avgReach : 0;
    const saveRate   = p.reach  > 0 ? (p.saves / p.reach) * 100 : 0;

    const tier: ScoredPost["tier"] =
      reachRatio >= 1.5 || saveRate >= 2 || p.engRate >= avgEngRate * 1.8
        ? "top"
        : reachRatio <= 0.4 && p.engRate <= avgEngRate * 0.5
        ? "low"
        : "avg";

    const rScore = Math.min(reachRatio * 50, 75);
    const sScore = avgSaves > 0 ? Math.min((p.saves / avgSaves) * 15, 15) : 0;
    const eScore = avgEngRate > 0 ? Math.min((p.engRate / avgEngRate) * 10, 10) : 0;
    const score  = Math.min(Math.round(rScore + sScore + eScore), 100);

    return { ...p, tier, score, reachRatio, saveRate };
  });
}

// ─── Recommendations engine ───────────────────────────────────────────────────

function buildRecommendations(posts: RawPost[], account: IGResponse["account"]): Recommendation[] {
  if (posts.length < 3) return [];
  const recs: Recommendation[] = [];

  // 1 — Format comparison
  const byType: Record<string, RawPost[]> = {};
  for (const p of posts) {
    (byType[p.mediaType] ??= []).push(p);
  }
  const typeStats = Object.entries(byType)
    .filter(([, ps]) => ps.length >= 2)
    .map(([type, ps]) => ({
      type,
      count:       ps.length,
      avgReach:    ps.reduce((s, p) => s + p.reach, 0) / ps.length,
      avgSaveRate: ps.reduce((s, p) => s + (p.reach > 0 ? p.saves / p.reach * 100 : 0), 0) / ps.length,
      avgEng:      ps.reduce((s, p) => s + p.engRate, 0) / ps.length,
    }))
    .sort((a, b) => b.avgReach - a.avgReach);

  if (typeStats.length >= 2) {
    const best  = typeStats[0];
    const worst = typeStats[typeStats.length - 1];
    const mult  = worst.avgReach > 0 ? (best.avgReach / worst.avgReach).toFixed(1) : "?";
    recs.push({
      icon: "📈",
      priority: "high",
      title: `${TYPE_NAME[best.type] ?? best.type}s are reaching ${mult}× more accounts`,
      detail: `Avg reach — ${TYPE_NAME[best.type]}: ${fmt(Math.round(best.avgReach))} vs ${TYPE_NAME[worst.type]}: ${fmt(Math.round(worst.avgReach))}. Shift volume to ${TYPE_NAME[best.type] ?? best.type}s.`,
    });
  }

  // 2 — Save rate signal
  const avgSaveRate = posts.reduce((s, p) => s + (p.reach > 0 ? p.saves / p.reach * 100 : 0), 0) / posts.length;
  const highSavePosts = posts.filter((p) => p.reach > 0 && (p.saves / p.reach) * 100 >= 2);
  if (highSavePosts.length > 0) {
    const savedTypes = [...new Set(highSavePosts.map((p) => TYPE_NAME[p.mediaType] ?? p.mediaType))].join(", ");
    recs.push({
      icon: "🔖",
      priority: "high",
      title: `${highSavePosts.length} post${highSavePosts.length > 1 ? "s" : ""} hit 2%+ save rate — evergreen signal`,
      detail: `Your save rate average is ${avgSaveRate.toFixed(2)}%. High-save posts (${savedTypes}) tell the algorithm your content is worth surfacing again. Create more like these.`,
    });
  } else if (avgSaveRate < 0.5 && posts.length >= 5) {
    recs.push({
      icon: "🔖",
      priority: "med",
      title: `Save rate is below 0.5% — content isn't being bookmarked`,
      detail: `Add genuine value that people want to return to: tutorials, frameworks, tips, or product use cases. Saves are the #1 non-viral growth signal on IG.`,
    });
  }

  // 3 — Top posts: time of day pattern
  const topSlice = Math.ceil(posts.length * 0.3);
  const topPosts = [...posts].sort((a, b) => b.reach - a.reach).slice(0, topSlice);
  const hourCounts: Record<number, number> = {};
  for (const p of topPosts) {
    const h = new Date(p.timestamp).getHours();
    hourCounts[h] = (hourCounts[h] ?? 0) + 1;
  }
  const topHourEntry = Object.entries(hourCounts).sort((a, b) => +b[1] - +a[1])[0];
  if (topHourEntry && +topHourEntry[1] >= 2) {
    const h = parseInt(topHourEntry[0]);
    const label = h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
    recs.push({
      icon: "⏰",
      priority: "med",
      title: `Your top ${topSlice} posts cluster around ${label} AEST`,
      detail: `${topHourEntry[1]} of your best-performing posts were published around this hour. Set this as your default posting window until data says otherwise.`,
    });
  }

  // 4 — Underperforming volume
  const avgReach = posts.reduce((s, p) => s + p.reach, 0) / posts.length;
  const lowPosts = posts.filter((p) => p.reach < avgReach * 0.4);
  if (lowPosts.length >= 3) {
    recs.push({
      icon: "⚡",
      priority: "med",
      title: `${lowPosts.length} posts are getting under 40% of your average reach`,
      detail: `Check for patterns: are these the same format, topic, or hook style? Low-reach content may have a weak first frame, poor caption hook, or wrong posting time.`,
    });
  }

  // 5 — Best save-rate format
  if (typeStats.length >= 2) {
    const bestSaver = [...typeStats].sort((a, b) => b.avgSaveRate - a.avgSaveRate)[0];
    if (bestSaver.avgSaveRate >= 1) {
      recs.push({
        icon: "💾",
        priority: "low",
        title: `${TYPE_NAME[bestSaver.type] ?? bestSaver.type}s have the highest save rate (${bestSaver.avgSaveRate.toFixed(1)}%)`,
        detail: `People are bookmarking this format to revisit. Lean into it for educational or how-to content — saves compound into reach over time.`,
      });
    }
  }

  // 6 — Follower to reach ratio check
  if (account.followers > 0 && avgReach > 0) {
    const ratio = avgReach / account.followers * 100;
    if (ratio < 10) {
      recs.push({
        icon: "👥",
        priority: "low",
        title: `Average post only reaching ${ratio.toFixed(0)}% of your followers`,
        detail: `An engaged account typically reaches 10–20%+ of followers per post. Improve saves and shares — these are the primary signals that unlock algorithmic reach to non-followers.`,
      });
    } else if (ratio > 50) {
      recs.push({
        icon: "🚀",
        priority: "low",
        title: `Reaching ${ratio.toFixed(0)}% of followers — strong algorithmic distribution`,
        detail: `Your content is getting pushed beyond your current audience. Maintain consistency and hook quality to keep this up.`,
      });
    }
  }

  return recs;
}

// ─── Recommendations strip ────────────────────────────────────────────────────

const PRIORITY_COLOR = { high: "#6366f1", med: "#fbbf24", low: "var(--text-faint)" };

function RecommendationsPanel({ recs, postCount }: { recs: Recommendation[]; postCount: number }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!recs.length) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-base">💡</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recommendations</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Derived from your last {postCount} posts</p>
        </div>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: "#6366f118", color: "#a5b4fc" }}>
          {recs.length} insight{recs.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        {recs.map((r, i) => (
          <div key={i}>
            <button
              className="w-full px-5 py-3.5 flex items-start gap-3 text-left hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpanded(expanded === i ? null : i)}>
              <span className="text-base flex-shrink-0 mt-0.5">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{r.title}</p>
                {expanded === i && (
                  <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{r.detail}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_COLOR[r.priority] }} />
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {expanded === i ? "▲" : "▼"}
                </span>
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Post row ─────────────────────────────────────────────────────────────────

function PostRow({ post, avgReach }: { post: ScoredPost; avgReach: number }) {
  const tier    = TIER_CFG[post.tier];
  const typeCfg = TYPE_CFG[post.mediaType] ?? { color: "var(--text-faint)", bg: "var(--bg-subtle)" };
  const barW    = avgReach > 0 ? Math.min((post.reach / avgReach) * 50, 100) : 0;

  return (
    <tr className="hover:bg-white/[0.02] transition-colors" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      {/* Thumbnail */}
      <td className="px-4 py-3 w-12">
        {post.thumbnailUrl
          ? <img src={post.thumbnailUrl} alt="" className="w-9 h-9 rounded-lg object-cover"
              style={{ border: "1px solid var(--border)" }} />
          : <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--bg-card-inner)", border: "1px solid var(--border)", color: "var(--text-faint)", fontSize: 14 }}>📷</div>
        }
      </td>

      {/* Caption */}
      <td className="px-4 py-3" style={{ maxWidth: 220 }}>
        <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)", maxWidth: 220 }}
          title={post.caption}>
          {post.caption || <span style={{ color: "var(--text-faint)" }}>No caption</span>}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{relDate(post.timestamp)}</p>
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
          style={{ background: typeCfg.bg, color: typeCfg.color }}>
          {TYPE_NAME[post.mediaType] ?? post.mediaType}
        </span>
      </td>

      {/* Score */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: tier.color }}>{post.score}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: tier.bg, color: tier.color }}>
            {tier.label}
          </span>
        </div>
      </td>

      {/* Reach bar */}
      <td className="px-4 py-3" style={{ minWidth: 120 }}>
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
            {fmt(post.reach)}
          </p>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)", minWidth: 40 }}>
            <div className="h-full rounded-full" style={{ width: `${barW}%`, background: typeCfg.color }} />
          </div>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
          {post.reachRatio > 0 ? `${post.reachRatio >= 1 ? "+" : ""}${((post.reachRatio - 1) * 100).toFixed(0)}% vs avg` : "—"}
        </p>
      </td>

      {/* Save rate */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-xs font-medium"
          style={{ color: post.saveRate >= 2 ? "#fbbf24" : post.saveRate > 0 ? "var(--text-secondary)" : "var(--text-faint)" }}>
          {post.saveRate > 0 ? `${post.saveRate.toFixed(2)}%` : "—"}
        </p>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>{fmt(post.saves)} saves</p>
      </td>

      {/* Eng % */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-xs font-medium"
          style={{ color: post.engRate >= 3 ? "#10b981" : post.engRate > 0 ? "var(--text-secondary)" : "var(--text-faint)" }}>
          {post.engRate > 0 ? `${post.engRate.toFixed(1)}%` : "—"}
        </p>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>{fmt(post.likes + post.comments)} engaged</p>
      </td>

      {/* Link */}
      <td className="px-4 py-3">
        <a href={post.permalink} target="_blank" rel="noopener noreferrer"
          className="text-xs hover:opacity-70 transition-opacity" style={{ color: "#6366f1" }}>↗</a>
      </td>
    </tr>
  );
}

// ─── Account stats strip ──────────────────────────────────────────────────────

function StatsStrip({ ig }: { ig: IGResponse }) {
  const { period } = ig;
  const topPost = [...ig.posts].sort((a, b) => b.reach - a.reach)[0];
  const avgReach = ig.posts.length ? ig.posts.reduce((s, p) => s + p.reach, 0) / ig.posts.length : 0;
  const avgSave  = ig.posts.length ? ig.posts.reduce((s, p) => s + (p.reach > 0 ? p.saves / p.reach * 100 : 0), 0) / ig.posts.length : 0;

  return (
    <div className="grid grid-cols-4 gap-4">
      {[
        { label: "28d Reach",     value: fmt(period.reach),        sub: "unique accounts" },
        { label: "Avg Post Reach",value: fmt(Math.round(avgReach)),sub: `${ig.posts.length} posts analysed` },
        { label: "Avg Save Rate", value: `${avgSave.toFixed(2)}%`, sub: "saves ÷ reach" },
        { label: "Best Post",     value: topPost ? fmt(topPost.reach) : "—", sub: topPost ? `${TYPE_NAME[topPost.mediaType] ?? topPost.mediaType} · ${relDate(topPost.timestamp)}` : "—" },
      ].map((s) => (
        <div key={s.label} className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>{s.label}</p>
          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Setup card ───────────────────────────────────────────────────────────────

function SetupCard({ reason }: { reason: string }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="text-4xl mb-4">📸</div>
      <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Instagram not connected</p>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{reason}</p>
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        Connect Instagram in the Instagram tab to enable live performance auditing.
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

type Mode = "live" | "prelive";

export default function LiveAuditView() {
  const [mode,    setMode]    = useState<Mode>("live");
  const [data,    setData]    = useState<IGResponse | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort,    setSort]    = useState<"score" | "reach" | "saves" | "date">("score");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/instagram/insights");
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to load"); return; }
      setData(json);
    } catch { setError("Network error"); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-6 h-6 rounded-full border-2 animate-spin mb-3"
          style={{ borderColor: "#6366f1", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Analysing your posts…</p>
      </div>
    );
  }

  const header = (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {mode === "live" ? "Live Performance Audit" : "Pre-Publish Audit"}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {mode === "live"
            ? "Real performance scoring for every published post · ranked vs your account averages"
            : "Score content before publishing · Green Light / Amber / Rework"}
        </p>
      </div>
      <button
        onClick={() => setMode(mode === "live" ? "prelive" : "live")}
        className="text-xs px-3 py-1.5 rounded-lg font-medium hover:opacity-80 transition-opacity"
        style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
        {mode === "live" ? "🎬 Pre-Publish Check" : "📊 Live Performance"}
      </button>
    </div>
  );

  if (mode === "prelive") {
    return (
      <>
        {header}
        <ContentAuditPanel />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <SetupCard reason={error ?? "No data available"} />
      </>
    );
  }

  const scored = scorePosts(data.posts);
  const recs   = buildRecommendations(data.posts, data.account);
  const avgReach = data.posts.length
    ? data.posts.reduce((s, p) => s + p.reach, 0) / data.posts.length
    : 0;

  const sorted = [...scored].sort((a, b) => {
    if (sort === "score") return b.score - a.score;
    if (sort === "reach") return b.reach - a.reach;
    if (sort === "saves") return b.saveRate - a.saveRate;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const counts = {
    top: scored.filter((p) => p.tier === "top").length,
    avg: scored.filter((p) => p.tier === "avg").length,
    low: scored.filter((p) => p.tier === "low").length,
  };

  function SortBtn({ k, label }: { k: typeof sort; label: string }) {
    return (
      <button onClick={() => setSort(k)}
        className="text-xs px-3 py-1 rounded-md font-medium transition-all"
        style={{
          background: sort === k ? "#6366f120" : "transparent",
          color:      sort === k ? "#a5b4fc"   : "var(--text-faint)",
        }}>
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* Stats strip */}
      <StatsStrip ig={data} />

      {/* Tier summary */}
      <div className="flex items-center gap-4 px-5 py-3 rounded-xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {(["top", "avg", "low"] as const).map((t) => {
          const cfg = TIER_CFG[t];
          return (
            <div key={t} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
              <span className="text-xs font-medium" style={{ color: cfg.color }}>{counts[t]} {cfg.label}</span>
            </div>
          );
        })}
        <span className="ml-auto text-xs" style={{ color: "var(--text-faint)" }}>
          {scored.length} posts scored · last 30
        </span>
      </div>

      {/* Recommendations */}
      <RecommendationsPanel recs={recs} postCount={data.posts.length} />

      {/* Post table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>All Posts</p>
          <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
            <SortBtn k="score" label="Score" />
            <SortBtn k="reach" label="Reach" />
            <SortBtn k="saves" label="Save %" />
            <SortBtn k="date"  label="Date"  />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["", "Post", "Type", "Score", "Reach", "Save Rate", "Eng %", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-medium uppercase tracking-wider"
                    style={{ color: "var(--text-faint)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <PostRow key={p.id} post={p} avgReach={avgReach} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
