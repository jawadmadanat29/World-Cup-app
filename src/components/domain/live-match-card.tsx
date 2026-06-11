"use client";
import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamLabel } from "@/components/domain/team-label";
import { STAGE_SHORT } from "@/lib/enums";
import { cn } from "@/lib/utils";
import type { FeaturedMatch } from "@/lib/queries";

const POLL_MS = 30_000;

const EVENT_ICON: Record<string, string> = {
  GOAL: "⚽",
  PENALTY_GOAL: "⚽",
  OWN_GOAL: "🥅",
  ASSIST: "👟",
  YELLOW: "🟨",
  RED: "🟥",
};

function eventLabel(type: string): string {
  if (type === "OWN_GOAL") return "Own goal";
  if (type === "PENALTY_GOAL") return "Penalty";
  if (type === "ASSIST") return "Assist";
  if (type === "YELLOW") return "Yellow card";
  if (type === "RED") return "Red card";
  return "Goal";
}

export function LiveMatchCard({ initial }: { initial: FeaturedMatch[] }) {
  const [matches, setMatches] = React.useState<FeaturedMatch[]>(initial);

  React.useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { matches: FeaturedMatch[] };
        if (active) setMatches(data.matches ?? []);
      } catch {
        /* keep last known state on a transient failure */
      }
    }
    const id = setInterval(poll, POLL_MS);
    poll(); // refresh once on mount in case the server snapshot is stale
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (matches.length === 0) return null;

  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <FeaturedRow key={m.id} m={m} />
      ))}
    </div>
  );
}

function FeaturedRow({ m }: { m: FeaturedMatch }) {
  const live = m.state === "LIVE";
  const stage = m.stage === "GROUP" && m.groupCode ? `Group ${m.groupCode}` : STAGE_SHORT[m.stage as keyof typeof STAGE_SHORT] ?? m.stage;
  const recent = [...m.events].reverse(); // newest first for display

  return (
    <Card className={cn("overflow-hidden", live && "border-destructive/30")}>
      <div className={cn("flex items-center justify-between border-b px-4 py-2", live ? "bg-destructive/5" : "bg-secondary/40")}>
        {live ? (
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-destructive">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
            Live{m.minute != null && <span className="tabular-nums"> · {m.minute}&apos;</span>}
          </span>
        ) : (
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Latest result{m.note && <span className="font-normal normal-case"> · {m.note}</span>}
          </span>
        )}
        <Badge variant="muted">{stage}</Badge>
      </div>

      <Link href={`/fixtures/${m.id}`} className="block px-4 py-4 transition-colors hover:bg-muted/40">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamLabel name={m.home?.name} iso={m.home?.isoCode} placeholder="TBD" className="justify-start" bold />
          <span className="whitespace-nowrap font-mono text-2xl font-bold tabular-nums">
            {m.homeScore} <span className="text-muted-foreground">-</span> {m.awayScore}
          </span>
          <TeamLabel name={m.away?.name} iso={m.away?.isoCode} placeholder="TBD" reverse className="justify-end" bold />
        </div>
      </Link>

      {recent.length > 0 && (
        <ul className="max-h-64 divide-y overflow-y-auto border-t text-sm">
          {recent.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-4 py-1.5">
              <span className="w-9 shrink-0 text-xs tabular-nums text-muted-foreground">{e.minute != null ? `${e.minute}'` : ""}</span>
              <span aria-hidden className="shrink-0">{EVENT_ICON[e.type] ?? "•"}</span>
              <span className="min-w-0 flex-1 truncate">
                {e.player ?? eventLabel(e.type)}
                {e.team && <span className="text-muted-foreground"> · {e.team}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{eventLabel(e.type)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
