/**
 * Design Rules — shared utilities used by both the campaign-designer cron
 * agent and the build-campaign-entry on-demand route.
 *
 * A "design rule" is a per-campaign-type brief that tells Claude exactly how
 * to build the email: layout directives, colour overrides, copy tone, CTA
 * wording, subject line formulas, etc.  Rules are stored in the
 * `campaign_design_rules` table and matched by keyword against the campaign
 * name + brief text.
 */

export interface DesignRule {
  id:               string;
  store_id:         string;
  name:             string;
  trigger_keywords: string;
  template_type:    string | null;
  design_brief:     string;
  subject_formula:  string | null;
  shopify_actions:  string | null;
  color_primary:    string | null;
  color_accent:     string | null;
  is_active:        boolean;
  sort_order:       number;
  created_at:       string;
  updated_at:       string;
}

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * Find the first active rule whose trigger keywords appear in the combined
 * campaign name + brief text.  Rules are checked in sort_order sequence so
 * the most specific rule (lowest sort_order) wins.
 */
export function matchDesignRule(
  name:  string,
  brief: string,
  rules: DesignRule[]
): DesignRule | null {
  const haystack = `${name} ${brief}`.toLowerCase();

  const active = [...rules]
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const rule of active) {
    const keywords = rule.trigger_keywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    if (keywords.some((kw) => haystack.includes(kw))) {
      return rule;
    }
  }

  return null;
}

// ─── Prompt injection ─────────────────────────────────────────────────────────

const TEMPLATE_LABEL: Record<string, string> = {
  urgency:  "Urgency (countdown / flash-sale format)",
  "hero-cta": "Hero + CTA (announcement / launch format)",
  split:    "Split (image + text side-by-side)",
  grid:     "Grid (hero + product grid)",
  minimal:  "Minimal (text-first, clean)",
};

/**
 * Returns a prompt section that instructs Claude to follow the matched rule.
 * Insert this block BEFORE the HTML template section in the user message.
 */
export function buildDesignRulesPrompt(rule: DesignRule): string {
  const lines: string[] = [
    `## Campaign Design Rules — MUST FOLLOW`,
    `A design rule has been matched to this campaign. Apply every directive below`,
    `precisely — they override any generic defaults.`,
    ``,
    `**Matched rule**: ${rule.name}`,
  ];

  if (rule.template_type) {
    lines.push(`**Template format**: ${TEMPLATE_LABEL[rule.template_type] ?? rule.template_type}`);
  }

  if (rule.color_primary) {
    lines.push(`**Primary colour override**: ${rule.color_primary}`);
  }
  if (rule.color_accent) {
    lines.push(`**Accent colour override**: ${rule.color_accent}`);
  }

  if (rule.design_brief.trim()) {
    lines.push(``, `**Design & copy directives**:`, rule.design_brief.trim());
  }

  if (rule.subject_formula?.trim()) {
    lines.push(
      ``,
      `**Subject line formula** (adapt to this campaign's specifics):`,
      rule.subject_formula.trim()
    );
  }

  if (rule.shopify_actions?.trim()) {
    lines.push(
      ``,
      `**Note — Shopify actions required before sending** (mention in email footer or preview text if relevant):`,
      rule.shopify_actions.trim()
    );
  }

  lines.push(``, `---`);

  return lines.join("\n");
}
