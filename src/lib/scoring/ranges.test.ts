import { describe, it, expect } from "vitest";
import { parseRange, rangeContains } from "@/lib/scoring/ranges";

describe("parseRange", () => {
  it("parses bounded, open-ended, less-than and single values", () => {
    expect(parseRange("2-3")).toEqual({ min: 2, max: 3 });
    expect(parseRange("6+")).toEqual({ min: 6, max: Infinity });
    expect(parseRange("<140")).toEqual({ min: -Infinity, max: 139 });
    expect(parseRange("0")).toEqual({ min: 0, max: 0 });
    expect(parseRange("180+")).toEqual({ min: 180, max: Infinity });
  });

  it("returns null for garbage", () => {
    expect(parseRange("")).toBeNull();
    expect(parseRange("abc")).toBeNull();
  });
});

describe("rangeContains", () => {
  it("tests membership", () => {
    expect(rangeContains("2-3", 2)).toBe(true);
    expect(rangeContains("2-3", 4)).toBe(false);
    expect(rangeContains("6+", 9)).toBe(true);
    expect(rangeContains("<140", 100)).toBe(true);
    expect(rangeContains("<140", 140)).toBe(false);
    expect(rangeContains(null, 3)).toBe(false);
  });
});
