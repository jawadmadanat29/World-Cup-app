/* eslint-disable no-console */
// One-off generator: parse the official FIFA World Cup 2026 .ics calendar into
// src/data/wc2026.json (the committed, reproducible source of truth for teams,
// the group draw, venues and the full 104-match schedule).
//
// Usage:  ICS=~/Downloads/FIFA_World_Cup_2026.ics npx tsx scripts/generate-wc2026.ts
// (defaults to ~/Downloads/FIFA_World_Cup_2026.ics)

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

interface Meta { name: string; shortName: string; isoCode: string; confederation: string }

// Display name (as it appears in the .ics SUMMARY) -> team metadata.
const NAME_META: Record<string, Meta> = {
  "Mexico": { name: "Mexico", shortName: "MEX", isoCode: "mx", confederation: "CONCACAF" },
  "South Africa": { name: "South Africa", shortName: "RSA", isoCode: "za", confederation: "CAF" },
  "South Korea": { name: "South Korea", shortName: "KOR", isoCode: "kr", confederation: "AFC" },
  "Czechia": { name: "Czechia", shortName: "CZE", isoCode: "cz", confederation: "UEFA" },
  "Canada": { name: "Canada", shortName: "CAN", isoCode: "ca", confederation: "CONCACAF" },
  "Bosnia & Herz.": { name: "Bosnia & Herzegovina", shortName: "BIH", isoCode: "ba", confederation: "UEFA" },
  "Qatar": { name: "Qatar", shortName: "QAT", isoCode: "qa", confederation: "AFC" },
  "Switzerland": { name: "Switzerland", shortName: "SUI", isoCode: "ch", confederation: "UEFA" },
  "Brazil": { name: "Brazil", shortName: "BRA", isoCode: "br", confederation: "CONMEBOL" },
  "Morocco": { name: "Morocco", shortName: "MAR", isoCode: "ma", confederation: "CAF" },
  "Haiti": { name: "Haiti", shortName: "HAI", isoCode: "ht", confederation: "CONCACAF" },
  "Scotland": { name: "Scotland", shortName: "SCO", isoCode: "gb-sct", confederation: "UEFA" },
  "USA": { name: "United States", shortName: "USA", isoCode: "us", confederation: "CONCACAF" },
  "Paraguay": { name: "Paraguay", shortName: "PAR", isoCode: "py", confederation: "CONMEBOL" },
  "Australia": { name: "Australia", shortName: "AUS", isoCode: "au", confederation: "AFC" },
  "Türkiye": { name: "Türkiye", shortName: "TUR", isoCode: "tr", confederation: "UEFA" },
  "Germany": { name: "Germany", shortName: "GER", isoCode: "de", confederation: "UEFA" },
  "Curaçao": { name: "Curaçao", shortName: "CUW", isoCode: "cw", confederation: "CONCACAF" },
  "Ivory Coast": { name: "Ivory Coast", shortName: "CIV", isoCode: "ci", confederation: "CAF" },
  "Ecuador": { name: "Ecuador", shortName: "ECU", isoCode: "ec", confederation: "CONMEBOL" },
  "Netherlands": { name: "Netherlands", shortName: "NED", isoCode: "nl", confederation: "UEFA" },
  "Japan": { name: "Japan", shortName: "JPN", isoCode: "jp", confederation: "AFC" },
  "Tunisia": { name: "Tunisia", shortName: "TUN", isoCode: "tn", confederation: "CAF" },
  "Sweden": { name: "Sweden", shortName: "SWE", isoCode: "se", confederation: "UEFA" },
  "Belgium": { name: "Belgium", shortName: "BEL", isoCode: "be", confederation: "UEFA" },
  "Egypt": { name: "Egypt", shortName: "EGY", isoCode: "eg", confederation: "CAF" },
  "Iran": { name: "Iran", shortName: "IRN", isoCode: "ir", confederation: "AFC" },
  "New Zealand": { name: "New Zealand", shortName: "NZL", isoCode: "nz", confederation: "OFC" },
  "Spain": { name: "Spain", shortName: "ESP", isoCode: "es", confederation: "UEFA" },
  "Cape Verde": { name: "Cape Verde", shortName: "CPV", isoCode: "cv", confederation: "CAF" },
  "Saudi Arabia": { name: "Saudi Arabia", shortName: "KSA", isoCode: "sa", confederation: "AFC" },
  "Uruguay": { name: "Uruguay", shortName: "URU", isoCode: "uy", confederation: "CONMEBOL" },
  "France": { name: "France", shortName: "FRA", isoCode: "fr", confederation: "UEFA" },
  "Senegal": { name: "Senegal", shortName: "SEN", isoCode: "sn", confederation: "CAF" },
  "Norway": { name: "Norway", shortName: "NOR", isoCode: "no", confederation: "UEFA" },
  "Iraq": { name: "Iraq", shortName: "IRQ", isoCode: "iq", confederation: "AFC" },
  "Argentina": { name: "Argentina", shortName: "ARG", isoCode: "ar", confederation: "CONMEBOL" },
  "Algeria": { name: "Algeria", shortName: "ALG", isoCode: "dz", confederation: "CAF" },
  "Austria": { name: "Austria", shortName: "AUT", isoCode: "at", confederation: "UEFA" },
  "Jordan": { name: "Jordan", shortName: "JOR", isoCode: "jo", confederation: "AFC" },
  "Portugal": { name: "Portugal", shortName: "POR", isoCode: "pt", confederation: "UEFA" },
  "DR Congo": { name: "DR Congo", shortName: "COD", isoCode: "cd", confederation: "CAF" },
  "Uzbekistan": { name: "Uzbekistan", shortName: "UZB", isoCode: "uz", confederation: "AFC" },
  "Colombia": { name: "Colombia", shortName: "COL", isoCode: "co", confederation: "CONMEBOL" },
  "England": { name: "England", shortName: "ENG", isoCode: "gb-eng", confederation: "UEFA" },
  "Croatia": { name: "Croatia", shortName: "CRO", isoCode: "hr", confederation: "UEFA" },
  "Ghana": { name: "Ghana", shortName: "GHA", isoCode: "gh", confederation: "CAF" },
  "Panama": { name: "Panama", shortName: "PAN", isoCode: "pa", confederation: "CONCACAF" },
};

// .ics LOCATION city -> index into the VENUES array in tournament-data.ts.
const CITY_TO_VENUE: Record<string, number> = {
  "New York/NJ": 0, "MetLife Stadium, NY/NJ": 0,
  "Los Angeles": 1, "Dallas": 2, "Houston": 3, "Atlanta": 4, "Philadelphia": 5,
  "Boston": 6, "Seattle": 7, "San Francisco": 8, "Kansas City": 9, "Miami": 10,
  "Toronto": 11, "Vancouver": 12, "Mexico City": 13, "Guadalajara": 14, "Monterrey": 15,
};

const icsPath = (process.env.ICS || path.join(os.homedir(), "Downloads/FIFA_World_Cup_2026.ics")).replace(/^~/, os.homedir());
const raw = fs.readFileSync(icsPath, "utf8");
const blocks = raw.split("BEGIN:VEVENT").slice(1);

interface Ev { num: number; startISO: string; summary: string; city: string; desc: string }
const events: Ev[] = blocks
  .map((b) => {
    const num = Number(b.match(/UID:wc2026-(\d+)/)![1]) + 1;
    const dt = b.match(/DTSTART:(\d{8}T\d{6})Z/)![1];
    const startISO = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}T${dt.slice(9, 11)}:${dt.slice(11, 13)}:${dt.slice(13, 15)}Z`;
    const summary = (b.match(/SUMMARY:.*WC2026: (.*)/)?.[1] ?? b.match(/SUMMARY:(.*)/)![1]).trim();
    const city = b.match(/LOCATION:(.*)/)![1].trim();
    const desc = (b.match(/DESCRIPTION:(?!Kicks off)(.*)/)?.[1] ?? "").trim();
    return { num, startISO, summary, city, desc };
  })
  .sort((a, b) => a.num - b.num);

function meta(name: string): Meta {
  const m = NAME_META[name];
  if (!m) throw new Error(`Unknown team name in ICS: "${name}"`);
  return m;
}
function venueIndex(city: string): number {
  const v = CITY_TO_VENUE[city];
  if (v === undefined) throw new Error(`Unknown city in ICS: "${city}"`);
  return v;
}
function stageOf(e: Ev): string {
  if (e.desc.startsWith("Group Stage")) return "GROUP";
  if (e.desc === "Round of 32") return "R32";
  if (e.desc === "Round of 16") return "R16";
  if (e.desc === "Quarter-final") return "QF";
  if (e.desc === "Semi-final") return "SF";
  if (/third place/i.test(e.summary)) return "THIRD_PLACE";
  return "FINAL";
}
// Standard sequential bracket feeders for rounds the ICS leaves generic.
function feeders(num: number, stage: string): { h: number; a: number; type: string } | null {
  if (stage === "R16") { const i = num - 89; return { h: 73 + 2 * i, a: 74 + 2 * i, type: "winner" }; }
  if (stage === "QF") { const i = num - 97; return { h: 89 + 2 * i, a: 90 + 2 * i, type: "winner" }; }
  if (stage === "SF") { const i = num - 101; return { h: 97 + 2 * i, a: 98 + 2 * i, type: "winner" }; }
  if (stage === "THIRD_PLACE") return { h: 101, a: 102, type: "loser" };
  if (stage === "FINAL") return { h: 101, a: 102, type: "winner" };
  return null;
}

const groupLayout: Record<string, string[]> = {};
const teamsSeen = new Map<string, Meta>();
const fixtures: Record<string, unknown>[] = [];

for (const e of events) {
  const stage = stageOf(e);
  const fixture: Record<string, unknown> = { matchNumber: e.num, stage, venueIndex: venueIndex(e.city), kickoffISO: e.startISO };

  if (stage === "GROUP") {
    const code = e.desc.match(/Group Stage Group (\w)/)![1];
    const [h, a] = e.summary.split(" vs ").map((s) => s.trim());
    for (const nm of [h, a]) {
      const m = meta(nm);
      teamsSeen.set(m.shortName, m);
      (groupLayout[code] ??= []);
      if (!groupLayout[code].includes(m.shortName)) groupLayout[code].push(m.shortName);
    }
    fixture.groupCode = code;
    fixture.homeShort = meta(h).shortName;
    fixture.awayShort = meta(a).shortName;
  } else if (stage === "R32") {
    const [h, a] = e.summary.split(" vs ").map((s) => s.trim());
    fixture.homePlaceholder = h;
    fixture.awayPlaceholder = a;
  } else {
    const f = feeders(e.num, stage)!;
    fixture.homeSourceMatchNumber = f.h;
    fixture.awaySourceMatchNumber = f.a;
    fixture.homeSourceType = f.type;
    fixture.awaySourceType = f.type;
    const verb = f.type === "loser" ? "Loser" : "Winner";
    fixture.homePlaceholder = `${verb} Match ${f.h}`;
    fixture.awayPlaceholder = `${verb} Match ${f.a}`;
  }
  fixtures.push(fixture);
}

// Sanity checks
const codes = Object.keys(groupLayout).sort();
if (codes.length !== 12) throw new Error(`Expected 12 groups, got ${codes.length}`);
for (const c of codes) if (groupLayout[c].length !== 4) throw new Error(`Group ${c} has ${groupLayout[c].length} teams`);
if (teamsSeen.size !== 48) throw new Error(`Expected 48 teams, got ${teamsSeen.size}`);
if (fixtures.length !== 104) throw new Error(`Expected 104 fixtures, got ${fixtures.length}`);

const out = {
  generatedAt: new Date().toISOString(),
  source: "FIFA_World_Cup_2026.ics",
  teams: [...teamsSeen.values()],
  groupLayout,
  fixtures,
};
const outPath = path.join(process.cwd(), "src", "data", "wc2026.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`✅ wrote ${out.teams.length} teams, ${codes.length} groups, ${fixtures.length} fixtures → ${outPath}`);
