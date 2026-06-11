"use client";
import * as React from "react";
import Link from "next/link";
import { Check, ChevronRight, Search, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TeamLabel } from "@/components/domain/team-label";
import { StatusBadge } from "@/components/domain/status-badge";
import { Countdown } from "@/components/domain/countdown";
import { STAGE_SHORT } from "@/lib/enums";
import { dayKey, timeLabel, TOURNAMENT_TZ_LABEL } from "@/lib/matchday";
import type { HubMatch } from "@/lib/queries";
import { cn } from "@/lib/utils";

type MatchdayGroup = { key: string; label: string; status: "done" | "current" | "upcoming"; matches: HubMatch[] };
type Totals = { total: number; predicted: number; complete: number };

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This week" },
  { key: "locked", label: "Locked" },
  { key: "completed", label: "Completed" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const DAY_MS = 86_400_000;

export function MatchPredictions({ matchdays, totals }: { matchdays: MatchdayGroup[]; totals: Totals }) {
  const [filter, setFilter] = React.useState<FilterKey>("open");
  const [query, setQuery] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const allMatches = React.useMemo(() => matchdays.flatMap((d) => d.matches), [matchdays]);

  // Next lock = earliest still-open match.
  const nextLock = React.useMemo(() => {
    const open = allMatches.filter((m) => m.editable).sort((a, b) => +new Date(a.lockAt) - +new Date(b.lockAt));
    return open[0] ?? null;
  }, [allMatches]);

  // Still-open matches that lock within the next 24 hours (urgency).
  const lockSoonCount = React.useMemo(() => {
    if (!mounted) return 0;
    return allMatches.filter((m) => m.editable && +new Date(m.lockAt) - Date.now() <= DAY_MS).length;
  }, [allMatches, mounted]);

  const remaining = totals.total - totals.complete;

  const q = query.trim().toLowerCase();
  const matchPasses = React.useCallback(
    (m: HubMatch): boolean => {
      if (q && !`${m.home.name} ${m.away.name}`.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "open":
          return m.editable;
        case "today":
          return dayKey(new Date(m.kickoff)) === dayKey(new Date());
        case "tomorrow":
          return dayKey(new Date(m.kickoff)) === dayKey(new Date(Date.now() + DAY_MS));
        case "week": {
          const k = dayKey(new Date(m.kickoff));
          return k >= dayKey(new Date()) && +new Date(m.kickoff) <= Date.now() + 7 * DAY_MS;
        }
        case "locked":
          return m.lockState === "LOCKED";
        case "completed":
          return m.lockState === "COMPLETED";
      }
    },
    [filter, q],
  );

  const visibleDays = matchdays
    .map((d) => ({ ...d, matches: d.matches.filter(matchPasses) }))
    .filter((d) => d.matches.length > 0);
  const visibleCount = visibleDays.reduce((n, d) => n + d.matches.length, 0);

  return (
    <div className="space-y-4">
      {/* Sticky summary bar */}
      <div className="sticky top-16 z-30 rounded-lg border bg-card/95 px-4 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <span>
            <b className="tabular-nums">{totals.complete}</b> / {totals.total} matches predicted
            {remaining > 0 && <span className="text-muted-foreground"> · {remaining} remaining</span>}
          </span>
          {nextLock ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Next lock: <span className="font-medium text-foreground">{nextLock.home.name} v {nextLock.away.name}</span> in{" "}
              <span className="text-foreground"><Countdown target={nextLock.lockAt} compact /></span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">All matches locked</span>
          )}
        </div>
        {lockSoonCount > 0 && (
          <p className="mt-1 text-xs font-medium text-gold">
            {lockSoonCount} {lockSoonCount === 1 ? "match locks" : "matches lock"} within the next 24 hours — get your picks in.
          </p>
        )}
      </div>

      {/* Filters + search */}
      <div className="space-y-2">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.key ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by team…"
            className="pl-9"
            aria-label="Search matches by team"
          />
        </div>
      </div>

      {/* Matchday list */}
      {visibleCount === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No matches {q ? "match your search" : "in this view"}. Try a different filter.
        </Card>
      ) : (
        visibleDays.map((d) => (
          <Card key={d.key} className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-secondary/30 px-4 py-2.5">
              <span className="text-sm font-semibold">{d.label}</span>
              {d.status === "current" && <Badge variant="default">Open now</Badge>}
              {d.status === "upcoming" && <Badge variant="secondary">Upcoming</Badge>}
              {d.status === "done" && <Badge variant="muted">Done</Badge>}
            </div>
            <div className="divide-y">
              {d.matches.map((m) => <MatchRow key={m.id} m={m} />)}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function MatchRow({ m }: { m: HubMatch }) {
  return (
    <Link href={`/predictions/match/${m.id}`}>
      <div className={cn("flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4", m.editable || m.predicted ? "transition-colors hover:bg-muted/40" : "opacity-70")}>
        <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
          {m.stage === "GROUP" && m.groupCode ? m.groupCode : STAGE_SHORT[m.stage as keyof typeof STAGE_SHORT]}
        </Badge>
        <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground sm:w-16">
          {timeLabel(m.kickoff)}<span className="hidden sm:inline"> {TOURNAMENT_TZ_LABEL}</span>
        </span>
        <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamLabel name={m.home.name} shortName={m.home.shortName} iso={m.home.isoCode} showShort flagSize="sm" className="justify-start" />
          <span className="text-xs text-muted-foreground">v</span>
          <TeamLabel name={m.away.name} shortName={m.away.shortName} iso={m.away.isoCode} showShort flagSize="sm" reverse className="justify-end" />
        </div>
        {m.predicted ? (
          <Badge variant={m.complete ? "default" : "warning"} className="gap-1 px-1.5 sm:px-2.5">
            <Check className="h-3 w-3" /> {m.score}{!m.complete && " · partial"}
          </Badge>
        ) : (
          <StatusBadge state={m.lockState} className="px-1.5 sm:px-2.5" />
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}
