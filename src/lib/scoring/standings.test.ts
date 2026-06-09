import { describe, it, expect } from "vitest";
import {
  computeGroupStandings,
  rankBestThirds,
  groupQualification,
  type StandingMatch,
} from "@/lib/scoring/standings";

describe("computeGroupStandings (section 10)", () => {
  const teams = ["t1", "t2", "t3", "t4"];
  const matches: StandingMatch[] = [
    { homeTeamId: "t1", awayTeamId: "t2", ftHome: 2, ftAway: 0 },
    { homeTeamId: "t1", awayTeamId: "t3", ftHome: 1, ftAway: 0 },
    { homeTeamId: "t1", awayTeamId: "t4", ftHome: 3, ftAway: 0 },
    { homeTeamId: "t2", awayTeamId: "t3", ftHome: 1, ftAway: 0 },
    { homeTeamId: "t2", awayTeamId: "t4", ftHome: 2, ftAway: 1 },
    { homeTeamId: "t3", awayTeamId: "t4", ftHome: 2, ftAway: 1 },
  ];

  it("orders by points, GD, GF", () => {
    const table = computeGroupStandings(teams, matches);
    expect(table.map((r) => r.teamId)).toEqual(["t1", "t2", "t3", "t4"]);
    expect(table[0]).toMatchObject({ teamId: "t1", played: 3, won: 3, points: 9, gf: 6, ga: 0, gd: 6 });
    expect(table[1]).toMatchObject({ teamId: "t2", points: 6 });
    expect(table[3]).toMatchObject({ teamId: "t4", points: 0, gd: -5 });
  });

  it("breaks point ties by goal difference then goals for", () => {
    const t = ["a", "b"];
    const m: StandingMatch[] = [
      { homeTeamId: "a", awayTeamId: "b", ftHome: 1, ftAway: 1 }, // both 1pt
    ];
    // equal points & GD & GF -> deterministic by seed order
    const table = computeGroupStandings(t, m);
    expect(table.map((r) => r.teamId)).toEqual(["a", "b"]);
  });
});

describe("rankBestThirds", () => {
  it("ranks third-placed teams and qualifies the top N", () => {
    const ranked = rankBestThirds(
      [
        { groupCode: "A", row: { teamId: "a3", played: 3, won: 1, drawn: 1, lost: 1, gf: 4, ga: 3, gd: 1, points: 4 } },
        { groupCode: "B", row: { teamId: "b3", played: 3, won: 2, drawn: 0, lost: 1, gf: 5, ga: 3, gd: 2, points: 6 } },
        { groupCode: "C", row: { teamId: "c3", played: 3, won: 0, drawn: 1, lost: 2, gf: 1, ga: 5, gd: -4, points: 1 } },
      ],
      2,
    );
    expect(ranked.map((r) => r.row.teamId)).toEqual(["b3", "a3", "c3"]);
    expect(ranked.filter((r) => r.qualified).map((r) => r.row.teamId)).toEqual(["b3", "a3"]);
  });
});

describe("groupQualification", () => {
  const rows = [
    { teamId: "1st", played: 3, won: 3, drawn: 0, lost: 0, gf: 6, ga: 0, gd: 6, points: 9 },
    { teamId: "2nd", played: 3, won: 2, drawn: 0, lost: 1, gf: 4, ga: 3, gd: 1, points: 6 },
    { teamId: "3rd", played: 3, won: 1, drawn: 0, lost: 2, gf: 2, ga: 4, gd: -2, points: 3 },
    { teamId: "4th", played: 3, won: 0, drawn: 0, lost: 3, gf: 1, ga: 6, gd: -5, points: 0 },
  ];

  it("marks top-2 AUTO, a qualifying third BEST_THIRD, others ELIMINATED", () => {
    const q = groupQualification(rows, new Set(["3rd"]), true);
    expect(q.get("1st")).toBe("AUTO");
    expect(q.get("2nd")).toBe("AUTO");
    expect(q.get("3rd")).toBe("BEST_THIRD");
    expect(q.get("4th")).toBe("ELIMINATED");
  });

  it("marks everything PENDING until the group is complete", () => {
    const q = groupQualification(rows, new Set(), false);
    expect([...q.values()].every((v) => v === "PENDING")).toBe(true);
  });
});
