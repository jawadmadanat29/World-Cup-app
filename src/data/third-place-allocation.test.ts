import { describe, it, expect } from "vitest";
import { thirdPlaceAssignment, THIRD_WINNERS } from "@/data/third-place-allocation";

// The group each winner slot is *allowed* to draw a third from, per the official
// 2026 FIFA World Cup Round of 32 bracket (e.g. "1A vs 3rd Group C/E/F/H/I").
const ALLOWED: Record<string, string> = {
  A: "CEFHI", B: "EFGIJ", D: "BEFIJ", E: "ABCDF",
  G: "AEHIJ", I: "CDFGH", K: "DEIJL", L: "EHIJK",
};

const GROUPS = "ABCDEFGHIJKL".split("");
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [head, ...rest] = arr;
  return [...combinations(rest, k - 1).map((c) => [head, ...c]), ...combinations(rest, k)];
}

describe("thirdPlaceAssignment (FIFA Annex C)", () => {
  it("returns null until exactly 8 distinct groups are supplied", () => {
    expect(thirdPlaceAssignment([])).toBeNull();
    expect(thirdPlaceAssignment(["A", "B", "C"])).toBeNull();
    expect(thirdPlaceAssignment("ABCDEFG".split(""))).toBeNull(); // 7
    expect(thirdPlaceAssignment("ABCDEFGHI".split(""))).toBeNull(); // 9
    expect(thirdPlaceAssignment("AABBCCDDEEFF".split(""))).toBeNull(); // dupes -> 6 distinct
  });

  it("covers all 495 combinations with a valid, constraint-respecting permutation", () => {
    const combos = combinations(GROUPS, 8);
    expect(combos.length).toBe(495);
    for (const combo of combos) {
      const a = thirdPlaceAssignment(combo);
      expect(a, combo.join("")).not.toBeNull();
      const assigned = THIRD_WINNERS.map((w) => a![w]);
      // every winner slot gets a third, all distinct, exactly the qualifying set
      expect([...assigned].sort()).toEqual([...combo].sort());
      // each assignment obeys FIFA's allowed-group constraint
      for (const w of THIRD_WINNERS) expect(ALLOWED[w]).toContain(a![w]);
    }
  });

  it("matches the official table for a known combination", () => {
    // Combination 1 on the FIFA/Wikipedia bracket: thirds from E,F,G,H,I,J,K,L.
    expect(thirdPlaceAssignment("EFGHIJKL".split(""))).toEqual({
      A: "E", B: "J", D: "I", E: "F", G: "H", I: "G", K: "L", L: "K",
    });
  });

  it("is independent of the order groups are supplied", () => {
    const a = thirdPlaceAssignment("ABCDEFGH".split(""));
    const b = thirdPlaceAssignment("HGFEDCBA".split(""));
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
  });
});
