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
  thirdTeamId?: string;
  fourthTeamId?: string;
  surpriseTeamId?: string;
  disappointingTeamId?: string;
  highestScoringTeamId?: string;
  bestDefensiveTeamId?: string;
  totalGoals?: string;
  finalWentToPens?: boolean;
  redCards?: string;
  hatTricks?: string;
  awards: Record<string, string>;
}

const clean = (s?: string) => (s && s !== "" ? s : null);
const num = (s?: string) => {
  if (s === undefined || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

export async function saveOutcomes(input: OutcomesInput): Promise<ActionResult> {
  try {
    await requireAdmin();
    const fields = {
      championTeamId: clean(input.championTeamId),
      runnerUpTeamId: clean(input.runnerUpTeamId),
      thirdTeamId: clean(input.thirdTeamId),
      fourthTeamId: clean(input.fourthTeamId),
      surpriseTeamId: clean(input.surpriseTeamId),
      disappointingTeamId: clean(input.disappointingTeamId),
      highestScoringTeamId: clean(input.highestScoringTeamId),
      bestDefensiveTeamId: clean(input.bestDefensiveTeamId),
      totalGoals: num(input.totalGoals),
      finalWentToPens: input.finalWentToPens ?? null,
      redCards: num(input.redCards),
      hatTricks: num(input.hatTricks),
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
    await writeAudit({ action: "UPDATE", entity: "tournament_result", summary: `Saved tournament outcomes & award winners; rescored ${written} transactions.`, after: fields });
    revalidateEverything();
    return ok("Outcomes & awards saved — predictions rescored.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save outcomes.");
  }
}
