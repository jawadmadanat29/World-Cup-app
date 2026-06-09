// Central definitions for the String "discriminator" fields used across the
// schema (kept here instead of DB enums so the schema stays Postgres-portable).
// These const arrays are the single source of truth for both the UI and the
// Zod validators in src/lib/validation.ts.

export const STAGES = [
  "GROUP",
  "R32",
  "R16",
  "QF",
  "SF",
  "THIRD_PLACE",
  "FINAL",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  GROUP: "Group Stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  THIRD_PLACE: "Third-place Match",
  FINAL: "Final",
};

export const STAGE_SHORT: Record<Stage, string> = {
  GROUP: "Group",
  R32: "R32",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  THIRD_PLACE: "3rd",
  FINAL: "Final",
};

/** Knockout stages only, in bracket order. */
export const KNOCKOUT_STAGES = [
  "R32",
  "R16",
  "QF",
  "SF",
  "THIRD_PLACE",
  "FINAL",
] as const;

export const OUTCOMES = ["HOME", "AWAY", "DRAW"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const SCORER_PICK_TYPES = ["FIRST", "ANYTIME", "ASSIST", "MULTI"] as const;
export type ScorerPickType = (typeof SCORER_PICK_TYPES)[number];

export const FIRST_TO_SCORE = ["HOME", "AWAY", "NONE"] as const;

export const EVENT_TYPES = [
  "GOAL",
  "ASSIST",
  "YELLOW",
  "RED",
  "OWN_GOAL",
  "PENALTY_GOAL",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
export type Position = (typeof POSITIONS)[number];

export const CONFEDERATIONS = [
  "UEFA",
  "CONMEBOL",
  "CONCACAF",
  "CAF",
  "AFC",
  "OFC",
] as const;

export const MATCH_STATUS = ["SCHEDULED", "LIVE", "COMPLETED"] as const;
export type MatchStatus = (typeof MATCH_STATUS)[number];

export const DECISIVE_SCORE = ["FT", "AET", "PENS"] as const;
export type DecisiveScore = (typeof DECISIVE_SCORE)[number];

export const AWARD_TYPES = [
  "GOLDEN_BOOT",
  "TOP_ASSIST",
  "MVP",
  "BEST_YOUNG",
  "BEST_GK",
  "FIRST_HATTRICK",
  "MOST_GOALS_MATCH",
] as const;
export type AwardType = (typeof AWARD_TYPES)[number];

export const AWARD_LABELS: Record<string, string> = {
  GOLDEN_BOOT: "Golden Boot (Top Scorer)",
  TOP_ASSIST: "Top Assister",
  MVP: "Player of the Tournament",
  BEST_YOUNG: "Best Young Player",
  BEST_GK: "Best Goalkeeper",
  FIRST_HATTRICK: "First Hat-trick Scorer",
  MOST_GOALS_MATCH: "Most Goals in a Match (Player)",
};

export const TOURNAMENT_TEAM_CATEGORIES = [
  "SEMIFINALIST",
  "QUARTERFINALIST",
  "GROUP_WINNER",
  "ADVANCING",
  "BEST_THIRD",
] as const;
export type TournamentTeamCategory = (typeof TOURNAMENT_TEAM_CATEGORIES)[number];

export const KNOCKOUT_PRED_MODES = ["PRE_TOURNAMENT", "STAGE_BY_STAGE"] as const;
export type KnockoutPredMode = (typeof KNOCKOUT_PRED_MODES)[number];

// Range option labels (kept as labels so they survive a Postgres/SQLite swap).
export const TOTAL_GOALS_RANGES = ["0-1", "2-3", "4-5", "6+"] as const;
export const TOTAL_CARDS_RANGES = ["0-2", "3-4", "5-6", "7+"] as const;
export const TOURNAMENT_GOALS_RANGES = [
  "<140",
  "140-159",
  "160-179",
  "180+",
] as const;
export const RED_CARD_RANGES = ["0-2", "3-5", "6-9", "10+"] as const;
export const HATTRICK_RANGES = ["0", "1-2", "3-4", "5+"] as const;

export const LOCK_STATES = [
  "UPCOMING", // future matchday — not yet open for predictions (progressive unlock)
  "OPEN",
  "CLOSING_SOON",
  "LOCKED",
  "COMPLETED",
] as const;
export type LockState = (typeof LOCK_STATES)[number];

// Settings keys.
export const SETTINGS = {
  MATCH_LOCK_BUFFER_MINUTES: "matchLockBufferMinutes",
  WILDCARDS_PER_PARTICIPANT: "wildcardsPerParticipant",
  ACTIVE_LEAGUE_ID: "activeLeagueId",
  TOURNAMENT_NAME: "tournamentName",
  CLOSING_SOON_MINUTES: "closingSoonMinutes",
} as const;

export function isStage(v: string): v is Stage {
  return (STAGES as readonly string[]).includes(v);
}
export function isKnockoutStage(v: string): boolean {
  return v !== "GROUP" && (STAGES as readonly string[]).includes(v);
}
