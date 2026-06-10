// Pure player-statistics + achievements helpers (Phase 2.4 / 2.5). No DB access:
// the query layer fetches rows and hands them in, so these stay unit-testable.
import { dayKey, dayLabel } from "@/lib/matchday";

export type Outcome = "HOME" | "AWAY" | "DRAW";

/** One of the player's match predictions, joined with the (optional) result. */
export interface PredOutcome {
  matchId: string;
  kickoff: Date;
  predictedOutcome: Outcome | null;
  actualOutcome: Outcome | null; // null = not played/scored yet
}

export interface MatchdayPoints {
  label: string;
  points: number;
}

export interface PlayerStats {
  scoredMatches: number;
  correctOutcomes: number;
  accuracyPct: number; // 0..100, 0 when nothing scored yet
  currentStreak: number; // trailing run of correct outcomes (most recent matches)
  longestStreak: number;
  bestMatchday: MatchdayPoints | null;
  worstMatchday: MatchdayPoints | null;
  wildcardsUsed: number;
  exactScores: number;
}

/** Outcome of a final score. */
export function outcomeOf(home: number, away: number): Outcome {
  return home > away ? "HOME" : home < away ? "AWAY" : "DRAW";
}

export function computePlayerStats(args: {
  preds: PredOutcome[];
  matchPoints: { kickoff: Date; points: number }[]; // point txns that carry a matchId
  wildcardsUsed: number;
  exactScores: number;
}): PlayerStats {
  const scored = args.preds
    .filter((p) => p.actualOutcome != null)
    .sort((a, b) => +a.kickoff - +b.kickoff);
  const correctFlags = scored.map((p) => p.predictedOutcome != null && p.predictedOutcome === p.actualOutcome);
  const correctOutcomes = correctFlags.filter(Boolean).length;
  const accuracyPct = scored.length ? Math.round((correctOutcomes / scored.length) * 100) : 0;

  let longestStreak = 0;
  let run = 0;
  for (const ok of correctFlags) {
    run = ok ? run + 1 : 0;
    if (run > longestStreak) longestStreak = run;
  }
  let currentStreak = 0;
  for (let i = correctFlags.length - 1; i >= 0 && correctFlags[i]; i--) currentStreak++;

  // Matchday point buckets — start every day the player had a scored match at 0,
  // then add the points earned that day, so an all-blanks day can be the "worst".
  const byDay = new Map<string, { label: string; points: number }>();
  for (const p of scored) {
    const k = dayKey(p.kickoff);
    if (!byDay.has(k)) byDay.set(k, { label: dayLabel(p.kickoff), points: 0 });
  }
  for (const t of args.matchPoints) {
    const k = dayKey(t.kickoff);
    const bucket = byDay.get(k) ?? { label: dayLabel(t.kickoff), points: 0 };
    bucket.points += t.points;
    byDay.set(k, bucket);
  }
  const days = [...byDay.values()];
  const bestMatchday = days.length ? days.reduce((a, b) => (b.points > a.points ? b : a)) : null;
  const worstMatchday = days.length ? days.reduce((a, b) => (b.points < a.points ? b : a)) : null;

  return {
    scoredMatches: scored.length,
    correctOutcomes,
    accuracyPct,
    currentStreak,
    longestStreak,
    bestMatchday,
    worstMatchday,
    wildcardsUsed: args.wildcardsUsed,
    exactScores: args.exactScores,
  };
}

export interface Achievement {
  key: string;
  label: string;
  description: string;
  earned: boolean;
}

export function computeAchievements(args: {
  preds: PredOutcome[];
  exactScores: number;
  longestStreak: number;
  championCorrect: boolean; // champion pick matched, final played
}): Achievement[] {
  const scored = args.preds.filter((p) => p.actualOutcome != null);
  const correctAwayWin = scored.some((p) => p.predictedOutcome === "AWAY" && p.actualOutcome === "AWAY");

  // Perfect Day = a matchday with >=2 scored predictions, all outcomes correct.
  const dayMap = new Map<string, { total: number; correct: number }>();
  for (const p of scored) {
    const k = dayKey(p.kickoff);
    const b = dayMap.get(k) ?? { total: 0, correct: 0 };
    b.total++;
    if (p.predictedOutcome === p.actualOutcome) b.correct++;
    dayMap.set(k, b);
  }
  const perfectDay = [...dayMap.values()].some((d) => d.total >= 2 && d.correct === d.total);

  return [
    { key: "ORACLE", label: "Oracle", description: "Predicted the tournament champion", earned: args.championCorrect },
    { key: "EXACTA", label: "Exacta", description: "Nailed 5 exact scorelines", earned: args.exactScores >= 5 },
    { key: "HOT_STREAK", label: "Hot Streak", description: "5 correct results in a row", earned: args.longestStreak >= 5 },
    { key: "UNDERDOG", label: "Underdog Hunter", description: "Called an away-team upset correctly", earned: correctAwayWin },
    { key: "PERFECT_DAY", label: "Perfect Day", description: "Every result right on a matchday", earned: perfectDay },
  ];
}
