import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isMetaConnected,
  checkMetaToken,
  getMetaAccountInsights,
  getMetaCampaigns,
} from "@/lib/meta";
import {
  isGoogleConnected,
  getGoogleAccountStats,
  getGoogleCampaigns,
} from "@/lib/googleAds";
import { isTikTokConnected, getTikTokStats } from "@/lib/tiktok";

const STORE_ID   = process.env.STORE_ID ?? "50f89d8a-ae07-4999-9ec7-4304a2f6c51b";
const META_BASE  = "https://graph.facebook.com/v19.0";
const TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3";

// ─── Types ────────────────────────────────────────────────────────────────────
export type HealthSeverity = "critical" | "warning" | "info";
export type PlatformStatus = "healthy" | "warning" | "critical" | "disconnected";

export type HealthIssue = {
  severity: HealthSeverity;
  title: string;
  description: string;
  action: string;
};

export type PlatformHealth = {
  connected: boolean;
  status: PlatformStatus;
  accountName?: string;
  accountStatus?: string;
  issues: HealthIssue[];
  metrics?: {
    spend: number;
    roas: number;
    cpa: number;
    frequency?: number;
    conversions: number;
  };
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
function last7d(): { since: string; until: string } {
  const until = new Date();
  const since = new Date(until);
  since.setDate(since.getDate() - 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}

// ─── Meta health ──────────────────────────────────────────────────────────────
const META_STATUS_MAP: Record<number, { label: string; severity: PlatformStatus }> = {
  1:   { label: "Active",                status: "healthy"  },
  2:   { label: "Disabled",              status: "critical" },
  3:   { label: "Unsettled — payment",   status: "critical" },
  4:   { label: "Pending risk review",   status: "warning"  },
  5:   { label: "Pending settlement",    status: "warning"  },
  6:   { label: "In grace period",       status: "warning"  },
  7:   { label: "Pending closure",       status: "critical" },
  8:   { label: "Closed",                status: "critical" },
  100: { label: "Pending 10DLC review",  status: "warning"  },
  101: { label: "Pending validation",    status: "warning"  },
  102: { label: "Invalid payment method",status: "critical" },
} as any;

async function metaHealth(): Promise<PlatformHealth> {
  if (!isMetaConnected()) return { connected: false, status: "disconnected", issues: [] };

  const issues: HealthIssue[] = [];
  const { since, until } = last7d();
  const rawAccId = process.env.META_AD_ACCOUNT_ID ?? "";
  const accountId = rawAccId.startsWith("act_") ? rawAccId : `act_${rawAccId}`;
  const token = process.env.META_ACCESS_TOKEN ?? "";

  // 1. Token validity
  const tokenErr = await checkMetaToken();
  if (tokenErr) {
    issues.push({
      severity: "critical",
      title: "Meta token invalid",
      description: tokenErr,
      action: "Re-authenticate Meta in Integrations and generate a fresh long-lived token.",
    });
    return { connected: true, status: "critical", issues };
  }

  // 2. Account status from Graph API
  let accountName: string | undefined;
  let accountStatusLabel = "Active";
  try {
    const qs = new URLSearchParams({
      fields: "id,name,account_status,disable_reason,currency",
      access_token: token,
    });
    const r = await fetch(`${META_BASE}/${accountId}?${qs}`);
    const d = await r.json();
    if (r.ok && d.id) {
      accountName = d.name;
      const statusCode: number = d.account_status ?? 1;
      const info = META_STATUS_MAP[statusCode];
      if (info) {
        accountStatusLabel = info.label;
        if (statusCode !== 1) {
          issues.push({
            severity: statusCode === 4 || statusCode === 5 || statusCode === 6 || statusCode === 100 || statusCode === 101 ? "warning" : "critical",
            title: `Account status: ${info.label}`,
            description: d.disable_reason ? `Disable reason code: ${d.disable_reason}` : "Account is not fully active.",
            action: statusCode === 3 || statusCode === 102
              ? "Update your payment method in Meta Business Manager → Billing."
              : "Review your account in Meta Business Manager for required actions.",
          });
        }
      }
    }
  } catch { /* non-fatal */ }

  // 3. Performance signals (last 7 days)
  let metrics: PlatformHealth["metrics"] | undefined;
  try {
    const [acct, camps] = await Promise.all([
      getMetaAccountInsights({ type: "range", since, until }),
      getMetaCampaigns({ type: "range", since, until }),
    ]);

    const cpa = acct.purchases > 0 ? acct.spend / acct.purchases : 0;
    metrics = {
      spend:       acct.spend,
      roas:        acct.roas,
      cpa,
      frequency:   acct.frequency,
      conversions: acct.purchases,
    };

    if (acct.spend > 0) {
      if (acct.roas < 1 && acct.roas > 0) {
        issues.push({
          severity: "critical",
          title: "ROAS below 1× — losing money",
          description: `Current ROAS: ${acct.roas.toFixed(2)}× over the last 7 days. You're spending more than you're earning.`,
          action: "Pause lowest-performing campaigns and ad sets. Review creative fatigue and audience overlap.",
        });
      } else if (acct.roas < 1.5 && acct.roas > 0) {
        issues.push({
          severity: "warning",
          title: "ROAS below target",
          description: `Current ROAS: ${acct.roas.toFixed(2)}× — below the 1.5× minimum threshold.`,
          action: "Scale budget away from campaigns with ROAS < 1× and towards top performers.",
        });
      }

      if (acct.frequency > 4) {
        issues.push({
          severity: "warning",
          title: "High ad frequency — creative fatigue",
          description: `Average frequency: ${acct.frequency.toFixed(1)}× (target < 3.5). Audiences are being oversaturated.`,
          action: "Refresh creatives immediately. Expand audience targeting or create new lookalikes.",
        });
      } else if (acct.frequency > 3.5) {
        issues.push({
          severity: "info",
          title: "Frequency approaching fatigue threshold",
          description: `Average frequency: ${acct.frequency.toFixed(1)}×. Prepare new creatives now to avoid performance dip.`,
          action: "Queue new video or image creatives for this audience segment.",
        });
      }

      if (cpa > 50) {
        issues.push({
          severity: "warning",
          title: "High cost per acquisition",
          description: `CPA: $${cpa.toFixed(2)} over the last 7 days. Target is under $30.`,
          action: "Narrow audience targeting, test new creatives, or adjust bid strategy.",
        });
      }
    }

    // Check for any disabled campaigns that have spend
    const disabledWithSpend = camps.filter((c: any) => c.status !== "ACTIVE" && c.spend > 0);
    if (disabledWithSpend.length > 0) {
      issues.push({
        severity: "info",
        title: `${disabledWithSpend.length} paused campaign${disabledWithSpend.length > 1 ? "s" : ""} with recent spend`,
        description: `${disabledWithSpend.map((c: any) => c.name).join(", ")} had spend in the last 7 days but are now paused.`,
        action: "Review whether these should be reactivated or budgets reallocated.",
      });
    }
  } catch (e: any) {
    issues.push({
      severity: "warning",
      title: "Could not fetch performance data",
      description: e.message ?? "Unknown error fetching Meta metrics.",
      action: "Check Meta API permissions in the Integrations page.",
    });
  }

  const worstSeverity: PlatformStatus =
    issues.some((i) => i.severity === "critical") ? "critical" :
    issues.some((i) => i.severity === "warning")  ? "warning"  : "healthy";

  return {
    connected: true,
    status: worstSeverity,
    accountName,
    accountStatus: accountStatusLabel,
    issues,
    metrics,
  };
}

// ─── Google health ────────────────────────────────────────────────────────────
async function googleHealth(): Promise<PlatformHealth> {
  if (!isGoogleConnected()) return { connected: false, status: "disconnected", issues: [] };

  const issues: HealthIssue[] = [];
  const { since, until } = last7d();

  try {
    const [stats, camps] = await Promise.all([
      getGoogleAccountStats({ since, until }),
      getGoogleCampaigns({ since, until }),
    ]);

    const metrics: PlatformHealth["metrics"] = {
      spend:       stats.spend,
      roas:        stats.roas,
      cpa:         stats.costPerConv,
      conversions: stats.conversions,
    };

    if (stats.spend > 0) {
      if (stats.roas < 1 && stats.roas > 0) {
        issues.push({
          severity: "critical",
          title: "ROAS below 1× — spending more than earning",
          description: `Google ROAS: ${stats.roas.toFixed(2)}× over last 7 days.`,
          action: "Pause underperforming keywords/ad groups. Review conversion tracking to ensure it's accurate.",
        });
      } else if (stats.roas < 2 && stats.roas > 0) {
        issues.push({
          severity: "warning",
          title: "Google ROAS below 2×",
          description: `Current ROAS: ${stats.roas.toFixed(2)}×. Google Shopping/Search targets 3–5×.`,
          action: "Review negative keyword lists and pause low-QS keywords. Check landing page conversion rate.",
        });
      }

      if (stats.ctr < 1) {
        issues.push({
          severity: "info",
          title: "Low click-through rate",
          description: `CTR: ${stats.ctr.toFixed(2)}%. Strong Google Ads typically exceed 3–5% CTR.`,
          action: "Test new ad copy, review keyword match types, and improve ad relevance scores.",
        });
      }

      if (stats.costPerConv > 40 && stats.conversions > 0) {
        issues.push({
          severity: "warning",
          title: "High cost per conversion",
          description: `CPA: $${stats.costPerConv.toFixed(2)}. Review bid strategy and keyword targeting.`,
          action: "Switch to Target CPA bidding and set a target based on your margin.",
        });
      }
    } else if (camps.length === 0) {
      issues.push({
        severity: "warning",
        title: "No active campaigns",
        description: "No Google campaign spend detected in the last 7 days.",
        action: "Check that campaigns are enabled and budgets are set in Google Ads Manager.",
      });
    }

    // Check for a mix of ENABLED and PAUSED — any completely paused
    const activeCamps  = camps.filter((c: any) => c.status === "ENABLED");
    const pausedCamps  = camps.filter((c: any) => c.status === "PAUSED");
    if (activeCamps.length === 0 && pausedCamps.length > 0) {
      issues.push({
        severity: "critical",
        title: "All Google campaigns are paused",
        description: `${pausedCamps.length} campaign${pausedCamps.length > 1 ? "s" : ""} found, all paused. No active spend.`,
        action: "Resume priority campaigns in Google Ads or in the Campaign Controls tab.",
      });
    }

    const worstSeverity: PlatformStatus =
      issues.some((i) => i.severity === "critical") ? "critical" :
      issues.some((i) => i.severity === "warning")  ? "warning"  : "healthy";

    return { connected: true, status: worstSeverity, issues, metrics };
  } catch (e: any) {
    return {
      connected: true,
      status: "warning",
      issues: [{
        severity: "warning",
        title: "Google Ads API error",
        description: e.message ?? "Could not fetch Google account data.",
        action: "Check Google Ads credentials in Vercel environment variables.",
      }],
    };
  }
}

// ─── TikTok health ────────────────────────────────────────────────────────────
async function tiktokHealth(): Promise<PlatformHealth> {
  if (!isTikTokConnected()) return { connected: false, status: "disconnected", issues: [] };

  const issues: HealthIssue[] = [];
  const { since, until } = last7d();

  // Fetch advertiser info for account status + balance
  let accountName: string | undefined;
  let accountStatus = "Unknown";
  try {
    const advertiserId = process.env.TIKTOK_ADVERTISER_ID ?? "";
    const qs = new URLSearchParams({
      advertiser_ids: JSON.stringify([advertiserId]),
      fields: JSON.stringify(["name", "status", "balance", "currency", "role"]),
    });
    const r = await fetch(`${TIKTOK_BASE}/advertiser/info/?${qs}`, {
      headers: {
        "Access-Token": process.env.TIKTOK_ACCESS_TOKEN ?? "",
        "Content-Type": "application/json",
      },
    });
    const d = await r.json();
    if (d.code === 0 && d.data?.list?.length > 0) {
      const info = d.data.list[0];
      accountName   = info.name;
      accountStatus = info.status ?? "Unknown";

      if (info.status !== "STATUS_ENABLE") {
        const statusLabels: Record<string, string> = {
          STATUS_DISABLE:  "Disabled",
          STATUS_PUNISH:   "Penalized",
          STATUS_EXCEPTION:"Exception",
        };
        issues.push({
          severity: "critical",
          title: `TikTok account ${statusLabels[info.status] ?? info.status}`,
          description: `Advertiser account status is ${info.status}. Ads cannot run.`,
          action: "Contact TikTok Business support at business.tiktok.com to resolve the account status.",
        });
      }

      if (typeof info.balance === "number" && info.balance < 20) {
        issues.push({
          severity: info.balance < 5 ? "critical" : "warning",
          title: "Low TikTok account balance",
          description: `Remaining balance: $${info.balance.toFixed(2)}. Ads will stop when balance hits $0.`,
          action: "Top up your TikTok Ads account balance in the TikTok Ads Manager billing section.",
        });
      }
    }
  } catch { /* non-fatal */ }

  // Performance signals
  let metrics: PlatformHealth["metrics"] | undefined;
  try {
    const data: any = await getTikTokStats({ since, until });
    const acct = data.account ?? {};

    metrics = {
      spend:       acct.spend       ?? 0,
      roas:        acct.roas        ?? 0,
      cpa:         acct.costPerConversion ?? 0,
      frequency:   acct.frequency   ?? 0,
      conversions: acct.conversions ?? 0,
    };

    if (acct.spend > 0) {
      if (acct.roas < 1 && acct.roas > 0) {
        issues.push({
          severity: "critical",
          title: "TikTok ROAS below 1×",
          description: `ROAS: ${acct.roas.toFixed(2)}× over last 7 days. Spend exceeds revenue.`,
          action: "Pause low-performing campaigns. Refresh video creatives — TikTok performance is heavily creative-driven.",
        });
      } else if (acct.roas < 1.5 && acct.roas > 0) {
        issues.push({
          severity: "warning",
          title: "TikTok ROAS below 1.5×",
          description: `ROAS: ${acct.roas.toFixed(2)}×. TikTok targets typically aim for 2×+.`,
          action: "Test new hooks in the first 3 seconds of video. Broaden audiences slightly.",
        });
      }

      if ((acct.frequency ?? 0) > 3) {
        issues.push({
          severity: "info",
          title: "Creative fatigue on TikTok",
          description: `Average frequency: ${(acct.frequency ?? 0).toFixed(1)}×. TikTok audiences saturate faster than other platforms.`,
          action: "Upload fresh UGC or creator content. TikTok recommends new creatives every 7–14 days.",
        });
      }
    }
  } catch (e: any) {
    issues.push({
      severity: "info",
      title: "Could not fetch TikTok performance data",
      description: e.message ?? "API error",
      action: "Verify TIKTOK_ACCESS_TOKEN and TIKTOK_ADVERTISER_ID in Vercel environment variables.",
    });
  }

  const worstSeverity: PlatformStatus =
    issues.some((i) => i.severity === "critical") ? "critical" :
    issues.some((i) => i.severity === "warning")  ? "warning"  : "healthy";

  return {
    connected: true,
    status: worstSeverity,
    accountName,
    accountStatus,
    issues,
    metrics,
  };
}

// ─── Agent actions from Supabase ──────────────────────────────────────────────
async function fetchAgentActions() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await supabase
      .from("action_log")
      .select("*")
      .eq("store_id", STORE_ID)
      .order("created_at", { ascending: false })
      .limit(30);

    const all = data ?? [];
    return {
      pending: all.filter((a: any) => a.severity === "recommend" && a.approved === null && a.slack_ts),
      recent:  all.filter((a: any) => a.executed === true).slice(0, 5),
    };
  } catch {
    return { pending: [], recent: [] };
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export async function GET() {
  const [meta, google, tiktok, agentActions] = await Promise.all([
    metaHealth(),
    googleHealth(),
    tiktokHealth(),
    fetchAgentActions(),
  ]);

  return NextResponse.json({ meta, google, tiktok, agentActions });
}
