"use server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { recomputeTournamentAndAwards } from "@/lib/scoring/recompute";
import { writeAudit } from "@/lib/audit";
import { AWARD_TYPES } from "@/lib/enums";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

export interface OutcomesInput {
  championTeamId?: string;
  runnerUpTeamId?: string;
  awards: Record<string, string>; // GOLDEN_BOOT | TOP_ASSIST -> playerId
}

const clean = (s?: string) => (s && s !== "" ? s : null);

export async function saveOutcomes(input: OutcomesInput): Promise<ActionResult> {
  try {
    await requireAdmin();
    const fields = {
      championTeamId: clean(input.championTeamId),
      runnerUpTeamId: clean(input.runnerUpTeamId),
    };

    await prisma.tournamentResult.upsert({
      where: { id: "default" },
      create: { id: "default", ...fields },
      update: fields,
    });

    for (const type of AWARD_TYPES) {
      const playerId = clean(input.awards?.[type]);
      await prisma.awardResult.upsert({
        where: { awardType: type },
        create: { awardType: type, playerId },
        update: { playerId },
      });
    }

    const written = await recomputeTournamentAndAwards();
    await writeAudit({ action: "UPDATE", entity: "tournament_result", summary: `Saved champion, runner-up & award winners; rescored ${written} transactions.`, after: fields });
    revalidateEverything();
    return ok("Outcomes & awards saved — predictions rescored.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save outcomes.");
  }
}
