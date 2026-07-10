"use server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { resultEntrySchema, type ResultEntryInput } from "@/lib/validation";
import { recomputeEverything } from "@/lib/scoring/recompute";
import { applyResult } from "@/lib/scoring/apply-result";
import { writeAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

export async function saveResult(input: ResultEntryInput): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = resultEntrySchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid result.");
    await applyResult(parsed.data);
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
