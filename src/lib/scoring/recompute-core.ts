// Alias-free recompute core. Takes a PrismaClient instance so it can be called
// both from the Next app (server actions) and from the standalone seed script
// (run via tsx). All imports are relative — no "@/" alias, no "server-only".
//
// Every pass is delete-then-insert within a category scope: idempotent and safe
// to re-run after any result correction. Manual AdminAdjustment rows are never
// touched. PointTransaction.dedupeKey (UNIQUE) is the final duplicate guard.

import type { PrismaClient } from "@prisma/client";
import { buildRuleMap } from "./rules";
import {
  scoreMatch,
  scoreGroup,
  scoreBestThirds,
  scoreTournament,
  scoreAward,
  type Award,
  type ActualMatch,
  type MatchPredictionInput,
} from "./engine";
import { computeGroupStandings, rankBestThirds } from "./standings";
import { computeLeaderTallies, highestScoringTeam, bestDefensiveTeam } from "./leaders";
import { buildDedupeKey } from "./dedupe";

interface TxnRow {
  participantId: string;
  category: string;
  source: string;
  points: number;
  reason: string;
  matchId: string | null;
  groupId: string | null;
  refId: string | null;
  dedupeKey: string;
}

function awardsToRows(
  participantId: string,
  scopeId: string,
  awards: Award[],
  extra: { matchId?: string; groupId?: string } = {},
): TxnRow[] {
  return awards.map((a) => ({
    participantId,
    category: a.category,
    source: a.source,
    points: a.points,
    reason: a.reason,
    matchId: extra.matchId ?? null,
    groupId: extra.groupId ?? null,
    refId: a.ref ?? null,
    dedupeKey: buildDedupeKey(participantId, scopeId, a),
  }));
}

function nonEmpty<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((x): x is T => x != null && x !== "");
}

async function getRuleMap(db: PrismaClient) {
  return buildRuleMap(await db.scoringRule.findMany());
}

function deriveActual(
  match: { homeTeamId: string | null },
  result: {
    ftHome: number; ftAway: number; wentToExtraTime: boolean; wentToPenalties: boolean;
    pensHome: number | null; pensAway: number | null; advancingTeamId: string | null;
  },
  events: { type: string; teamId: string | null; playerId: string | null; minute: number | null }[],
): ActualMatch {
  const byMinute = (a: { minute: number | null }, b: { minute: number | null }) =>
    (a.minute ?? 999) - (b.minute ?? 999);
  const goalish = events.filter((e) => ["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(e.type));
  const firstGoal = [...goalish].sort(byMinute)[0];
  const credited = events.filter((e) => e.type === "GOAL" || e.type === "PENALTY_GOAL");
  const firstScorer = [...credited].sort(byMinute)[0];
  // Players who scored 2+ credited goals this match.
  const goalCounts = new Map<string, number>();
  for (const e of credited) if (e.playerId) goalCounts.set(e.playerId, (goalCounts.get(e.playerId) ?? 0) + 1);
  const multiScorerPlayerIds = [...goalCounts.entries()].filter(([, n]) => n >= 2).map(([pid]) => pid);
  return {
    ftHome: result.ftHome,
    ftAway: result.ftAway,
    wentToExtraTime: result.wentToExtraTime,
    wentToPenalties: result.wentToPenalties,
    pensHome: result.pensHome,
    pensAway: result.pensAway,
    advancingTeamId: result.advancingTeamId,
    firstScorerPlayerId: firstScorer?.playerId ?? null,
    scorerPlayerIds: nonEmpty(credited.map((e) => e.playerId)),
    multiScorerPlayerIds,
    assistPlayerIds: nonEmpty(events.filter((e) => e.type === "ASSIST").map((e) => e.playerId)),
    firstTeamToScore: firstGoal ? (firstGoal.teamId === match.homeTeamId ? "HOME" : "AWAY") : "NONE",
  };
}

export async function recomputeMatches(db: PrismaClient): Promise<number> {
  const rules = await getRuleMap(db);
  const matches = await db.match.findMany({
    include: {
      result: true,
      events: true,
      matchPredictions: { include: { scorerPicks: true } },
      wildcards: true,
    },
  });

  const rows: TxnRow[] = [];
  for (const match of matches) {
    if (!match.result) continue;
    const actual = deriveActual(match, match.result, match.events);
    const wildcardSet = new Set(match.wildcards.map((w) => w.participantId));
    const isKnockout = match.stage !== "GROUP";

    for (const pred of match.matchPredictions) {
      const input: MatchPredictionInput = {
        homeGoals: pred.homeGoals,
        awayGoals: pred.awayGoals,
        advanceTeamId: pred.advanceTeamId,
        predictExtraTime: pred.predictExtraTime,
        predictPenalties: pred.predictPenalties,
        penaltyHome: pred.penaltyHome,
        penaltyAway: pred.penaltyAway,
        firstTeamToScore: pred.firstTeamToScore,
        bttsPrediction: pred.bttsPrediction,
        cleanSheetPrediction: pred.cleanSheetPrediction,
        firstScorerPlayerId: pred.scorerPicks.find((s) => s.pickType === "FIRST")?.playerId ?? null,
        anytimeScorerPlayerIds: pred.scorerPicks.filter((s) => s.pickType === "ANYTIME").map((s) => s.playerId),
        assistPlayerIds: pred.scorerPicks.filter((s) => s.pickType === "ASSIST").map((s) => s.playerId),
        multiScorerPlayerIds: pred.scorerPicks.filter((s) => s.pickType === "MULTI").map((s) => s.playerId),
        wildcardApplied: wildcardSet.has(pred.participantId),
        isKnockout,
      };
      rows.push(...awardsToRows(pred.participantId, match.id, scoreMatch(input, actual, rules), { matchId: match.id }));
    }
  }

  await db.$transaction([
    db.pointTransaction.deleteMany({ where: { category: { in: ["MATCH", "WILDCARD"] } } }),
    ...(rows.length ? [db.pointTransaction.createMany({ data: rows })] : []),
  ]);
  return rows.length;
}

export async function recomputeGroups(db: PrismaClient): Promise<number> {
  const rules = await getRuleMap(db);
  const groups = await db.group.findMany({ include: { members: true }, orderBy: { orderIndex: "asc" } });
  const groupMatches = await db.match.findMany({ where: { stage: "GROUP" }, include: { result: true } });
  const groupPreds = await db.participantGroupPrediction.findMany();
  const tournamentPreds = await db.participantTournamentPrediction.findMany({ include: { teamPicks: true } });

  const matchesByGroup = new Map<string, typeof groupMatches>();
  for (const m of groupMatches) {
    if (!m.groupId) continue;
    const arr = matchesByGroup.get(m.groupId) ?? [];
    arr.push(m);
    matchesByGroup.set(m.groupId, arr);
  }

  const rows: TxnRow[] = [];
  const thirdEntries: { groupCode: string; row: ReturnType<typeof computeGroupStandings>[number] }[] = [];
  let completeGroups = 0;

  for (const g of groups) {
    const teamIds = [...g.members].sort((a, b) => a.slot - b.slot).map((m) => m.teamId);
    const all = matchesByGroup.get(g.id) ?? [];
    const played = all.filter((m) => m.result);
    const standings = computeGroupStandings(
      teamIds,
      played.map((m) => ({
        homeTeamId: m.homeTeamId!,
        awayTeamId: m.awayTeamId!,
        ftHome: m.result!.ftHome,
        ftAway: m.result!.ftAway,
      })),
    );
    const complete = all.length > 0 && played.length === all.length;
    if (!complete) continue;

    completeGroups++;
    if (standings[2]) thirdEntries.push({ groupCode: g.code, row: standings[2] });
    const actualOrder = standings.map((r) => r.teamId);

    const byParticipant = new Map<string, typeof groupPreds>();
    for (const p of groupPreds.filter((p) => p.groupId === g.id)) {
      const arr = byParticipant.get(p.participantId) ?? [];
      arr.push(p);
      byParticipant.set(p.participantId, arr);
    }
    for (const [pid, preds] of byParticipant) {
      const positions: Record<string, number> = {};
      for (const p of preds) positions[p.teamId] = p.predictedPosition;
      rows.push(...awardsToRows(pid, g.id, scoreGroup({ positions }, actualOrder, rules), { groupId: g.id }));
    }
  }

  if (groups.length > 0 && completeGroups === groups.length) {
    const ranked = rankBestThirds(thirdEntries, 8);
    const bestThirdIds = ranked.filter((r) => r.qualified).map((r) => r.row.teamId);
    for (const tp of tournamentPreds) {
      const picks = tp.teamPicks.filter((x) => x.category === "BEST_THIRD").map((x) => x.teamId);
      rows.push(...awardsToRows(tp.participantId, "bestthirds", scoreBestThirds(picks, bestThirdIds, rules)));
    }
  }

  await db.$transaction([
    db.pointTransaction.deleteMany({ where: { category: "GROUP" } }),
    ...(rows.length ? [db.pointTransaction.createMany({ data: rows })] : []),
  ]);
  return rows.length;
}

export async function recomputeTournamentAndAwards(db: PrismaClient): Promise<number> {
  const rules = await getRuleMap(db);
  const tr = await db.tournamentResult.findUnique({ where: { id: "default" } });
  const awardResults = await db.awardResult.findMany();
  const preds = await db.participantTournamentPrediction.findMany({ include: { teamPicks: true } });
  const awardPreds = await db.participantAwardPrediction.findMany();

  const koMatches = await db.match.findMany({ where: { stage: { in: ["R16", "QF", "SF"] } } });
  const r16Teams = new Set<string>();
  const qfTeams = new Set<string>();
  const sfTeams = new Set<string>();
  for (const m of koMatches) {
    const target = m.stage === "R16" ? r16Teams : m.stage === "QF" ? qfTeams : sfTeams;
    if (m.homeTeamId) target.add(m.homeTeamId);
    if (m.awayTeamId) target.add(m.awayTeamId);
  }
  // Auto-derive team stats from entered results/events; admin values (if set on
  // TournamentResult) always take precedence.
  const playedMatches = await db.match.findMany({ where: { result: { isNot: null } }, include: { result: true } });
  const eventRows = await db.matchEvent.findMany({ select: { type: true, playerId: true, matchId: true, teamId: true } });
  const tallies = computeLeaderTallies(
    eventRows,
    playedMatches.map((m) => ({ homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, ftHome: m.result!.ftHome, ftAway: m.result!.ftAway })),
  );

  const actual = {
    championTeamId: tr?.championTeamId ?? null,
    runnerUpTeamId: tr?.runnerUpTeamId ?? null,
    thirdTeamId: tr?.thirdTeamId ?? null,
    fourthTeamId: tr?.fourthTeamId ?? null,
    semifinalistTeamIds: [...sfTeams],
    quarterfinalistTeamIds: [...qfTeams],
    roundOf16TeamIds: [...r16Teams],
    surpriseTeamId: tr?.surpriseTeamId ?? null,
    disappointingTeamId: tr?.disappointingTeamId ?? null,
    highestScoringTeamId: tr?.highestScoringTeamId ?? highestScoringTeam(tallies),
    bestDefensiveTeamId: tr?.bestDefensiveTeamId ?? bestDefensiveTeam(tallies),
    totalGoals: tr?.totalGoals ?? tallies.totalGoals,
    finalWentToPens: tr?.finalWentToPens ?? null,
    redCards: tr?.redCards ?? null,
    hatTricks: tr?.hatTricks ?? null,
  };

  const rows: TxnRow[] = [];
  for (const p of preds) {
    rows.push(
      ...awardsToRows(
        p.participantId,
        "tournament",
        scoreTournament(
          {
            championTeamId: p.championTeamId,
            runnerUpTeamId: p.runnerUpTeamId,
            thirdTeamId: p.thirdTeamId,
            fourthTeamId: p.fourthTeamId,
            semifinalistTeamIds: p.teamPicks.filter((x) => x.category === "SEMIFINALIST").map((x) => x.teamId),
            quarterfinalistTeamIds: p.teamPicks.filter((x) => x.category === "QUARTERFINALIST").map((x) => x.teamId),
            roundOf16TeamIds: p.teamPicks.filter((x) => x.category === "ROUND_OF_16").map((x) => x.teamId),
            surpriseTeamId: p.surpriseTeamId,
            disappointingTeamId: p.disappointingTeamId,
            highestScoringTeamId: p.highestScoringTeamId,
            bestDefensiveTeamId: p.bestDefensiveTeamId,
            totalGoalsRange: p.totalGoalsRange,
            finalPenaltyShootout: p.finalPenaltyShootout,
            redCardRange: p.redCardRange,
            hatTrickRange: p.hatTrickRange,
          },
          actual,
          rules,
        ),
      ),
    );
  }

  const awardMap = new Map(awardResults.map((a) => [a.awardType, a]));
  for (const ap of awardPreds) {
    const ar = awardMap.get(ap.awardType);
    const award = scoreAward(ap.awardType, ap.playerId, ar?.playerId, rules);
    if (award) rows.push(...awardsToRows(ap.participantId, ap.awardType, [award]));
  }

  await db.$transaction([
    db.pointTransaction.deleteMany({ where: { category: { in: ["KNOCKOUT_PRE", "TOURNAMENT", "AWARD"] } } }),
    ...(rows.length ? [db.pointTransaction.createMany({ data: rows })] : []),
  ]);
  return rows.length;
}

export async function recomputeEverything(
  db: PrismaClient,
): Promise<{ match: number; group: number; tournament: number }> {
  const match = await recomputeMatches(db);
  const group = await recomputeGroups(db);
  const tournament = await recomputeTournamentAndAwards(db);
  return { match, group, tournament };
}
