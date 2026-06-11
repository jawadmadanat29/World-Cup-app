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

// Only one kind of goalscorer pick remains: a single any-time goalscorer.
export const SCORER_PICK_TYPES = ["ANYTIME"] as const;
export type ScorerPickType = (typeof SCORER_PICK_TYPES)[number];

export const FIRST_TO_SCORE = ["HOME", "AWAY", "NONE"] as const;

// Per-match confidence (non-scoring — captured for fun/stats only, surfaced in Phase 2).
export const CONFIDENCE_LEVELS = ["GUESSING", "UNSURE", "CONFIDENT", "VERY_CONFIDENT"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  GUESSING: "Just guessing",
  UNSURE: "Not sure",
  CONFIDENT: "Confident",
  VERY_CONFIDENT: "Very confident",
};

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
] as const;
export type AwardType = (typeof AWARD_TYPES)[number];

export const AWARD_LABELS: Record<string, string> = {
  GOLDEN_BOOT: "Golden Boot (Top Scorer)",
  TOP_ASSIST: "Top Assister",
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

// A match is editable until its exact kickoff. "Upcoming" is a display-only
// urgency flag (kickoff within 24h) — it does NOT lock predictions.
export const LOCK_STATES = [
  "OPEN", // kickoff in the future — predictions open & editable
  "UPCOMING", // kickoff within the next 24h — still editable, shown with urgency
  "LOCKED", // now >= kickoff — predictions closed
  "COMPLETED", // final result is in
] as const;
export type LockState = (typeof LOCK_STATES)[number];

// Window before kickoff during which a still-open match is flagged "Upcoming".
export const UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000;

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
