import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import {
  matchPredictionSchema,
  groupPredictionSchema,
  tournamentPredictionSchema,
} from "@/lib/validation";
import { getConfig } from "@/lib/settings";
import { recomputeMatches, recomputeGroups, recomputeTournamentAndAwards } from "@/lib/scoring/recompute";
import { writeAudit } from "@/lib/audit";
import { AWARD_TYPES } from "@/lib/enums";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

// Shared prediction-write core (NO auth). Admin actions and participant actions
// both call these; callers are responsible for authorization + lock checks.

export type MatchPredInput = z.input<typeof matchPredictionSchema>;
export type GroupPredInput = z.input<typeof groupPredictionSchema>;
export type TournamentPredInput = z.input<typeof tournamentPredictionSchema>;
export type AwardPick = { awardType: string; playerId?: string };

export async function writeMatchPrediction(input: MatchPredInput, actor: string): Promise<ActionResult> {
  const parsed = matchPredictionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid prediction.");
  const d = parsed.data;

  const outcome =
    d.homeGoals != null && d.awayGoals != null
      ? d.homeGoals > d.awayGoals ? "HOME" : d.homeGoals < d.awayGoals ? "AWAY" : "DRAW"
      : null;

  const pred = await prisma.participantMatchPrediction.upsert({
    where: { participantId_matchId: { participantId: d.participantId, matchId: d.matchId } },
    create: {
      participantId: d.participantId, matchId: d.matchId,
      homeGoals: d.homeGoals ?? null, awayGoals: d.awayGoals ?? null, predictedOutcome: outcome,
      advanceTeamId: d.advanceTeamId ?? null, predictExtraTime: d.predictExtraTime ?? null, predictPenalties: d.predictPenalties ?? null,
      penaltyHome: d.penaltyHome ?? null, penaltyAway: d.penaltyAway ?? null,
      firstTeamToScore: d.firstTeamToScore || null, bttsPrediction: d.bttsPrediction ?? null, cleanSheetPrediction: d.cleanSheetPrediction ?? null,
      totalGoalsRange: null, totalCardsRange: null, wildcardPick: d.wildcardPick ?? null,
    },
    update: {
      homeGoals: d.homeGoals ?? null, awayGoals: d.awayGoals ?? null, predictedOutcome: outcome,
      advanceTeamId: d.advanceTeamId ?? null, predictExtraTime: d.predictExtraTime ?? null, predictPenalties: d.predictPenalties ?? null,
      penaltyHome: d.penaltyHome ?? null, penaltyAway: d.penaltyAway ?? null,
      firstTeamToScore: d.firstTeamToScore || null, bttsPrediction: d.bttsPrediction ?? null, cleanSheetPrediction: d.cleanSheetPrediction ?? null,
      totalGoalsRange: null, totalCardsRange: null, wildcardPick: d.wildcardPick ?? null,
      updatedAt: new Date(),
    },
  });

  await prisma.participantMatchScorerPrediction.deleteMany({ where: { predictionId: pred.id } });
  const picks: { predictionId: string; playerId: string; pickType: string }[] = [];
  if (d.firstScorerPlayerId) picks.push({ predictionId: pred.id, playerId: d.firstScorerPlayerId, pickType: "FIRST" });
  for (const pid of d.anytimeScorerPlayerIds ?? []) picks.push({ predictionId: pred.id, playerId: pid, pickType: "ANYTIME" });
  for (const pid of d.assistPlayerIds ?? []) picks.push({ predictionId: pred.id, playerId: pid, pickType: "ASSIST" });
  for (const pid of d.multiScorerPlayerIds ?? []) picks.push({ predictionId: pred.id, playerId: pid, pickType: "MULTI" });
  if (picks.length) await prisma.participantMatchScorerPrediction.createMany({ data: picks });

  const config = await getConfig();
  const existing = await prisma.wildcard.findUnique({ where: { participantId_matchId: { participantId: d.participantId, matchId: d.matchId } } });
  if (d.applyWildcard && !existing) {
    const used = await prisma.wildcard.count({ where: { participantId: d.participantId } });
    if (used >= config.wildcardsPerParticipant) return fail(`No wildcards left (max ${config.wildcardsPerParticipant}).`);
    await prisma.wildcard.create({ data: { participantId: d.participantId, matchId: d.matchId } });
  } else if (!d.applyWildcard && existing) {
    await prisma.wildcard.delete({ where: { id: existing.id } });
  }

  await recomputeMatches();
  await writeAudit({ actor, action: "UPDATE", entity: "match_prediction", entityId: pred.id, summary: `Match prediction saved (${d.homeGoals ?? "-"}-${d.awayGoals ?? "-"}).` });
  revalidateEverything();
  return ok("Match prediction saved.");
}

export async function writeGroupPrediction(input: GroupPredInput, actor: string): Promise<ActionResult> {
  const parsed = groupPredictionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid group ranking.");
  const { participantId, groupId, order } = parsed.data;
  if (new Set(order).size !== order.length) return fail("Each team can only take one position.");

  await prisma.$transaction([
    prisma.participantGroupPrediction.deleteMany({ where: { participantId, groupId } }),
    ...order.map((teamId, i) => prisma.participantGroupPrediction.create({ data: { participantId, groupId, teamId, predictedPosition: i + 1 } })),
  ]);
  await recomputeGroups();
  await writeAudit({ actor, action: "UPDATE", entity: "group_prediction", entityId: groupId, summary: "Group ranking saved." });
  revalidateEverything();
  return ok("Group ranking saved.");
}

export async function writeTournamentPrediction(input: TournamentPredInput, actor: string): Promise<ActionResult> {
  const parsed = tournamentPredictionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid tournament prediction.");
  const d = parsed.data;
  const clean = (s?: string) => (s && s !== "" ? s : null);

  const pred = await prisma.participantTournamentPrediction.upsert({
    where: { participantId: d.participantId },
    create: {
      participantId: d.participantId,
      championTeamId: clean(d.championTeamId), runnerUpTeamId: clean(d.runnerUpTeamId), thirdTeamId: clean(d.thirdTeamId), fourthTeamId: clean(d.fourthTeamId),
      surpriseTeamId: clean(d.surpriseTeamId), disappointingTeamId: clean(d.disappointingTeamId), highestScoringTeamId: clean(d.highestScoringTeamId), bestDefensiveTeamId: clean(d.bestDefensiveTeamId),
      totalGoalsRange: clean(d.totalGoalsRange), finalPenaltyShootout: d.finalPenaltyShootout ?? null, redCardRange: clean(d.redCardRange), hatTrickRange: clean(d.hatTrickRange),
    },
    update: {
      championTeamId: clean(d.championTeamId), runnerUpTeamId: clean(d.runnerUpTeamId), thirdTeamId: clean(d.thirdTeamId), fourthTeamId: clean(d.fourthTeamId),
      surpriseTeamId: clean(d.surpriseTeamId), disappointingTeamId: clean(d.disappointingTeamId), highestScoringTeamId: clean(d.highestScoringTeamId), bestDefensiveTeamId: clean(d.bestDefensiveTeamId),
      totalGoalsRange: clean(d.totalGoalsRange), finalPenaltyShootout: d.finalPenaltyShootout ?? null, redCardRange: clean(d.redCardRange), hatTrickRange: clean(d.hatTrickRange),
    },
  });

  const picks = [
    ...Array.from(new Set(d.semifinalistTeamIds ?? [])).map((teamId) => ({ predictionId: pred.id, category: "SEMIFINALIST", teamId })),
    ...Array.from(new Set(d.quarterfinalistTeamIds ?? [])).map((teamId) => ({ predictionId: pred.id, category: "QUARTERFINALIST", teamId })),
    ...Array.from(new Set(d.roundOf16TeamIds ?? [])).map((teamId) => ({ predictionId: pred.id, category: "ROUND_OF_16", teamId })),
    ...Array.from(new Set(d.bestThirdTeamIds ?? [])).map((teamId) => ({ predictionId: pred.id, category: "BEST_THIRD", teamId })),
  ];
  await prisma.participantTournamentTeamPick.deleteMany({ where: { predictionId: pred.id } });
  if (picks.length) await prisma.participantTournamentTeamPick.createMany({ data: picks });

  await recomputeTournamentAndAwards();
  await recomputeGroups();
  await writeAudit({ actor, action: "UPDATE", entity: "tournament_prediction", entityId: pred.id, summary: "Tournament prediction saved." });
  revalidateEverything();
  return ok("Tournament prediction saved.");
}

export async function writeAwardPredictions(participantId: string, picks: AwardPick[], actor: string): Promise<ActionResult> {
  if (!participantId) return fail("Missing participant.");
  for (const p of picks) {
    if (!(AWARD_TYPES as readonly string[]).includes(p.awardType)) continue;
    await prisma.participantAwardPrediction.upsert({
      where: { participantId_awardType: { participantId, awardType: p.awardType } },
      create: { participantId, awardType: p.awardType, playerId: p.playerId || null },
      update: { playerId: p.playerId || null },
    });
  }
  await recomputeTournamentAndAwards();
  await writeAudit({ actor, action: "UPDATE", entity: "award_prediction", entityId: participantId, summary: "Award predictions saved." });
  revalidateEverything();
  return ok("Award predictions saved.");
}
