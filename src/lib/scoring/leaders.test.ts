import { describe, it, expect } from "vitest";
import {
  computeLeaderTallies,
  highestScoringTeam,
  bestDefensiveTeam,
  topByCount,
  type LeaderEvent,
  type LeaderMatch,
} from "@/lib/scoring/leaders";

const ev = (type: string, playerId: string | null, matchId: string, teamId: string | null = null): LeaderEvent => ({ type, playerId, matchId, teamId });

describe("computeLeaderTallies", () => {
  const events: LeaderEvent[] = [
    ev("GOAL", "p1", "m1"), ev("GOAL", "p1", "m1"), ev("GOAL", "p1", "m1"), // p1 hat-trick in m1
    ev("PENALTY_GOAL", "p1", "m2"),                                          // p1 +1 in m2 (total 4)
    ev("GOAL", "p2", "m1"),
    ev("OWN_GOAL", "p3", "m1"),                                              // own goal: not a scorer
    ev("ASSIST", "p2", "m1"), ev("ASSIST", "p2", "m2"),
    ev("YELLOW", "p2", "m1"), ev("RED", "p4", "m2"),
  ];
  const matches: LeaderMatch[] = [
    { homeTeamId: "A", awayTeamId: "B", ftHome: 4, ftAway: 1 }, // m1
    { homeTeamId: "A", awayTeamId: "C", ftHome: 1, ftAway: 0 }, // m2
  ];

  const t = computeLeaderTallies(events, matches);

  it("counts goals (excluding own goals) and assists", () => {
    expect(t.goals.get("p1")).toBe(4);
    expect(t.goals.get("p2")).toBe(1);
    expect(t.goals.get("p3")).toBeUndefined(); // own goal not credited
    expect(t.assists.get("p2")).toBe(2);
  });

  it("detects hat-tricks and the best single-match haul", () => {
    expect(t.hatTricks).toHaveLength(1);
    expect(t.hatTricks[0]).toMatchObject({ playerId: "p1", matchId: "m1", goals: 3 });
    expect(t.bestMatchHaul).toMatchObject({ playerId: "p1", goals: 3 });
  });

  it("counts cards", () => {
    expect(t.yellow.get("p2")).toBe(1);
    expect(t.red.get("p4")).toBe(1);
  });

  it("tallies team goals for/against and totals", () => {
    expect(t.teamGF.get("A")).toBe(5); // 4 + 1
    expect(t.teamGA.get("A")).toBe(1); // 1 + 0
    expect(t.teamGF.get("B")).toBe(1);
    expect(t.teamPlayed.get("A")).toBe(2);
    expect(t.totalGoals).toBe(6);
  });

  it("derives highest-scoring and best-defensive teams", () => {
    expect(highestScoringTeam(t)).toBe("A"); // 5 GF
    // A & C both concede 1 (A scored against C); tie broken by more GF -> A. B concedes 4.
    expect(bestDefensiveTeam(t)).toBe("A");
  });

  it("ranks by count", () => {
    expect(topByCount(t.goals)[0]).toEqual({ id: "p1", count: 4 });
  });
});
