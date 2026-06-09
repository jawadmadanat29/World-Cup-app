// Leaderboard ordering + tiebreakers (section G).
// Order: total points, then most exact scores, most correct outcomes, most
// correct knockout winners, most correct goalscorers, most correct awards,
// earliest final-tournament submission, else a genuinely shared position.

export interface LeaderboardStats {
  participantId: string;
  totalPoints: number;
  exactScores: number;
  correctOutcomes: number;
  correctKnockoutWinners: number;
  correctScorers: number;
  correctAwards: number;
  /** epoch ms of final tournament prediction submission; earlier wins, null last */
  finalSubmittedAt: number | null;
}

export interface RankedRow extends LeaderboardStats {
  rank: number;
  /** true when this row shares its rank with another (fully tied). */
  shared: boolean;
}

export function compareLeaderboard(a: LeaderboardStats, b: LeaderboardStats): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
  if (b.correctOutcomes !== a.correctOutcomes) return b.correctOutcomes - a.correctOutcomes;
  if (b.correctKnockoutWinners !== a.correctKnockoutWinners) return b.correctKnockoutWinners - a.correctKnockoutWinners;
  if (b.correctScorers !== a.correctScorers) return b.correctScorers - a.correctScorers;
  if (b.correctAwards !== a.correctAwards) return b.correctAwards - a.correctAwards;
  // Earliest submitted final prediction wins (null = not submitted = last).
  const aT = a.finalSubmittedAt ?? Number.POSITIVE_INFINITY;
  const bT = b.finalSubmittedAt ?? Number.POSITIVE_INFINITY;
  if (aT !== bT) return aT - bT;
  return 0; // genuinely tied -> shared position
}

export function rankLeaderboard(stats: LeaderboardStats[]): RankedRow[] {
  const sorted = [...stats].sort(compareLeaderboard);
  const out: RankedRow[] = [];
  let rank = 0;
  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const tiedWithPrev = prev != null && compareLeaderboard(prev, sorted[i]) === 0;
    if (!tiedWithPrev) rank = i + 1; // standard competition ranking (1,2,2,4)
    out.push({ ...sorted[i], rank, shared: false });
  }
  // Flag shared ranks.
  const counts = new Map<number, number>();
  for (const r of out) counts.set(r.rank, (counts.get(r.rank) ?? 0) + 1);
  for (const r of out) r.shared = (counts.get(r.rank) ?? 0) > 1;
  return out;
}
