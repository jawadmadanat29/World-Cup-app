"use server";
import { prisma } from "@/lib/db";
import { requireParticipant } from "@/lib/auth";
import { getConfig } from "@/lib/settings";
import { matchLockState, sectionLockState } from "@/lib/locking";
import {
  writeMatchPrediction,
  writeGroupPrediction,
  writeTournamentPrediction,
  writeAwardPredictions,
  type MatchPredInput,
  type GroupPredInput,
  type TournamentPredInput,
  type AwardPick,
} from "@/lib/prediction-writes";
import { ok, fail, type ActionResult } from "@/lib/action-result";

// Participants enter ONLY their own predictions, and only before lock.

async function matchLocked(matchId: string): Promise<boolean> {
  const [config, m] = await Promise.all([
    getConfig(),
    prisma.match.findUnique({ where: { id: matchId }, include: { result: { select: { id: true } } } }),
  ]);
  if (!m) return true;
  const state = matchLockState(
    { kickoff: m.kickoff, manualLock: m.manualLock, hasResult: !!m.result, status: m.status, lockBufferMinutes: m.lockBufferMinutes },
    config.matchLockBufferMinutes, config.closingSoonMinutes,
  );
  return state === "LOCKED" || state === "COMPLETED";
}

async function sectionLocked(scope: string): Promise<boolean> {
  const [config, d] = await Promise.all([getConfig(), prisma.predictionDeadline.findUnique({ where: { scope } })]);
  return sectionLockState({ deadline: d?.deadline ?? null, manualLocked: d?.manualLocked ?? false }, config.closingSoonMinutes) === "LOCKED";
}

export async function saveMyMatchPrediction(input: MatchPredInput): Promise<ActionResult> {
  try {
    const pid = await requireParticipant();
    if (await matchLocked(input.matchId)) return fail("This match is locked — predictions can no longer be changed.");
    return await writeMatchPrediction({ ...input, participantId: pid }, pid);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save prediction.");
  }
}

export async function saveMyGroupPrediction(input: GroupPredInput): Promise<ActionResult> {
  try {
    const pid = await requireParticipant();
    if (await sectionLocked("GROUP_STAGE")) return fail("Group predictions are locked.");
    return await writeGroupPrediction({ ...input, participantId: pid }, pid);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save group ranking.");
  }
}

export async function saveMyTournamentPrediction(input: TournamentPredInput): Promise<ActionResult> {
  try {
    const pid = await requireParticipant();
    if (await sectionLocked("TOURNAMENT")) return fail("Tournament predictions are locked.");
    return await writeTournamentPrediction({ ...input, participantId: pid }, pid);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save tournament prediction.");
  }
}

// Signature mirrors the admin action so the form is reusable; the passed id is
// ignored in favour of the session participant.
export async function saveMyAwardPredictions(_participantId: string, picks: AwardPick[]): Promise<ActionResult> {
  try {
    const pid = await requireParticipant();
    if (await sectionLocked("TOURNAMENT")) return fail("Award predictions are locked.");
    return await writeAwardPredictions(pid, picks, pid);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save award predictions.");
  }
}

// Guided tournament builder (spec §5 Mode 2) — writes group finishes, the
// knockout bracket and the two surviving awards in one submit. All of it locks
// at the TOURNAMENT deadline (first kickoff).
export interface TournamentBuilderInput {
  groupOrders: { groupId: string; order: string[] }[];
  bestThirdTeamIds: string[];
  roundOf16TeamIds: string[];
  quarterfinalistTeamIds: string[];
  semifinalistTeamIds: string[];
  championTeamId?: string;
  runnerUpTeamId?: string;
  goldenBootPlayerId?: string;
  topAssistPlayerId?: string;
}

export async function saveMyTournamentBuilder(input: TournamentBuilderInput): Promise<ActionResult> {
  try {
    const pid = await requireParticipant();
    if (await sectionLocked("TOURNAMENT")) return fail("Tournament predictions are locked.");

    for (const g of input.groupOrders) {
      if (g.order.length === 4 && new Set(g.order).size === 4) {
        const r = await writeGroupPrediction({ participantId: pid, groupId: g.groupId, order: g.order }, pid);
        if (!r.ok) return r;
      }
    }

    const t = await writeTournamentPrediction({
      participantId: pid,
      championTeamId: input.championTeamId,
      runnerUpTeamId: input.runnerUpTeamId,
      semifinalistTeamIds: input.semifinalistTeamIds,
      quarterfinalistTeamIds: input.quarterfinalistTeamIds,
      roundOf16TeamIds: input.roundOf16TeamIds,
      bestThirdTeamIds: input.bestThirdTeamIds,
    }, pid);
    if (!t.ok) return t;

    const picks: AwardPick[] = [];
    if (input.goldenBootPlayerId) picks.push({ awardType: "GOLDEN_BOOT", playerId: input.goldenBootPlayerId });
    if (input.topAssistPlayerId) picks.push({ awardType: "TOP_ASSIST", playerId: input.topAssistPlayerId });
    if (picks.length) {
      const a = await writeAwardPredictions(pid, picks, pid);
      if (!a.ok) return a;
    }

    return ok("Tournament predictions saved.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save tournament predictions.");
  }
}
