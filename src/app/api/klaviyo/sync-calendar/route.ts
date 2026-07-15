import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const REVISION    = "2024-10-15";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function klaviyoHeaders() {
  return {
    Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`,
    revision: REVISION,
    Accept: "application/json",
  };
}

type KlaviyoCampaign = {
  id: string;
  attributes: { name: string; status: string; scheduled_at: string | null };
};

async function fetchAllKlaviyoCampaigns(): Promise<KlaviyoCampaign[]> {
  const results: KlaviyoCampaign[] = [];
  let url: string | null =
    `${KLAVIYO_BASE}/campaigns/?filter=equals(messages.channel,'email')` +
    `&fields[campaign]=name,status,scheduled_at&sort=-created_at`;

  while (url) {
    const pageRes: Response = await fetch(url, { headers: klaviyoHeaders() });
    if (!pageRes.ok) throw new Error(`Klaviyo ${pageRes.status}: ${await pageRes.text()}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageData: any = await pageRes.json();
    results.push(...(pageData.data ?? []));
    url = pageData.links?.next ?? null;
  }
  return results;
}

// Strip years, "(clone)", "[tags]", punctuation — reduces to core keywords
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b202[4-9]\b/g, "")
    .replace(/\(clone\)|\(copy\)/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlapScore(a: string, b: string): number {
  const aw = a.split(" ").filter(Boolean);
  const bw = new Set(b.split(" ").filter(Boolean));
  const overlap = aw.filter((w) => bw.has(w)).length;
  const denom = Math.max(aw.length, bw.size);
  return denom === 0 ? 0 : overlap / denom;
}

// Days between two ISO date strings (absolute)
function dayDiff(a: string | null, b: string | null): number {
  if (!a || !b) return 9999;
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / 86_400_000
  );
}

export async function POST() {
  try {
    const [klaviyoCampaigns, { data: entries, error: dbErr }] =
      await Promise.all([
        fetchAllKlaviyoCampaigns(),
        db()
          .from("content_calendar")
          .select("id, name, send_at")
          .is("klaviyo_campaign_id", null),
      ]);

    if (dbErr) throw dbErr;
    if (!entries?.length) {
      return NextResponse.json({ linked: 0, matches: [], skipped: [] });
    }

    const SCORE_THRESHOLD = 0.55;
    const MIN_GAP         = 0.15; // best must beat second-best by this much

    type Match = {
      calendarId:   string;
      calendarName: string;
      sendAt:       string | null;
      klaviyoId:    string;
      klaviyoName:  string;
      klaviyoStatus:string;
      score:        number;
      dateDiff:     number;
    };

    // Step 1: for each calendar entry find its best Klaviyo candidate
    const candidates: Match[] = [];
    const skipped: { calendarName: string; reason: string }[] = [];

    for (const entry of entries) {
      const normEntry = normalize(entry.name);
      if (!normEntry) continue;

      let best = 0, second = 0, bestKc: KlaviyoCampaign | null = null;

      for (const kc of klaviyoCampaigns) {
        const s = wordOverlapScore(normEntry, normalize(kc.attributes.name ?? ""));
        if (s > best) { second = best; best = s; bestKc = kc; }
        else if (s > second) { second = s; }
      }

      if (best < SCORE_THRESHOLD) continue; // no plausible match

      if (best - second < MIN_GAP) {
        skipped.push({ calendarName: entry.name, reason: "ambiguous name match" });
        continue;
      }

      candidates.push({
        calendarId:    entry.id,
        calendarName:  entry.name,
        sendAt:        entry.send_at,
        klaviyoId:     bestKc!.id,
        klaviyoName:   bestKc!.attributes.name,
        klaviyoStatus: bestKc!.attributes.status,
        score:         Math.round(best * 100),
        dateDiff:      dayDiff(entry.send_at, bestKc!.attributes.scheduled_at),
      });
    }

    // Step 2: resolve conflicts — if multiple calendar entries claim the same
    // Klaviyo campaign, keep the one with the smallest date gap (closest send date).
    const byKlaviyoId = new Map<string, Match[]>();
    for (const c of candidates) {
      const list = byKlaviyoId.get(c.klaviyoId) ?? [];
      list.push(c);
      byKlaviyoId.set(c.klaviyoId, list);
    }

    const finalMatches: Match[] = [];
    for (const [, group] of byKlaviyoId) {
      if (group.length === 1) {
        finalMatches.push(group[0]);
      } else {
        // Pick closest by date; skip the rest
        group.sort((a, b) => a.dateDiff - b.dateDiff);
        finalMatches.push(group[0]);
        for (const loser of group.slice(1)) {
          skipped.push({
            calendarName: loser.calendarName,
            reason: `outcompeted for "${loser.klaviyoName}" by closer date match`,
          });
        }
      }
    }

    // Step 3: apply updates
    let linked = 0;
    for (const m of finalMatches) {
      const { error } = await db()
        .from("content_calendar")
        .update({ klaviyo_campaign_id: m.klaviyoId })
        .eq("id", m.calendarId);
      if (!error) linked++;
    }

    return NextResponse.json({
      linked,
      matches: finalMatches.map(({ calendarName, klaviyoName, klaviyoStatus, score }) => ({
        calendarName, klaviyoName, klaviyoStatus, score,
      })),
      skipped,
    });
  } catch (err) {
    console.error("[sync-calendar]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
