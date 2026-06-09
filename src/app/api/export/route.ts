import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getLeaderboard } from "@/lib/queries";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type") ?? "all";
  const stamp = new Date().toISOString().slice(0, 10);

  if (type === "leaderboard") {
    const rows = await getLeaderboard();
    const csv = toCsv([
      ["rank", "name", "total", "auto", "adjustment", "exactScores", "correctOutcomes", "correctScorers", "match", "group", "knockout", "tournament", "award"],
      ...rows.map((r) => [
        r.rank, r.participant.name, r.total, r.autoTotal, r.adjustment, r.stats.exactScores, r.stats.correctOutcomes, r.stats.correctScorers,
        r.byCategory.MATCH ?? 0, r.byCategory.GROUP ?? 0, (r.byCategory.KNOCKOUT_PRE ?? 0) + (r.byCategory.KNOCKOUT_STAGE ?? 0), r.byCategory.TOURNAMENT ?? 0, r.byCategory.AWARD ?? 0,
      ]),
    ]);
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="leaderboard-${stamp}.csv"` } });
  }

  if (type === "scoring") {
    const [participants, txns] = await Promise.all([
      prisma.participant.findMany({ select: { id: true, name: true } }),
      prisma.pointTransaction.findMany(),
    ]);
    const nameById = new Map(participants.map((p) => [p.id, p.name]));
    const csv = toCsv([
      ["participant", "category", "source", "points", "reason"],
      ...txns.map((t) => [nameById.get(t.participantId) ?? t.participantId, t.category, t.source, t.points, t.reason]),
    ]);
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="scoring-breakdown-${stamp}.csv"` } });
  }

  // type === "all" → full JSON backup
  const [leagues, leagueMembers, teams, venues, groups, groupMembers, players, matches, results, events, participants, matchPreds, scorerPreds, groupPreds, tournamentPreds, tournamentPicks, awardPreds, wildcards, transactions, adjustments, scoringRules, settings, deadlines, tournamentResult, awardResults] = await Promise.all([
    prisma.league.findMany(), prisma.leagueMember.findMany(),
    prisma.team.findMany(), prisma.venue.findMany(), prisma.group.findMany(), prisma.groupMember.findMany(), prisma.player.findMany(),
    prisma.match.findMany(), prisma.matchResult.findMany(), prisma.matchEvent.findMany(), prisma.participant.findMany(),
    prisma.participantMatchPrediction.findMany(), prisma.participantMatchScorerPrediction.findMany(), prisma.participantGroupPrediction.findMany(),
    prisma.participantTournamentPrediction.findMany(), prisma.participantTournamentTeamPick.findMany(), prisma.participantAwardPrediction.findMany(),
    prisma.wildcard.findMany(), prisma.pointTransaction.findMany(), prisma.adminAdjustment.findMany(), prisma.scoringRule.findMany(),
    prisma.appSettings.findMany(), prisma.predictionDeadline.findMany(), prisma.tournamentResult.findMany(), prisma.awardResult.findMany(),
  ]);
  const dump = {
    exportedAt: new Date().toISOString(),
    backupVersion: 2,
    leagues, leagueMembers, teams, venues, groups, groupMembers, players, matches, results, events, participants,
    matchPreds, scorerPreds, groupPreds, tournamentPreds, tournamentPicks, awardPreds,
    wildcards, transactions, adjustments, scoringRules, settings, deadlines, tournamentResult, awardResults,
  };
  return new NextResponse(JSON.stringify(dump, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="wcp-backup-${stamp}.json"` },
  });
}
