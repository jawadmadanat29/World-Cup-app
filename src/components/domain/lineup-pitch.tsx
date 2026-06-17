"use client";
import * as React from "react";
import { Flag } from "@/components/domain/flag";
import { cn } from "@/lib/utils";
import type { MatchLiveData, MatchLineup, LineupSlot } from "@/lib/queries";

type EventTally = { goals: number; ownGoals: number; yellow: boolean; red: boolean };

function lastName(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function colOf(p: LineupSlot): number {
  return p.grid ? Number(p.grid.split(":")[1]) || 0 : 0;
}

function rowsOf(xi: LineupSlot[]): LineupSlot[][] {
  const map = new Map<number, LineupSlot[]>();
  xi.forEach((p, idx) => {
    const r = p.grid ? Number(p.grid.split(":")[0]) || idx + 1 : idx + 1;
    const arr = map.get(r) ?? [];
    arr.push(p);
    map.set(r, arr);
  });
  return [...map.keys()].sort((a, b) => a - b).map((k) => map.get(k)!.slice().sort((a, b) => colOf(a) - colOf(b)));
}

function tallyEvents(events: MatchLiveData["events"]): Map<string, EventTally> {
  const m = new Map<string, EventTally>();
  for (const e of events) {
    if (!e.playerId) continue;
    const t = m.get(e.playerId) ?? { goals: 0, ownGoals: 0, yellow: false, red: false };
    if (e.type === "GOAL" || e.type === "PENALTY_GOAL") t.goals++;
    else if (e.type === "OWN_GOAL") t.ownGoals++;
    else if (e.type === "YELLOW") t.yellow = true;
    else if (e.type === "RED") t.red = true;
    m.set(e.playerId, t);
  }
  return m;
}

function Badges({ ev }: { ev: EventTally | undefined }) {
  if (!ev) return null;
  return (
    <>
      {ev.goals > 0 && (
        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-white px-1 text-[9px] leading-tight shadow">
          ⚽{ev.goals > 1 ? ev.goals : ""}
        </span>
      )}
      {ev.ownGoals > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-white px-1 text-[9px] shadow">🥅</span>}
      {(ev.red || ev.yellow) && (
        <span className={cn("absolute -left-1 -top-1.5 h-2.5 w-1.5 rounded-[1px] shadow", ev.red ? "bg-red-600" : "bg-yellow-400")} />
      )}
    </>
  );
}

function PlayerChip({ p, ev, dark }: { p: LineupSlot; ev: EventTally | undefined; dark: boolean }) {
  return (
    <div className="flex w-[18%] flex-col items-center gap-0.5">
      <div
        className={cn(
          "relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold shadow",
          dark ? "bg-slate-900 text-white" : "bg-white text-slate-900",
        )}
      >
        {p.number ?? ""}
        <Badges ev={ev} />
      </div>
      <span className="max-w-[60px] truncate text-[9px] leading-tight text-white/90">{lastName(p.name)}</span>
    </div>
  );
}

function Half({ lineup, tally, dark, attackingUp }: { lineup: MatchLineup; tally: Map<string, EventTally>; dark: boolean; attackingUp: boolean }) {
  const rows = rowsOf(lineup.startXI);
  // attackingUp (home, top half): GK first/top → forwards toward the midline (bottom of this half).
  // else (away, bottom half): forwards near the midline (top) → GK at the bottom.
  const ordered = attackingUp ? rows : rows.slice().reverse();
  return (
    <div className="flex flex-1 flex-col justify-around py-2">
      {ordered.map((row, i) => (
        <div key={i} className="flex justify-evenly">
          {row.map((p, j) => (
            <PlayerChip key={`${i}-${j}-${p.playerId ?? p.name}`} p={p} ev={p.playerId ? tally.get(p.playerId) : undefined} dark={dark} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Bench({ title, lineup, tally }: { title: string; lineup: MatchLineup; tally: Map<string, EventTally> }) {
  if (!lineup.subs.length) return null;
  return (
    <div className="text-xs">
      <p className="mb-1 font-medium text-muted-foreground">{title} bench{lineup.formation ? ` · ${lineup.formation}` : ""}</p>
      <div className="flex flex-wrap gap-1.5">
        {lineup.subs.map((p, i) => {
          const ev = p.playerId ? tally.get(p.playerId) : undefined;
          return (
            <span key={`${i}-${p.playerId ?? p.name}`} className="inline-flex items-center gap-1 rounded-full border bg-secondary/50 px-2 py-0.5">
              <span className="tabular-nums text-muted-foreground">{p.number ?? "–"}</span>
              {lastName(p.name)}
              {ev?.goals ? <span>⚽{ev.goals > 1 ? ev.goals : ""}</span> : null}
              {ev?.red ? <span>🟥</span> : ev?.yellow ? <span>🟨</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function LineupPitch({
  matchId,
  initial,
  home,
  away,
}: {
  matchId: string;
  initial: MatchLiveData;
  home: { name: string; iso: string } | null;
  away: { name: string; iso: string } | null;
}) {
  const [data, setData] = React.useState<MatchLiveData>(initial);

  React.useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch(`/api/match/${matchId}/live`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { data: MatchLiveData | null };
        if (active && json.data) setData(json.data);
      } catch {
        /* keep last state */
      }
    }
    const id = setInterval(poll, 30_000);
    poll();
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [matchId]);

  const tally = React.useMemo(() => tallyEvents(data.events), [data.events]);
  if (!data.lineupHome && !data.lineupAway) {
    return <p className="text-sm text-muted-foreground">Lineups usually drop ~40 minutes before kickoff — check back soon.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3 text-sm font-semibold">
        {home && <Flag iso={home.iso} size="sm" />}
        <span className="font-mono text-lg tabular-nums">{data.homeScore} <span className="text-muted-foreground">-</span> {data.awayScore}</span>
        {away && <Flag iso={away.iso} size="sm" />}
        {data.minute != null && <span className="text-xs font-normal text-muted-foreground">{data.minute}&apos;</span>}
      </div>

      <div
        className="relative flex flex-col overflow-hidden rounded-lg"
        style={{
          minHeight: 460,
          background: "repeating-linear-gradient(0deg, #1f9d55 0px, #1f9d55 40px, #1c9050 40px, #1c9050 80px)",
        }}
      >
        {/* center line + circle */}
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/40" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
        {data.lineupHome ? <Half lineup={data.lineupHome} tally={tally} dark={false} attackingUp /> : <div className="flex-1" />}
        {data.lineupAway ? <Half lineup={data.lineupAway} tally={tally} dark attackingUp={false} /> : <div className="flex-1" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.lineupHome && <Bench title={home?.name ?? "Home"} lineup={data.lineupHome} tally={tally} />}
        {data.lineupAway && <Bench title={away?.name ?? "Away"} lineup={data.lineupAway} tally={tally} />}
      </div>
    </div>
  );
}
