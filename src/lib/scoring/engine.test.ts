import { describe, it, expect } from "vitest";
import {
  scoreMatchResult,
  scoreMatch,
  scoreGroup,
  scoreBestThirds,
  scoreTournament,
  scoreAward,
  sumAwards,
  outcomeOf,
  type ActualMatch,
  type MatchPredictionInput,
} from "@/lib/scoring/engine";
import { DEFAULT_RULE_MAP } from "@/lib/scoring/rules";
import { buildDedupeKey } from "@/lib/scoring/dedupe";

const R = DEFAULT_RULE_MAP;

function actual(p: Partial<ActualMatch> = {}): ActualMatch {
  return {
    ftHome: 0,
    ftAway: 0,
    advancingTeamId: null,
    scorerPlayerIds: [],
    firstTeamToScore: "NONE",
    ...p,
  };
}

function pred(p: Partial<MatchPredictionInput> = {}): MatchPredictionInput {
  return {
    homeGoals: null,
    awayGoals: null,
    advanceTeamId: null,
    firstTeamToScore: null,
    bttsPrediction: null,
    cleanSheetPrediction: null,
    anytimeScorerPlayerIds: [],
    wildcardApplied: false,
    isKnockout: false,
    ...p,
  };
}

describe("outcomeOf", () => {
  it("derives outcomes from a score", () => {
    expect(outcomeOf({ home: 2, away: 1 })).toBe("HOME");
    expect(outcomeOf({ home: 0, away: 3 })).toBe("AWAY");
    expect(outcomeOf({ home: 1, away: 1 })).toBe("DRAW");
  });
});

describe("scoreMatchResult — result + exact bonus", () => {
  it("2-1 vs 2-1 → correct result (3) + exact (5) = 8", () => {
    const a = scoreMatchResult({ home: 2, away: 1 }, { home: 2, away: 1 }, R);
    expect(sumAwards(a)).toBe(8);
    expect(a.map((x) => x.source).sort()).toEqual(["MATCH_EXACT", "MATCH_OUTCOME"]);
  });

  it("correct result but wrong score → just 3 (no GD/total bonuses)", () => {
    const a = scoreMatchResult({ home: 3, away: 1 }, { home: 2, away: 0 }, R);
    expect(sumAwards(a)).toBe(3);
    expect(a.map((x) => x.source)).toEqual(["MATCH_OUTCOME"]);
  });

  it("wrong outcome → 0 points", () => {
    expect(sumAwards(scoreMatchResult({ home: 2, away: 1 }, { home: 0, away: 1 }, R))).toBe(0);
  });
});

describe("scoreMatch — bonuses", () => {
  it("any-time goalscorer scores when the picked player scores", () => {
    const a = scoreMatch(pred({ anytimeScorerPlayerIds: ["p1"] }), actual({ scorerPlayerIds: ["p1", "p3"] }), R);
    const got = a.filter((x) => x.source === "BONUS_ANYTIME_SCORER");
    expect(got).toHaveLength(1);
    expect(got[0].points).toBe(2);
    expect(got[0].ref).toBe("p1");
  });

  it("any-time goalscorer earns nothing when the picked player doesn't score", () => {
    const a = scoreMatch(pred({ anytimeScorerPlayerIds: ["p1"] }), actual({ scorerPlayerIds: ["p2"] }), R);
    expect(a.some((x) => x.source === "BONUS_ANYTIME_SCORER")).toBe(false);
  });

  it("first team to score / BTTS / clean sheet", () => {
    const a = scoreMatch(
      pred({ firstTeamToScore: "HOME", bttsPrediction: true, cleanSheetPrediction: false }),
      actual({ ftHome: 2, ftAway: 1, firstTeamToScore: "HOME" }),
      R,
    );
    expect(a.some((x) => x.source === "BONUS_FIRST_TO_SCORE")).toBe(true);
    expect(a.some((x) => x.source === "BONUS_BTTS")).toBe(true);
    expect(a.some((x) => x.source === "BONUS_CLEAN_SHEET")).toBe(true); // predicted no clean sheet, none happened
  });
});

describe("scoreMatch — knockout advance", () => {
  it("awards +2 for the correct team to advance (however they got there)", () => {
    const a = scoreMatch(
      pred({ homeGoals: 1, awayGoals: 1, isKnockout: true, advanceTeamId: "A" }),
      actual({ ftHome: 1, ftAway: 1, advancingTeamId: "A" }),
      R,
    );
    expect(a.find((x) => x.source === "KO_ADVANCE")?.points).toBe(2);
  });

  it("no advance points in a group match", () => {
    const a = scoreMatch(
      pred({ homeGoals: 1, awayGoals: 0, isKnockout: false, advanceTeamId: "A" }),
      actual({ ftHome: 1, ftAway: 0, advancingTeamId: "A" }),
      R,
    );
    expect(a.some((x) => x.source === "KO_ADVANCE")).toBe(false);
  });
});

describe("scoreMatch — wildcard doubling", () => {
  it("doubles the result points only", () => {
    const a = scoreMatch(pred({ homeGoals: 2, awayGoals: 1, wildcardApplied: true }), actual({ ftHome: 2, ftAway: 1 }), R);
    // result = 8, wildcard adds +8
    expect(sumAwards(a)).toBe(16);
    expect(a.find((x) => x.source === "WILDCARD_DOUBLE")?.points).toBe(8);
  });

  it("does NOT double bonus points", () => {
    const a = scoreMatch(
      pred({ homeGoals: 2, awayGoals: 1, wildcardApplied: true, anytimeScorerPlayerIds: ["p1"] }),
      actual({ ftHome: 2, ftAway: 1, scorerPlayerIds: ["p1"] }),
      R,
    );
    // 8 (result) + 2 (any-time scorer) + 8 (wildcard double of result only) = 18
    expect(sumAwards(a)).toBe(18);
    expect(a.find((x) => x.source === "WILDCARD_DOUBLE")?.points).toBe(8);
  });

  it("is idempotent — same inputs produce identical awards", () => {
    const inP = pred({ homeGoals: 3, awayGoals: 2, isKnockout: true, advanceTeamId: "A" });
    const inA = actual({ ftHome: 3, ftAway: 2, advancingTeamId: "A" });
    expect(scoreMatch(inP, inA, R)).toEqual(scoreMatch(inP, inA, R));
  });
});

describe("scoreGroup", () => {
  it("exact group ranking → positions + exact bonus + advancing", () => {
    const a = scoreGroup({ positions: { A: 1, B: 2, C: 3, D: 4 } }, ["A", "B", "C", "D"], R);
    // 5+4+2+2 + 5 (exact) + 2+2 (advance A,B) = 22
    expect(sumAwards(a)).toBe(22);
    expect(a.some((x) => x.source === "GROUP_EXACT_BONUS")).toBe(true);
    expect(a.filter((x) => x.source === "GROUP_ADVANCE")).toHaveLength(2);
  });

  it("partial group ranking — winner + fourth + one advance", () => {
    const a = scoreGroup({ positions: { A: 1, B: 3, C: 2, D: 4 } }, ["A", "B", "C", "D"], R);
    // winner A (5) + fourth D (2) + advance A (2) = 9
    expect(sumAwards(a)).toBe(9);
    expect(a.some((x) => x.source === "GROUP_EXACT_BONUS")).toBe(false);
  });
});

describe("scoreBestThirds", () => {
  it("awards 2 per correct best-third", () => {
    const a = scoreBestThirds(["A", "B", "C", "D"], ["A", "C", "X", "Y"], R);
    expect(a).toHaveLength(2);
    expect(sumAwards(a)).toBe(4);
  });
});

describe("scoreTournament — bracket depth", () => {
  it("scores champion, finalist, semifinalists, QFs and R16", () => {
    const a = scoreTournament(
      {
        championTeamId: "A",
        runnerUpTeamId: "B",
        semifinalistTeamIds: ["A", "B", "C", "Z"],
        quarterfinalistTeamIds: ["A", "B", "C", "D"],
        roundOf16TeamIds: ["A", "B"],
      },
      {
        championTeamId: "A",
        runnerUpTeamId: "B",
        semifinalistTeamIds: ["A", "B", "C", "D"],
        quarterfinalistTeamIds: ["A", "B", "C", "D", "E", "F", "G", "H"],
        roundOf16TeamIds: ["A", "B", "C", "D"],
      },
      R,
    );
    // champion 30 + finalist 15 + SF (A,B,C correct) 30 + QF (A,B,C,D) 24 + R16 (A,B) 8 = 107
    expect(sumAwards(a)).toBe(107);
  });
});

describe("scoreAward", () => {
  it("awards points for the two surviving awards, nothing otherwise", () => {
    expect(scoreAward("GOLDEN_BOOT", "p1", "p1", R)?.points).toBe(15);
    expect(scoreAward("TOP_ASSIST", "p1", "p1", R)?.points).toBe(12);
    expect(scoreAward("GOLDEN_BOOT", "p1", "p2", R)).toBeNull();
    // retired award types no longer score
    expect(scoreAward("MVP", "p9", "p9", R)).toBeNull();
  });
});

describe("dedupe keys (prevent duplicate scoring)", () => {
  it("produces unique keys for distinct awards", () => {
    const awards = scoreMatch(
      pred({ homeGoals: 2, awayGoals: 1, anytimeScorerPlayerIds: ["p1"] }),
      actual({ ftHome: 2, ftAway: 1, scorerPlayerIds: ["p1"] }),
      R,
    );
    const keys = awards.map((a) => buildDedupeKey("participant-1", "match-1", a));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
