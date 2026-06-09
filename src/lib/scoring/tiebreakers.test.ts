import { describe, it, expect } from "vitest";
import { rankLeaderboard, type LeaderboardStats } from "@/lib/scoring/tiebreakers";

function s(p: Partial<LeaderboardStats> & { participantId: string; totalPoints: number }): LeaderboardStats {
  return {
    exactScores: 0,
    correctOutcomes: 0,
    correctKnockoutWinners: 0,
    correctScorers: 0,
    correctAwards: 0,
    finalSubmittedAt: null,
    ...p,
  };
}

describe("rankLeaderboard (section G tiebreakers)", () => {
  it("ranks by total points first", () => {
    const r = rankLeaderboard([s({ participantId: "a", totalPoints: 50 }), s({ participantId: "b", totalPoints: 70 })]);
    expect(r[0].participantId).toBe("b");
    expect(r[0].rank).toBe(1);
  });

  it("breaks ties on exact scores, then outcomes", () => {
    const r = rankLeaderboard([
      s({ participantId: "a", totalPoints: 100, exactScores: 5, correctOutcomes: 8 }),
      s({ participantId: "b", totalPoints: 100, exactScores: 5, correctOutcomes: 10 }),
      s({ participantId: "c", totalPoints: 100, exactScores: 7, correctOutcomes: 1 }),
    ]);
    expect(r.map((x) => x.participantId)).toEqual(["c", "b", "a"]);
  });

  it("prefers the earlier final submission", () => {
    const r = rankLeaderboard([
      s({ participantId: "late", totalPoints: 40, finalSubmittedAt: 2000 }),
      s({ participantId: "early", totalPoints: 40, finalSubmittedAt: 1000 }),
    ]);
    expect(r[0].participantId).toBe("early");
  });

  it("assigns a shared position when fully tied", () => {
    const r = rankLeaderboard([
      s({ participantId: "x", totalPoints: 40 }),
      s({ participantId: "y", totalPoints: 40 }),
      s({ participantId: "z", totalPoints: 30 }),
    ]);
    expect(r[0].rank).toBe(1);
    expect(r[1].rank).toBe(1);
    expect(r[0].shared).toBe(true);
    expect(r[1].shared).toBe(true);
    expect(r[2].rank).toBe(3); // standard competition ranking
    expect(r[2].shared).toBe(false);
  });
});
