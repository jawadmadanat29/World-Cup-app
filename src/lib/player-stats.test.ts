import { describe, it, expect } from "vitest";
import { computePlayerStats, computeAchievements, outcomeOf, type PredOutcome } from "@/lib/player-stats";

// Two distinct ET matchdays (midday UTC → same calendar day in America/New_York).
const day1 = (h = 16) => new Date(`2026-06-11T${String(h).padStart(2, "0")}:00:00Z`);
const day2 = (h = 16) => new Date(`2026-06-12T${String(h).padStart(2, "0")}:00:00Z`);

const preds: PredOutcome[] = [
  { matchId: "m1", kickoff: day1(16), predictedOutcome: "HOME", actualOutcome: "HOME" }, // correct
  { matchId: "m2", kickoff: day1(18), predictedOutcome: "AWAY", actualOutcome: "HOME" }, // wrong
  { matchId: "m3", kickoff: day2(16), predictedOutcome: "DRAW", actualOutcome: "DRAW" }, // correct
  { matchId: "m4", kickoff: day2(18), predictedOutcome: "AWAY", actualOutcome: "AWAY" }, // correct (away upset)
  { matchId: "m5", kickoff: day2(20), predictedOutcome: "HOME", actualOutcome: null }, // not played → ignored
];

describe("outcomeOf", () => {
  it("classifies scorelines", () => {
    expect(outcomeOf(2, 0)).toBe("HOME");
    expect(outcomeOf(0, 1)).toBe("AWAY");
    expect(outcomeOf(1, 1)).toBe("DRAW");
  });
});

describe("computePlayerStats", () => {
  const stats = computePlayerStats({
    preds,
    matchPoints: [
      { kickoff: day1(16), points: 5 },
      { kickoff: day2(16), points: 3 },
      { kickoff: day2(18), points: 4 },
    ],
    wildcardsUsed: 2,
    exactScores: 1,
  });

  it("counts scored matches and accuracy (ignoring unplayed)", () => {
    expect(stats.scoredMatches).toBe(4);
    expect(stats.correctOutcomes).toBe(3);
    expect(stats.accuracyPct).toBe(75);
  });

  it("computes current and longest streaks", () => {
    expect(stats.currentStreak).toBe(2); // m3, m4 trailing
    expect(stats.longestStreak).toBe(2);
  });

  it("finds best and worst matchday by points earned", () => {
    expect(stats.bestMatchday?.points).toBe(7); // day2: 3 + 4
    expect(stats.worstMatchday?.points).toBe(5); // day1
  });

  it("returns zeros gracefully with no scored matches", () => {
    const empty = computePlayerStats({ preds: [], matchPoints: [], wildcardsUsed: 0, exactScores: 0 });
    expect(empty.accuracyPct).toBe(0);
    expect(empty.bestMatchday).toBeNull();
  });
});

describe("computeAchievements", () => {
  it("awards the right badges from the data", () => {
    const a = computeAchievements({ preds, exactScores: 5, longestStreak: 5, championCorrect: true });
    const earned = Object.fromEntries(a.map((x) => [x.key, x.earned]));
    expect(earned.ORACLE).toBe(true);
    expect(earned.EXACTA).toBe(true); // 5 exact
    expect(earned.HOT_STREAK).toBe(true); // streak 5
    expect(earned.UNDERDOG).toBe(true); // m4 away upset
    expect(earned.PERFECT_DAY).toBe(true); // day2: m3 + m4 both correct
  });

  it("locks badges when thresholds aren't met", () => {
    const a = computeAchievements({ preds: [], exactScores: 1, longestStreak: 1, championCorrect: false });
    expect(a.every((x) => !x.earned)).toBe(true);
  });
});
