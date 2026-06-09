// Pure tournament-stats aggregator. Operates on plain event/match rows so it is
// easy to unit-test and reusable by both the Leaders page (queries.ts) and the
// recompute layer (to auto-derive highest-scoring / best-defensive teams).

export interface LeaderEvent {
  type: string; // GOAL | PENALTY_GOAL | OWN_GOAL | ASSIST | YELLOW | RED
  playerId: string | null;
  matchId: string;
  teamId: string | null;
}

export interface LeaderMatch {
  homeTeamId: string | null;
  awayTeamId: string | null;
  ftHome: number;
  ftAway: number;
}

export interface LeaderTallies {
  goals: Map<string, number>; // playerId -> goals (GOAL + PENALTY_GOAL, excludes own goals)
  assists: Map<string, number>;
  yellow: Map<string, number>;
  red: Map<string, number>;
  hatTricks: { playerId: string; matchId: string; goals: number }[];
  bestMatchHaul: { playerId: string; matchId: string; goals: number } | null;
  teamGF: Map<string, number>;
  teamGA: Map<string, number>;
  teamPlayed: Map<string, number>;
  totalGoals: number;
}

const inc = (m: Map<string, number>, k: string | null, by = 1) => {
  if (!k) return;
  m.set(k, (m.get(k) ?? 0) + by);
};

export function computeLeaderTallies(events: LeaderEvent[], matches: LeaderMatch[]): LeaderTallies {
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  const yellow = new Map<string, number>();
  const red = new Map<string, number>();
  const perMatchPlayerGoals = new Map<string, number>(); // `${matchId}|${playerId}` -> goals

  for (const e of events) {
    if (e.type === "GOAL" || e.type === "PENALTY_GOAL") {
      inc(goals, e.playerId);
      if (e.playerId) inc(perMatchPlayerGoals, `${e.matchId}|${e.playerId}`);
    } else if (e.type === "ASSIST") {
      inc(assists, e.playerId);
    } else if (e.type === "YELLOW") {
      inc(yellow, e.playerId);
    } else if (e.type === "RED") {
      inc(red, e.playerId);
    }
  }

  const hatTricks: { playerId: string; matchId: string; goals: number }[] = [];
  let bestMatchHaul: { playerId: string; matchId: string; goals: number } | null = null;
  for (const [key, g] of perMatchPlayerGoals) {
    const [matchId, playerId] = key.split("|");
    if (g >= 3) hatTricks.push({ playerId, matchId, goals: g });
    if (!bestMatchHaul || g > bestMatchHaul.goals) bestMatchHaul = { playerId, matchId, goals: g };
  }
  hatTricks.sort((a, b) => b.goals - a.goals);

  const teamGF = new Map<string, number>();
  const teamGA = new Map<string, number>();
  const teamPlayed = new Map<string, number>();
  let totalGoals = 0;
  for (const m of matches) {
    totalGoals += m.ftHome + m.ftAway;
    if (m.homeTeamId) { inc(teamGF, m.homeTeamId, m.ftHome); inc(teamGA, m.homeTeamId, m.ftAway); inc(teamPlayed, m.homeTeamId); }
    if (m.awayTeamId) { inc(teamGF, m.awayTeamId, m.ftAway); inc(teamGA, m.awayTeamId, m.ftHome); inc(teamPlayed, m.awayTeamId); }
  }

  return { goals, assists, yellow, red, hatTricks, bestMatchHaul, teamGF, teamGA, teamPlayed, totalGoals };
}

/** Highest-scoring team (max goals-for; ties broken by fewest conceded). */
export function highestScoringTeam(t: LeaderTallies): string | null {
  let best: string | null = null;
  for (const [team, gf] of t.teamGF) {
    if (best === null) { best = team; continue; }
    const bgf = t.teamGF.get(best)!;
    if (gf > bgf || (gf === bgf && (t.teamGA.get(team) ?? 0) < (t.teamGA.get(best) ?? 0))) best = team;
  }
  return best;
}

/** Best defensive team among those that have played (fewest goals-against). */
export function bestDefensiveTeam(t: LeaderTallies): string | null {
  let best: string | null = null;
  for (const [team] of t.teamPlayed) {
    if (best === null) { best = team; continue; }
    const ga = t.teamGA.get(team) ?? 0;
    const bga = t.teamGA.get(best) ?? 0;
    if (ga < bga || (ga === bga && (t.teamGF.get(team) ?? 0) > (t.teamGF.get(best) ?? 0))) best = team;
  }
  return best;
}

export function topByCount(m: Map<string, number>, limit = 20): { id: string; count: number }[] {
  return [...m.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}
