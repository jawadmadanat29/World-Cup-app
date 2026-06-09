/* eslint-disable no-console */
// Seed script — builds a clean PRE-TOURNAMENT league from the central data:
// 48 teams, 16 venues, 12 groups, all 104 fixtures (real 2026 calendar),
// sample players, default scoring rules, settings, section deadlines, and 6
// participant profiles. NO results, NO events, NO predictions — nothing has
// been played yet, so the admin enters everything via the app.
//
// Run with: npm run db:seed
//
// Uses RELATIVE imports + its own PrismaClient so it runs cleanly under tsx.

import { PrismaClient } from "@prisma/client";
import {
  TEAMS,
  VENUES,
  GROUP_CODES,
  GROUP_LAYOUT,
  buildAllFixtures,
  buildPlayers,
} from "../src/data/tournament-data";
import { DEFAULT_SCORING_RULES } from "../src/lib/scoring/rules";
import { recomputeEverything } from "../src/lib/scoring/recompute-core";
import { SETTINGS } from "../src/lib/enums";

const prisma = new PrismaClient();

const PARTICIPANTS = [
  { name: "Phil Pinpoint", nickname: "The Gaffer", accentColor: "#10b981" },
  { name: "Tina Tactics", nickname: "Coach", accentColor: "#f59e0b" },
  { name: "Sam Sweeper", nickname: "Wall", accentColor: "#38bdf8" },
  { name: "Vic VAR", nickname: "Replay", accentColor: "#a78bfa" },
  { name: "Greg Groupstage", nickname: "Greggy", accentColor: "#fb7185" },
  { name: "Pat Penalty", nickname: "Spot-kick", accentColor: "#34d399" },
];

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

async function wipe() {
  await prisma.pointTransaction.deleteMany();
  await prisma.adminAdjustment.deleteMany();
  await prisma.wildcard.deleteMany();
  await prisma.participantMatchScorerPrediction.deleteMany();
  await prisma.participantMatchPrediction.deleteMany();
  await prisma.participantGroupPrediction.deleteMany();
  await prisma.participantKnockoutPrediction.deleteMany();
  await prisma.participantTournamentTeamPick.deleteMany();
  await prisma.participantTournamentPrediction.deleteMany();
  await prisma.participantAwardPrediction.deleteMany();
  await prisma.leagueMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.matchEvent.deleteMany();
  await prisma.matchResult.deleteMany();
  await prisma.match.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.league.deleteMany();
  await prisma.scoringRule.deleteMany();
  await prisma.appSettings.deleteMany();
  await prisma.predictionDeadline.deleteMany();
  await prisma.awardResult.deleteMany();
  await prisma.tournamentResult.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.syncState.deleteMany();
}

async function main() {
  console.log("🌱 Seeding World Cup Predictor 2026 (pre-tournament)…");
  await wipe();

  const league = await prisma.league.create({ data: { name: "Friends League", season: "2026", isActive: true } });

  // Venues
  const venueIds: string[] = [];
  for (const v of VENUES) venueIds.push((await prisma.venue.create({ data: v })).id);

  // Teams
  const teamIdByShort = new Map<string, string>();
  for (const t of TEAMS) {
    const created = await prisma.team.create({ data: { ...t, isSample: true } });
    teamIdByShort.set(t.shortName, created.id);
  }

  // Groups + members
  const groupIdByCode = new Map<string, string>();
  for (let i = 0; i < GROUP_CODES.length; i++) {
    const code = GROUP_CODES[i];
    const group = await prisma.group.create({ data: { name: `Group ${code}`, code, orderIndex: i } });
    groupIdByCode.set(code, group.id);
    const teams = GROUP_LAYOUT[code];
    for (let slot = 0; slot < teams.length; slot++) {
      await prisma.groupMember.create({ data: { groupId: group.id, teamId: teamIdByShort.get(teams[slot])!, slot: slot + 1 } });
    }
  }

  // Players
  for (const p of buildPlayers()) {
    await prisma.player.create({
      data: {
        teamId: teamIdByShort.get(p.teamShort)!,
        name: p.name, position: p.position, shirtNumber: p.shirtNumber, isYoung: p.isYoung, isSample: true,
      },
    });
  }

  // Scoring rules
  for (const r of DEFAULT_SCORING_RULES) await prisma.scoringRule.create({ data: r });

  // App settings
  const settings: [string, string][] = [
    [SETTINGS.MATCH_LOCK_BUFFER_MINUTES, "0"],
    [SETTINGS.CLOSING_SOON_MINUTES, "120"],
    [SETTINGS.WILDCARDS_PER_PARTICIPANT, "3"],
    [SETTINGS.TOURNAMENT_NAME, "World Cup Predictor 2026"],
    [SETTINGS.ACTIVE_LEAGUE_ID, league.id],
  ];
  for (const [key, value] of settings) await prisma.appSettings.create({ data: { key, value } });

  // Matches — all upcoming (SCHEDULED), no results. Knockouts keep placeholders.
  const fixtures = buildAllFixtures();
  const opener = fixtures.reduce((min, f) => (f.kickoff < min ? f.kickoff : min), fixtures[0].kickoff);
  const matchIdByNumber = new Map<number, string>();
  let firstR32: Date | null = null;
  for (const f of fixtures) {
    const m = await prisma.match.create({
      data: {
        matchNumber: f.matchNumber,
        stage: f.stage,
        groupId: f.groupCode ? groupIdByCode.get(f.groupCode)! : null,
        venueId: venueIds[f.venueIndex],
        kickoff: f.kickoff,
        homeTeamId: f.homeShort ? teamIdByShort.get(f.homeShort)! : null,
        awayTeamId: f.awayShort ? teamIdByShort.get(f.awayShort)! : null,
        homePlaceholder: f.homePlaceholder ?? null,
        awayPlaceholder: f.awayPlaceholder ?? null,
        homeSourceType: f.homeSourceType ?? null,
        awaySourceType: f.awaySourceType ?? null,
        status: "SCHEDULED",
      },
    });
    matchIdByNumber.set(f.matchNumber, m.id);
    if (f.stage === "R32" && (!firstR32 || f.kickoff < firstR32)) firstR32 = f.kickoff;
  }
  // Wire knockout bracket feeders.
  for (const f of fixtures) {
    if (f.homeSourceMatchNumber || f.awaySourceMatchNumber) {
      await prisma.match.update({
        where: { id: matchIdByNumber.get(f.matchNumber)! },
        data: {
          homeSourceMatchId: f.homeSourceMatchNumber ? matchIdByNumber.get(f.homeSourceMatchNumber) : null,
          awaySourceMatchId: f.awaySourceMatchNumber ? matchIdByNumber.get(f.awaySourceMatchNumber) : null,
        },
      });
    }
  }

  // Section deadlines (real dates).
  await prisma.predictionDeadline.create({ data: { scope: "TOURNAMENT", deadline: opener } });
  await prisma.predictionDeadline.create({ data: { scope: "GROUP_STAGE", deadline: opener } });
  if (firstR32) await prisma.predictionDeadline.create({ data: { scope: "KO_R32", deadline: firstR32 } });

  // Empty actuals row (nothing decided yet).
  await prisma.tournamentResult.create({ data: { id: "default" } });

  // Participants — profiles only, no predictions yet.
  const allTeamIds = [...teamIdByShort.values()];
  for (let i = 0; i < PARTICIPANTS.length; i++) {
    const p = PARTICIPANTS[i];
    await prisma.participant.create({
      data: {
        leagueId: league.id,
        name: p.name, nickname: p.nickname, initials: initials(p.name), accentColor: p.accentColor,
        favoriteTeamId: allTeamIds[i % allTeamIds.length],
      },
    });
  }

  // Score (nothing to score yet — clears any stale transactions).
  await recomputeEverything(prisma);

  console.log("✅ Seed complete (pre-tournament).");
  console.log(`   ${TEAMS.length} teams · ${VENUES.length} venues · ${GROUP_CODES.length} groups · ${fixtures.length} matches · ${PARTICIPANTS.length} participants`);
  console.log(`   Opens ${opener.toDateString()}. No matches played, no predictions entered — ready for the admin to fill in.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
