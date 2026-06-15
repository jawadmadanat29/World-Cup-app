import "server-only";
import { subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/settings";
import { matchLockState, sectionLockState, isLocked } from "@/lib/locking";
import { groupMatchdays, currentMatchdayKey } from "@/lib/matchday";
import { isMatchPredictionStarted, isMatchPredictionComplete } from "@/lib/prediction-complete";
import { computePlayerStats, computeAchievements, outcomeOf, type Outcome, type PredOutcome } from "@/lib/player-stats";
import type { LockState } from "@/lib/enums";
import { computeGroupStandings, rankBestThirds, groupQualification, type Qualification } from "@/lib/scoring/standings";
import { rankLeaderboard, type LeaderboardStats } from "@/lib/scoring/tiebreakers";
import { computeLeaderTallies, topByCount, highestScoringTeam, bestDefensiveTeam } from "@/lib/scoring/leaders";

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

export type TeamLite = { id: string; name: string; shortName: string; isoCode: string };
export type ParticipantLite = {
  id: string; name: string; nickname: string | null; initials: string; accentColor: string; avatarId: string | null; favoriteTeamId: string | null;
};

export async function getTeamMap(): Promise<Map<string, TeamLite>> {
  const teams = await prisma.team.findMany({ select: { id: true, name: true, shortName: true, isoCode: true } });
  return new Map(teams.map((t) => [t.id, t]));
}

export async function getPlayerMap() {
  const players = await prisma.player.findMany({ select: { id: true, name: true, position: true, teamId: true } });
  return new Map(players.map((p) => [p.id, p]));
}

export async function getParticipants(): Promise<ParticipantLite[]> {
  return prisma.participant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, nickname: true, initials: true, accentColor: true, avatarId: true, favoriteTeamId: true },
  });
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export const CATEGORIES = ["MATCH", "GROUP", "KNOCKOUT_PRE", "KNOCKOUT_STAGE", "TOURNAMENT", "AWARD", "WILDCARD"] as const;

export interface LeaderboardRow {
  participant: ParticipantLite;
  total: number;
  autoTotal: number;
  adjustment: number;
  byCategory: Record<string, number>;
  stats: LeaderboardStats;
  rank: number;
  shared: boolean;
  movement: number; // +up / -down / 0
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const [participants, txns, adjustments, tourPreds] = await Promise.all([
    getParticipants(),
    prisma.pointTransaction.findMany(),
    prisma.adminAdjustment.findMany(),
    prisma.participantTournamentPrediction.findMany({ select: { participantId: true, submittedAt: true } }),
  ]);

  const recentMatches = await prisma.match.findMany({
    where: { result: { isNot: null }, kickoff: { gte: subDays(new Date(), 4) } },
    select: { id: true },
  });
  const recentSet = new Set(recentMatches.map((m) => m.id));

  const adjByP = new Map<string, number>();
  for (const a of adjustments) adjByP.set(a.participantId, (adjByP.get(a.participantId) ?? 0) + a.points);
  const submitByP = new Map<string, number>();
  for (const t of tourPreds) submitByP.set(t.participantId, t.submittedAt.getTime());

  const txnByP = new Map<string, typeof txns>();
  for (const t of txns) {
    const arr = txnByP.get(t.participantId) ?? [];
    arr.push(t);
    txnByP.set(t.participantId, arr);
  }

  const recentPointsByP = new Map<string, number>();
  const built = participants.map((p) => {
    const list = txnByP.get(p.id) ?? [];
    const byCategory: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
    let auto = 0, recent = 0, exact = 0, outcomes = 0, koWinners = 0, scorers = 0, awards = 0;
    for (const t of list) {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.points;
      auto += t.points;
      if (t.matchId && recentSet.has(t.matchId)) recent += t.points;
      if (t.source === "MATCH_EXACT") exact++;
      else if (t.source === "MATCH_OUTCOME") outcomes++;
      else if (t.source === "KO_ADVANCE") koWinners++;
      else if (t.source === "BONUS_FIRST_SCORER" || t.source === "BONUS_ANYTIME_SCORER") scorers++;
      else if (t.source.startsWith("AWARD_")) awards++;
    }
    const adjustment = adjByP.get(p.id) ?? 0;
    recentPointsByP.set(p.id, recent);
    const stats: LeaderboardStats = {
      participantId: p.id,
      totalPoints: auto + adjustment,
      exactScores: exact,
      correctOutcomes: outcomes,
      correctKnockoutWinners: koWinners,
      correctScorers: scorers,
      correctAwards: awards,
      finalSubmittedAt: submitByP.get(p.id) ?? null,
    };
    return { participant: p, autoTotal: auto, adjustment, byCategory, stats };
  });

  const rankedNow = rankLeaderboard(built.map((b) => b.stats));
  const rankNowById = new Map(rankedNow.map((r) => [r.participantId, r]));

  // Rank "before" the most recent matchday's points → movement.
  const rankedBefore = rankLeaderboard(
    built.map((b) => ({ ...b.stats, totalPoints: b.stats.totalPoints - (recentPointsByP.get(b.participant.id) ?? 0) })),
  );
  const rankBeforeById = new Map(rankedBefore.map((r) => [r.participantId, r.rank]));

  const rows: LeaderboardRow[] = built.map((b) => {
    const now = rankNowById.get(b.participant.id)!;
    const before = rankBeforeById.get(b.participant.id) ?? now.rank;
    return {
      participant: b.participant,
      total: b.stats.totalPoints,
      autoTotal: b.autoTotal,
      adjustment: b.adjustment,
      byCategory: b.byCategory,
      stats: b.stats,
      rank: now.rank,
      shared: now.shared,
      movement: before - now.rank,
    };
  });

  rows.sort((a, b) => a.rank - b.rank || b.total - a.total);
  return rows;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export interface FixtureRow {
  id: string;
  matchNumber: number;
  stage: string;
  groupCode: string | null;
  kickoff: Date;
  venue: { name: string; city: string } | null;
  home: TeamLite | null;
  away: TeamLite | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  result: { ftHome: number; ftAway: number; decisiveScore: string; pensHome: number | null; pensAway: number | null } | null;
  lockState: LockState;
  predictionsCount: number;
}

export async function getFixtures(): Promise<FixtureRow[]> {
  const [config, teamMap, matches] = await Promise.all([
    getConfig(),
    getTeamMap(),
    prisma.match.findMany({
      orderBy: { matchNumber: "asc" },
      include: {
        venue: true,
        group: true,
        result: true,
        _count: { select: { matchPredictions: true } },
      },
    }),
  ]);
  const now = new Date();
  return matches.map((m) => ({
    id: m.id,
    matchNumber: m.matchNumber,
    stage: m.stage,
    groupCode: m.group?.code ?? null,
    kickoff: m.kickoff,
    venue: m.venue ? { name: m.venue.name, city: m.venue.city } : null,
    home: m.homeTeamId ? teamMap.get(m.homeTeamId) ?? null : null,
    away: m.awayTeamId ? teamMap.get(m.awayTeamId) ?? null : null,
    homePlaceholder: m.homePlaceholder,
    awayPlaceholder: m.awayPlaceholder,
    result: m.result
      ? { ftHome: m.result.ftHome, ftAway: m.result.ftAway, decisiveScore: m.result.decisiveScore, pensHome: m.result.pensHome, pensAway: m.result.pensAway }
      : null,
    lockState: matchLockState(
      { kickoff: m.kickoff, manualLock: m.manualLock, hasResult: !!m.result, status: m.status, lockBufferMinutes: m.lockBufferMinutes },
      config.matchLockBufferMinutes,
      config.closingSoonMinutes,
      now,
    ),
    predictionsCount: m._count.matchPredictions,
  }));
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface GroupStandingRow {
  team: TeamLite;
  played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number;
  qualification: Qualification;
}
export interface GroupData {
  id: string;
  code: string;
  name: string;
  complete: boolean;
  standings: GroupStandingRow[];
  fixtures: FixtureRow[];
}

export async function getGroupsData(): Promise<{ groups: GroupData[]; bestThirds: { team: TeamLite; groupCode: string; points: number; gd: number; gf: number; rank: number; qualified: boolean }[] }> {
  const [teamMap, fixtures, groups] = await Promise.all([
    getTeamMap(),
    getFixtures(),
    prisma.group.findMany({ orderBy: { orderIndex: "asc" }, include: { members: true } }),
  ]);
  const groupFixtures = fixtures.filter((f) => f.stage === "GROUP");

  // First pass: compute standings + completion per group; collect 3rd-place rows.
  const thirdEntries: { groupCode: string; row: ReturnType<typeof computeGroupStandings>[number] }[] = [];
  const prelim = groups.map((g) => {
    const teamIds = [...g.members].sort((a, b) => a.slot - b.slot).map((m) => m.teamId);
    const gfx = groupFixtures.filter((f) => f.groupCode === g.code);
    const played = gfx.filter((f) => f.result);
    const standings = computeGroupStandings(
      teamIds,
      played.map((f) => ({ homeTeamId: f.home!.id, awayTeamId: f.away!.id, ftHome: f.result!.ftHome, ftAway: f.result!.ftAway })),
    );
    const complete = gfx.length > 0 && played.length === gfx.length;
    if (complete && standings[2]) thirdEntries.push({ groupCode: g.code, row: standings[2] });
    return { g, gfx, standings, complete };
  });

  const allComplete = prelim.length > 0 && prelim.every((p) => p.complete);
  const ranked = allComplete ? rankBestThirds(thirdEntries, 8) : rankBestThirds(thirdEntries, 8);
  const bestThirdIds = new Set(ranked.filter((r) => r.qualified).map((r) => r.row.teamId));

  const out: GroupData[] = prelim.map(({ g, gfx, standings, complete }) => {
    const qual = groupQualification(standings, bestThirdIds, complete);
    return {
      id: g.id,
      code: g.code,
      name: g.name,
      complete,
      fixtures: gfx,
      standings: standings.map((r) => ({
        team: teamMap.get(r.teamId)!,
        played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, gf: r.gf, ga: r.ga, gd: r.gd, points: r.points,
        qualification: qual.get(r.teamId) ?? "PENDING",
      })),
    };
  });

  const bestThirds = ranked.map((r) => ({
    team: teamMap.get(r.row.teamId)!,
    groupCode: r.groupCode,
    points: r.row.points, gd: r.row.gd, gf: r.row.gf,
    rank: r.rank, qualified: r.qualified,
  }));

  return { groups: out, bestThirds };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Home (focused homepage — spec §3)
// ---------------------------------------------------------------------------

export interface HomeActivity {
  id: string;
  kind: "TOURNAMENT" | "WILDCARD" | "MATCH";
  participant: ParticipantLite;
  text: string;
  at: Date;
}

export async function getHomeData() {
  const [fixtures, leaderboard, participants, config, teamMap] = await Promise.all([
    getFixtures(),
    getLeaderboard(),
    getParticipants(),
    getConfig(),
    getTeamMap(),
  ]);
  const now = new Date();
  const withTeams = fixtures.filter((f) => f.home && f.away);

  const completedMatches = fixtures.filter((f) => f.result).length;
  const totalMatches = fixtures.length;
  const recentResult = fixtures.filter((f) => f.result).sort((a, b) => +b.kickoff - +a.kickoff)[0] ?? null;

  // Matchdays (calendar days, tournament TZ). Current = earliest not fully locked.
  const days = groupMatchdays(withTeams, (f) => f.kickoff);
  const currentKey = currentMatchdayKey(days, (f) => isLocked(f.lockState));
  const currentDay = days.find((d) => d.key === currentKey) ?? null;
  const currentMatches = currentDay?.items ?? [];

  // Minimal ribbon: the next few still-open upcoming matches across all days.
  const ribbon = withTeams
    .filter((f) => !f.result && f.lockState !== "LOCKED")
    .sort((a, b) => +a.kickoff - +b.kickoff)
    .slice(0, 4);

  // Prediction progress.
  const pmap = new Map(participants.map((p) => [p.id, p]));
  const tourPreds = await prisma.participantTournamentPrediction.findMany({ select: { participantId: true, updatedAt: true } });
  const tournamentPicksSubmitted = new Set(tourPreds.map((t) => t.participantId)).size;

  // "Completed today" = a fully-complete prediction (Q2) for EVERY current-day match.
  let completedToday = 0;
  if (currentMatches.length > 0) {
    const ids = currentMatches.map((m) => m.id);
    const preds = await prisma.participantMatchPrediction.findMany({
      where: { matchId: { in: ids } },
      select: { participantId: true, homeGoals: true, awayGoals: true, firstTeamToScore: true, bttsPrediction: true, cleanSheetPrediction: true, scorerPicks: { select: { pickType: true } } },
    });
    const completeByP = new Map<string, number>();
    for (const p of preds) if (isMatchPredictionComplete(p)) completeByP.set(p.participantId, (completeByP.get(p.participantId) ?? 0) + 1);
    completedToday = [...completeByP.values()].filter((n) => n >= ids.length).length;
  }

  // Friend activity — privacy-safe (never reveals pick contents; wildcards only
  // surface once the match has locked).
  const activity: HomeActivity[] = [];
  for (const t of tourPreds) {
    const p = pmap.get(t.participantId);
    if (p) activity.push({ id: `t-${t.participantId}`, kind: "TOURNAMENT", participant: p, text: "submitted tournament picks", at: t.updatedAt });
  }
  const wilds = await prisma.wildcard.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { match: { select: { kickoff: true, manualLock: true, status: true, lockBufferMinutes: true, result: { select: { id: true } } } } },
  });
  for (const w of wilds) {
    const p = pmap.get(w.participantId);
    if (!p) continue;
    const locked = isLocked(
      matchLockState(
        { kickoff: w.match.kickoff, manualLock: w.match.manualLock, hasResult: !!w.match.result, status: w.match.status, lockBufferMinutes: w.match.lockBufferMinutes },
        config.matchLockBufferMinutes,
        config.closingSoonMinutes,
        now,
      ),
    );
    if (!locked) continue;
    activity.push({ id: `w-${w.id}`, kind: "WILDCARD", participant: p, text: "used a wildcard", at: w.createdAt });
  }
  const recentMatchPreds = await prisma.participantMatchPrediction.findMany({
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: { id: true, participantId: true, updatedAt: true },
  });
  const seenP = new Set<string>();
  for (const r of recentMatchPreds) {
    if (seenP.has(r.participantId)) continue;
    seenP.add(r.participantId);
    const p = pmap.get(r.participantId);
    if (p) activity.push({ id: `m-${r.id}`, kind: "MATCH", participant: p, text: "updated their match predictions", at: r.updatedAt });
  }
  activity.sort((a, b) => +b.at - +a.at);

  return {
    config,
    tournamentName: config.tournamentName,
    stats: { completedMatches, totalMatches },
    recentResult,
    currentMatchday: currentDay ? { key: currentDay.key, label: currentDay.label, matches: currentMatches.slice(0, 6) } : null,
    ribbon,
    progress: {
      playersJoined: participants.length,
      tournamentPicksSubmitted,
      completedToday,
      currentDayMatchCount: currentMatches.length,
    },
    leaderboard: leaderboard.slice(0, 5),
    activity: activity.slice(0, 6),
    teamMap,
  };
}

// ---------------------------------------------------------------------------
// Bracket
// ---------------------------------------------------------------------------

export interface BracketMatch {
  id: string; matchNumber: number; stage: string;
  home: TeamLite | null; away: TeamLite | null;
  homePlaceholder: string | null; awayPlaceholder: string | null;
  result: { ftHome: number; ftAway: number; decisiveScore: string; advancingTeamId: string | null } | null;
}

export async function getBracket(): Promise<Record<string, BracketMatch[]>> {
  const [teamMap, matches] = await Promise.all([
    getTeamMap(),
    prisma.match.findMany({
      where: { stage: { in: ["R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"] } },
      orderBy: { matchNumber: "asc" },
      include: { result: true },
    }),
  ]);
  const byStage: Record<string, BracketMatch[]> = {};
  for (const m of matches) {
    (byStage[m.stage] ??= []).push({
      id: m.id, matchNumber: m.matchNumber, stage: m.stage,
      home: m.homeTeamId ? teamMap.get(m.homeTeamId) ?? null : null,
      away: m.awayTeamId ? teamMap.get(m.awayTeamId) ?? null : null,
      homePlaceholder: m.homePlaceholder, awayPlaceholder: m.awayPlaceholder,
      result: m.result
        ? { ftHome: m.result.ftHome, ftAway: m.result.ftAway, decisiveScore: m.result.decisiveScore, advancingTeamId: m.result.advancingTeamId }
        : null,
    });
  }
  return byStage;
}

// ---------------------------------------------------------------------------
// Participant profile
// ---------------------------------------------------------------------------

export type PlayerLite = { id: string; name: string; position: string };

// --- Prediction entry (admin) --------------------------------------------

export interface HubMatch {
  id: string; matchNumber: number; stage: string; groupCode: string | null; kickoff: Date;
  lockAt: string; // ISO time this match locks (= exact kickoff) — for countdowns
  home: TeamLite; away: TeamLite;
  lockState: LockState; // per-match time-based state (OPEN / UPCOMING / LOCKED / COMPLETED)
  realLockState: LockState; // same as lockState (kept for callers)
  editable: boolean;
  predicted: boolean;
  complete: boolean;
  score: string | null;
}

export async function getPredictionHub(participantId: string) {
  const [config, teamMap, participant] = await Promise.all([getConfig(), getTeamMap(), prisma.participant.findUnique({ where: { id: participantId } })]);
  if (!participant) return null;
  const now = new Date();
  const matches = await prisma.match.findMany({
    orderBy: { matchNumber: "asc" },
    include: {
      group: true,
      result: true,
      matchPredictions: {
        where: { participantId },
        select: { homeGoals: true, awayGoals: true, firstTeamToScore: true, bttsPrediction: true, cleanSheetPrediction: true, scorerPicks: { select: { pickType: true } } },
      },
    },
  });

  const base = matches
    .filter((m) => m.homeTeamId && m.awayTeamId)
    .map((m) => {
      const pred = m.matchPredictions[0] ?? null;
      const realLockState = matchLockState(
        { kickoff: m.kickoff, manualLock: m.manualLock, hasResult: !!m.result, status: m.status, lockBufferMinutes: m.lockBufferMinutes },
        config.matchLockBufferMinutes, config.closingSoonMinutes, now,
      );
      const lockAt = m.kickoff.toISOString(); // matches lock at the exact kickoff
      return {
        id: m.id, matchNumber: m.matchNumber, stage: m.stage, groupCode: m.group?.code ?? null, kickoff: m.kickoff, lockAt,
        home: teamMap.get(m.homeTeamId!)!, away: teamMap.get(m.awayTeamId!)!,
        realLockState,
        predicted: isMatchPredictionStarted(pred),
        complete: isMatchPredictionComplete(pred),
        score: pred && pred.homeGoals != null ? `${pred.homeGoals}-${pred.awayGoals}` : null,
      };
    });

  // Group into matchdays purely for display. Every match stays editable until
  // its OWN kickoff — the matchday "status" is informational and never gates
  // prediction access (a match >24h away is still fully open).
  const days = groupMatchdays(base, (m) => m.kickoff);
  const currentKey = currentMatchdayKey(days, (m) => isLocked(m.realLockState));
  const currentIndex = days.findIndex((d) => d.key === currentKey);

  const matchdays = days.map((d, idx) => {
    const status = currentIndex < 0 ? "done" : idx < currentIndex ? "done" : idx === currentIndex ? "current" : "upcoming";
    return {
      key: d.key,
      label: d.label,
      status: status as "done" | "current" | "upcoming",
      matches: d.items.map((m): HubMatch => ({
        ...m,
        lockState: m.realLockState,
        editable: m.realLockState === "OPEN" || m.realLockState === "UPCOMING",
      })),
    };
  });

  const currentDay = matchdays.find((d) => d.status === "current") ?? null;
  const currentMatchday = currentDay
    ? { key: currentDay.key, label: currentDay.label, total: currentDay.matches.length, complete: currentDay.matches.filter((m) => m.complete).length }
    : null;
  const matchTotals = {
    total: base.length,
    predicted: base.filter((m) => m.predicted).length,
    complete: base.filter((m) => m.complete).length,
  };

  const groupRows = await prisma.group.findMany({ orderBy: { orderIndex: "asc" } });
  const gp = await prisma.participantGroupPrediction.groupBy({ by: ["groupId"], where: { participantId }, _count: true });
  const gpMap = new Map(gp.map((g) => [g.groupId, g._count]));
  const groups = groupRows.map((g) => ({ id: g.id, code: g.code, name: g.name, ranked: (gpMap.get(g.id) ?? 0) >= 4 }));
  const [tournamentDone, awardsCount, wildcardsUsed] = await Promise.all([
    prisma.participantTournamentPrediction.findUnique({ where: { participantId }, select: { id: true } }),
    prisma.participantAwardPrediction.count({ where: { participantId } }),
    prisma.wildcard.count({ where: { participantId } }),
  ]);
  return {
    participant, matchdays, currentMatchday, matchTotals, groups,
    tournamentDone: !!tournamentDone, awardsCount, wildcardsUsed, wildcardsMax: config.wildcardsPerParticipant,
  };
}

export async function getMatchPrediction(participantId: string, matchId: string) {
  const [config, teamMap, participant] = await Promise.all([getConfig(), getTeamMap(), prisma.participant.findUnique({ where: { id: participantId } })]);
  if (!participant) return null;
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      result: true, group: true,
      matchPredictions: { where: { participantId }, include: { scorerPicks: true } },
      wildcards: { where: { participantId } },
    },
  });
  if (!m) return null;
  const teamIds = [m.homeTeamId, m.awayTeamId].filter(Boolean) as string[];
  const players = await prisma.player.findMany({ where: { teamId: { in: teamIds } }, select: { id: true, name: true, position: true, teamId: true }, orderBy: { shirtNumber: "asc" } });
  const existing = m.matchPredictions[0] ?? null;
  const wildcardsUsed = await prisma.wildcard.count({ where: { participantId } });

  return {
    participant,
    match: {
      id: m.id, matchNumber: m.matchNumber, stage: m.stage, isKnockout: m.stage !== "GROUP", groupCode: m.group?.code ?? null, kickoff: m.kickoff,
      home: m.homeTeamId ? teamMap.get(m.homeTeamId) ?? null : null,
      away: m.awayTeamId ? teamMap.get(m.awayTeamId) ?? null : null,
    },
    homePlayers: players.filter((p) => p.teamId === m.homeTeamId).map(({ id, name, position }) => ({ id, name, position })),
    awayPlayers: players.filter((p) => p.teamId === m.awayTeamId).map(({ id, name, position }) => ({ id, name, position })),
    lockState: matchLockState(
      { kickoff: m.kickoff, manualLock: m.manualLock, hasResult: !!m.result, status: m.status, lockBufferMinutes: m.lockBufferMinutes },
      config.matchLockBufferMinutes, config.closingSoonMinutes,
    ),
    existing: existing
      ? {
          homeGoals: existing.homeGoals, awayGoals: existing.awayGoals, advanceTeamId: existing.advanceTeamId,
          firstTeamToScore: existing.firstTeamToScore, bttsPrediction: existing.bttsPrediction, cleanSheetPrediction: existing.cleanSheetPrediction,
          wildcardPick: existing.wildcardPick, confidence: existing.confidence,
          anytimeScorerPlayerIds: existing.scorerPicks.filter((s) => s.pickType === "ANYTIME").map((s) => s.playerId),
        }
      : null,
    wildcardApplied: m.wildcards.length > 0,
    wildcardsRemaining: Math.max(0, config.wildcardsPerParticipant - wildcardsUsed),
  };
}

export async function getGroupPrediction(participantId: string, groupId: string) {
  const [teamMap, participant, group] = await Promise.all([
    getTeamMap(),
    prisma.participant.findUnique({ where: { id: participantId } }),
    prisma.group.findUnique({ where: { id: groupId }, include: { members: true } }),
  ]);
  if (!participant || !group) return null;
  const teams = [...group.members].sort((a, b) => a.slot - b.slot).map((mm) => teamMap.get(mm.teamId)!);
  const existing = await prisma.participantGroupPrediction.findMany({ where: { participantId, groupId }, orderBy: { predictedPosition: "asc" } });
  return { participant, group: { id: group.id, code: group.code, name: group.name }, teams, existingOrder: existing.map((e) => e.teamId) };
}

export async function getAwardPredictionData(participantId: string) {
  const [teamMap, participant, existing] = await Promise.all([
    getTeamMap(),
    prisma.participant.findUnique({ where: { id: participantId } }),
    prisma.participantAwardPrediction.findMany({ where: { participantId } }),
  ]);
  if (!participant) return null;
  const rows = await prisma.player.findMany({ select: { id: true, name: true, position: true, teamId: true }, orderBy: [{ teamId: "asc" }, { shirtNumber: "asc" }] });
  const players = rows.map((p) => ({ id: p.id, name: p.name, position: p.position, team: teamMap.get(p.teamId)?.shortName ?? "" }));
  const existingMap: Record<string, string> = {};
  for (const e of existing) if (e.playerId) existingMap[e.awardType] = e.playerId;
  return { participant, players, existing: existingMap };
}

// Data for the guided tournament builder (spec §5 Mode 2). Everything the
// wizard needs in one shot: the 4 teams per group, the player list (for the two
// surviving awards), and any picks already saved.

// A knockout slot resolves to a team from the player's own picks.
export type KoSlot =
  | { kind: "GW"; group: string } // group winner
  | { kind: "RU"; group: string } // group runner-up
  | { kind: "THIRD"; winnerGroup: string } // 3rd-placed team facing this winner (FIFA Annex C)
  | { kind: "WIN"; match: number }; // winner of an earlier KO match number
export interface KoTie { matchNumber: number; stage: string; home: KoSlot; away: KoSlot }

function parseKnockout(
  koAll: { id: string; matchNumber: number; stage: string; homePlaceholder: string | null; awayPlaceholder: string | null; homeSourceMatchId: string | null; awaySourceMatchId: string | null }[],
): KoTie[] {
  const idToNum = new Map(koAll.map((m) => [m.id, m.matchNumber]));
  // A 3rd-placed slot only knows WHICH group's third it gets after the bracket
  // is resolved (FIFA Annex C). Its `winnerGroup` is wired up below from the
  // group-winner it is drawn against.
  const slot = (placeholder: string | null, sourceId: string | null): KoSlot => {
    if (sourceId && idToNum.has(sourceId)) return { kind: "WIN", match: idToNum.get(sourceId)! };
    const p = placeholder ?? "";
    let m: RegExpMatchArray | null;
    if ((m = p.match(/^Winner ([A-L])$/i))) return { kind: "GW", group: m[1].toUpperCase() };
    if ((m = p.match(/^Runner-up ([A-L])$/i))) return { kind: "RU", group: m[1].toUpperCase() };
    if ((m = p.match(/Winner Match (\d+)/i))) return { kind: "WIN", match: Number(m[1]) };
    return { kind: "THIRD", winnerGroup: "" };
  };
  const ties: KoTie[] = [];
  for (const m of [...koAll].sort((a, b) => a.matchNumber - b.matchNumber)) {
    if (m.stage === "THIRD_PLACE") continue; // not predicted in the builder
    const home = slot(m.homePlaceholder, m.homeSourceMatchId);
    const away = slot(m.awayPlaceholder, m.awaySourceMatchId);
    // Each R32 third-placed slot is drawn against a specific group winner; record
    // it so the builder can apply the Annex C allocation table.
    if (home.kind === "THIRD" && away.kind === "GW") home.winnerGroup = away.group;
    if (away.kind === "THIRD" && home.kind === "GW") away.winnerGroup = home.group;
    ties.push({ matchNumber: m.matchNumber, stage: m.stage, home, away });
  }
  return ties;
}

export async function getTournamentBuilderData(participantId: string) {
  const [teamMap, participant, groupsRaw, groupPreds, tour, awardPreds, config, deadline, opener] = await Promise.all([
    getTeamMap(),
    prisma.participant.findUnique({ where: { id: participantId } }),
    prisma.group.findMany({ orderBy: { orderIndex: "asc" }, include: { members: true } }),
    prisma.participantGroupPrediction.findMany({ where: { participantId } }),
    prisma.participantTournamentPrediction.findUnique({ where: { participantId }, include: { teamPicks: true } }),
    prisma.participantAwardPrediction.findMany({ where: { participantId } }),
    getConfig(),
    prisma.predictionDeadline.findUnique({ where: { scope: "TOURNAMENT" } }),
    prisma.match.findFirst({ where: { homeTeamId: { not: null }, awayTeamId: { not: null } }, orderBy: { kickoff: "asc" }, select: { kickoff: true } }),
  ]);
  if (!participant) return null;
  const locked = sectionLockState({ deadline: deadline?.deadline ?? null, manualLocked: deadline?.manualLocked ?? false }, config.closingSoonMinutes) === "LOCKED";

  const groups = groupsRaw.map((g) => ({
    id: g.id,
    code: g.code,
    name: g.name,
    teams: [...g.members].sort((a, b) => a.slot - b.slot).map((m) => teamMap.get(m.teamId)).filter((t): t is TeamLite => !!t),
  }));

  const orders: Record<string, string[]> = {};
  const byGroup = new Map<string, typeof groupPreds>();
  for (const p of groupPreds) { const a = byGroup.get(p.groupId) ?? []; a.push(p); byGroup.set(p.groupId, a); }
  for (const [gid, preds] of byGroup) orders[gid] = [...preds].sort((a, b) => a.predictedPosition - b.predictedPosition).map((p) => p.teamId);

  const playerRows = await prisma.player.findMany({ select: { id: true, name: true, teamId: true }, orderBy: [{ teamId: "asc" }, { shirtNumber: "asc" }] });
  const players = playerRows.map((p) => ({ id: p.id, name: p.name, team: teamMap.get(p.teamId)?.shortName ?? "" }));

  const koAll = await prisma.match.findMany({
    where: { stage: { in: ["R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"] } },
    select: { id: true, matchNumber: true, stage: true, homePlaceholder: true, awayPlaceholder: true, homeSourceMatchId: true, awaySourceMatchId: true },
  });
  const knockout = parseKnockout(koAll);

  const awardMap: Record<string, string> = {};
  for (const a of awardPreds) if (a.playerId) awardMap[a.awardType] = a.playerId;

  const picks = tour?.teamPicks ?? [];
  return {
    participant,
    locked,
    firstKickoff: opener?.kickoff ?? null,
    teams: [...teamMap.values()],
    groups,
    knockout,
    players,
    existing: {
      orders,
      bestThirdTeamIds: picks.filter((t) => t.category === "BEST_THIRD").map((t) => t.teamId),
      roundOf16TeamIds: picks.filter((t) => t.category === "ROUND_OF_16").map((t) => t.teamId),
      quarterfinalistTeamIds: picks.filter((t) => t.category === "QUARTERFINALIST").map((t) => t.teamId),
      semifinalistTeamIds: picks.filter((t) => t.category === "SEMIFINALIST").map((t) => t.teamId),
      championTeamId: tour?.championTeamId ?? null,
      runnerUpTeamId: tour?.runnerUpTeamId ?? null,
      goldenBootPlayerId: awardMap["GOLDEN_BOOT"] ?? null,
      topAssistPlayerId: awardMap["TOP_ASSIST"] ?? null,
    },
  };
}


export async function getMatchEditData(matchId: string) {
  const teamMap = await getTeamMap();
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: { result: true, events: true, group: true, venue: true },
  });
  if (!m) return null;
  const home = m.homeTeamId ? teamMap.get(m.homeTeamId) ?? null : null;
  const away = m.awayTeamId ? teamMap.get(m.awayTeamId) ?? null : null;
  const teamIds = [m.homeTeamId, m.awayTeamId].filter(Boolean) as string[];
  const players = await prisma.player.findMany({
    where: { teamId: { in: teamIds } },
    select: { id: true, name: true, position: true, teamId: true, shirtNumber: true },
    orderBy: { shirtNumber: "asc" },
  });
  return {
    id: m.id,
    matchNumber: m.matchNumber,
    stage: m.stage,
    isKnockout: m.stage !== "GROUP",
    groupCode: m.group?.code ?? null,
    kickoff: m.kickoff,
    home,
    away,
    homePlaceholder: m.homePlaceholder,
    awayPlaceholder: m.awayPlaceholder,
    homePlayers: players.filter((p) => p.teamId === m.homeTeamId).map(({ id, name, position }) => ({ id, name, position })),
    awayPlayers: players.filter((p) => p.teamId === m.awayTeamId).map(({ id, name, position }) => ({ id, name, position })),
    result: m.result,
    events: m.events.map((e) => ({ type: e.type, teamId: e.teamId, playerId: e.playerId, minute: e.minute })),
  };
}

export async function getAwardsBoard() {
  const [playerMap, teamMap, preds, results] = await Promise.all([
    getPlayerMap(),
    getTeamMap(),
    prisma.participantAwardPrediction.findMany({ include: { participant: true } }),
    prisma.awardResult.findMany(),
  ]);
  const actualByType = new Map(results.map((r) => [r.awardType, r]));
  const playerLabel = (id: string | null) => {
    if (!id) return null;
    const pl = playerMap.get(id);
    if (!pl) return null;
    return { name: pl.name, team: teamMap.get(pl.teamId)?.shortName ?? null };
  };

  const byType = new Map<string, { participant: { id: string; name: string; initials: string; accentColor: string }; pick: ReturnType<typeof playerLabel>; correct: boolean }[]>();
  for (const p of preds) {
    const actual = actualByType.get(p.awardType);
    const correct = !!actual?.playerId && actual.playerId === p.playerId;
    const arr = byType.get(p.awardType) ?? [];
    arr.push({
      participant: { id: p.participant.id, name: p.participant.name, initials: p.participant.initials, accentColor: p.participant.accentColor },
      pick: playerLabel(p.playerId),
      correct,
    });
    byType.set(p.awardType, arr);
  }
  const actuals: Record<string, ReturnType<typeof playerLabel>> = {};
  for (const r of results) actuals[r.awardType] = playerLabel(r.playerId);

  return { byType, actuals };
}

// ---------------------------------------------------------------------------
// Tournament leaders / stats (auto-aggregated from entered results & events)
// ---------------------------------------------------------------------------

export async function getLeaders() {
  const [teamMap, playerMap, events, played] = await Promise.all([
    getTeamMap(),
    getPlayerMap(),
    prisma.matchEvent.findMany({ select: { type: true, playerId: true, matchId: true, teamId: true } }),
    prisma.match.findMany({ where: { result: { isNot: null } }, include: { result: true } }),
  ]);

  const tallies = computeLeaderTallies(
    events,
    played.map((m) => ({ homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, ftHome: m.result!.ftHome, ftAway: m.result!.ftAway })),
  );

  const playerRow = (id: string) => {
    const p = playerMap.get(id);
    return { id, name: p?.name ?? "Unknown", team: p ? teamMap.get(p.teamId) ?? null : null };
  };

  const topScorers = topByCount(tallies.goals, 20).map((x) => ({ player: playerRow(x.id), goals: x.count }));
  const topAssisters = topByCount(tallies.assists, 15).map((x) => ({ player: playerRow(x.id), assists: x.count }));

  const cardIds = new Set([...tallies.yellow.keys(), ...tallies.red.keys()]);
  const discipline = [...cardIds]
    .map((id) => ({ player: playerRow(id), yellow: tallies.yellow.get(id) ?? 0, red: tallies.red.get(id) ?? 0 }))
    .sort((a, b) => b.red - a.red || b.yellow - a.yellow)
    .slice(0, 15);

  const teamGoals = [...tallies.teamGF.entries()]
    .map(([id, gf]) => ({ team: teamMap.get(id) ?? null, gf, ga: tallies.teamGA.get(id) ?? 0, played: tallies.teamPlayed.get(id) ?? 0 }))
    .sort((a, b) => b.gf - a.gf)
    .slice(0, 12);
  const teamDefence = [...tallies.teamPlayed.keys()]
    .map((id) => ({ team: teamMap.get(id) ?? null, ga: tallies.teamGA.get(id) ?? 0, gf: tallies.teamGF.get(id) ?? 0, played: tallies.teamPlayed.get(id) ?? 0 }))
    .sort((a, b) => a.ga - b.ga || b.gf - a.gf)
    .slice(0, 12);

  const htCount = new Map<string, number>();
  for (const h of tallies.hatTricks) htCount.set(h.playerId, (htCount.get(h.playerId) ?? 0) + 1);
  const hatTrickPlayers = [...htCount.entries()].map(([id, count]) => ({ player: playerRow(id), count })).sort((a, b) => b.count - a.count);

  const bestMatchHaul = tallies.bestMatchHaul ? { player: playerRow(tallies.bestMatchHaul.playerId), goals: tallies.bestMatchHaul.goals } : null;
  const redTotal = [...tallies.red.values()].reduce((s, n) => s + n, 0);

  return {
    topScorers,
    topAssisters,
    discipline,
    teamGoals,
    teamDefence,
    hatTrickPlayers,
    bestMatchHaul,
    totals: { goals: tallies.totalGoals, matchesPlayed: played.length, redCards: redTotal, hatTricks: tallies.hatTricks.length },
    suggestions: {
      goldenBootPlayerId: topScorers[0]?.player.id ?? null,
      goldenBootLabel: topScorers[0] ? `${topScorers[0].player.name} (${topScorers[0].goals})` : null,
      topAssistPlayerId: topAssisters[0]?.player.id ?? null,
      topAssistLabel: topAssisters[0] ? `${topAssisters[0].player.name} (${topAssisters[0].assists})` : null,
      mostGoalsMatchPlayerId: bestMatchHaul?.player.id ?? null,
      mostGoalsMatchLabel: bestMatchHaul ? `${bestMatchHaul.player.name} (${bestMatchHaul.goals})` : null,
      highestScoringTeamId: highestScoringTeam(tallies),
      bestDefensiveTeamId: bestDefensiveTeam(tallies),
      totalGoals: tallies.totalGoals,
      redCards: redTotal,
      hatTricks: tallies.hatTricks.length,
    },
  };
}

export async function getOutcomesData() {
  const [teamMap, leaders, tr, awardResults, playerRows] = await Promise.all([
    getTeamMap(),
    getLeaders(),
    prisma.tournamentResult.findUnique({ where: { id: "default" } }),
    prisma.awardResult.findMany(),
    prisma.player.findMany({ select: { id: true, name: true, teamId: true }, orderBy: [{ teamId: "asc" }, { shirtNumber: "asc" }] }),
  ]);
  const teams = [...teamMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const players = playerRows.map((p) => ({ id: p.id, name: p.name, team: teamMap.get(p.teamId)?.shortName ?? "" }));
  const awards: Record<string, string> = {};
  for (const a of awardResults) if (a.playerId) awards[a.awardType] = a.playerId;

  return {
    teams,
    players,
    current: {
      championTeamId: tr?.championTeamId ?? "",
      runnerUpTeamId: tr?.runnerUpTeamId ?? "",
      awards,
    },
    suggestions: {
      goldenBootPlayerId: leaders.suggestions.goldenBootPlayerId,
      goldenBootLabel: leaders.suggestions.goldenBootLabel,
      topAssistPlayerId: leaders.suggestions.topAssistPlayerId,
      topAssistLabel: leaders.suggestions.topAssistLabel,
    },
  };
}

export async function getMatchDetail(matchId: string) {
  const [config, teamMap, playerMap] = await Promise.all([getConfig(), getTeamMap(), getPlayerMap()]);
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      venue: true,
      group: true,
      result: true,
      events: true,
      matchPredictions: { include: { participant: true, scorerPicks: true } },
      wildcards: true,
    },
  });
  if (!m) return null;

  const lockState = matchLockState(
    { kickoff: m.kickoff, manualLock: m.manualLock, hasResult: !!m.result, status: m.status, lockBufferMinutes: m.lockBufferMinutes },
    config.matchLockBufferMinutes,
    config.closingSoonMinutes,
  );
  const revealed = lockState === "LOCKED" || lockState === "COMPLETED";
  const home = m.homeTeamId ? teamMap.get(m.homeTeamId) ?? null : null;
  const away = m.awayTeamId ? teamMap.get(m.awayTeamId) ?? null : null;
  const wildcardSet = new Set(m.wildcards.map((w) => w.participantId));

  const events = m.events
    .slice()
    .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999))
    .map((e) => ({
      type: e.type,
      minute: e.minute,
      side: e.teamId === m.homeTeamId ? "HOME" : e.teamId === m.awayTeamId ? "AWAY" : null,
      playerName: e.playerId ? playerMap.get(e.playerId)?.name ?? null : null,
    }));

  // Points each participant earned on THIS match (only exists once it's scored).
  const pointRows = revealed
    ? await prisma.pointTransaction.groupBy({ by: ["participantId"], where: { matchId: m.id }, _sum: { points: true } })
    : [];
  const pointsByParticipant = new Map(pointRows.map((r) => [r.participantId, r._sum.points ?? 0]));
  const maxMatchPoints = pointsByParticipant.size ? Math.max(...pointsByParticipant.values()) : 0;

  const predictions = revealed
    ? m.matchPredictions
        .map((p) => {
          const points = pointsByParticipant.get(p.participant.id) ?? 0;
          return {
            participant: {
              id: p.participant.id, name: p.participant.name, initials: p.participant.initials, accentColor: p.participant.accentColor,
            },
            homeGoals: p.homeGoals,
            awayGoals: p.awayGoals,
            outcome: p.predictedOutcome,
            advanceTeam: p.advanceTeamId ? teamMap.get(p.advanceTeamId)?.shortName ?? null : null,
            firstTeamToScore: p.firstTeamToScore,
            btts: p.bttsPrediction,
            scorers: p.scorerPicks.map((s) => ({ name: playerMap.get(s.playerId)?.name ?? "Unknown", type: s.pickType })),
            wildcard: wildcardSet.has(p.participant.id),
            points,
            topScorer: maxMatchPoints > 0 && points === maxMatchPoints,
          };
        })
        .sort((a, b) => b.points - a.points)
    : [];

  // Consensus (only meaningful once revealed)
  let consensus: null | {
    home: number; draw: number; away: number; total: number;
    topScore: string | null; popularScorer: string | null; wildcards: string[];
  } = null;
  if (revealed && predictions.length) {
    let h = 0, dr = 0, a = 0;
    const scoreCount = new Map<string, number>();
    const scorerCount = new Map<string, number>();
    for (const p of predictions) {
      if (p.outcome === "HOME") h++; else if (p.outcome === "AWAY") a++; else if (p.outcome === "DRAW") dr++;
      if (p.homeGoals != null && p.awayGoals != null) {
        const k = `${p.homeGoals}-${p.awayGoals}`;
        scoreCount.set(k, (scoreCount.get(k) ?? 0) + 1);
      }
      for (const s of p.scorers) scorerCount.set(s.name, (scorerCount.get(s.name) ?? 0) + 1);
    }
    const total = predictions.length;
    const topScore = [...scoreCount.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    const popularScorer = [...scorerCount.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    consensus = {
      home: Math.round((h / total) * 100),
      draw: Math.round((dr / total) * 100),
      away: Math.round((a / total) * 100),
      total,
      topScore,
      popularScorer,
      wildcards: predictions.filter((p) => p.wildcard).map((p) => p.participant.name),
    };
  }

  return {
    id: m.id,
    matchNumber: m.matchNumber,
    stage: m.stage,
    groupCode: m.group?.code ?? null,
    kickoff: m.kickoff,
    venue: m.venue ? { name: m.venue.name, city: m.venue.city, country: m.venue.country } : null,
    home,
    away,
    homePlaceholder: m.homePlaceholder,
    awayPlaceholder: m.awayPlaceholder,
    result: m.result,
    lockState,
    revealed,
    events,
    predictions,
    consensus,
    predictionsCount: m.matchPredictions.length,
  };
}

/** The match currently in play (kicked off, no result yet) for the home "live" card. */
export async function getLiveComparison() {
  const now = new Date();
  const m = await prisma.match.findFirst({
    where: { kickoff: { lte: now }, result: { is: null }, homeTeamId: { not: null }, awayTeamId: { not: null } },
    orderBy: { kickoff: "desc" },
    select: { id: true },
  });
  if (!m) return null;
  return getMatchDetail(m.id);
}

// Latest-predictions feed for the leaderboard (spec §7). Privacy-safe:
//  - match predictions revealed ONLY after the match locks
//  - bold calls + wildcards revealed ONLY after the match locks
//  - tournament submissions shown as "submitted" with NO selections revealed
export interface FeedEvent {
  id: string;
  // PICK = privacy-safe "made a pick" (no contents); LOCK = a match locked (system event).
  kind: "MATCH" | "TOURNAMENT" | "WILDCARD" | "BOLD" | "EXACT" | "LEAD" | "PICK" | "LOCK";
  participant: ParticipantLite | null; // null for system events (LOCK)
  text: string;
  at: Date;
}

export async function getLatestPredictions(limit = 15, leaderboard?: LeaderboardRow[]): Promise<FeedEvent[]> {
  const [config, participants, teamMap] = await Promise.all([getConfig(), getParticipants(), getTeamMap()]);
  const pmap = new Map(participants.map((p) => [p.id, p]));
  const now = new Date();
  const events: FeedEvent[] = [];

  const mpreds = await prisma.participantMatchPrediction.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { match: { select: { homeTeamId: true, awayTeamId: true, kickoff: true, manualLock: true, status: true, lockBufferMinutes: true, result: { select: { id: true } } } } },
  });
  for (const p of mpreds) {
    const locked = isLocked(matchLockState(
      { kickoff: p.match.kickoff, manualLock: p.match.manualLock, hasResult: !!p.match.result, status: p.match.status, lockBufferMinutes: p.match.lockBufferMinutes },
      config.matchLockBufferMinutes, config.closingSoonMinutes, now,
    ));
    const part = pmap.get(p.participantId);
    if (!part) continue;
    const home = p.match.homeTeamId ? teamMap.get(p.match.homeTeamId) : null;
    const away = p.match.awayTeamId ? teamMap.get(p.match.awayTeamId) : null;
    if (!home || !away) continue;

    if (!locked) {
      // Privacy-safe: show that a pick was made, never its contents, before lock.
      if (p.homeGoals != null && p.awayGoals != null) {
        events.push({ id: `pick-${p.id}`, kind: "PICK", participant: part, text: `made their pick for ${home.shortName} v ${away.shortName}`, at: p.updatedAt });
      }
      continue;
    }
    // Locked → reveal the contents.
    if (p.homeGoals != null && p.awayGoals != null) {
      events.push({ id: `m-${p.id}`, kind: "MATCH", participant: part, text: `predicted ${home.shortName} ${p.homeGoals}–${p.awayGoals} ${away.shortName}`, at: p.updatedAt });
    }
    if (p.wildcardPick) {
      events.push({ id: `b-${p.id}`, kind: "BOLD", participant: part, text: `bold call: “${p.wildcardPick}”`, at: p.updatedAt });
    }
  }

  const wilds = await prisma.wildcard.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { match: { select: { homeTeamId: true, awayTeamId: true, kickoff: true, manualLock: true, status: true, lockBufferMinutes: true, result: { select: { id: true } } } } },
  });
  for (const w of wilds) {
    const locked = isLocked(matchLockState(
      { kickoff: w.match.kickoff, manualLock: w.match.manualLock, hasResult: !!w.match.result, status: w.match.status, lockBufferMinutes: w.match.lockBufferMinutes },
      config.matchLockBufferMinutes, config.closingSoonMinutes, now,
    ));
    if (!locked) continue;
    const part = pmap.get(w.participantId);
    const home = w.match.homeTeamId ? teamMap.get(w.match.homeTeamId) : null;
    const away = w.match.awayTeamId ? teamMap.get(w.match.awayTeamId) : null;
    if (part && home && away) events.push({ id: `w-${w.id}`, kind: "WILDCARD", participant: part, text: `used a wildcard on ${home.shortName} v ${away.shortName}`, at: w.createdAt });
  }

  const tourPreds = await prisma.participantTournamentPrediction.findMany({ select: { participantId: true, updatedAt: true } });
  for (const t of tourPreds) {
    const part = pmap.get(t.participantId);
    if (part) events.push({ id: `t-${t.participantId}`, kind: "TOURNAMENT", participant: part, text: "submitted their tournament picks", at: t.updatedAt });
  }

  // Exact-score hits (privacy-safe: a MATCH_EXACT point only exists once the
  // match has a result, so it's already public). Timestamp + id are derived from
  // the MATCH, not the point transaction — recompute deletes/recreates those
  // every sync, which would otherwise make old hits resurface as "just now".
  const exactTxns = await prisma.pointTransaction.findMany({
    where: { source: "MATCH_EXACT", matchId: { not: null } },
    take: 50,
    select: { participantId: true, matchId: true },
  });
  const exactMatchIds = [...new Set(exactTxns.map((t) => t.matchId).filter((x): x is string => !!x))];
  const exactMatches = exactMatchIds.length
    ? await prisma.match.findMany({ where: { id: { in: exactMatchIds } }, select: { id: true, kickoff: true, homeTeamId: true, awayTeamId: true } })
    : [];
  const exactMap = new Map(exactMatches.map((m) => [m.id, m]));
  for (const t of exactTxns) {
    const part = pmap.get(t.participantId);
    const m = t.matchId ? exactMap.get(t.matchId) : null;
    const home = m?.homeTeamId ? teamMap.get(m.homeTeamId) : null;
    const away = m?.awayTeamId ? teamMap.get(m.awayTeamId) : null;
    if (part && m && home && away) {
      events.push({ id: `e-${t.participantId}-${m.id}`, kind: "EXACT", participant: part, text: `nailed the exact score in ${home.shortName} v ${away.shortName}`, at: m.kickoff });
    }
  }

  // "Moved into 1st" — from leaderboard movement (current leader who climbed).
  const board = leaderboard ?? (await getLeaderboard());
  const newLeaders = board.filter((r) => r.rank === 1 && r.movement > 0);
  if (newLeaders.length) {
    const latest = await prisma.match.findFirst({ where: { result: { isNot: null } }, orderBy: { kickoff: "desc" }, select: { kickoff: true } });
    const at = latest?.kickoff ?? now;
    for (const r of newLeaders) {
      const part = pmap.get(r.participant.id);
      if (part) events.push({ id: `lead-${r.participant.id}`, kind: "LEAD", participant: part, text: "moved into 1st place 👑", at });
    }
  }

  // Match locks — once a match kicks off (locks), picks are revealed.
  const lockMatches = await prisma.match.findMany({
    where: { homeTeamId: { not: null }, awayTeamId: { not: null } },
    orderBy: { kickoff: "desc" },
    take: 25,
    select: { id: true, kickoff: true, homeTeamId: true, awayTeamId: true, manualLock: true, status: true, lockBufferMinutes: true, result: { select: { id: true } } },
  });
  for (const m of lockMatches) {
    const ls = matchLockState(
      { kickoff: m.kickoff, manualLock: m.manualLock, hasResult: !!m.result, status: m.status, lockBufferMinutes: m.lockBufferMinutes },
      config.matchLockBufferMinutes, config.closingSoonMinutes, now,
    );
    if (!isLocked(ls)) continue;
    const home = m.homeTeamId ? teamMap.get(m.homeTeamId) : null;
    const away = m.awayTeamId ? teamMap.get(m.awayTeamId) : null;
    if (home && away) events.push({ id: `lock-${m.id}`, kind: "LOCK", participant: null, text: `${home.shortName} v ${away.shortName} locked — picks revealed`, at: m.kickoff });
  }

  // Tournament forecast lock (system event).
  const tourDeadline = await prisma.predictionDeadline.findUnique({ where: { scope: "TOURNAMENT" } });
  const tourLocked = sectionLockState({ deadline: tourDeadline?.deadline ?? null, manualLocked: tourDeadline?.manualLocked ?? false }, config.closingSoonMinutes, now) === "LOCKED";
  if (tourLocked && tourDeadline?.deadline) {
    events.push({ id: "lock-tournament", kind: "LOCK", participant: null, text: "Tournament forecasts locked — everyone’s brackets are in", at: tourDeadline.deadline });
  }

  return events.sort((a, b) => +b.at - +a.at).slice(0, limit);
}

// Privacy-aware public profile (spec §8). Match predictions are revealed only
// after each match locks; the tournament forecast only after the first kickoff.
export async function getPublicProfile(id: string) {
  const participant = await prisma.participant.findUnique({ where: { id } });
  if (!participant) return null;
  const [leaderboard, teamMap, playerMap, config, tourDeadline] = await Promise.all([
    getLeaderboard(), getTeamMap(), getPlayerMap(), getConfig(),
    prisma.predictionDeadline.findUnique({ where: { scope: "TOURNAMENT" } }),
  ]);
  const row = leaderboard.find((r) => r.participant.id === id) ?? null;
  const favorite = participant.favoriteTeamId ? teamMap.get(participant.favoriteTeamId) ?? null : null;
  const avgTotal = leaderboard.length ? leaderboard.reduce((s, r) => s + r.total, 0) / leaderboard.length : 0;
  const now = new Date();
  const pname = (pid: string | null | undefined) => (pid ? playerMap.get(pid)?.name ?? null : null);
  const tn = (tid: string | null | undefined) => (tid ? teamMap.get(tid) ?? null : null);

  // --- match predictions (reveal locked only) ---
  const mpreds = await prisma.participantMatchPrediction.findMany({
    where: { participantId: id },
    include: { match: { include: { result: true, group: true } }, scorerPicks: true },
    orderBy: { match: { matchNumber: "asc" } },
  });
  const wildcardMatchIds = new Set((await prisma.wildcard.findMany({ where: { participantId: id }, select: { matchId: true } })).map((w) => w.matchId));
  let hiddenMatches = 0;
  const revealedMatches = mpreds.flatMap((p) => {
    const ls = matchLockState(
      { kickoff: p.match.kickoff, manualLock: p.match.manualLock, hasResult: !!p.match.result, status: p.match.status, lockBufferMinutes: p.match.lockBufferMinutes },
      config.matchLockBufferMinutes, config.closingSoonMinutes, now,
    );
    if (!isLocked(ls)) { hiddenMatches++; return []; }
    return [{
      id: p.id,
      matchNumber: p.match.matchNumber,
      stage: p.match.stage,
      groupCode: p.match.group?.code ?? null,
      home: tn(p.match.homeTeamId),
      away: tn(p.match.awayTeamId),
      score: p.homeGoals != null ? `${p.homeGoals}–${p.awayGoals}` : null,
      result: p.match.result ? `${p.match.result.ftHome}–${p.match.result.ftAway}` : null,
      firstTeamToScore: p.firstTeamToScore,
      btts: p.bttsPrediction,
      cleanSheet: p.cleanSheetPrediction,
      anytime: p.scorerPicks.filter((s) => s.pickType === "ANYTIME").map((s) => pname(s.playerId)).filter((x): x is string => !!x),
      assists: p.scorerPicks.filter((s) => s.pickType === "ASSIST").map((s) => pname(s.playerId)).filter((x): x is string => !!x),
      multi: p.scorerPicks.filter((s) => s.pickType === "MULTI").map((s) => pname(s.playerId)).filter((x): x is string => !!x)[0] ?? null,
      boldCall: p.wildcardPick,
      wildcard: wildcardMatchIds.has(p.matchId),
    }];
  });

  // --- tournament forecast (reveal only after first kickoff) ---
  const tourLocked = sectionLockState({ deadline: tourDeadline?.deadline ?? null, manualLocked: tourDeadline?.manualLocked ?? false }, config.closingSoonMinutes) === "LOCKED";
  const tourPred = await prisma.participantTournamentPrediction.findUnique({ where: { participantId: id }, include: { teamPicks: true } });
  const tournament: {
    locked: boolean; submitted: boolean;
    data?: {
      champion: TeamLite | null; runnerUp: TeamLite | null;
      semifinalists: TeamLite[]; quarterfinalists: TeamLite[]; roundOf16: TeamLite[]; bestThirds: TeamLite[];
      goldenBoot: string | null; topAssist: string | null;
      groups: { name: string; order: (TeamLite | null)[] }[];
    };
  } = { locked: tourLocked, submitted: !!tourPred };

  if (tourLocked && tourPred) {
    const picksBy = (cat: string) => tourPred.teamPicks.filter((x) => x.category === cat).map((x) => tn(x.teamId)).filter((t): t is TeamLite => !!t);
    const [groupsRaw, groupPreds, awardPreds] = await Promise.all([
      prisma.group.findMany({ orderBy: { orderIndex: "asc" } }),
      prisma.participantGroupPrediction.findMany({ where: { participantId: id } }),
      prisma.participantAwardPrediction.findMany({ where: { participantId: id } }),
    ]);
    const orderByGroup = new Map<string, string[]>();
    for (const gp of [...groupPreds].sort((a, b) => a.predictedPosition - b.predictedPosition)) {
      const arr = orderByGroup.get(gp.groupId) ?? [];
      arr.push(gp.teamId);
      orderByGroup.set(gp.groupId, arr);
    }
    const awardMap = new Map(awardPreds.map((a) => [a.awardType, a.playerId]));
    tournament.data = {
      champion: tn(tourPred.championTeamId),
      runnerUp: tn(tourPred.runnerUpTeamId),
      semifinalists: picksBy("SEMIFINALIST"),
      quarterfinalists: picksBy("QUARTERFINALIST"),
      roundOf16: picksBy("ROUND_OF_16"),
      bestThirds: picksBy("BEST_THIRD"),
      goldenBoot: pname(awardMap.get("GOLDEN_BOOT") ?? null),
      topAssist: pname(awardMap.get("TOP_ASSIST") ?? null),
      groups: groupsRaw
        .filter((g) => (orderByGroup.get(g.id) ?? []).length === 4)
        .map((g) => ({ name: g.name, order: (orderByGroup.get(g.id) ?? []).map((tid) => tn(tid)) })),
    };
  }

  // --- player statistics + achievements (Phase 2.4 / 2.5) ---
  // These read the player's OWN scored predictions, so there's no privacy gate:
  // a result is public once the match has been played.
  const [txns, tourResult, finalPlayed] = await Promise.all([
    prisma.pointTransaction.findMany({ where: { participantId: id }, select: { matchId: true, points: true } }),
    prisma.tournamentResult.findUnique({ where: { id: "default" }, select: { championTeamId: true } }),
    prisma.match.findFirst({ where: { stage: "FINAL", result: { isNot: null } }, select: { id: true } }),
  ]);
  const kickoffByMatch = new Map(mpreds.map((p) => [p.matchId, p.match.kickoff]));
  const predOutcomes: PredOutcome[] = mpreds.map((p) => ({
    matchId: p.matchId,
    kickoff: p.match.kickoff,
    predictedOutcome: (p.predictedOutcome as Outcome | null) ?? null,
    actualOutcome: p.match.result ? outcomeOf(p.match.result.ftHome, p.match.result.ftAway) : null,
  }));
  const matchPoints = txns
    .filter((t): t is { matchId: string; points: number } => !!t.matchId && kickoffByMatch.has(t.matchId))
    .map((t) => ({ kickoff: kickoffByMatch.get(t.matchId)!, points: t.points }));
  const stats = computePlayerStats({
    preds: predOutcomes,
    matchPoints,
    wildcardsUsed: wildcardMatchIds.size,
    exactScores: row?.stats.exactScores ?? 0,
  });
  const championCorrect =
    !!finalPlayed && !!tourResult?.championTeamId && !!tourPred?.championTeamId && tourPred.championTeamId === tourResult.championTeamId;
  const achievements = computeAchievements({
    preds: predOutcomes,
    exactScores: stats.exactScores,
    longestStreak: stats.longestStreak,
    championCorrect,
    totalPoints: row?.total ?? 0,
    accuracyPct: stats.accuracyPct,
    scoredMatches: stats.scoredMatches,
  });

  return { participant, row, favorite, avgTotal, leaderboardSize: leaderboard.length, matchStats: { revealed: revealedMatches.length, hidden: hiddenMatches }, revealedMatches, tournament, stats, achievements };
}

// Head-to-head comparison (Phase 2.1). Privacy: the VIEWER's own picks always
// show; the RIVAL's tournament forecast is revealed only after the first kickoff,
// and a rival match pick only after that match locks.
export interface CompareScalar { key: string; label: string; viewer: string | null; rival: string | null; }
export interface CompareGroup { name: string; viewer: (string | null)[]; rival: (string | null)[] | null; }
export interface CompareMatch {
  id: string; stage: string; groupCode: string | null;
  home: string | null; away: string | null;
  viewerScore: string; rivalScore: string | null; rivalHidden: boolean; agree: boolean;
}

export async function getComparison(viewerId: string, rivalId: string) {
  if (viewerId === rivalId) return null;
  const [viewer, rival] = await Promise.all([
    prisma.participant.findUnique({ where: { id: viewerId } }),
    prisma.participant.findUnique({ where: { id: rivalId } }),
  ]);
  if (!viewer || !rival) return null;

  const [teamMap, playerMap, config, tourDeadline, groupsRaw] = await Promise.all([
    getTeamMap(), getPlayerMap(), getConfig(),
    prisma.predictionDeadline.findUnique({ where: { scope: "TOURNAMENT" } }),
    prisma.group.findMany({ orderBy: { orderIndex: "asc" } }),
  ]);
  const tn = (tid: string | null | undefined) => (tid ? teamMap.get(tid)?.shortName ?? null : null);
  const pn = (pid: string | null | undefined) => (pid ? playerMap.get(pid)?.name ?? null : null);
  const tourLocked = sectionLockState({ deadline: tourDeadline?.deadline ?? null, manualLocked: tourDeadline?.manualLocked ?? false }, config.closingSoonMinutes) === "LOCKED";

  const [vTour, rTour, vAwards, rAwards, vGroups, rGroups, vMatch, rMatch] = await Promise.all([
    prisma.participantTournamentPrediction.findUnique({ where: { participantId: viewerId } }),
    prisma.participantTournamentPrediction.findUnique({ where: { participantId: rivalId } }),
    prisma.participantAwardPrediction.findMany({ where: { participantId: viewerId } }),
    prisma.participantAwardPrediction.findMany({ where: { participantId: rivalId } }),
    prisma.participantGroupPrediction.findMany({ where: { participantId: viewerId } }),
    prisma.participantGroupPrediction.findMany({ where: { participantId: rivalId } }),
    prisma.participantMatchPrediction.findMany({
      where: { participantId: viewerId, homeGoals: { not: null } },
      include: { match: { include: { result: { select: { id: true } }, group: true } } },
      orderBy: { match: { matchNumber: "asc" } },
    }),
    prisma.participantMatchPrediction.findMany({ where: { participantId: rivalId }, select: { matchId: true, homeGoals: true, awayGoals: true } }),
  ]);

  const awardOf = (rows: { awardType: string; playerId: string | null }[], type: string) => rows.find((a) => a.awardType === type)?.playerId ?? null;
  const scalars: CompareScalar[] = [
    { key: "champion", label: "Champion", viewer: tn(vTour?.championTeamId), rival: tourLocked ? tn(rTour?.championTeamId) : null },
    { key: "runnerUp", label: "Runner-up", viewer: tn(vTour?.runnerUpTeamId), rival: tourLocked ? tn(rTour?.runnerUpTeamId) : null },
    { key: "goldenBoot", label: "Golden Boot", viewer: pn(awardOf(vAwards, "GOLDEN_BOOT")), rival: tourLocked ? pn(awardOf(rAwards, "GOLDEN_BOOT")) : null },
    { key: "topAssist", label: "Top assist", viewer: pn(awardOf(vAwards, "TOP_ASSIST")), rival: tourLocked ? pn(awardOf(rAwards, "TOP_ASSIST")) : null },
  ];

  const orderMap = (rows: { groupId: string; teamId: string; predictedPosition: number }[]) => {
    const m = new Map<string, string[]>();
    for (const gp of [...rows].sort((a, b) => a.predictedPosition - b.predictedPosition)) {
      const arr = m.get(gp.groupId) ?? [];
      arr.push(gp.teamId);
      m.set(gp.groupId, arr);
    }
    return m;
  };
  const vOrder = orderMap(vGroups);
  const rOrder = orderMap(rGroups);
  const groups: CompareGroup[] = groupsRaw
    .map((g) => ({
      name: g.name,
      viewer: (vOrder.get(g.id) ?? []).map((t) => tn(t)),
      rival: tourLocked ? (rOrder.get(g.id) ?? []).map((t) => tn(t)) : null,
    }))
    .filter((g) => g.viewer.length === 4 || (g.rival && g.rival.length === 4));

  const rByMatch = new Map(rMatch.map((p) => [p.matchId, p]));
  const now = new Date();
  const matches: CompareMatch[] = vMatch.map((p) => {
    const locked = isLocked(matchLockState(
      { kickoff: p.match.kickoff, manualLock: p.match.manualLock, hasResult: !!p.match.result, status: p.match.status, lockBufferMinutes: p.match.lockBufferMinutes },
      config.matchLockBufferMinutes, config.closingSoonMinutes, now,
    ));
    const viewerScore = `${p.homeGoals}–${p.awayGoals}`;
    const rp = rByMatch.get(p.matchId);
    const rivalHas = !!rp && rp.homeGoals != null;
    const rivalScore = rivalHas && locked ? `${rp!.homeGoals}–${rp!.awayGoals}` : null;
    return {
      id: p.id,
      stage: p.match.stage,
      groupCode: p.match.group?.code ?? null,
      home: tn(p.match.homeTeamId),
      away: tn(p.match.awayTeamId),
      viewerScore,
      rivalScore,
      rivalHidden: rivalHas && !locked,
      agree: rivalScore != null && rivalScore === viewerScore,
    };
  });

  const lite = (p: typeof viewer): ParticipantLite => ({
    id: p.id, name: p.name, nickname: p.nickname, initials: p.initials, accentColor: p.accentColor, avatarId: p.avatarId, favoriteTeamId: p.favoriteTeamId,
  });
  const agreeCount = matches.filter((m) => m.agree).length;
  const differCount = matches.filter((m) => m.rivalScore != null && !m.agree).length;

  return {
    viewer: lite(viewer),
    rival: lite(rival),
    rivalRevealed: tourLocked,
    scalars,
    groups,
    matches,
    matchSummary: { agree: agreeCount, differ: differCount, hidden: matches.filter((m) => m.rivalHidden).length, total: matches.length },
  };
}

// ---------------------------------------------------------------------------
// Featured match — powers the home card. Shows live match(es) while any are in
// play; otherwise falls back to the most recent finished match (final score +
// events) so the card is always populated once the tournament is under way.
// ---------------------------------------------------------------------------

export interface LiveEvent {
  id: string;
  type: string; // GOAL | OWN_GOAL | PENALTY_GOAL | YELLOW | RED | ASSIST
  minute: number | null;
  team: string | null; // short name of the team involved
  player: string | null;
}

export interface FeaturedMatch {
  id: string;
  state: "LIVE" | "FINAL";
  stage: string;
  groupCode: string | null;
  home: TeamLite | null;
  away: TeamLite | null;
  homeScore: number;
  awayScore: number;
  minute: number | null; // LIVE only
  note: string | null; // FINAL only — "Full time" | "After extra time" | "Penalties X-Y"
  events: LiveEvent[];
}

export async function getFeaturedMatches(): Promise<FeaturedMatch[]> {
  try {
    return await queryFeaturedMatches();
  } catch {
    // Degrade to empty if e.g. the live-snapshot columns aren't migrated yet —
    // never take down the home page over this card.
    return [];
  }
}

async function eventsByMatch(matchIds: string[], teamMap: Map<string, TeamLite>): Promise<Map<string, LiveEvent[]>> {
  const byMatch = new Map<string, LiveEvent[]>();
  if (matchIds.length === 0) return byMatch;
  const events = await prisma.matchEvent.findMany({
    where: { matchId: { in: matchIds } },
    select: { id: true, matchId: true, type: true, minute: true, teamId: true, player: { select: { name: true } } },
  });
  for (const e of events) {
    const list = byMatch.get(e.matchId) ?? [];
    list.push({
      id: e.id,
      type: e.type,
      minute: e.minute,
      team: e.teamId ? teamMap.get(e.teamId)?.shortName ?? null : null,
      player: e.player?.name ?? null,
    });
    byMatch.set(e.matchId, list);
  }
  for (const [k, list] of byMatch) {
    byMatch.set(k, list.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)));
  }
  return byMatch;
}

async function queryFeaturedMatches(): Promise<FeaturedMatch[]> {
  const teamMap = await getTeamMap();

  // 1) Anything live right now wins.
  const live = await prisma.match.findMany({
    where: { status: "LIVE" },
    select: {
      id: true, stage: true, homeTeamId: true, awayTeamId: true,
      liveHome: true, liveAway: true, liveMinute: true,
      group: { select: { code: true } },
    },
    orderBy: { kickoff: "asc" },
  });

  if (live.length > 0) {
    const byMatch = await eventsByMatch(live.map((m) => m.id), teamMap);
    return live.map((m) => ({
      id: m.id,
      state: "LIVE" as const,
      stage: m.stage,
      groupCode: m.group?.code ?? null,
      home: m.homeTeamId ? teamMap.get(m.homeTeamId) ?? null : null,
      away: m.awayTeamId ? teamMap.get(m.awayTeamId) ?? null : null,
      homeScore: m.liveHome ?? 0,
      awayScore: m.liveAway ?? 0,
      minute: m.liveMinute,
      note: null,
      events: byMatch.get(m.id) ?? [],
    }));
  }

  // 2) Otherwise the most recent finished match.
  const last = await prisma.match.findFirst({
    where: { status: "COMPLETED", result: { isNot: null } },
    orderBy: { kickoff: "desc" },
    select: {
      id: true, stage: true, homeTeamId: true, awayTeamId: true,
      group: { select: { code: true } },
      result: { select: { ftHome: true, ftAway: true, decisiveScore: true, pensHome: true, pensAway: true } },
    },
  });
  if (!last || !last.result) return [];

  const r = last.result;
  const note =
    r.decisiveScore === "PENS" && r.pensHome != null && r.pensAway != null
      ? `Penalties ${r.pensHome}-${r.pensAway}`
      : r.decisiveScore === "AET"
        ? "After extra time"
        : "Full time";
  const byMatch = await eventsByMatch([last.id], teamMap);
  return [{
    id: last.id,
    state: "FINAL" as const,
    stage: last.stage,
    groupCode: last.group?.code ?? null,
    home: last.homeTeamId ? teamMap.get(last.homeTeamId) ?? null : null,
    away: last.awayTeamId ? teamMap.get(last.awayTeamId) ?? null : null,
    homeScore: r.ftHome,
    awayScore: r.ftAway,
    minute: null,
    note,
    events: byMatch.get(last.id) ?? [],
  }];
}

