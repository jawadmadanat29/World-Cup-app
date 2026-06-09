"use server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

export async function importTeamsJson(text: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    let data: unknown;
    try { data = JSON.parse(text); } catch { return fail("That isn’t valid JSON."); }
    if (!Array.isArray(data)) return fail("Expected a JSON array of teams.");
    let count = 0;
    for (const row of data as Record<string, string>[]) {
      if (!row.name || !row.shortName || !row.isoCode) continue;
      await prisma.team.upsert({
        where: { shortName: row.shortName },
        create: { name: row.name, shortName: row.shortName, isoCode: row.isoCode, confederation: row.confederation ?? null, isSample: false },
        update: { name: row.name, isoCode: row.isoCode, confederation: row.confederation ?? null },
      });
      count++;
    }
    await writeAudit({ action: "IMPORT", entity: "team", summary: `Imported/updated ${count} teams from JSON.` });
    revalidateEverything();
    return ok(`Imported ${count} teams.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Team import failed.");
  }
}

export async function importFixturesJson(text: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    let data: unknown;
    try { data = JSON.parse(text); } catch { return fail("That isn’t valid JSON."); }
    if (!Array.isArray(data)) return fail("Expected a JSON array of fixtures.");

    const teams = await prisma.team.findMany({ select: { id: true, shortName: true } });
    const venues = await prisma.venue.findMany({ select: { id: true, name: true } });
    const teamByShort = new Map(teams.map((t) => [t.shortName, t.id]));
    const venueByName = new Map(venues.map((v) => [v.name, v.id]));

    let count = 0;
    for (const row of data as Record<string, string | number>[]) {
      const matchNumber = Number(row.matchNumber);
      if (!Number.isFinite(matchNumber)) continue;
      const data2: Record<string, unknown> = {};
      if (row.kickoff) { const d = new Date(String(row.kickoff)); if (!Number.isNaN(d.getTime())) data2.kickoff = d; }
      if (row.homeShort && teamByShort.has(String(row.homeShort))) data2.homeTeamId = teamByShort.get(String(row.homeShort));
      if (row.awayShort && teamByShort.has(String(row.awayShort))) data2.awayTeamId = teamByShort.get(String(row.awayShort));
      if (row.venueName && venueByName.has(String(row.venueName))) data2.venueId = venueByName.get(String(row.venueName));
      if (Object.keys(data2).length === 0) continue;
      try {
        await prisma.match.update({ where: { matchNumber }, data: data2 });
        count++;
      } catch { /* no match with that number — skip */ }
    }
    await writeAudit({ action: "IMPORT", entity: "match", summary: `Updated ${count} fixtures from JSON.` });
    revalidateEverything();
    return ok(`Updated ${count} fixtures.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Fixture import failed.");
  }
}

// ---------------------------------------------------------------------------
// Restore from a full JSON backup (from "Download full backup"). Atomic: the
// wipe + recreate run in one transaction, so a bad file rolls back with no loss.
// ---------------------------------------------------------------------------

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
function revive<T>(rows: T[] | undefined): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      out[k] = typeof v === "string" && ISO_RE.test(v) ? new Date(v) : v;
    }
    return out as T;
  });
}

export async function restoreBackup(text: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    let data: Record<string, unknown[]>;
    try { data = JSON.parse(text); } catch { return fail("That isn’t valid JSON."); }
    if (!Array.isArray(data.teams) || !Array.isArray(data.matches)) {
      return fail("This doesn’t look like a full backup (missing teams/matches).");
    }
    const g = (k: string) => revive(data[k] as unknown[]);
    const ops: Prisma.PrismaPromise<unknown>[] = [
      // wipe (child-first)
      prisma.pointTransaction.deleteMany(), prisma.adminAdjustment.deleteMany(), prisma.wildcard.deleteMany(),
      prisma.participantMatchScorerPrediction.deleteMany(), prisma.participantMatchPrediction.deleteMany(),
      prisma.participantGroupPrediction.deleteMany(), prisma.participantKnockoutPrediction.deleteMany(),
      prisma.participantTournamentTeamPick.deleteMany(), prisma.participantTournamentPrediction.deleteMany(),
      prisma.participantAwardPrediction.deleteMany(), prisma.leagueMember.deleteMany(), prisma.user.deleteMany(),
      prisma.participant.deleteMany(), prisma.matchEvent.deleteMany(), prisma.matchResult.deleteMany(),
      prisma.match.deleteMany(), prisma.groupMember.deleteMany(), prisma.group.deleteMany(),
      prisma.player.deleteMany(), prisma.team.deleteMany(), prisma.venue.deleteMany(),
      prisma.scoringRule.deleteMany(), prisma.appSettings.deleteMany(), prisma.predictionDeadline.deleteMany(),
      prisma.awardResult.deleteMany(), prisma.tournamentResult.deleteMany(), prisma.league.deleteMany(),
    ];
    const add = (rows: unknown[], make: (d: never) => Prisma.PrismaPromise<unknown>) => {
      if (rows.length) ops.push(make(rows as never));
    };
    // recreate (parent-first)
    add(g("leagues"), (d) => prisma.league.createMany({ data: d }));
    add(g("venues"), (d) => prisma.venue.createMany({ data: d }));
    add(g("teams"), (d) => prisma.team.createMany({ data: d }));
    add(g("groups"), (d) => prisma.group.createMany({ data: d }));
    add(g("players"), (d) => prisma.player.createMany({ data: d }));
    add(g("groupMembers"), (d) => prisma.groupMember.createMany({ data: d }));
    add(g("matches"), (d) => prisma.match.createMany({ data: d }));
    add(g("participants"), (d) => prisma.participant.createMany({ data: d }));
    add(g("leagueMembers"), (d) => prisma.leagueMember.createMany({ data: d }));
    add(g("results"), (d) => prisma.matchResult.createMany({ data: d }));
    add(g("events"), (d) => prisma.matchEvent.createMany({ data: d }));
    add(g("matchPreds"), (d) => prisma.participantMatchPrediction.createMany({ data: d }));
    add(g("scorerPreds"), (d) => prisma.participantMatchScorerPrediction.createMany({ data: d }));
    add(g("groupPreds"), (d) => prisma.participantGroupPrediction.createMany({ data: d }));
    add(g("tournamentPreds"), (d) => prisma.participantTournamentPrediction.createMany({ data: d }));
    add(g("tournamentPicks"), (d) => prisma.participantTournamentTeamPick.createMany({ data: d }));
    add(g("awardPreds"), (d) => prisma.participantAwardPrediction.createMany({ data: d }));
    add(g("wildcards"), (d) => prisma.wildcard.createMany({ data: d }));
    add(g("transactions"), (d) => prisma.pointTransaction.createMany({ data: d }));
    add(g("adjustments"), (d) => prisma.adminAdjustment.createMany({ data: d }));
    add(g("scoringRules"), (d) => prisma.scoringRule.createMany({ data: d }));
    add(g("settings"), (d) => prisma.appSettings.createMany({ data: d }));
    add(g("deadlines"), (d) => prisma.predictionDeadline.createMany({ data: d }));
    add(g("tournamentResult"), (d) => prisma.tournamentResult.createMany({ data: d }));
    add(g("awardResults"), (d) => prisma.awardResult.createMany({ data: d }));

    await prisma.$transaction(ops);

    await writeAudit({ action: "IMPORT", entity: "backup", summary: `Restored from backup (${g("matches").length} matches, ${g("participants").length} participants).` });
    revalidateEverything();
    return ok("Backup restored successfully.");
  } catch (e) {
    return fail(`Restore failed (no changes applied): ${e instanceof Error ? e.message : "unknown error"}`);
  }
}
