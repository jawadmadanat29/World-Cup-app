"use server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

export async function saveDeadline(scope: string, deadlineISO: string, manualLocked: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const deadline = deadlineISO ? new Date(deadlineISO) : null;
    if (deadlineISO && Number.isNaN(deadline?.getTime())) return fail("Invalid date.");
    await prisma.predictionDeadline.upsert({
      where: { scope },
      create: { scope, deadline, manualLocked },
      update: { deadline, manualLocked },
    });
    await writeAudit({ action: manualLocked ? "LOCK" : "UPDATE", entity: "prediction_deadline", entityId: scope, summary: `Deadline for ${scope}${manualLocked ? " (manually locked)" : ""}.` });
    revalidateEverything();
    return ok(`Deadline for ${scope} saved.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save deadline.");
  }
}

export async function setMatchLock(matchId: string, mode: "LOCKED" | "OPEN" | "AUTO"): Promise<ActionResult> {
  try {
    await requireAdmin();
    const manualLock = mode === "AUTO" ? null : mode;
    const m = await prisma.match.update({ where: { id: matchId }, data: { manualLock } });
    await writeAudit({
      action: mode === "LOCKED" ? "LOCK" : mode === "OPEN" ? "UNLOCK" : "UPDATE",
      entity: "match",
      entityId: matchId,
      summary: `Match #${m.matchNumber} lock override set to ${mode}.`,
    });
    revalidateEverything();
    return ok(`Match lock set to ${mode === "AUTO" ? "automatic" : mode.toLowerCase()}.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not change lock.");
  }
}
