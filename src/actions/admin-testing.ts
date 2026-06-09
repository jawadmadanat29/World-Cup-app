"use server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { recomputeEverything } from "@/lib/scoring/recompute";
import { writeAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

// Testing helpers so the league can be rehearsed safely before kickoff.

function rng(seed: number) {
  let s = (seed % 2147483647) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function goals(r: () => number) {
  const x = r();
  return x < 0.25 ? 0 : x < 0.55 ? 1 : x < 0.8 ? 2 : x < 0.93 ? 3 : 4;
}

/** Simulate results + goalscorers for the group stage so scoring can be tested. */
export async function loadSampleResults(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const matches = await prisma.match.findMany({
      where: { stage: "GROUP", homeTeamId: { not: null }, awayTeamId: { not: null } },
      include: { result: { select: { source: true } } },
    });
    const players = await prisma.player.findMany({ select: { id: true, teamId: true, position: true } });
    const attackersByTeam = new Map<string, string[]>();
    for (const p of players) {
      if (p.position === "FWD" || p.position === "MID") {
        (attackersByTeam.get(p.teamId) ?? attackersByTeam.set(p.teamId, []).get(p.teamId)!).push(p.id);
      }
    }

    let count = 0;
    for (const m of matches) {
      if (m.result?.source === "ADMIN") continue; // never clobber manual entries
      const r = rng(m.matchNumber * 7919 + 17);
      const ftHome = goals(r);
      const ftAway = goals(r);
      const events: { matchId: string; type: string; teamId: string; playerId: string | null; minute: number }[] = [];
      const addGoals = (teamId: string, n: number) => {
        const atk = attackersByTeam.get(teamId) ?? [];
        for (let i = 0; i < n; i++) {
          events.push({ matchId: m.id, type: "GOAL", teamId, playerId: atk.length ? atk[Math.floor(r() * atk.length)] : null, minute: 3 + Math.floor(r() * 87) });
        }
      };
      addGoals(m.homeTeamId!, ftHome);
      addGoals(m.awayTeamId!, ftAway);

      await prisma.$transaction([
        prisma.matchEvent.deleteMany({ where: { matchId: m.id } }),
        prisma.matchResult.upsert({
          where: { matchId: m.id },
          create: { matchId: m.id, ftHome, ftAway, decisiveScore: "FT", source: "TEST" },
          update: { ftHome, ftAway, decisiveScore: "FT", source: "TEST" },
        }),
        ...events.map((e) => prisma.matchEvent.create({ data: e })),
        prisma.match.update({ where: { id: m.id }, data: { status: "COMPLETED" } }),
      ]);
      count++;
    }
    await recomputeEverything();
    await writeAudit({ action: "TEST", entity: "match_result", summary: `Loaded sample results for ${count} group matches (test data).` });
    revalidateEverything();
    return ok(`Loaded sample results for ${count} group matches and recalculated.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load sample results.");
  }
}

/** Wipe all results + events (keeps predictions & accounts) — back to "not played". */
export async function clearAllResults(): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.$transaction([
      prisma.matchEvent.deleteMany(),
      prisma.matchResult.deleteMany(),
      prisma.match.updateMany({ data: { status: "SCHEDULED" } }),
      prisma.tournamentResult.deleteMany(),
      prisma.awardResult.deleteMany(),
    ]);
    await recomputeEverything();
    await writeAudit({ action: "RESET", entity: "match_result", summary: "Cleared all results, events and outcomes (predictions kept)." });
    revalidateEverything();
    return ok("All results cleared — back to pre-tournament. Predictions kept.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not clear results.");
  }
}

/** Wipe everyone's predictions + wildcards (keeps results & accounts). */
export async function resetAllPredictions(): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.$transaction([
      prisma.participantMatchScorerPrediction.deleteMany(),
      prisma.participantMatchPrediction.deleteMany(),
      prisma.participantGroupPrediction.deleteMany(),
      prisma.participantKnockoutPrediction.deleteMany(),
      prisma.participantTournamentTeamPick.deleteMany(),
      prisma.participantTournamentPrediction.deleteMany(),
      prisma.participantAwardPrediction.deleteMany(),
      prisma.wildcard.deleteMany(),
    ]);
    await recomputeEverything();
    await writeAudit({ action: "RESET", entity: "prediction", summary: "Cleared all participant predictions and wildcards." });
    revalidateEverything();
    return ok("All predictions cleared. Accounts and results kept.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not reset predictions.");
  }
}
