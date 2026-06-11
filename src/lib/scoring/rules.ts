// Default scoring rules. Every value/toggle here is editable from the admin
// Scoring Settings page (persisted in the ScoringRule table). The seed loads
// these defaults; the engine falls back to them if a rule row is missing.

export interface ScoringRuleDef {
  key: string;
  category:
    | "MATCH"
    | "GROUP"
    | "KNOCKOUT_PRE"
    | "AWARD"
    | "SYSTEM";
  label: string;
  description?: string;
  value: number;
  enabled: boolean;
}

// The whole scoring system, kept deliberately small so a new player can learn it
// in seconds. Every category is football-natural, easy to understand, and easy
// to verify objectively.
export const DEFAULT_SCORING_RULES: ScoringRuleDef[] = [
  // ---- Match result ----
  { key: "MATCH_OUTCOME", category: "MATCH", label: "Correct result (win / draw / loss)", value: 3, enabled: true },
  { key: "MATCH_EXACT", category: "MATCH", label: "Exact score (bonus on top of the result)", value: 5, enabled: true },

  // ---- Match bonuses ----
  { key: "BONUS_FIRST_TO_SCORE", category: "MATCH", label: "First team to score", value: 1, enabled: true },
  { key: "BONUS_BTTS", category: "MATCH", label: "Both teams to score", value: 1, enabled: true },
  { key: "BONUS_CLEAN_SHEET", category: "MATCH", label: "Clean sheet", value: 1, enabled: true },
  { key: "BONUS_ANYTIME_SCORER", category: "MATCH", label: "Any-time goalscorer", value: 2, enabled: true },

  // ---- Knockout match extra ----
  { key: "KO_ADVANCE", category: "MATCH", label: "Correct team to advance", description: "Whether the team goes through — extra time or penalties don't matter.", value: 2, enabled: true },

  // ---- Group stage ----
  { key: "GROUP_WINNER", category: "GROUP", label: "Correct group winner", value: 5, enabled: true },
  { key: "GROUP_RUNNER_UP", category: "GROUP", label: "Correct runner-up", value: 4, enabled: true },
  { key: "GROUP_THIRD", category: "GROUP", label: "Correct third place", value: 2, enabled: true },
  { key: "GROUP_FOURTH", category: "GROUP", label: "Correct fourth place", value: 2, enabled: true },
  { key: "GROUP_EXACT_BONUS", category: "GROUP", label: "Entire group correct (bonus)", value: 5, enabled: true },
  { key: "GROUP_ADVANCE", category: "GROUP", label: "Correct team advancing (each)", value: 2, enabled: true },
  { key: "GROUP_BEST_THIRD", category: "GROUP", label: "Correct best third-place qualifier (each)", value: 2, enabled: true },

  // ---- Tournament bracket (one-time, how far each team goes) ----
  { key: "KO_PRE_R16", category: "KNOCKOUT_PRE", label: "Reach the Round of 16", value: 4, enabled: true },
  { key: "KO_PRE_QF", category: "KNOCKOUT_PRE", label: "Reach the Quarter-finals", value: 6, enabled: true },
  { key: "KO_PRE_SF", category: "KNOCKOUT_PRE", label: "Reach the Semi-finals", value: 10, enabled: true },
  { key: "KO_PRE_FINAL", category: "KNOCKOUT_PRE", label: "Reach the Final (finalist)", value: 15, enabled: true },
  { key: "KO_PRE_CHAMPION", category: "KNOCKOUT_PRE", label: "Champion", value: 30, enabled: true },

  // ---- Player awards ----
  { key: "AWARD_GOLDEN_BOOT", category: "AWARD", label: "Golden Boot (top scorer)", value: 15, enabled: true },
  { key: "AWARD_TOP_ASSIST", category: "AWARD", label: "Top Assister", value: 12, enabled: true },

  // ---- System ----
  { key: "WILDCARDS_PER_PARTICIPANT", category: "SYSTEM", label: "Wildcards per participant", description: "How many match wildcards each player gets.", value: 3, enabled: true },
];

/**
 * Rule keys that are no longer part of the scoring system. The live DB may still
 * hold rows for these from an earlier version; the DB cleanup script and seed
 * delete them so they never resurface in the admin Scoring page or the guide.
 */
export const RETIRED_RULE_KEYS = [
  "MATCH_GD", "MATCH_TOTAL", "BONUS_FIRST_SCORER", "BONUS_ASSIST", "BONUS_MULTI_SCORER",
  "KO_EXTRA_TIME", "KO_PENALTIES", "KO_PEN_SCORE",
  "KO_PRE_R32", "KO_PRE_THIRD",
  "KO_STAGE_R32", "KO_STAGE_R16", "KO_STAGE_QF", "KO_STAGE_SF", "KO_STAGE_THIRD", "KO_STAGE_FINAL",
  "TOURNAMENT_SURPRISE_TEAM", "TOURNAMENT_DISAPPOINTING_TEAM", "TOURNAMENT_HIGHEST_SCORING",
  "TOURNAMENT_BEST_DEFENSIVE", "TOURNAMENT_FINAL_PENS",
  "AWARD_MVP", "AWARD_BEST_YOUNG", "AWARD_BEST_GK", "AWARD_FIRST_HATTRICK", "AWARD_MOST_GOALS_MATCH",
] as const;

export interface RuleEntry {
  value: number;
  enabled: boolean;
}
export type RuleMap = Record<string, RuleEntry>;

export const DEFAULT_RULE_MAP: RuleMap = Object.fromEntries(
  DEFAULT_SCORING_RULES.map((r) => [r.key, { value: r.value, enabled: r.enabled }]),
);

/** Build a lookup map from DB rows, falling back to defaults for any gaps. */
export function buildRuleMap(
  rows: { key: string; value: number; enabled: boolean }[] = [],
): RuleMap {
  const map: RuleMap = { ...DEFAULT_RULE_MAP };
  for (const r of rows) map[r.key] = { value: r.value, enabled: r.enabled };
  return map;
}

export function ruleValue(map: RuleMap, key: string): number {
  return (map[key] ?? DEFAULT_RULE_MAP[key])?.value ?? 0;
}
export function ruleEnabled(map: RuleMap, key: string): boolean {
  return (map[key] ?? DEFAULT_RULE_MAP[key])?.enabled ?? false;
}
