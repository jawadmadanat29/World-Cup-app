import "server-only";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/sync/provider";
import { recomputeEverything } from "@/lib/scoring/recompute";
import { writeAudit } from "@/lib/audit";

// The ONE place the external API is called — from the admin "Sync now" button or
// the /api/sync scheduler endpoint, never per visitor. All page reads come from
// the DB, so the site is unaffected if the API is slow or down.

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Common provider name → our 3-letter shortName discrepancies.
const ALIASES: Record<string, string> = {
  unitedstates: "USA", usa: "USA", korearepublic: "KOR", southkorea: "KOR",
  turkiye: "TUR", turkey: "TUR", ivorycoast: "CIV", cotedivoire: "CIV",
  drcongo: "COD", congodr: "COD", democraticrepublicofthecongo: "COD",
  capeverde: "CPV", caboverde: "CPV", czechia: "CZE", czechrepublic: "CZE",
  bosniaherzegovina: "BIH", bosniaandherzegovina: "BIH", curacao: "CUW",
};

const SYNC_THROTTLE_MS = 60_000;

export interface SyncOutcome {
  status: string;
  summary: string;
  error?: string;
}

export async function runSync({ force = false }: { force?: boolean } = {}): Promise<SyncOutcome> {
  const provider = getProvider();
  const state = await prisma.syncState.findUnique({ where: { id: "default" } });

  // Throttle to protect API quota (manual button passes force).
  if (!force && state?.lastSyncAt && Date.now() - state.lastSyncAt.getTime() < SYNC_THROTTLE_MS) {
    const out = { status: "SKIPPED", summary: "Skipped — synced moments ago." };
    await recordLog(out);
    return out;
  }

  if (!provider.configured) {
    const out = { status: "NOT_CONFIGURED", summary: "No API key set — running in manual mode." };
    await prisma.syncState.upsert({
      where: { id: "default" },
      create: { id: "default", status: "NOT_CONFIGURED", lastSyncAt: new Date(), lastSummary: out.summary },
      update: { status: "NOT_CONFIGURED", lastSyncAt: new Date(), lastSummary: out.summary },
    });
    await recordLog(out);
    return out;
  }

  await prisma.syncState.upsert({
    where: { id: "default" },
    create: { id: "default", status: "RUNNING", lastSyncAt: new Date() },
    update: { status: "RUNNING", lastSyncAt: new Date() },
  });

  try {
    const { fixtures, quota } = await provider.fetchFixtures();

    // Resolve provider team names → our team ids.
    const teams = await prisma.team.findMany({ select: { id: true, name: true, shortName: true } });
    const byNorm = new Map<string, string>();
    for (const t of teams) {
      byNorm.set(normalize(t.name), t.id);
      byNorm.set(normalize(t.shortName), t.id);
    }
    const byShort = new Map(teams.map((t) => [t.shortName, t.id]));
    const resolve = (name: string): string | null => {
      const n = normalize(name);
      if (byNorm.has(n)) return byNorm.get(n)!;
      const alias = ALIASES[n];
      return alias ? byShort.get(alias) ?? null : null;
    };

    // Index our matches that have both teams, by unordered team-pair.
    const matches = await prisma.match.findMany({
      where: { homeTeamId: { not: null }, awayTeamId: { not: null } },
      include: { result: { select: { source: true } } },
    });
    const pairKey = (a: string, b: string) => [a, b].sort().join("|");
    const byPair = new Map<string, (typeof matches)[number]>();
    for (const m of matches) byPair.set(pairKey(m.homeTeamId!, m.awayTeamId!), m);

    let updated = 0, matched = 0, unmatched = 0, skippedManual = 0;
    for (const fx of fixtures) {
      if (!fx.finished || fx.homeGoals == null || fx.awayGoals == null) continue;
      const home = resolve(fx.homeName);
      const away = resolve(fx.awayName);
      if (!home || !away) { unmatched++; continue; }
      const m = byPair.get(pairKey(home, away));
      if (!m) { unmatched++; continue; }
      matched++;
      if (m.result?.source === "ADMIN") { skippedManual++; continue; }

      // Orient goals to our home/away.
      const homeIsOurHome = home === m.homeTeamId;
      const ourHomeGoals = homeIsOurHome ? fx.homeGoals : fx.awayGoals;
      const ourAwayGoals = homeIsOurHome ? fx.awayGoals : fx.homeGoals;
      const decisive = fx.state === "PENS" ? "PENS" : fx.state === "AET" ? "AET" : "FT";
      const advancing =
        m.stage !== "GROUP" && ourHomeGoals !== ourAwayGoals
          ? ourHomeGoals > ourAwayGoals ? m.homeTeamId : m.awayTeamId
          : null;

      await prisma.matchResult.upsert({
        where: { matchId: m.id },
        create: { matchId: m.id, ftHome: ourHomeGoals, ftAway: ourAwayGoals, decisiveScore: decisive, source: "API", wentToExtraTime: decisive !== "FT", wentToPenalties: decisive === "PENS", advancingTeamId: advancing },
        update: { ftHome: ourHomeGoals, ftAway: ourAwayGoals, decisiveScore: decisive, source: "API", wentToExtraTime: decisive !== "FT", wentToPenalties: decisive === "PENS", advancingTeamId: advancing },
      });
      await prisma.match.update({ where: { id: m.id }, data: { status: "COMPLETED" } });
      updated++;
    }

    await recomputeEverything();

    const summary = `Updated ${updated} result${updated === 1 ? "" : "s"} (matched ${matched}, manual kept ${skippedManual}, unmatched ${unmatched}).`;
    await prisma.syncState.update({
      where: { id: "default" },
      data: { status: "OK", lastSuccessAt: new Date(), lastSummary: summary, lastError: null, quotaRemaining: quota.remaining, quotaLimit: quota.limit },
    });
    await recordLog({ status: "OK", summary });
    await writeAudit({ actor: "sync", action: "SYNC", entity: "sync", summary });
    return { status: "OK", summary };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown sync error";
    await prisma.syncState.update({ where: { id: "default" }, data: { status: "FAILED", lastError: error, lastSummary: "Sync failed." } });
    await recordLog({ status: "FAILED", summary: "Sync failed.", error });
    return { status: "FAILED", summary: "Sync failed.", error };
  }
}

async function recordLog(out: SyncOutcome) {
  await prisma.syncLog.create({ data: { status: out.status, summary: out.summary, error: out.error ?? null } });
  // Keep only the most recent 50 entries.
  const old = await prisma.syncLog.findMany({ orderBy: { createdAt: "desc" }, skip: 50, select: { id: true } });
  if (old.length) await prisma.syncLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}
