import { NextRequest, NextResponse } from "next/server";

const META_BASE = "https://graph.facebook.com/v19.0";

async function igGet(path: string, params: Record<string, string>, token: string) {
  const qs  = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${META_BASE}${path}?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `IG API ${res.status}`);
  return data;
}

function sumValues(settled: PromiseSettledResult<any>): number {
  if (settled.status === "rejected") return 0;
  return (settled.value?.data?.[0]?.values ?? []).reduce((s: number, v: any) => s + (v.value ?? 0), 0);
}

function toSeries(settled: PromiseSettledResult<any>): { date: string; value: number }[] {
  if (settled.status === "rejected") return [];
  return (settled.value?.data?.[0]?.values ?? []).map((v: any) => ({
    date:  v.end_time?.split("T")[0] ?? "",
    value: v.value ?? 0,
  }));
}

export async function GET(req: NextRequest) {
  const token = process.env.META_ACCESS_TOKEN ?? "";
  if (!token) {
    return NextResponse.json({ error: "Meta access token not configured" }, { status: 400 });
  }

  // Discover IG Business Account ID (env var takes priority, then auto-discover)
  let igId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? "";

  if (!igId) {
    try {
      const pages = await igGet("/me/accounts", {
        fields: "instagram_business_account{id,username}",
        limit:  "10",
      }, token);
      const page = (pages.data ?? []).find((p: any) => p.instagram_business_account);
      if (!page) {
        return NextResponse.json({ error: "no_ig_account", setup: true }, { status: 400 });
      }
      igId = page.instagram_business_account.id;
    } catch {
      return NextResponse.json({ error: "permission_denied", setup: true }, { status: 400 });
    }
  }

  const now      = Math.floor(Date.now() / 1000);
  const days     = 28;
  const sinceTs  = now - days * 86400;
  const sinceStr = String(sinceTs);
  const untilStr = String(now);

  try {
    const [account, impRes, reachRes, pvRes, wcRes, mediaRes] = await Promise.allSettled([
      igGet(`/${igId}`, {
        fields: "followers_count,follows_count,media_count,name,username,biography,website",
      }, token),
      igGet(`/${igId}/insights`, { metric: "impressions",    period: "day", since: sinceStr, until: untilStr }, token),
      igGet(`/${igId}/insights`, { metric: "reach",          period: "day", since: sinceStr, until: untilStr }, token),
      igGet(`/${igId}/insights`, { metric: "profile_views",  period: "day", since: sinceStr, until: untilStr }, token),
      igGet(`/${igId}/insights`, { metric: "website_clicks", period: "day", since: sinceStr, until: untilStr }, token),
      igGet(`/${igId}/media`, {
        fields: [
          "id,caption,media_type,timestamp,thumbnail_url,media_url",
          "like_count,comments_count,permalink",
          "insights.metric(impressions,reach,saved,shares)",
        ].join(","),
        limit: "30",
      }, token),
    ]);

    if (account.status === "rejected") {
      throw new Error(account.reason?.message ?? "Failed to fetch account");
    }

    const acc = account.value;

    const posts = ((mediaRes.status === "fulfilled" ? mediaRes.value?.data : null) ?? []).map((m: any) => {
      const ins: Record<string, number> = {};
      for (const i of m.insights?.data ?? []) {
        ins[i.name] = i.values?.[0]?.value ?? 0;
      }
      const reach        = ins.reach ?? 0;
      const totalEngaged = (m.like_count ?? 0) + (m.comments_count ?? 0) + (ins.saved ?? 0) + (ins.shares ?? 0);
      return {
        id:           m.id,
        caption:      (m.caption ?? "").slice(0, 140),
        mediaType:    m.media_type as string,
        timestamp:    m.timestamp as string,
        thumbnailUrl: (m.thumbnail_url ?? m.media_url ?? null) as string | null,
        permalink:    m.permalink as string,
        likes:        m.like_count  ?? 0,
        comments:     m.comments_count ?? 0,
        impressions:  ins.impressions ?? 0,
        reach,
        saves:        ins.saved  ?? 0,
        shares:       ins.shares ?? 0,
        engRate:      reach > 0 ? (totalEngaged / reach) * 100 : 0,
      };
    });

    return NextResponse.json({
      account: {
        id:         igId,
        name:       acc.name       ?? "",
        username:   acc.username   ?? "",
        followers:  acc.followers_count ?? 0,
        following:  acc.follows_count   ?? 0,
        mediaCount: acc.media_count     ?? 0,
        biography:  acc.biography ?? "",
        website:    acc.website   ?? "",
      },
      period: {
        days,
        impressions:       sumValues(impRes),
        reach:             sumValues(reachRes),
        profileViews:      sumValues(pvRes),
        websiteClicks:     sumValues(wcRes),
        reachSeries:       toSeries(reachRes),
        impressionsSeries: toSeries(impRes),
      },
      posts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "IG API error" }, { status: 500 });
  }
}
