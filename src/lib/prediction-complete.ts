// Single source of truth for what makes a match prediction "complete".
// A prediction counts as complete when the score, the three yes/no/team calls,
// and the any-time goalscorer pick are all set. Bold Call is never required.
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
    { key: "anytime", label: "Any-time goalscorer", done: count("ANYTIME") >= 1 },
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
