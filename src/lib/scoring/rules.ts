// Default scoring rules. Every value/toggle here is editable from the admin
// Scoring Settings page (persisted in the ScoringRule table). The seed loads
// these defaults; the engine falls back to them if a rule row is missing.

export interface ScoringRuleDef {
  key: string;
  category:
    | "MATCH"
    | "GROUP"
    | "KNOCKOUT_PRE"
    | "KNOCKOUT_STAGE"
    | "TOURNAMENT"
    | "AWARD"
    | "SYSTEM";
  label: string;
  description?: string;
  value: number;
  enabled: boolean;
}

export const DEFAULT_SCORING_RULES: ScoringRuleDef[] = [
  // ---- Match result (section A) ----
  { key: "MATCH_OUTCOME", category: "MATCH", label: "Correct outcome (W/D/L)", value: 3, enabled: true },
  { key: "MATCH_EXACT", category: "MATCH", label: "Exact scoreline bonus", description: "Replaces GD & total bonuses.", value: 4, enabled: true },
  { key: "MATCH_GD", category: "MATCH", label: "Correct goal difference bonus", value: 1, enabled: true },
  { key: "MATCH_TOTAL", category: "MATCH", label: "Correct total goals bonus", value: 1, enabled: true },

  // ---- Match bonuses (section B) ----
  { key: "BONUS_FIRST_TO_SCORE", category: "MATCH", label: "Correct first team to score", value: 1, enabled: true },
  { key: "BONUS_FIRST_SCORER", category: "MATCH", label: "Correct first goalscorer", value: 3, enabled: true },
  { key: "BONUS_ANYTIME_SCORER", category: "MATCH", label: "Correct any-time goalscorer (each)", value: 2, enabled: true },
  { key: "BONUS_ASSIST", category: "MATCH", label: "Correct assist provider (each)", value: 2, enabled: true },
  { key: "BONUS_BTTS", category: "MATCH", label: "Correct both-teams-to-score", value: 1, enabled: true },
  { key: "BONUS_CLEAN_SHEET", category: "MATCH", label: "Correct clean-sheet prediction", value: 1, enabled: true },
  { key: "BONUS_MULTI_SCORER", category: "MATCH", label: "Correct multi-goal scorer (2+ goals)", value: 4, enabled: true },

  // ---- Knockout match extras (section A, knockout) ----
  { key: "KO_ADVANCE", category: "MATCH", label: "Correct team to advance", value: 2, enabled: true },
  { key: "KO_EXTRA_TIME", category: "MATCH", label: "Correct extra-time prediction", value: 1, enabled: true },
  { key: "KO_PENALTIES", category: "MATCH", label: "Correct penalty-shootout prediction", value: 2, enabled: true },
  { key: "KO_PEN_SCORE", category: "MATCH", label: "Exact penalty-shootout score", value: 2, enabled: true },

  // ---- Group stage (section C) ----
  { key: "GROUP_WINNER", category: "GROUP", label: "Correct group winner", value: 5, enabled: true },
  { key: "GROUP_RUNNER_UP", category: "GROUP", label: "Correct runner-up", value: 4, enabled: true },
  { key: "GROUP_THIRD", category: "GROUP", label: "Correct third place", value: 2, enabled: true },
  { key: "GROUP_FOURTH", category: "GROUP", label: "Correct fourth place", value: 2, enabled: true },
  { key: "GROUP_EXACT_BONUS", category: "GROUP", label: "Entire group ranking exact (bonus)", value: 5, enabled: true },
  { key: "GROUP_ADVANCE", category: "GROUP", label: "Correct team advancing (each)", value: 2, enabled: true },
  { key: "GROUP_BEST_THIRD", category: "GROUP", label: "Correct best third-place qualifier (each)", value: 2, enabled: true },

  // ---- Pre-tournament bracket / tournament deep rounds (section D pre) ----
  { key: "KO_PRE_R32", category: "KNOCKOUT_PRE", label: "Correct Round-of-32 qualifier", value: 2, enabled: true },
  { key: "KO_PRE_R16", category: "KNOCKOUT_PRE", label: "Correct Round-of-16 qualifier", value: 4, enabled: true },
  { key: "KO_PRE_QF", category: "KNOCKOUT_PRE", label: "Correct quarter-finalist", value: 6, enabled: true },
  { key: "KO_PRE_SF", category: "KNOCKOUT_PRE", label: "Correct semi-finalist", value: 10, enabled: true },
  { key: "KO_PRE_FINAL", category: "KNOCKOUT_PRE", label: "Correct finalist", value: 15, enabled: true },
  { key: "KO_PRE_CHAMPION", category: "KNOCKOUT_PRE", label: "Correct champion", value: 30, enabled: true },
  { key: "KO_PRE_THIRD", category: "KNOCKOUT_PRE", label: "Correct third-place winner", value: 8, enabled: true },

  // ---- Stage-by-stage knockout (section D stage) — wired for future use ----
  { key: "KO_STAGE_R32", category: "KNOCKOUT_STAGE", label: "Correct R32 winner (stage-by-stage)", value: 3, enabled: true },
  { key: "KO_STAGE_R16", category: "KNOCKOUT_STAGE", label: "Correct R16 winner (stage-by-stage)", value: 5, enabled: true },
  { key: "KO_STAGE_QF", category: "KNOCKOUT_STAGE", label: "Correct QF winner (stage-by-stage)", value: 8, enabled: true },
  { key: "KO_STAGE_SF", category: "KNOCKOUT_STAGE", label: "Correct SF winner (stage-by-stage)", value: 12, enabled: true },
  { key: "KO_STAGE_THIRD", category: "KNOCKOUT_STAGE", label: "Correct third-place winner (stage-by-stage)", value: 6, enabled: true },
  { key: "KO_STAGE_FINAL", category: "KNOCKOUT_STAGE", label: "Correct final winner (stage-by-stage)", value: 18, enabled: true },

  // ---- Tournament extras (section E, team awards) ----
  { key: "TOURNAMENT_SURPRISE_TEAM", category: "TOURNAMENT", label: "Correct surprise team", value: 5, enabled: true },
  { key: "TOURNAMENT_DISAPPOINTING_TEAM", category: "TOURNAMENT", label: "Correct most disappointing team", value: 5, enabled: true },
  { key: "TOURNAMENT_HIGHEST_SCORING", category: "TOURNAMENT", label: "Correct highest-scoring team", value: 8, enabled: true },
  { key: "TOURNAMENT_BEST_DEFENSIVE", category: "TOURNAMENT", label: "Correct best defensive team", value: 8, enabled: true },
  { key: "TOURNAMENT_FINAL_PENS", category: "TOURNAMENT", label: "Correct final penalty-shootout prediction", value: 3, enabled: true },

  // ---- Player awards (section E) ----
  { key: "AWARD_GOLDEN_BOOT", category: "AWARD", label: "Correct Golden Boot", value: 15, enabled: true },
  { key: "AWARD_TOP_ASSIST", category: "AWARD", label: "Correct top assister", value: 12, enabled: true },
  { key: "AWARD_MVP", category: "AWARD", label: "Correct Player of the Tournament", value: 15, enabled: true },
  { key: "AWARD_BEST_YOUNG", category: "AWARD", label: "Correct Best Young Player", value: 10, enabled: true },
  { key: "AWARD_BEST_GK", category: "AWARD", label: "Correct Best Goalkeeper", value: 10, enabled: true },
  { key: "AWARD_FIRST_HATTRICK", category: "AWARD", label: "Correct first hat-trick scorer", value: 8, enabled: true },
  { key: "AWARD_MOST_GOALS_MATCH", category: "AWARD", label: "Correct most goals in a match (player)", value: 5, enabled: true },

  // ---- System ----
  { key: "WILDCARDS_PER_PARTICIPANT", category: "SYSTEM", label: "Wildcards per participant", description: "How many match wildcards each player gets.", value: 3, enabled: true },
];

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
