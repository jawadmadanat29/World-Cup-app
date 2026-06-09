// Pure scoring engine. No DB access — operates on plain inputs so it is trivial
// to unit-test (see engine.test.ts). The recompute layer (recompute.ts) maps DB
// rows into these inputs, runs the engine, and persists the resulting awards as
// idempotent PointTransaction rows.

import type { Outcome } from "../enums";
import { rangeContains } from "./ranges";
import { ruleEnabled, ruleValue, type RuleMap } from "./rules";

/** A single point award produced by the engine. */
export interface Award {
  category: "MATCH" | "GROUP" | "KNOCKOUT_PRE" | "KNOCKOUT_STAGE" | "TOURNAMENT" | "AWARD" | "WILDCARD";
  source: string;
  points: number;
  reason: string;
  /** Optional sub-reference (e.g. team id, award type) for the dedupe key. */
  ref?: string;
}

export interface ScoreLine {
  home: number;
  away: number;
}

export function outcomeOf(line: ScoreLine): Outcome {
  if (line.home > line.away) return "HOME";
  if (line.home < line.away) return "AWAY";
  return "DRAW";
}

// ---------------------------------------------------------------------------
// Match scoring (sections A, B + knockout extras + wildcard doubling)
// ---------------------------------------------------------------------------

export interface ActualMatch {
  ftHome: number;
  ftAway: number;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
  pensHome?: number | null;
  pensAway?: number | null;
  advancingTeamId?: string | null;
  firstScorerPlayerId?: string | null;
  scorerPlayerIds: string[];
  /** Players who scored 2+ goals in this match. */
  multiScorerPlayerIds: string[];
  assistPlayerIds: string[];
  firstTeamToScore: "HOME" | "AWAY" | "NONE";
}

export interface MatchPredictionInput {
  homeGoals?: number | null;
  awayGoals?: number | null;
  advanceTeamId?: string | null;
  predictExtraTime?: boolean | null;
  predictPenalties?: boolean | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  firstTeamToScore?: string | null;
  bttsPrediction?: boolean | null;
  cleanSheetPrediction?: boolean | null;
  firstScorerPlayerId?: string | null;
  anytimeScorerPlayerIds: string[];
  assistPlayerIds: string[];
  multiScorerPlayerIds: string[];
  wildcardApplied: boolean;
  isKnockout: boolean;
}

/**
 * Section A — the "result" points (outcome + exact/GD/total). Returned
 * separately because the wildcard doubles ONLY these.
 */
export function scoreMatchResult(
  pred: ScoreLine,
  actual: ScoreLine,
  rules: RuleMap,
): Award[] {
  const awards: Award[] = [];
  const predOut = outcomeOf(pred);
  const actOut = outcomeOf(actual);
  if (predOut !== actOut) return awards; // no result points without correct outcome

  awards.push({
    category: "MATCH",
    source: "MATCH_OUTCOME",
    points: ruleValue(rules, "MATCH_OUTCOME"),
    reason: `Correct outcome (${actOut.toLowerCase()})`,
  });

  const exact = pred.home === actual.home && pred.away === actual.away;
  if (exact) {
    awards.push({
      category: "MATCH",
      source: "MATCH_EXACT",
      points: ruleValue(rules, "MATCH_EXACT"),
      reason: `Exact score ${actual.home}-${actual.away}`,
    });
  } else {
    // GD and total bonuses are independent and cannot both apply unless exact.
    if (pred.home - pred.away === actual.home - actual.away) {
      awards.push({
        category: "MATCH",
        source: "MATCH_GD",
        points: ruleValue(rules, "MATCH_GD"),
        reason: "Correct goal difference",
      });
    }
    if (pred.home + pred.away === actual.home + actual.away) {
      awards.push({
        category: "MATCH",
        source: "MATCH_TOTAL",
        points: ruleValue(rules, "MATCH_TOTAL"),
        reason: "Correct total goals",
      });
    }
  }
  return awards;
}

/** Sections A (knockout) + B — bonuses that are NOT doubled by a wildcard. */
export function scoreMatchBonuses(
  pred: MatchPredictionInput,
  actual: ActualMatch,
  rules: RuleMap,
): Award[] {
  const awards: Award[] = [];

  // First team to score
  if (
    ruleEnabled(rules, "BONUS_FIRST_TO_SCORE") &&
    pred.firstTeamToScore != null &&
    pred.firstTeamToScore === actual.firstTeamToScore
  ) {
    awards.push({ category: "MATCH", source: "BONUS_FIRST_TO_SCORE", points: ruleValue(rules, "BONUS_FIRST_TO_SCORE"), reason: "Correct first team to score" });
  }

  // First goalscorer
  if (
    ruleEnabled(rules, "BONUS_FIRST_SCORER") &&
    pred.firstScorerPlayerId &&
    actual.firstScorerPlayerId &&
    pred.firstScorerPlayerId === actual.firstScorerPlayerId
  ) {
    awards.push({ category: "MATCH", source: "BONUS_FIRST_SCORER", points: ruleValue(rules, "BONUS_FIRST_SCORER"), reason: "Correct first goalscorer", ref: pred.firstScorerPlayerId });
  }

  // Any-time goalscorers (per correct player)
  if (ruleEnabled(rules, "BONUS_ANYTIME_SCORER")) {
    const scorers = new Set(actual.scorerPlayerIds);
    for (const pid of new Set(pred.anytimeScorerPlayerIds)) {
      if (scorers.has(pid)) {
        awards.push({ category: "MATCH", source: "BONUS_ANYTIME_SCORER", points: ruleValue(rules, "BONUS_ANYTIME_SCORER"), reason: "Correct any-time goalscorer", ref: pid });
      }
    }
  }

  // Assist providers (per correct player)
  if (ruleEnabled(rules, "BONUS_ASSIST")) {
    const assisters = new Set(actual.assistPlayerIds);
    for (const pid of new Set(pred.assistPlayerIds)) {
      if (assisters.has(pid)) {
        awards.push({ category: "MATCH", source: "BONUS_ASSIST", points: ruleValue(rules, "BONUS_ASSIST"), reason: "Correct assist provider", ref: pid });
      }
    }
  }

  // Multi-goal scorer (predicted player who actually scored 2+ goals)
  if (ruleEnabled(rules, "BONUS_MULTI_SCORER")) {
    const multi = new Set(actual.multiScorerPlayerIds);
    for (const pid of new Set(pred.multiScorerPlayerIds)) {
      if (multi.has(pid)) {
        awards.push({ category: "MATCH", source: "BONUS_MULTI_SCORER", points: ruleValue(rules, "BONUS_MULTI_SCORER"), reason: "Correct multi-goal scorer (2+)", ref: pid });
      }
    }
  }

  // Both teams to score
  if (ruleEnabled(rules, "BONUS_BTTS") && pred.bttsPrediction != null) {
    const actualBtts = actual.ftHome > 0 && actual.ftAway > 0;
    if (pred.bttsPrediction === actualBtts) {
      awards.push({ category: "MATCH", source: "BONUS_BTTS", points: ruleValue(rules, "BONUS_BTTS"), reason: `Correct both-teams-to-score (${actualBtts ? "yes" : "no"})` });
    }
  }

  // Clean sheet (either side kept one)
  if (ruleEnabled(rules, "BONUS_CLEAN_SHEET") && pred.cleanSheetPrediction != null) {
    const actualClean = actual.ftHome === 0 || actual.ftAway === 0;
    if (pred.cleanSheetPrediction === actualClean) {
      awards.push({ category: "MATCH", source: "BONUS_CLEAN_SHEET", points: ruleValue(rules, "BONUS_CLEAN_SHEET"), reason: `Correct clean-sheet (${actualClean ? "yes" : "no"})` });
    }
  }

  // Knockout extras
  if (pred.isKnockout) {
    if (ruleEnabled(rules, "KO_ADVANCE") && pred.advanceTeamId && actual.advancingTeamId && pred.advanceTeamId === actual.advancingTeamId) {
      awards.push({ category: "MATCH", source: "KO_ADVANCE", points: ruleValue(rules, "KO_ADVANCE"), reason: "Correct team to advance" });
    }
    if (ruleEnabled(rules, "KO_EXTRA_TIME") && pred.predictExtraTime != null && pred.predictExtraTime === actual.wentToExtraTime) {
      awards.push({ category: "MATCH", source: "KO_EXTRA_TIME", points: ruleValue(rules, "KO_EXTRA_TIME"), reason: `Correct extra-time prediction (${actual.wentToExtraTime ? "yes" : "no"})` });
    }
    if (ruleEnabled(rules, "KO_PENALTIES") && pred.predictPenalties != null && pred.predictPenalties === actual.wentToPenalties) {
      awards.push({ category: "MATCH", source: "KO_PENALTIES", points: ruleValue(rules, "KO_PENALTIES"), reason: `Correct penalties prediction (${actual.wentToPenalties ? "yes" : "no"})` });
    }
    if (
      ruleEnabled(rules, "KO_PEN_SCORE") &&
      actual.wentToPenalties &&
      pred.penaltyHome != null &&
      pred.penaltyAway != null &&
      actual.pensHome != null &&
      actual.pensAway != null &&
      pred.penaltyHome === actual.pensHome &&
      pred.penaltyAway === actual.pensAway
    ) {
      awards.push({ category: "MATCH", source: "KO_PEN_SCORE", points: ruleValue(rules, "KO_PEN_SCORE"), reason: `Exact shootout score ${actual.pensHome}-${actual.pensAway}` });
    }
  }

  return awards;
}

/**
 * Full match score. Combines result + bonuses and applies the wildcard, which
 * DOUBLES only the section-A result points (outcome + exact/GD/total) — never
 * goalscorer/assist/cards/knockout bonuses.
 */
export function scoreMatch(
  pred: MatchPredictionInput,
  actual: ActualMatch,
  rules: RuleMap,
): Award[] {
  const awards: Award[] = [];
  const hasScore = pred.homeGoals != null && pred.awayGoals != null;

  let resultAwards: Award[] = [];
  if (hasScore) {
    resultAwards = scoreMatchResult(
      { home: pred.homeGoals as number, away: pred.awayGoals as number },
      { home: actual.ftHome, away: actual.ftAway },
      rules,
    );
    awards.push(...resultAwards);
  }
  awards.push(...scoreMatchBonuses(pred, actual, rules));

  // Wildcard: double the result points by adding an equal bonus.
  if (pred.wildcardApplied) {
    const doubleable = resultAwards.reduce((s, a) => s + a.points, 0);
    if (doubleable > 0) {
      awards.push({
        category: "WILDCARD",
        source: "WILDCARD_DOUBLE",
        points: doubleable,
        reason: `Wildcard ×2 on result points (+${doubleable})`,
      });
    }
  }

  return awards;
}

// ---------------------------------------------------------------------------
// Group stage (section C)
// ---------------------------------------------------------------------------

export interface GroupPredictionInput {
  /** teamId -> predicted position (1..4) */
  positions: Record<string, number>;
}

export function scoreGroup(
  pred: GroupPredictionInput,
  /** actual final order, index 0 = 1st place .. index 3 = 4th place */
  actualOrder: string[],
  rules: RuleMap,
): Award[] {
  const awards: Award[] = [];
  const posKey = ["", "GROUP_WINNER", "GROUP_RUNNER_UP", "GROUP_THIRD", "GROUP_FOURTH"];
  const posLabel = ["", "winner", "runner-up", "third", "fourth"];

  let allCorrect = actualOrder.length === 4;
  for (let i = 0; i < actualOrder.length; i++) {
    const actualTeam = actualOrder[i];
    const pos = i + 1;
    if (pred.positions[actualTeam] === pos) {
      awards.push({ category: "GROUP", source: posKey[pos], points: ruleValue(rules, posKey[pos]), reason: `Correct ${posLabel[pos]}`, ref: actualTeam });
    } else {
      allCorrect = false;
    }
  }
  if (allCorrect) {
    awards.push({ category: "GROUP", source: "GROUP_EXACT_BONUS", points: ruleValue(rules, "GROUP_EXACT_BONUS"), reason: "Entire group ranking exact" });
  }

  // Advancing (predicted top-2 that actually finished top-2)
  const actualTop2 = new Set(actualOrder.slice(0, 2));
  const predictedTop2 = Object.entries(pred.positions)
    .filter(([, p]) => p === 1 || p === 2)
    .map(([t]) => t);
  for (const t of predictedTop2) {
    if (actualTop2.has(t)) {
      awards.push({ category: "GROUP", source: "GROUP_ADVANCE", points: ruleValue(rules, "GROUP_ADVANCE"), reason: "Correct team advancing", ref: t });
    }
  }
  return awards;
}

/** Best third-place picks (section C) — scored against the actual best-8 thirds. */
export function scoreBestThirds(
  predictedTeamIds: string[],
  actualBestThirdIds: string[],
  rules: RuleMap,
): Award[] {
  const actual = new Set(actualBestThirdIds);
  const awards: Award[] = [];
  for (const t of new Set(predictedTeamIds)) {
    if (actual.has(t)) {
      awards.push({ category: "GROUP", source: "GROUP_BEST_THIRD", points: ruleValue(rules, "GROUP_BEST_THIRD"), reason: "Correct best third-place qualifier", ref: t });
    }
  }
  return awards;
}

// ---------------------------------------------------------------------------
// Tournament predictions (deep rounds -> KNOCKOUT_PRE, extras -> TOURNAMENT)
// ---------------------------------------------------------------------------

export interface TournamentPredictionInput {
  championTeamId?: string | null;
  runnerUpTeamId?: string | null;
  thirdTeamId?: string | null;
  fourthTeamId?: string | null;
  semifinalistTeamIds: string[];
  quarterfinalistTeamIds: string[];
  roundOf16TeamIds: string[];
  surpriseTeamId?: string | null;
  disappointingTeamId?: string | null;
  highestScoringTeamId?: string | null;
  bestDefensiveTeamId?: string | null;
  totalGoalsRange?: string | null;
  finalPenaltyShootout?: boolean | null;
  redCardRange?: string | null;
  hatTrickRange?: string | null;
}

export interface TournamentActualInput {
  championTeamId?: string | null;
  runnerUpTeamId?: string | null;
  thirdTeamId?: string | null;
  fourthTeamId?: string | null;
  semifinalistTeamIds: string[];
  quarterfinalistTeamIds: string[];
  roundOf16TeamIds: string[];
  surpriseTeamId?: string | null;
  disappointingTeamId?: string | null;
  highestScoringTeamId?: string | null;
  bestDefensiveTeamId?: string | null;
  totalGoals?: number | null;
  finalWentToPens?: boolean | null;
  redCards?: number | null;
  hatTricks?: number | null;
}

export function scoreTournament(
  pred: TournamentPredictionInput,
  actual: TournamentActualInput,
  rules: RuleMap,
): Award[] {
  const a: Award[] = [];
  const eq = (x?: string | null, y?: string | null) => !!x && !!y && x === y;

  if (eq(pred.championTeamId, actual.championTeamId))
    a.push({ category: "KNOCKOUT_PRE", source: "KO_PRE_CHAMPION", points: ruleValue(rules, "KO_PRE_CHAMPION"), reason: "Correct champion" });
  if (eq(pred.runnerUpTeamId, actual.runnerUpTeamId))
    a.push({ category: "KNOCKOUT_PRE", source: "KO_PRE_FINAL", points: ruleValue(rules, "KO_PRE_FINAL"), reason: "Correct runner-up (finalist)" });
  if (eq(pred.thirdTeamId, actual.thirdTeamId))
    a.push({ category: "KNOCKOUT_PRE", source: "KO_PRE_THIRD", points: ruleValue(rules, "KO_PRE_THIRD"), reason: "Correct third place" });
  if (eq(pred.fourthTeamId, actual.fourthTeamId))
    a.push({ category: "KNOCKOUT_PRE", source: "KO_PRE_SF", points: ruleValue(rules, "KO_PRE_SF"), reason: "Correct fourth place (semi-finalist)", ref: pred.fourthTeamId! });

  const actualSF = new Set(actual.semifinalistTeamIds);
  for (const t of new Set(pred.semifinalistTeamIds)) {
    if (actualSF.has(t))
      a.push({ category: "KNOCKOUT_PRE", source: "KO_PRE_SF", points: ruleValue(rules, "KO_PRE_SF"), reason: "Correct semi-finalist", ref: t });
  }
  const actualQF = new Set(actual.quarterfinalistTeamIds);
  for (const t of new Set(pred.quarterfinalistTeamIds)) {
    if (actualQF.has(t))
      a.push({ category: "KNOCKOUT_PRE", source: "KO_PRE_QF", points: ruleValue(rules, "KO_PRE_QF"), reason: "Correct quarter-finalist", ref: t });
  }
  const actualR16 = new Set(actual.roundOf16TeamIds);
  for (const t of new Set(pred.roundOf16TeamIds)) {
    if (actualR16.has(t))
      a.push({ category: "KNOCKOUT_PRE", source: "KO_PRE_R16", points: ruleValue(rules, "KO_PRE_R16"), reason: "Correct Round-of-16 team", ref: t });
  }

  if (eq(pred.surpriseTeamId, actual.surpriseTeamId))
    a.push({ category: "TOURNAMENT", source: "TOURNAMENT_SURPRISE_TEAM", points: ruleValue(rules, "TOURNAMENT_SURPRISE_TEAM"), reason: "Correct surprise team" });
  if (eq(pred.disappointingTeamId, actual.disappointingTeamId))
    a.push({ category: "TOURNAMENT", source: "TOURNAMENT_DISAPPOINTING_TEAM", points: ruleValue(rules, "TOURNAMENT_DISAPPOINTING_TEAM"), reason: "Correct most disappointing team" });
  if (eq(pred.highestScoringTeamId, actual.highestScoringTeamId))
    a.push({ category: "TOURNAMENT", source: "TOURNAMENT_HIGHEST_SCORING", points: ruleValue(rules, "TOURNAMENT_HIGHEST_SCORING"), reason: "Correct highest-scoring team" });
  if (eq(pred.bestDefensiveTeamId, actual.bestDefensiveTeamId))
    a.push({ category: "TOURNAMENT", source: "TOURNAMENT_BEST_DEFENSIVE", points: ruleValue(rules, "TOURNAMENT_BEST_DEFENSIVE"), reason: "Correct best defensive team" });

  if (pred.totalGoalsRange && actual.totalGoals != null && rangeContains(pred.totalGoalsRange, actual.totalGoals))
    a.push({ category: "TOURNAMENT", source: "TOURNAMENT_TOTAL_GOALS_RANGE", points: ruleValue(rules, "TOURNAMENT_TOTAL_GOALS_RANGE"), reason: `Correct total goals range (${pred.totalGoalsRange})` });
  if (pred.finalPenaltyShootout != null && actual.finalWentToPens != null && pred.finalPenaltyShootout === actual.finalWentToPens)
    a.push({ category: "TOURNAMENT", source: "TOURNAMENT_FINAL_PENS", points: ruleValue(rules, "TOURNAMENT_FINAL_PENS"), reason: "Correct final-shootout prediction" });
  if (pred.redCardRange && actual.redCards != null && rangeContains(pred.redCardRange, actual.redCards))
    a.push({ category: "TOURNAMENT", source: "TOURNAMENT_RED_CARD_RANGE", points: ruleValue(rules, "TOURNAMENT_RED_CARD_RANGE"), reason: `Correct red-card range (${pred.redCardRange})` });
  if (pred.hatTrickRange && actual.hatTricks != null && rangeContains(pred.hatTrickRange, actual.hatTricks))
    a.push({ category: "TOURNAMENT", source: "TOURNAMENT_HATTRICK_RANGE", points: ruleValue(rules, "TOURNAMENT_HATTRICK_RANGE"), reason: `Correct hat-trick range (${pred.hatTrickRange})` });

  return a;
}

// ---------------------------------------------------------------------------
// Player awards (section E)
// ---------------------------------------------------------------------------

const AWARD_RULE_KEY: Record<string, string> = {
  GOLDEN_BOOT: "AWARD_GOLDEN_BOOT",
  TOP_ASSIST: "AWARD_TOP_ASSIST",
  MVP: "AWARD_MVP",
  BEST_YOUNG: "AWARD_BEST_YOUNG",
  BEST_GK: "AWARD_BEST_GK",
  FIRST_HATTRICK: "AWARD_FIRST_HATTRICK",
  MOST_GOALS_MATCH: "AWARD_MOST_GOALS_MATCH",
};

export function scoreAward(
  awardType: string,
  predictedPlayerId: string | null | undefined,
  actualPlayerId: string | null | undefined,
  rules: RuleMap,
): Award | null {
  const key = AWARD_RULE_KEY[awardType];
  if (!key) return null;
  if (!predictedPlayerId || !actualPlayerId || predictedPlayerId !== actualPlayerId) return null;
  return {
    category: "AWARD",
    source: key,
    points: ruleValue(rules, key),
    reason: `Correct ${awardType.replace(/_/g, " ").toLowerCase()}`,
    ref: awardType,
  };
}

export function sumAwards(awards: Award[]): number {
  return awards.reduce((s, a) => s + a.points, 0);
}
