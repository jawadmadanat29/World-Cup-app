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
  capeverde: "CPV", caboverde: "CPV", capeverdeislands: "CPV", czechia: "CZE", czechrepublic: "CZE",
  bosniaherzegovina: "BIH", bosniaandherzegovina: "BIH", curacao: "CUW",
};

// Below 60s so a 1-minute cron's jitter never trips the throttle and skips a run.
const SYNC_THROTTLE_MS = 45_000;
// Cap how many /fixtures/events calls we make per run — keeps a 1-2 min cron
// well within a 7,500/day quota even if several matches are live at once.
const MAX_EVENT_FIXTURES_PER_RUN = 6;
// Lineups are only fetched for live matches (one extra call each) — bounded by
// how many games are in play at once, so this stays cheap on quota.
const MAX_LINEUP_FIXTURES_PER_RUN = 4;
// Only pull events for matches that are live or finished within this window. A
// long-finished match's events never change, so re-fetching them every run just
// burns quota (this was the main cause of blowing past the daily limit).
const RECENT_FINISH_WINDOW_MS = 4 * 60 * 60 * 1000;
// How far apart (in ms) a knockout fixture's kickoff may be from our scheduled
// placeholder match's kickoff and still be considered the same fixture.
const KNOCKOUT_MATCH_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

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

    // ---- Resolve provider team ids/names → our team ids ---------------------
    const teams = await prisma.team.findMany({ select: { id: true, name: true, shortName: true, apiTeamId: true } });
    const byNorm = new Map<string, string>();
    for (const t of teams) {
      byNorm.set(normalize(t.name), t.id);
      byNorm.set(normalize(t.shortName), t.id);
    }
    const byShort = new Map(teams.map((t) => [t.shortName, t.id]));
    const byApiTeamId = new Map<number, string>();
    for (const t of teams) if (t.apiTeamId != null) byApiTeamId.set(t.apiTeamId, t.id);
    const teamApiBackfill: { id: string; apiTeamId: number }[] = [];

    const resolveTeam = (apiId: number | null, name: string): string | null => {
      if (apiId != null && byApiTeamId.has(apiId)) return byApiTeamId.get(apiId)!;
      const n = normalize(name);
      let teamId = byNorm.get(n) ?? null;
      if (!teamId) {
        const alias = ALIASES[n];
        if (alias) teamId = byShort.get(alias) ?? null;
      }
      if (teamId && apiId != null && !byApiTeamId.has(apiId)) {
        teamApiBackfill.push({ id: teamId, apiTeamId: apiId });
        byApiTeamId.set(apiId, teamId);
      }
      return teamId;
    };

    // ---- Index our matches -----------------------------------------------
    const matches = await prisma.match.findMany({
      include: {
        result: {
          select: {
            source: true,
            ftHome: true, ftAway: true, decisiveScore: true,
            wentToExtraTime: true, aetHome: true, aetAway: true,
            wentToPenalties: true, pensHome: true, pensAway: true,
            advancingTeamId: true,
          },
        },
      },
    });
    const pairKey = (a: string, b: string) => [a, b].sort().join("|");
    const byApiFixtureId = new Map<number, (typeof matches)[number]>();
    const byPair = new Map<string, (typeof matches)[number]>();
    for (const m of matches) {
      if (m.apiFixtureId != null) byApiFixtureId.set(m.apiFixtureId, m);
      if (m.homeTeamId && m.awayTeamId) byPair.set(pairKey(m.homeTeamId, m.awayTeamId), m);
    }
    const assignedKO = new Set<string>();

    let updated = 0, matched = 0, unmatched = 0, skippedManual = 0, koFilled = 0;
    const matchUpdates: { id: string; data: Record<string, unknown> }[] = [];
    const eventCandidates: { apiFixtureId: number; matchId: string; live: boolean }[] = [];

    for (const fx of fixtures) {
      if (!fx.apiFixtureId) continue;
      const homeId = resolveTeam(fx.homeApiTeamId, fx.homeName);
      const awayId = resolveTeam(fx.awayApiTeamId, fx.awayName);

      let m = byApiFixtureId.get(fx.apiFixtureId);
      if (!m && homeId && awayId) m = byPair.get(pairKey(homeId, awayId));
      if (!m && homeId && awayId && fx.stage && fx.stage !== "GROUP" && fx.kickoff) {
        m = matches.find(
          (x) =>
            !assignedKO.has(x.id) &&
            x.stage === fx.stage &&
            (!x.homeTeamId || !x.awayTeamId) &&
            Math.abs(+x.kickoff - +fx.kickoff!) < KNOCKOUT_MATCH_WINDOW_MS,
        );
        if (m) assignedKO.add(m.id);
      }
      if (!m) { unmatched++; continue; }
      matched++;

      const data: Record<string, unknown> = {};
      if (m.apiFixtureId == null) data.apiFixtureId = fx.apiFixtureId;
      if (fx.kickoff && Math.abs(+m.kickoff - +fx.kickoff) > 60_000) data.kickoff = fx.kickoff;

      let mHomeTeamId = m.homeTeamId;
      let mAwayTeamId = m.awayTeamId;
      if ((!m.homeTeamId || !m.awayTeamId) && homeId && awayId) {
        data.homeTeamId = homeId;
        data.awayTeamId = awayId;
        mHomeTeamId = homeId;
        mAwayTeamId = awayId;
        koFilled++;
      }

      const isAdminResult = m.result?.source === "ADMIN";
      if (!isAdminResult) {
        const newStatus = fx.finished ? "COMPLETED" : fx.live ? "LIVE" : "SCHEDULED";
        if (newStatus !== m.status) data.status = newStatus;

        // ---- Live (in-play) snapshot: score + minute, in our orientation ----
        if (fx.live && mHomeTeamId && mAwayTeamId) {
          const homeIsOurHome = homeId === mHomeTeamId;
          const liveHome = homeIsOurHome ? fx.homeGoals : fx.awayGoals;
          const liveAway = homeIsOurHome ? fx.awayGoals : fx.homeGoals;
          if (liveHome !== m.liveHome) data.liveHome = liveHome;
          if (liveAway !== m.liveAway) data.liveAway = liveAway;
          if (fx.minute !== m.liveMinute) data.liveMinute = fx.minute;
        } else if (m.liveHome != null || m.liveAway != null || m.liveMinute != null) {
          // No longer live — clear the snapshot so stale scores never linger.
          data.liveHome = null;
          data.liveAway = null;
          data.liveMinute = null;
        }
      }
      if (Object.keys(data).length) matchUpdates.push({ id: m.id, data });

      // ---- Result ------------------------------------------------------
      if (fx.finished && fx.homeGoals != null && fx.awayGoals != null && mHomeTeamId && mAwayTeamId) {
        if (isAdminResult) {
          skippedManual++;
        } else {
          const homeIsOurHome = homeId === mHomeTeamId;
          const ourHomeGoals = homeIsOurHome ? fx.homeGoals : fx.awayGoals;
          const ourAwayGoals = homeIsOurHome ? fx.awayGoals : fx.homeGoals;
          const ourAetHome = homeIsOurHome ? fx.aetHome : fx.aetAway;
          const ourAetAway = homeIsOurHome ? fx.aetAway : fx.aetHome;
          const ourPensHome = homeIsOurHome ? fx.pensHome : fx.pensAway;
          const ourPensAway = homeIsOurHome ? fx.pensAway : fx.pensHome;
          const decisive = fx.state === "PENS" ? "PENS" : fx.state === "AET" ? "AET" : "FT";
          const advancing =
            m.stage !== "GROUP" && ourHomeGoals !== ourAwayGoals
              ? ourHomeGoals > ourAwayGoals ? mHomeTeamId : mAwayTeamId
              : decisive === "PENS" && ourPensHome != null && ourPensAway != null
                ? ourPensHome > ourPensAway ? mHomeTeamId : mAwayTeamId
                : null;

          // Only write when the result actually differs from what's stored.
          // Re-upserting an unchanged result on every tick was tripping the
          // recompute gate below, forcing a full predictions/points re-read
          // (~720×/day) — the dominant source of Supabase egress.
          const r = m.result;
          const same =
            r != null && r.source === "API" &&
            r.ftHome === ourHomeGoals && r.ftAway === ourAwayGoals &&
            r.decisiveScore === decisive &&
            r.wentToExtraTime === (decisive !== "FT") &&
            (r.aetHome ?? null) === (ourAetHome ?? null) &&
            (r.aetAway ?? null) === (ourAetAway ?? null) &&
            r.wentToPenalties === (decisive === "PENS") &&
            (r.pensHome ?? null) === (ourPensHome ?? null) &&
            (r.pensAway ?? null) === (ourPensAway ?? null) &&
            (r.advancingTeamId ?? null) === (advancing ?? null);

          if (!same) {
            await prisma.matchResult.upsert({
              where: { matchId: m.id },
              create: {
                matchId: m.id, ftHome: ourHomeGoals, ftAway: ourAwayGoals, decisiveScore: decisive, source: "API",
                wentToExtraTime: decisive !== "FT", aetHome: ourAetHome, aetAway: ourAetAway,
                wentToPenalties: decisive === "PENS", pensHome: ourPensHome, pensAway: ourPensAway,
                advancingTeamId: advancing,
              },
              update: {
                ftHome: ourHomeGoals, ftAway: ourAwayGoals, decisiveScore: decisive, source: "API",
                wentToExtraTime: decisive !== "FT", aetHome: ourAetHome, aetAway: ourAetAway,
                wentToPenalties: decisive === "PENS", pensHome: ourPensHome, pensAway: ourPensAway,
                advancingTeamId: advancing,
              },
            });
            updated++;
          }
        }
      }

      // ---- Events candidates (live or recently-finished, non-admin) ----
      const recentlyFinished = fx.finished && Date.now() - m.kickoff.getTime() < RECENT_FINISH_WINDOW_MS;
      if ((fx.live || recentlyFinished) && !isAdminResult) {
        eventCandidates.push({ apiFixtureId: fx.apiFixtureId, matchId: m.id, live: fx.live });
      }
    }

    for (const u of matchUpdates) await prisma.match.update({ where: { id: u.id }, data: u.data });
    for (const t of teamApiBackfill) await prisma.team.update({ where: { id: t.id }, data: { apiTeamId: t.apiTeamId } });

    // ---- Events (goals/assists/cards) — quota-capped ----------------------
    let eventsSynced = 0;
    if (eventCandidates.length) {
      const players = await prisma.player.findMany({ where: { apiPlayerId: { not: null } }, select: { id: true, apiPlayerId: true } });
      const byApiPlayerId = new Map(players.map((p) => [p.apiPlayerId!, p.id]));

      // Live matches first so the per-run cap never starves an in-play game.
      eventCandidates.sort((a, b) => Number(b.live) - Number(a.live));
      for (const c of eventCandidates.slice(0, MAX_EVENT_FIXTURES_PER_RUN)) {
        const events = await provider.fetchEvents(c.apiFixtureId);
        const rows = events.map((e) => ({
          matchId: c.matchId,
          type: e.type,
          teamId: e.teamApiId != null ? byApiTeamId.get(e.teamApiId) ?? null : null,
          playerId: e.playerApiId != null ? byApiPlayerId.get(e.playerApiId) ?? null : null,
          minute: e.minute,
        }));
        await prisma.$transaction([
          prisma.matchEvent.deleteMany({ where: { matchId: c.matchId } }),
          ...(rows.length ? [prisma.matchEvent.createMany({ data: rows })] : []),
        ]);
        eventsSynced++;
      }
    }

    // ---- Lineups (live matches only) — quota-capped ------------------------
    let lineupsSynced = 0;
    const liveCandidates = eventCandidates.filter((c) => c.live).slice(0, MAX_LINEUP_FIXTURES_PER_RUN);
    if (liveCandidates.length) {
      const players = await prisma.player.findMany({ where: { apiPlayerId: { not: null } }, select: { id: true, apiPlayerId: true } });
      const byApiPlayerId = new Map(players.map((p) => [p.apiPlayerId!, p.id]));
      const matchById = new Map(matches.map((m) => [m.id, m]));
      const toStored = (tl: Awaited<ReturnType<typeof provider.fetchLineups>>[number]) => ({
        formation: tl.formation,
        coach: tl.coach,
        startXI: tl.startXI.map((p) => ({ playerId: p.playerApiId != null ? byApiPlayerId.get(p.playerApiId) ?? null : null, name: p.name, number: p.number, pos: p.pos, grid: p.grid })),
        subs: tl.subs.map((p) => ({ playerId: p.playerApiId != null ? byApiPlayerId.get(p.playerApiId) ?? null : null, name: p.name, number: p.number, pos: p.pos, grid: p.grid })),
      });
      for (const c of liveCandidates) {
        const m = matchById.get(c.matchId);
        if (!m) continue;
        const teamLineups = await provider.fetchLineups(c.apiFixtureId);
        if (!teamLineups.length) continue;
        const data: Record<string, unknown> = {};
        for (const tl of teamLineups) {
          const ourTeamId = tl.teamApiId != null ? byApiTeamId.get(tl.teamApiId) ?? null : null;
          if (ourTeamId && ourTeamId === m.homeTeamId) data.lineupHome = toStored(tl);
          else if (ourTeamId && ourTeamId === m.awayTeamId) data.lineupAway = toStored(tl);
        }
        if (Object.keys(data).length) {
          await prisma.match.update({ where: { id: m.id }, data });
          lineupsSynced++;
        }
      }
    }

    // Only recompute when this run actually changed scoring inputs (a new/updated
    // result, a freshly-filled knockout match-up, or live/recent events). Idle
    // ticks — the vast majority over a 6-week tournament — would otherwise re-read
    // every prediction + transaction in the DB on every cron firing for nothing,
    // which was the single biggest source of Supabase egress.
    const scoringChanged = updated > 0 || koFilled > 0 || eventsSynced > 0;
    if (scoringChanged) await recomputeEverything();

    const parts = [`Updated ${updated} result${updated === 1 ? "" : "s"} (matched ${matched}, manual kept ${skippedManual}, unmatched ${unmatched}).`];
    if (koFilled) parts.push(`Filled ${koFilled} knockout match-up${koFilled === 1 ? "" : "s"}.`);
    if (eventsSynced) parts.push(`Synced events for ${eventsSynced} live/recent match${eventsSynced === 1 ? "" : "es"}.`);
    if (lineupsSynced) parts.push(`Synced lineups for ${lineupsSynced} live match${lineupsSynced === 1 ? "" : "es"}.`);
    const summary = parts.join(" ");

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
