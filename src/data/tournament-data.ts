// ============================================================================
// CENTRAL TOURNAMENT DATA — the single source of truth for teams, venues,
// groups, fixtures and players.
//
// Teams, the group draw and the full 104-match schedule (real kickoff times,
// real host cities, knockout placeholders) are loaded from `wc2026.json`, which
// was generated from the official FIFA World Cup 2026 .ics calendar via
// `scripts/generate-wc2026.ts`. To refresh from a new calendar export:
//     ICS=~/Downloads/FIFA_World_Cup_2026.ics npx tsx scripts/generate-wc2026.ts
//
// Player rosters are still illustratively GENERATED (real squads aren't in the
// calendar) — replace via Admin → Import or by editing buildPlayers().
// ============================================================================

import wc2026 from "./wc2026.json";

export interface TeamSeed {
  name: string;
  shortName: string;
  isoCode: string; // ISO 3166-1 alpha-2 (or gb-eng / gb-sct) for flag-icons
  confederation: string;
}

export interface VenueSeed {
  name: string;
  city: string;
  country: string;
  capacity: number;
}

export interface FixtureSeed {
  matchNumber: number;
  stage: string;
  groupCode?: string;
  venueIndex: number;
  kickoff: Date;
  homeShort?: string;
  awayShort?: string;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  homeSourceMatchNumber?: number;
  awaySourceMatchNumber?: number;
  homeSourceType?: string;
  awaySourceType?: string;
}

export interface PlayerSeed {
  teamShort: string;
  name: string;
  position: string;
  shirtNumber: number;
  isYoung: boolean;
}

// ---------------------------------------------------------------------------
// Teams + group draw (from wc2026.json)
// ---------------------------------------------------------------------------

export const TEAMS: TeamSeed[] = wc2026.teams as TeamSeed[];

export const GROUP_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

export const GROUP_LAYOUT: Record<string, string[]> = wc2026.groupLayout as Record<string, string[]>;

// ---------------------------------------------------------------------------
// 16 real host venues. Order MUST match the venueIndex values in wc2026.json
// (see CITY_TO_VENUE in scripts/generate-wc2026.ts).
// ---------------------------------------------------------------------------

export const VENUES: VenueSeed[] = [
  { name: "MetLife Stadium", city: "New York / New Jersey", country: "USA", capacity: 82500 },
  { name: "SoFi Stadium", city: "Los Angeles", country: "USA", capacity: 70000 },
  { name: "AT&T Stadium", city: "Dallas", country: "USA", capacity: 80000 },
  { name: "NRG Stadium", city: "Houston", country: "USA", capacity: 72000 },
  { name: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA", capacity: 71000 },
  { name: "Lincoln Financial Field", city: "Philadelphia", country: "USA", capacity: 69000 },
  { name: "Gillette Stadium", city: "Boston", country: "USA", capacity: 65000 },
  { name: "Lumen Field", city: "Seattle", country: "USA", capacity: 69000 },
  { name: "Levi's Stadium", city: "San Francisco Bay Area", country: "USA", capacity: 68500 },
  { name: "Arrowhead Stadium", city: "Kansas City", country: "USA", capacity: 76000 },
  { name: "Hard Rock Stadium", city: "Miami", country: "USA", capacity: 65000 },
  { name: "BMO Field", city: "Toronto", country: "Canada", capacity: 45000 },
  { name: "BC Place", city: "Vancouver", country: "Canada", capacity: 54000 },
  { name: "Estadio Azteca", city: "Mexico City", country: "Mexico", capacity: 87000 },
  { name: "Estadio Akron", city: "Guadalajara", country: "Mexico", capacity: 48000 },
  { name: "Estadio BBVA", city: "Monterrey", country: "Mexico", capacity: 53000 },
];

// ---------------------------------------------------------------------------
// Fixtures (real schedule from wc2026.json)
// ---------------------------------------------------------------------------

interface RawFixture {
  matchNumber: number;
  stage: string;
  venueIndex: number;
  kickoffISO: string;
  groupCode?: string;
  homeShort?: string;
  awayShort?: string;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  homeSourceMatchNumber?: number;
  awaySourceMatchNumber?: number;
  homeSourceType?: string;
  awaySourceType?: string;
}

export function buildAllFixtures(): FixtureSeed[] {
  return (wc2026.fixtures as unknown as RawFixture[]).map((f) => ({
    matchNumber: f.matchNumber,
    stage: f.stage,
    groupCode: f.groupCode,
    venueIndex: f.venueIndex,
    kickoff: new Date(f.kickoffISO),
    homeShort: f.homeShort,
    awayShort: f.awayShort,
    homePlaceholder: f.homePlaceholder,
    awayPlaceholder: f.awayPlaceholder,
    homeSourceMatchNumber: f.homeSourceMatchNumber,
    awaySourceMatchNumber: f.awaySourceMatchNumber,
    homeSourceType: f.homeSourceType,
    awaySourceType: f.awaySourceType,
  }));
}

// ---------------------------------------------------------------------------
// Sample players (illustrative — NOT official squads). Marquee forwards use
// recognizable names; the rest are generated from regional name pools.
// ---------------------------------------------------------------------------

const NAME_POOLS: Record<string, { first: string[]; last: string[] }> = {
  LATIN: {
    first: ["Lucas", "Mateo", "Santiago", "Diego", "Bruno", "Rafael", "Andrés", "Carlos", "Gabriel", "Thiago"],
    last: ["Silva", "Gómez", "Fernández", "Rodríguez", "Martins", "Costa", "Romero", "Herrera", "Vargas", "Sosa"],
  },
  AFRICAN: {
    first: ["Youssef", "Mohamed", "Samuel", "Kwame", "Sadio", "Riyad", "Victor", "Ismael", "Thomas", "Idrissa"],
    last: ["Diop", "Traoré", "Mensah", "Osei", "Koné", "Ndiaye", "Bailly", "Eze", "Mané", "Cissé"],
  },
  ASIAN: {
    first: ["Takumi", "Hiroshi", "Min-jae", "Sunwoo", "Ali", "Hassan", "Omar", "Aziz", "Kenji", "Reza"],
    last: ["Tanaka", "Kim", "Park", "Sato", "Nakamura", "Al-Ahmadi", "Karimi", "Lee", "Yamamoto", "Hosseini"],
  },
  EURO: {
    first: ["Lukas", "Marco", "Tomas", "Niklas", "Jakob", "Daniel", "Liam", "Noah", "Felix", "Stefan"],
    last: ["Novak", "Schmidt", "Hansen", "Müller", "Kowalski", "Petrov", "Johnson", "Andersson", "Horvat", "Bauer"],
  },
};

function poolFor(team: TeamSeed) {
  if (team.confederation === "CAF") return NAME_POOLS.AFRICAN;
  if (team.confederation === "AFC") return NAME_POOLS.ASIAN;
  if (team.confederation === "CONMEBOL" || ["MEX", "POR", "ESP"].includes(team.shortName)) return NAME_POOLS.LATIN;
  return NAME_POOLS.EURO;
}

// Two marquee forwards per selected team (illustrative).
const STAR_FORWARDS: Record<string, [string, string]> = {
  BRA: ["Vinícius Júnior", "Rodrygo"],
  ARG: ["Lionel Messi", "Julián Álvarez"],
  FRA: ["Kylian Mbappé", "Ousmane Dembélé"],
  ENG: ["Harry Kane", "Jude Bellingham"],
  POR: ["Cristiano Ronaldo", "Rafael Leão"],
  ESP: ["Lamine Yamal", "Álvaro Morata"],
  GER: ["Jamal Musiala", "Florian Wirtz"],
  NED: ["Cody Gakpo", "Memphis Depay"],
  BEL: ["Romelu Lukaku", "Jérémy Doku"],
  USA: ["Christian Pulisic", "Folarin Balogun"],
  NOR: ["Erling Haaland", "Alexander Sørloth"],
  EGY: ["Mohamed Salah", "Omar Marmoush"],
};

function lcg(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) + 1;
}

export function buildPlayers(): PlayerSeed[] {
  const out: PlayerSeed[] = [];
  const template = ["GK", "DEF", "DEF", "MID", "MID", "FWD", "FWD"];

  for (const team of TEAMS) {
    const pool = poolFor(team);
    const rnd = lcg(hash(team.shortName));
    const usedFirst = new Set<string>();
    const stars = STAR_FORWARDS[team.shortName];
    let shirt = 1;

    template.forEach((position, idx) => {
      let name: string;
      if (position === "FWD" && stars) {
        name = stars[idx === template.length - 1 ? 1 : 0];
      } else {
        let first = pool.first[Math.floor(rnd() * pool.first.length)];
        let guard = 0;
        while (usedFirst.has(first) && guard < 10) {
          first = pool.first[Math.floor(rnd() * pool.first.length)];
          guard++;
        }
        usedFirst.add(first);
        const last = pool.last[Math.floor(rnd() * pool.last.length)];
        name = `${first} ${last}`;
      }
      out.push({
        teamShort: team.shortName,
        name,
        position,
        shirtNumber: position === "GK" ? 1 : ++shirt,
        isYoung: idx === 3,
      });
    });
  }
  return out;
}
