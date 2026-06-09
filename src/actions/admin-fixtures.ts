"use server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { recomputeEverything } from "@/lib/scoring/recompute";
import { writeAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

export interface FixtureUpdate {
  matchId: string;
  kickoffISO?: string;
  venueId?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  manualLock?: "LOCKED" | "OPEN" | "AUTO";
}

export async function updateFixture(input: FixtureUpdate): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data: Record<string, unknown> = {};
    if (input.kickoffISO) {
      const d = new Date(input.kickoffISO);
      if (Number.isNaN(d.getTime())) return fail("Invalid kickoff date/time.");
      data.kickoff = d;
    }
    if (input.venueId !== undefined) data.venueId = input.venueId || null;
    if (input.homeTeamId !== undefined) data.homeTeamId = input.homeTeamId || null;
    if (input.awayTeamId !== undefined) data.awayTeamId = input.awayTeamId || null;
    if (input.manualLock !== undefined) data.manualLock = input.manualLock === "AUTO" ? null : input.manualLock;

    const m = await prisma.match.update({ where: { id: input.matchId }, data });
    // Team changes can affect knockout scoring; recompute to be safe.
    await recomputeEverything();
    await writeAudit({ action: "UPDATE", entity: "match", entityId: input.matchId, summary: `Edited fixture #${m.matchNumber}.`, after: data });
    revalidateEverything();
    return ok(`Fixture #${m.matchNumber} updated.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not update fixture.");
  }
}
