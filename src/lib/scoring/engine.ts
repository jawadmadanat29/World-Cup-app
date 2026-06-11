// Pure scoring engine. No DB access — operates on plain inputs so it is trivial
// to unit-test (see engine.test.ts). The recompute layer (recompute.ts) maps DB
// rows into these inputs, runs the engine, and persists the resulting awards as
// idempotent PointTransaction rows.

import type { Outcome } from "../enums";
import { ruleEnabled, ruleValue, type RuleMap } from "./rules";

/** A single point award produced by the engine. */
export interface Award {
  category: "MATCH" | "GROUP" | "KNOCKOUT_PRE" | "AWARD" | "WILDCARD";
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
  /** Knockout winner (who advanced), regardless of FT/AET/penalties. */
  advancingTeamId?: string | null;
  scorerPlayerIds: string[];
  firstTeamToScore: "HOME" | "AWAY" | "NONE";
}

export interface MatchPredictionInput {
  homeGoals?: number | null;
  awayGoals?: number | null;
  advanceTeamId?: string | null;
  firstTeamToScore?: string | null;
  bttsPrediction?: boolean | null;
  cleanSheetPrediction?: boolean | null;
  anytimeScorerPlayerIds: string[];
  wildcardApplied: boolean;
  isKnockout: boolean;
}

/**
 * The "result" points: correct outcome, plus an exact-score bonus on top.
 * Returned separately because the wildcard doubles ONLY these.
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
    reason: `Correct result (${actOut.toLowerCase()})`,
  });

  if (pred.home === actual.home && pred.away === actual.away) {
    awards.push({
      category: "MATCH",
      source: "MATCH_EXACT",
      points: ruleValue(rules, "MATCH_EXACT"),
      reason: `Exact score ${actual.home}-${actual.away}`,
    });
  }
  return awards;
}

/** Match bonuses — NOT doubled by a wildcard. */
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

  // Any-time goalscorer (the single picked player scored at any point)
  if (ruleEnabled(rules, "BONUS_ANYTIME_SCORER")) {
    const scorers = new Set(actual.scorerPlayerIds);
    for (const pid of new Set(pred.anytimeScorerPlayerIds)) {
      if (scorers.has(pid)) {
        awards.push({ category: "MATCH", source: "BONUS_ANYTIME_SCORER", points: ruleValue(rules, "BONUS_ANYTIME_SCORER"), reason: "Correct any-time goalscorer", ref: pid });
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

  // Knockout extra: correct team to advance (however they get there).
  if (pred.isKnockout) {
    if (ruleEnabled(rules, "KO_ADVANCE") && pred.advanceTeamId && actual.advancingTeamId && pred.advanceTeamId === actual.advancingTeamId) {
      awards.push({ category: "MATCH", source: "KO_ADVANCE", points: ruleValue(rules, "KO_ADVANCE"), reason: "Correct team to advance" });
    }
  }

  return awards;
}

/**
 * Full match score. Combines result + bonuses and applies the wildcard, which
 * DOUBLES only the result points (correct result + exact score) — never the
 * goalscorer / first-team / both-teams / clean-sheet / advance bonuses.
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
// Tournament bracket (one-time): how far each team goes.
// ---------------------------------------------------------------------------

export interface TournamentPredictionInput {
  championTeamId?: string | null;
  runnerUpTeamId?: string | null;
  semifinalistTeamIds: string[];
  quarterfinalistTeamIds: string[];
  roundOf16TeamIds: string[];
}

export interface TournamentActualInput {
  championTeamId?: string | null;
  runnerUpTeamId?: string | null;
  semifinalistTeamIds: string[];
  quarterfinalistTeamIds: string[];
  roundOf16TeamIds: string[];
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
    a.push({ category: "KNOCKOUT_PRE", source: "KO_PRE_FINAL", points: ruleValue(rules, "KO_PRE_FINAL"), reason: "Correct finalist" });

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

  return a;
}

// ---------------------------------------------------------------------------
// Player awards (section E)
// ---------------------------------------------------------------------------

const AWARD_RULE_KEY: Record<string, string> = {
  GOLDEN_BOOT: "AWARD_GOLDEN_BOOT",
  TOP_ASSIST: "AWARD_TOP_ASSIST",
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
