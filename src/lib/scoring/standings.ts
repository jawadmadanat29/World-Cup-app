// Pure group-standings computation (section 10) + best third-place ranking.
// Win = 3, Draw = 1, Loss = 0. Tiebreak: points, GD, GF, then the team's
// original (seed) order for determinism. The admin can override final orders
// for the rare official tie scenarios that need a drawing of lots / fair play.

export interface StandingMatch {
  homeTeamId: string;
  awayTeamId: string;
  ftHome: number;
  ftAway: number;
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export function computeGroupStandings(
  teamIds: string[],
  matches: StandingMatch[],
): StandingRow[] {
  const inGroup = new Set(teamIds);
  const rows = new Map<string, StandingRow>();
  for (const t of teamIds) {
    rows.set(t, { teamId: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
  }

  for (const m of matches) {
    if (!inGroup.has(m.homeTeamId) || !inGroup.has(m.awayTeamId)) continue;
    const h = rows.get(m.homeTeamId)!;
    const a = rows.get(m.awayTeamId)!;
    h.played++; a.played++;
    h.gf += m.ftHome; h.ga += m.ftAway;
    a.gf += m.ftAway; a.ga += m.ftHome;
    if (m.ftHome > m.ftAway) { h.won++; h.points += 3; a.lost++; }
    else if (m.ftHome < m.ftAway) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }

  for (const r of rows.values()) r.gd = r.gf - r.ga;

  const order = new Map(teamIds.map((t, i) => [t, i]));
  return [...rows.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.gd !== x.gd) return y.gd - x.gd;
    if (y.gf !== x.gf) return y.gf - x.gf;
    return (order.get(x.teamId)! - order.get(y.teamId)!);
  });
}

export interface ThirdPlaceEntry {
  groupCode: string;
  row: StandingRow;
}

export interface RankedThird extends ThirdPlaceEntry {
  rank: number;
  qualified: boolean;
}

/** Rank the third-placed teams across groups; the top `take` qualify. */
export function rankBestThirds(
  thirds: ThirdPlaceEntry[],
  take: number,
): RankedThird[] {
  const sorted = [...thirds].sort((x, y) => {
    if (y.row.points !== x.row.points) return y.row.points - x.row.points;
    if (y.row.gd !== x.row.gd) return y.row.gd - x.row.gd;
    if (y.row.gf !== x.row.gf) return y.row.gf - x.row.gf;
    return x.groupCode.localeCompare(y.groupCode);
  });
  return sorted.map((e, i) => ({ ...e, rank: i + 1, qualified: i < take }));
}

export type Qualification = "AUTO" | "BEST_THIRD" | "ELIMINATED" | "PENDING";

/** Mark qualification for a single completed group (top-2 auto). */
export function groupQualification(
  rows: StandingRow[],
  bestThirdTeamIds: Set<string>,
  groupComplete: boolean,
): Map<string, Qualification> {
  const out = new Map<string, Qualification>();
  rows.forEach((r, i) => {
    if (!groupComplete) { out.set(r.teamId, "PENDING"); return; }
    if (i < 2) out.set(r.teamId, "AUTO");
    else if (i === 2 && bestThirdTeamIds.has(r.teamId)) out.set(r.teamId, "BEST_THIRD");
    else out.set(r.teamId, "ELIMINATED");
  });
  return out;
}
