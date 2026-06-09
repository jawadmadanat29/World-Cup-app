import "server-only";

// Provider-agnostic football-data interface. The concrete adapter targets the
// API-Football (API-Sports) v3 shape; swap in another by implementing this.
// Nothing here runs unless FOOTBALL_API_KEY is set — the app is fully usable
// (manual entry) without it, and reads never hit the API.

export interface NormalizedFixture {
  homeName: string;
  awayName: string;
  kickoff: Date | null;
  finished: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  /** FT | AET | PENS | LIVE | SCHEDULED */
  state: string;
}

export interface FetchResult {
  fixtures: NormalizedFixture[];
  quota: { remaining: number | null; limit: number | null };
}

export interface FootballProvider {
  name: string;
  configured: boolean;
  fetchFixtures(): Promise<FetchResult>;
}

const FINISHED = new Set(["FT", "AET", "PEN"]);

function stateFromShort(short: string): string {
  if (short === "PEN") return "PENS";
  if (short === "AET") return "AET";
  if (short === "FT") return "FT";
  if (["1H", "2H", "HT", "ET", "LIVE", "BT", "P"].includes(short)) return "LIVE";
  return "SCHEDULED";
}

function notConfigured(): FootballProvider {
  return {
    name: "none",
    configured: false,
    async fetchFixtures() {
      throw new Error("No football API configured. Set FOOTBALL_API_KEY to enable live sync.");
    },
  };
}

function apiFootball(): FootballProvider {
  const key = process.env.FOOTBALL_API_KEY!;
  const host = process.env.FOOTBALL_API_HOST || "v3.football.api-sports.io";
  const league = process.env.FOOTBALL_API_LEAGUE || "1"; // 1 = FIFA World Cup
  const season = process.env.FOOTBALL_API_SEASON || "2026";

  return {
    name: "api-football",
    configured: true,
    async fetchFixtures() {
      const url = `https://${host}/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(url, {
          headers: { "x-apisports-key": key, "x-rapidapi-key": key, "x-rapidapi-host": host },
          signal: controller.signal,
          cache: "no-store",
        });
        const remaining = Number(res.headers.get("x-ratelimit-requests-remaining") ?? res.headers.get("X-RateLimit-Remaining"));
        const limit = Number(res.headers.get("x-ratelimit-requests-limit") ?? res.headers.get("X-RateLimit-Limit"));
        if (!res.ok) throw new Error(`API responded ${res.status} ${res.statusText}`);
        const json = (await res.json()) as { response?: unknown[]; errors?: unknown };
        if (json.errors && Array.isArray(json.errors) ? json.errors.length : json.errors && Object.keys(json.errors).length) {
          throw new Error(`API error: ${JSON.stringify(json.errors)}`);
        }
        const fixtures: NormalizedFixture[] = (json.response ?? []).map((rRaw) => {
          const r = rRaw as {
            fixture?: { date?: string; status?: { short?: string } };
            teams?: { home?: { name?: string }; away?: { name?: string } };
            goals?: { home?: number | null; away?: number | null };
          };
          const short = r.fixture?.status?.short ?? "NS";
          return {
            homeName: r.teams?.home?.name ?? "",
            awayName: r.teams?.away?.name ?? "",
            kickoff: r.fixture?.date ? new Date(r.fixture.date) : null,
            finished: FINISHED.has(short),
            homeGoals: r.goals?.home ?? null,
            awayGoals: r.goals?.away ?? null,
            state: stateFromShort(short),
          };
        });
        return { fixtures, quota: { remaining: Number.isFinite(remaining) ? remaining : null, limit: Number.isFinite(limit) ? limit : null } };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function getProvider(): FootballProvider {
  return process.env.FOOTBALL_API_KEY ? apiFootball() : notConfigured();
}
