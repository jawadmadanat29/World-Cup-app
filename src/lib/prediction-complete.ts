// Single source of truth for what makes a match prediction "complete" (Q2).
// Advanced picks are mandatory: a prediction only counts as complete when the
// score, the three yes/no/team calls, AND exactly 2 any-time scorers + 2 assist
// providers + 1 multi-goal scorer are all set. Bold Call is never required.
// Used by the predictions page, the home progress card, and profiles.

export interface MatchPredLike {
  homeGoals: number | null;
  awayGoals: number | null;
  firstTeamToScore: string | null;
  bttsPrediction: boolean | null;
  cleanSheetPrediction: boolean | null;
  scorerPicks: { pickType: string }[];
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export function matchPredictionChecklist(p: MatchPredLike | null | undefined): ChecklistItem[] {
  const count = (t: string) => (p ? p.scorerPicks.filter((s) => s.pickType === t).length : 0);
  return [
    { key: "score", label: "Predicted score", done: !!p && p.homeGoals != null && p.awayGoals != null },
    { key: "first", label: "First team to score", done: !!p && p.firstTeamToScore != null },
    { key: "btts", label: "Both teams to score", done: !!p && p.bttsPrediction != null },
    { key: "clean", label: "Clean sheet", done: !!p && p.cleanSheetPrediction != null },
    { key: "anytime", label: "2 any-time scorers", done: count("ANYTIME") === 2 },
    { key: "assist", label: "2 assist providers", done: count("ASSIST") === 2 },
    { key: "multi", label: "Multi-goal scorer", done: count("MULTI") === 1 },
  ];
}

/** A prediction exists at all (score entered) — "started", not necessarily complete. */
export function isMatchPredictionStarted(p: MatchPredLike | null | undefined): boolean {
  return !!p && p.homeGoals != null && p.awayGoals != null;
}

/** Every mandatory field present. */
export function isMatchPredictionComplete(p: MatchPredLike | null | undefined): boolean {
  return matchPredictionChecklist(p).every((c) => c.done);
}
