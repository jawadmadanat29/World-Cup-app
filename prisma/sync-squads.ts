/* eslint-disable no-console */
// One-time + re-runnable script: links our 48 Team rows to API-Football team
// ids (via /teams?league=&season=) and replaces placeholder/sample Player rows
// with each team's real World Cup squad (via /players/squads?team=).
//
// Run with: npx tsx prisma/sync-squads.ts
//
// Safe to re-run: re-links teams (idempotent) and only replaces a team's
// players when the API returns a non-empty squad for it. Reports any existing
// scorer/award picks that referenced players being replaced, so they can be
// re-picked.

import { PrismaClient } from "@prisma/client";
import { recomputeEverything } from "../src/lib/scoring/recompute-core";

const prisma = new PrismaClient();

const KEY = process.env.FOOTBALL_API_KEY ?? "";
const HOST = process.env.FOOTBALL_API_HOST || "v3.football.api-sports.io";
const LEAGUE = process.env.FOOTBALL_API_LEAGUE || "1";
const SEASON = process.env.FOOTBALL_API_SEASON || "2026";
const HEADERS = { "x-apisports-key": KEY, "x-rapidapi-key": KEY, "x-rapidapi-host": HOST };

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const ALIASES: Record<string, string> = {
  unitedstates: "USA", usa: "USA", korearepublic: "KOR", southkorea: "KOR",
  turkiye: "TUR", turkey: "TUR", ivorycoast: "CIV", cotedivoire: "CIV",
  drcongo: "COD", congodr: "COD", democraticrepublicofthecongo: "COD",
  capeverde: "CPV", caboverde: "CPV", capeverdeislands: "CPV", czechia: "CZE", czechrepublic: "CZE",
  bosniaherzegovina: "BIH", bosniaandherzegovina: "BIH", curacao: "CUW",
};

const POSITION_MAP: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Attacker: "FWD",
};

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`https://${HOST}${path}`, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors && (Array.isArray(json.errors) ? json.errors.length : Object.keys(json.errors).length)) {
    throw new Error(`API ${path} error: ${JSON.stringify(json.errors)}`);
  }
  return json as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!KEY) {
    console.error("FOOTBALL_API_KEY is not set — aborting.");
    process.exit(1);
  }

  console.log(`Fetching teams for league=${LEAGUE} season=${SEASON}...`);
  const teamsRes = await api<{ response: { team: { id: number; name: string; code: string | null } }[] }>(
    `/teams?league=${LEAGUE}&season=${SEASON}`,
  );
  const apiTeams = teamsRes.response.map((r) => r.team);
  console.log(`API returned ${apiTeams.length} teams.`);

  const dbTeams = await prisma.team.findMany({ select: { id: true, name: true, shortName: true, apiTeamId: true } });
  const byNorm = new Map<string, string>();
  for (const t of dbTeams) {
    byNorm.set(normalize(t.name), t.id);
    byNorm.set(normalize(t.shortName), t.id);
  }
  const byShort = new Map(dbTeams.map((t) => [t.shortName, t.id]));

  let linked = 0;
  const linkedTeamIds = new Set<string>();
  for (const at of apiTeams) {
    const n = normalize(at.name);
    let teamId = byNorm.get(n) ?? null;
    if (!teamId) {
      const alias = ALIASES[n];
      if (alias) teamId = byShort.get(alias) ?? null;
    }
    if (!teamId) {
      console.log(`  ⚠ No DB team match for API team "${at.name}" (id ${at.id}) — skipped.`);
      continue;
    }
    await prisma.team.update({ where: { id: teamId }, data: { apiTeamId: at.id } });
    linkedTeamIds.add(teamId);
    linked++;
  }
  console.log(`Linked ${linked}/${dbTeams.length} DB teams to API team ids.`);

  const teams = await prisma.team.findMany({
    where: { id: { in: [...linkedTeamIds] } },
    select: { id: true, name: true, shortName: true, apiTeamId: true },
  });

  let replacedTeams = 0;
  let replacedPlayers = 0;
  let skippedTeams = 0;
  const refReports: string[] = [];

  for (const team of teams) {
    if (!team.apiTeamId) continue;
    const sq = await api<{ response: { players: { id: number; name: string; age: number | null; number: number | null; position: string }[] }[] }>(
      `/players/squads?team=${team.apiTeamId}`,
    );
    const players = sq.response[0]?.players ?? [];
    if (!players.length) {
      console.log(`  ${team.shortName}: no squad data from API yet — kept existing players.`);
      skippedTeams++;
      await sleep(200);
      continue;
    }

    const existing = await prisma.player.findMany({ where: { teamId: team.id }, select: { id: true, name: true } });
    const existingIds = existing.map((p) => p.id);

    if (existingIds.length) {
      const [scorerRefs, awardRefs] = await Promise.all([
        prisma.participantMatchScorerPrediction.findMany({
          where: { playerId: { in: existingIds } },
          include: { prediction: { include: { participant: true } } },
        }),
        prisma.participantAwardPrediction.findMany({
          where: { playerId: { in: existingIds } },
          include: { participant: true },
        }),
      ]);
      const nameById = new Map(existing.map((p) => [p.id, p.name]));
      for (const r of scorerRefs) {
        const who = r.prediction.participant.nickname || r.prediction.participant.name;
        refReports.push(`${who}: ${r.pickType} scorer pick for ${team.shortName} "${nameById.get(r.playerId) ?? r.playerId}" will need to be re-picked.`);
      }
      for (const r of awardRefs) {
        if (!r.playerId) continue;
        const who = r.participant.nickname || r.participant.name;
        refReports.push(`${who}: ${r.awardType} pick for ${team.shortName} "${nameById.get(r.playerId) ?? r.playerId}" will need to be re-picked.`);
      }
    }

    await prisma.player.deleteMany({ where: { teamId: team.id } });
    await prisma.player.createMany({
      data: players.map((p) => ({
        teamId: team.id,
        name: p.name,
        position: POSITION_MAP[p.position] ?? "MID",
        shirtNumber: p.number,
        isYoung: p.age != null && p.age <= 23,
        isSample: false,
        apiPlayerId: p.id,
      })),
    });
    replacedTeams++;
    replacedPlayers += players.length;
    console.log(`  ${team.shortName}: replaced with ${players.length} real players.`);
    await sleep(200);
  }

  console.log(`\nReplaced squads for ${replacedTeams} teams (${replacedPlayers} players total). ${skippedTeams} team(s) skipped (no squad data yet).`);

  if (refReports.length) {
    console.log("\n⚠️  Existing picks referencing replaced players (re-pick recommended):");
    for (const r of refReports) console.log(`  - ${r}`);
  } else {
    console.log("No existing scorer/award picks referenced replaced players.");
  }

  console.log("\nRecomputing scores...");
  const counts = await recomputeEverything(prisma);
  console.log(`Recompute done: match=${counts.match} group=${counts.group} tournament=${counts.tournament}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
