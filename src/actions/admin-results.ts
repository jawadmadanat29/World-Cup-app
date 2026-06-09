"use server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { resultEntrySchema, type ResultEntryInput } from "@/lib/validation";
import { recomputeEverything } from "@/lib/scoring/recompute";
import { writeAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

export async function saveResult(input: ResultEntryInput): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = resultEntrySchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid result.");
    const d = parsed.data;

    const match = await prisma.match.findUnique({ where: { id: d.matchId } });
    if (!match) return fail("Match not found.");

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
      action: "UPDATE",
      entity: "match_result",
      entityId: d.matchId,
      summary: `Result for match #${match.matchNumber}: ${d.ftHome}-${d.ftAway} (${decisive}). Recalculated ${counts.match + counts.group + counts.tournament} transactions.`,
      after: { ftHome: d.ftHome, ftAway: d.ftAway, decisive, events: d.events.length },
    });
    revalidateEverything();
    return ok("Result saved — scores recalculated.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save result.");
  }
}

export async function clearResult(matchId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return fail("Match not found.");
    await prisma.$transaction([
      prisma.matchEvent.deleteMany({ where: { matchId } }),
      prisma.matchResult.deleteMany({ where: { matchId } }),
      prisma.match.update({ where: { id: matchId }, data: { status: "SCHEDULED" } }),
    ]);
    await recomputeEverything();
    await writeAudit({ action: "DELETE", entity: "match_result", entityId: matchId, summary: `Cleared result for match #${match.matchNumber} and recalculated.` });
    revalidateEverything();
    return ok("Result cleared and scores recalculated.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not clear result.");
  }
}
