import "server-only";
import { prisma } from "@/lib/db";
import { SETTINGS } from "@/lib/enums";

export interface AppConfig {
  matchLockBufferMinutes: number;
  closingSoonMinutes: number;
  wildcardsPerParticipant: number;
  tournamentName: string;
  activeLeagueId: string | null;
}

const DEFAULTS: AppConfig = {
  matchLockBufferMinutes: 0,
  closingSoonMinutes: 120,
  wildcardsPerParticipant: 3,
  tournamentName: "World Cup Predictor 2026",
  activeLeagueId: null,
};

export async function getConfig(): Promise<AppConfig> {
  const rows = await prisma.appSettings.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => {
    const v = map.get(k);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : d;
  };
  return {
    matchLockBufferMinutes: num(SETTINGS.MATCH_LOCK_BUFFER_MINUTES, DEFAULTS.matchLockBufferMinutes),
    closingSoonMinutes: num(SETTINGS.CLOSING_SOON_MINUTES, DEFAULTS.closingSoonMinutes),
    wildcardsPerParticipant: num(SETTINGS.WILDCARDS_PER_PARTICIPANT, DEFAULTS.wildcardsPerParticipant),
    tournamentName: map.get(SETTINGS.TOURNAMENT_NAME) ?? DEFAULTS.tournamentName,
    activeLeagueId: map.get(SETTINGS.ACTIVE_LEAGUE_ID) ?? DEFAULTS.activeLeagueId,
  };
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSettings.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
