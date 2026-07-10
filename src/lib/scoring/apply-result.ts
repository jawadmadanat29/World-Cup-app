import { prisma } from "@/lib/db";
import type { ResultEntryInput } from "@/lib/validation";
import { recomputeEverything } from "@/lib/scoring/recompute";
import { writeAudit } from "@/lib/audit";
import { revalidateEverything } from "@/lib/revalidate";

// Shared core for entering/updating a match result + its events, then
// re-scoring. Used by BOTH the admin "Enter results" server action and the
// key-protected /api/admin-result endpoint, so scoring is identical either way.
// Callers are responsible for auth (admin session or CRON_SECRET key).
export async function applyResult(d: ResultEntryInput, actor = "admin") {
  const match = await prisma.match.findUnique({ where: { id: d.matchId } });
  if (!match) throw new Error("Match not found.");

  const decisive = d.wentToPenalties ? "PENS" : d.wentToExtraTime ? "AET" : "FT";

  await prisma.$transaction([
    prisma.matchResult.upsert({
      where: { matchId: d.matchId },
      create: {
        matchId: d.matchId,
        ftHome: d.ftHome, ftAway: d.ftAway,
        wentToExtraTime: d.wentToExtraTime, aetHome: d.aetHome ?? null, aetAway: d.aetAway ?? null,
        wentToPenalties: d.wentToPenalties, pensHome: d.pensHome ?? null, pensAway: d.pensAway ?? null,
        advancingTeamId: d.advancingTeamId ?? null, mvpPlayerId: d.mvpPlayerId ?? null, decisiveScore: decisive,
      },
      update: {
        ftHome: d.ftHome, ftAway: d.ftAway,
        wentToExtraTime: d.wentToExtraTime, aetHome: d.aetHome ?? null, aetAway: d.aetAway ?? null,
        wentToPenalties: d.wentToPenalties, pensHome: d.pensHome ?? null, pensAway: d.pensAway ?? null,
        advancingTeamId: d.advancingTeamId ?? null, mvpPlayerId: d.mvpPlayerId ?? null, decisiveScore: decisive,
      },
    }),
    prisma.matchEvent.deleteMany({ where: { matchId: d.matchId } }),
    ...d.events.map((e) =>
      prisma.matchEvent.create({
        data: {
          matchId: d.matchId,
          type: e.type,
          teamId: e.teamId ?? null,
          playerId: e.playerId ?? null,
          minute: e.minute ?? null,
          relatedPlayerId: e.relatedPlayerId ?? null,
        },
      }),
    ),
    prisma.match.update({ where: { id: d.matchId }, data: { status: d.status } }),
  ]);

  const counts = await recomputeEverything();
  await writeAudit({
    actor,
    action: "UPDATE",
    entity: "match_result",
    entityId: d.matchId,
    summary: `Result for match #${match.matchNumber}: ${d.ftHome}-${d.ftAway} (${decisive}). Recalculated ${counts.match + counts.group + counts.tournament} transactions.`,
    after: { ftHome: d.ftHome, ftAway: d.ftAway, decisive, events: d.events.length },
  });
  revalidateEverything();
  return { matchNumber: match.matchNumber, decisive, counts };
}
