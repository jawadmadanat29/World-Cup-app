"use server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { settingsSchema, adjustmentSchema } from "@/lib/validation";
import { setSetting } from "@/lib/settings";
import { SETTINGS } from "@/lib/enums";
import { writeAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";
import type { z } from "zod";

export async function updateSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid settings.");
    const d = parsed.data;
    await Promise.all([
      setSetting(SETTINGS.WILDCARDS_PER_PARTICIPANT, String(d.wildcardsPerParticipant)),
      setSetting(SETTINGS.TOURNAMENT_NAME, d.tournamentName),
    ]);
    await writeAudit({ action: "UPDATE", entity: "app_settings", summary: "Updated league settings.", after: d });
    revalidateEverything();
    return ok("Settings saved.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save settings.");
  }
}

export async function addAdjustment(input: z.input<typeof adjustmentSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = adjustmentSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid adjustment.");
    const { participantId, points, reason } = parsed.data;
    await prisma.adminAdjustment.create({ data: { participantId, points, reason } });
    await writeAudit({ action: "ADJUST", entity: "admin_adjustment", entityId: participantId, summary: `Manual adjustment ${points > 0 ? "+" : ""}${points}: ${reason}` });
    revalidateEverything();
    return ok(`Adjustment of ${points > 0 ? "+" : ""}${points} recorded.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not add adjustment.");
  }
}

export async function deleteAdjustment(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.adminAdjustment.delete({ where: { id } });
    await writeAudit({ action: "DELETE", entity: "admin_adjustment", entityId: id, summary: "Removed a manual adjustment." });
    revalidateEverything();
    return ok("Adjustment removed.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not remove adjustment.");
  }
}
