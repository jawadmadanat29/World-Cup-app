import "server-only";

// Provider-agnostic football-data interface. The concrete adapter targets the
// API-Football (API-Sports) v3 shape; swap in another by implementing this.
// Nothing here runs unless FOOTBALL_API_KEY is set — the app is fully usable
// (manual entry) without it, and reads never hit the API.

export interface NormalizedFixture {
  apiFixtureId: number;
  homeName: string;
  awayName: string;
  homeApiTeamId: number | null;
  awayApiTeamId: number | null;
  /** Raw API round string, e.g. "Group Stage - 1", "Round of 16", "Final". */
  round: string;
  /** Our internal stage code, derived from `round`, or null if unrecognized. */
  stage: string | null;
  kickoff: Date | null;
  finished: boolean;
  live: boolean;
  /** Elapsed minutes while live (API status.elapsed), else null. */
  minute: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  aetHome: number | null;
  aetAway: number | null;
  pensHome: number | null;
  pensAway: number | null;
  /** FT | AET | PENS | LIVE | SCHEDULED */
  state: string;
}

export interface FetchResult {
  fixtures: NormalizedFixture[];
  quota: { remaining: number | null; limit: number | null };
}

export interface NormalizedTeam {
  apiTeamId: number;
  name: string;
  code: string | null;
}

export interface NormalizedSquadPlayer {
  apiPlayerId: number;
  name: string;
  position: string; // GK | DEF | MID | FWD (already mapped)
  shirtNumber: number | null;
  age: number | null;
}

export interface NormalizedEvent {
  /** GOAL | PENALTY_GOAL | OWN_GOAL | ASSIST | YELLOW | RED */
  type: string;
  teamApiId: number | null;
  playerApiId: number | null;
  playerName: string | null;
  minute: number | null;
}

export interface FootballProvider {
  name: string;
  configured: boolean;
  fetchFixtures(): Promise<FetchResult>;
  fetchTeams(): Promise<NormalizedTeam[]>;
  fetchSquad(apiTeamId: number): Promise<NormalizedSquadPlayer[]>;
  fetchEvents(apiFixtureId: number): Promise<NormalizedEvent[]>;
}

const FINISHED = new Set(["FT", "AET", "PEN"]);
const LIVE = new Set(["1H", "2H", "HT", "ET", "LIVE", "BT", "P"]);

function stateFromShort(short: string): string {
  if (short === "PEN") return "PENS";
  if (short === "AET") return "AET";
  if (short === "FT") return "FT";
  if (LIVE.has(short)) return "LIVE";
  return "SCHEDULED";
}

/** Map API-Football's "league.round" string to our internal stage code. */
export function mapRoundToStage(round: string): string | null {
  const r = round.trim().toLowerCase();
  if (r.startsWith("group stage")) return "GROUP";
  if (r === "round of 32") return "R32";
  if (r === "round of 16") return "R16";
  if (r === "quarter-finals" || r === "quarterfinals") return "QF";
  if (r === "semi-finals" || r === "semifinals") return "SF";
  if (r.includes("3rd place") || r.includes("third place")) return "THIRD_PLACE";
  if (r === "final") return "FINAL";
  return null;
}

const POSITION_MAP: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Attacker: "FWD",
};

function notConfigured(): FootballProvider {
  const err = async (): Promise<never> => {
    throw new Error("No football API configured. Set FOOTBALL_API_KEY to enable live sync.");
  };
  return {
    name: "none",
    configured: false,
    fetchFixtures: err,
    fetchTeams: err,
    fetchSquad: err,
    fetchEvents: err,
  };
}

function apiFootball(): FootballProvider {
  const key = process.env.FOOTBALL_API_KEY!;
  const host = process.env.FOOTBALL_API_HOST || "v3.football.api-sports.io";
  const league = process.env.FOOTBALL_API_LEAGUE || "1"; // 1 = FIFA World Cup
  const season = process.env.FOOTBALL_API_SEASON || "2026";
  const headers = { "x-apisports-key": key, "x-rapidapi-key": key, "x-rapidapi-host": host };

  async function apiGet<T>(path: string): Promise<{ json: { response?: T[]; errors?: unknown }; quota: { remaining: number | null; limit: number | null } }> {
    const url = `https://${host}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
      const remaining = Number(res.headers.get("x-ratelimit-requests-remaining") ?? res.headers.get("X-RateLimit-Remaining"));
      const limit = Number(res.headers.get("x-ratelimit-requests-limit") ?? res.headers.get("X-RateLimit-Limit"));
      if (!res.ok) throw new Error(`API responded ${res.status} ${res.statusText}`);
      const json = (await res.json()) as { response?: T[]; errors?: unknown };
      if (json.errors && (Array.isArray(json.errors) ? json.errors.length : Object.keys(json.errors as object).length)) {
        throw new Error(`API error: ${JSON.stringify(json.errors)}`);
      }
      return { json, quota: { remaining: Number.isFinite(remaining) ? remaining : null, limit: Number.isFinite(limit) ? limit : null } };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    name: "api-football",
    configured: true,

    async fetchFixtures() {
      const { json, quota } = await apiGet<{
        fixture?: { id?: number; date?: string; status?: { short?: string; elapsed?: number | null } };
        league?: { round?: string };
        teams?: { home?: { id?: number; name?: string }; away?: { id?: number; name?: string } };
        goals?: { home?: number | null; away?: number | null };
        score?: {
          extratime?: { home?: number | null; away?: number | null };
          penalty?: { home?: number | null; away?: number | null };
        };
      }>(`/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`);

      const fixtures: NormalizedFixture[] = (json.response ?? []).map((r) => {
        const short = r.fixture?.status?.short ?? "NS";
        const round = r.league?.round ?? "";
        return {
          apiFixtureId: r.fixture?.id ?? 0,
          homeName: r.teams?.home?.name ?? "",
          awayName: r.teams?.away?.name ?? "",
          homeApiTeamId: r.teams?.home?.id ?? null,
          awayApiTeamId: r.teams?.away?.id ?? null,
          round,
          stage: mapRoundToStage(round),
          kickoff: r.fixture?.date ? new Date(r.fixture.date) : null,
          finished: FINISHED.has(short),
          live: LIVE.has(short),
          minute: r.fixture?.status?.elapsed ?? null,
          homeGoals: r.goals?.home ?? null,
          awayGoals: r.goals?.away ?? null,
          aetHome: r.score?.extratime?.home ?? null,
          aetAway: r.score?.extratime?.away ?? null,
          pensHome: r.score?.penalty?.home ?? null,
          pensAway: r.score?.penalty?.away ?? null,
          state: stateFromShort(short),
        };
      });
      return { fixtures, quota };
    },

    async fetchTeams() {
      const { json } = await apiGet<{ team?: { id?: number; name?: string; code?: string | null } }>(
        `/teams?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`,
      );
      return (json.response ?? [])
        .filter((r) => r.team?.id != null && r.team?.name)
        .map((r) => ({ apiTeamId: r.team!.id!, name: r.team!.name!, code: r.team!.code ?? null }));
    },

    async fetchSquad(apiTeamId: number) {
      const { json } = await apiGet<{ players?: { id?: number; name?: string; age?: number | null; number?: number | null; position?: string }[] }>(
        `/players/squads?team=${encodeURIComponent(String(apiTeamId))}`,
      );
      const players = json.response?.[0]?.players ?? [];
      return players
        .filter((p) => p.id != null && p.name)
        .map((p) => ({
          apiPlayerId: p.id!,
          name: p.name!,
          position: POSITION_MAP[p.position ?? ""] ?? "MID",
          shirtNumber: p.number ?? null,
          age: p.age ?? null,
        }));
    },

    async fetchEvents(apiFixtureId: number) {
      const { json } = await apiGet<{
        time?: { elapsed?: number | null };
        team?: { id?: number | null };
        player?: { id?: number | null; name?: string | null };
        assist?: { id?: number | null; name?: string | null };
        type?: string;
        detail?: string;
      }>(`/fixtures/events?fixture=${encodeURIComponent(String(apiFixtureId))}`);

      const out: NormalizedEvent[] = [];
      for (const e of json.response ?? []) {
        const minute = e.time?.elapsed ?? null;
        const teamApiId = e.team?.id ?? null;
        if (e.type === "Goal") {
          if (e.detail === "Missed Penalty") continue;
          const goalType = e.detail === "Penalty" ? "PENALTY_GOAL" : e.detail === "Own Goal" ? "OWN_GOAL" : "GOAL";
          out.push({ type: goalType, teamApiId, playerApiId: e.player?.id ?? null, playerName: e.player?.name ?? null, minute });
          if (goalType !== "OWN_GOAL" && e.assist?.id != null) {
            out.push({ type: "ASSIST", teamApiId, playerApiId: e.assist.id, playerName: e.assist.name ?? null, minute });
          }
        } else if (e.type === "Card") {
          const cardType = e.detail === "Yellow Card" ? "YELLOW" : "RED";
          out.push({ type: cardType, teamApiId, playerApiId: e.player?.id ?? null, playerName: e.player?.name ?? null, minute });
        }
      }
      return out;
    },
  };
}

export function getProvider(): FootballProvider {
  return process.env.FOOTBALL_API_KEY ? apiFootball() : notConfigured();
}
