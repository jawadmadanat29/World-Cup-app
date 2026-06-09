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
    wentToExtraTime: false,
    wentToPenalties: false,
    pensHome: null,
    pensAway: null,
    advancingTeamId: null,
    firstScorerPlayerId: null,
    scorerPlayerIds: [],
    multiScorerPlayerIds: [],
    assistPlayerIds: [],
    firstTeamToScore: "NONE",
    ...p,
  };
}

function pred(p: Partial<MatchPredictionInput> = {}): MatchPredictionInput {
  return {
    homeGoals: null,
    awayGoals: null,
    advanceTeamId: null,
    predictExtraTime: null,
    predictPenalties: null,
    penaltyHome: null,
    penaltyAway: null,
    firstTeamToScore: null,
    bttsPrediction: null,
    cleanSheetPrediction: null,
    firstScorerPlayerId: null,
    anytimeScorerPlayerIds: [],
    assistPlayerIds: [],
    multiScorerPlayerIds: [],
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

describe("scoreMatchResult — the spec examples (section A)", () => {
  it("2-1 vs 2-1 → outcome + exact = 7 (no double-counting)", () => {
    const a = scoreMatchResult({ home: 2, away: 1 }, { home: 2, away: 1 }, R);
    expect(sumAwards(a)).toBe(7);
    expect(a.map((x) => x.source).sort()).toEqual(["MATCH_EXACT", "MATCH_OUTCOME"]);
    // exact must NOT also award GD or total
    expect(a.some((x) => x.source === "MATCH_GD")).toBe(false);
    expect(a.some((x) => x.source === "MATCH_TOTAL")).toBe(false);
  });

  it("3-1 vs 2-0 → outcome + GD = 4", () => {
    expect(sumAwards(scoreMatchResult({ home: 3, away: 1 }, { home: 2, away: 0 }, R))).toBe(4);
  });

  it("1-0 vs 2-1 → outcome + GD = 4", () => {
    expect(sumAwards(scoreMatchResult({ home: 1, away: 0 }, { home: 2, away: 1 }, R))).toBe(4);
  });

  it("2-2 vs 1-1 → draw + GD = 4", () => {
    expect(sumAwards(scoreMatchResult({ home: 2, away: 2 }, { home: 1, away: 1 }, R))).toBe(4);
  });

  it("4-0 vs 3-1 → outcome + total goals = 4", () => {
    const a = scoreMatchResult({ home: 4, away: 0 }, { home: 3, away: 1 }, R);
    expect(sumAwards(a)).toBe(4);
    expect(a.some((x) => x.source === "MATCH_TOTAL")).toBe(true);
    expect(a.some((x) => x.source === "MATCH_GD")).toBe(false);
  });

  it("wrong outcome → 0 points", () => {
    expect(sumAwards(scoreMatchResult({ home: 2, away: 1 }, { home: 0, away: 1 }, R))).toBe(0);
  });
});

describe("scoreMatch — bonuses (section B)", () => {
  it("first goalscorer correct → 3", () => {
    const a = scoreMatch(pred({ firstScorerPlayerId: "p1" }), actual({ firstScorerPlayerId: "p1", scorerPlayerIds: ["p1"] }), R);
    expect(a.find((x) => x.source === "BONUS_FIRST_SCORER")?.points).toBe(3);
  });

  it("any-time goalscorers score per correct player only", () => {
    const a = scoreMatch(
      pred({ anytimeScorerPlayerIds: ["p1", "p2"] }),
      actual({ scorerPlayerIds: ["p2", "p3"] }),
      R,
    );
    const got = a.filter((x) => x.source === "BONUS_ANYTIME_SCORER");
    expect(got).toHaveLength(1);
    expect(got[0].ref).toBe("p2");
  });

  it("assist providers score 2 each", () => {
    const a = scoreMatch(pred({ assistPlayerIds: ["a1"] }), actual({ assistPlayerIds: ["a1"] }), R);
    expect(a.find((x) => x.source === "BONUS_ASSIST")?.points).toBe(2);
  });

  it("BTTS / clean sheet", () => {
    const a = scoreMatch(
      pred({ bttsPrediction: true, cleanSheetPrediction: false }),
      actual({ ftHome: 2, ftAway: 1 }),
      R,
    );
    expect(a.some((x) => x.source === "BONUS_BTTS")).toBe(true);
    expect(a.some((x) => x.source === "BONUS_CLEAN_SHEET")).toBe(true); // clean sheet=false, actual no clean sheet -> correct
  });

  it("multi-goal scorer: awards only when the predicted player scored 2+", () => {
    const hit = scoreMatch(pred({ multiScorerPlayerIds: ["p1"] }), actual({ multiScorerPlayerIds: ["p1"] }), R);
    expect(hit.find((x) => x.source === "BONUS_MULTI_SCORER")?.points).toBe(4);
    // predicted player only scored once (not in actual multi list) -> no award
    const miss = scoreMatch(pred({ multiScorerPlayerIds: ["p1"] }), actual({ scorerPlayerIds: ["p1"], multiScorerPlayerIds: [] }), R);
    expect(miss.some((x) => x.source === "BONUS_MULTI_SCORER")).toBe(false);
  });
});

describe("scoreMatch — knockout extras", () => {
  it("advance + extra time + penalties + exact shootout", () => {
    const a = scoreMatch(
      pred({
        homeGoals: 1,
        awayGoals: 1,
        isKnockout: true,
        advanceTeamId: "A",
        predictExtraTime: true,
        predictPenalties: true,
        penaltyHome: 4,
        penaltyAway: 3,
      }),
      actual({
        ftHome: 1,
        ftAway: 1,
        advancingTeamId: "A",
        wentToExtraTime: true,
        wentToPenalties: true,
        pensHome: 4,
        pensAway: 3,
      }),
      R,
    );
    expect(a.find((x) => x.source === "KO_ADVANCE")?.points).toBe(2);
    expect(a.find((x) => x.source === "KO_EXTRA_TIME")?.points).toBe(1);
    expect(a.find((x) => x.source === "KO_PENALTIES")?.points).toBe(2);
    expect(a.find((x) => x.source === "KO_PEN_SCORE")?.points).toBe(2);
  });
});

describe("scoreMatch — wildcard doubling", () => {
  it("doubles the result points only", () => {
    const a = scoreMatch(pred({ homeGoals: 2, awayGoals: 1, wildcardApplied: true }), actual({ ftHome: 2, ftAway: 1 }), R);
    // result = 7, wildcard adds +7
    expect(sumAwards(a)).toBe(14);
    expect(a.find((x) => x.source === "WILDCARD_DOUBLE")?.points).toBe(7);
  });

  it("does NOT double goalscorer/bonus points", () => {
    const a = scoreMatch(
      pred({ homeGoals: 2, awayGoals: 1, wildcardApplied: true, firstScorerPlayerId: "p1" }),
      actual({ ftHome: 2, ftAway: 1, firstScorerPlayerId: "p1", scorerPlayerIds: ["p1"] }),
      R,
    );
    // 7 (result) + 3 (first scorer) + 7 (wildcard double of result only) = 17
    expect(sumAwards(a)).toBe(17);
    expect(a.find((x) => x.source === "WILDCARD_DOUBLE")?.points).toBe(7);
  });

  it("is idempotent — same inputs produce identical awards", () => {
    const inP = pred({ homeGoals: 3, awayGoals: 2, isKnockout: true, advanceTeamId: "A" });
    const inA = actual({ ftHome: 3, ftAway: 2, advancingTeamId: "A" });
    expect(scoreMatch(inP, inA, R)).toEqual(scoreMatch(inP, inA, R));
  });
});

describe("scoreGroup (section C)", () => {
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

describe("scoreBestThirds (section C)", () => {
  it("awards 2 per correct best-third", () => {
    const a = scoreBestThirds(["A", "B", "C", "D"], ["A", "C", "X", "Y"], R);
    expect(a).toHaveLength(2);
    expect(sumAwards(a)).toBe(4);
  });
});

describe("scoreTournament (sections D/E)", () => {
  it("scores champion, finalist, semifinalists, QFs and extras", () => {
    const a = scoreTournament(
      {
        championTeamId: "A",
        runnerUpTeamId: "B",
        thirdTeamId: null,
        fourthTeamId: null,
        semifinalistTeamIds: ["A", "B", "C", "Z"],
        quarterfinalistTeamIds: ["A", "B", "C", "D"],
        roundOf16TeamIds: [],
        surpriseTeamId: "S",
        disappointingTeamId: null,
        highestScoringTeamId: null,
        bestDefensiveTeamId: null,
        totalGoalsRange: "140-159",
        finalPenaltyShootout: true,
        redCardRange: null,
        hatTrickRange: null,
      },
      {
        championTeamId: "A",
        runnerUpTeamId: "B",
        thirdTeamId: "C",
        fourthTeamId: "D",
        semifinalistTeamIds: ["A", "B", "C", "D"],
        quarterfinalistTeamIds: ["A", "B", "C", "D", "E", "F", "G", "H"],
        roundOf16TeamIds: [],
        surpriseTeamId: "S",
        disappointingTeamId: "X",
        highestScoringTeamId: "Y",
        bestDefensiveTeamId: "Z",
        totalGoals: 150,
        finalWentToPens: true,
        redCards: 5,
        hatTricks: 1,
      },
      R,
    );
    // champion 25 + finalist 15 + SF (A,B,C correct, Z wrong) 30 + QF (A,B,C,D) 24
    // + surprise 5 + total goals 5 + final pens 3 = 107
    expect(sumAwards(a)).toBe(107);
  });
});

describe("scoreAward (section E)", () => {
  it("awards points for a correct player, nothing otherwise", () => {
    expect(scoreAward("GOLDEN_BOOT", "p1", "p1", R)?.points).toBe(15);
    expect(scoreAward("GOLDEN_BOOT", "p1", "p2", R)).toBeNull();
    expect(scoreAward("MVP", "p9", "p9", R)?.points).toBe(15);
  });
});

describe("dedupe keys (prevent duplicate scoring)", () => {
  it("produces unique keys for distinct per-player awards", () => {
    const awards = scoreMatch(
      pred({ anytimeScorerPlayerIds: ["p1", "p2"] }),
      actual({ scorerPlayerIds: ["p1", "p2"] }),
      R,
    );
    const keys = awards.map((a) => buildDedupeKey("participant-1", "match-1", a));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
