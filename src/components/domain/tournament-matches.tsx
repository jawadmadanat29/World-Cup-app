"use client";
import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FixtureCard } from "@/components/domain/fixture-card";
import { TeamLabel } from "@/components/domain/team-label";
import { ScorePill } from "@/components/domain/score-pill";
import { EmptyState } from "@/components/domain/empty-state";
import { cn } from "@/lib/utils";
import type { FixtureRow } from "@/lib/queries";

export interface MatchdayGroup {
  key: string;
  label: string;
  status: "done" | "current" | "upcoming";
  matches: FixtureRow[];
}

export function TournamentMatches({ matchdays, currentKey, recent }: { matchdays: MatchdayGroup[]; currentKey: string | null; recent: FixtureRow[] }) {
  const [sel, setSel] = React.useState<string>(currentKey ?? matchdays[0]?.key ?? "all");
  const selectedDay = matchdays.find((d) => d.key === sel);

  return (
    <div className="space-y-4">
      {recent.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent results</p>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {recent.map((f) => (
              <div key={f.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                <TeamLabel name={f.home?.name} iso={f.home?.isoCode} showShort flagSize="sm" className="justify-start" />
                <ScorePill home={f.result!.ftHome} away={f.result!.ftAway} muted />
                <TeamLabel name={f.away?.name} iso={f.away?.isoCode} showShort flagSize="sm" reverse className="justify-end" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Matchday rail */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {matchdays.map((d) => (
          <button
            key={d.key}
            onClick={() => setSel(d.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              sel === d.key ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {d.status === "current" && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            {d.label}
          </button>
        ))}
        <button
          onClick={() => setSel("all")}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            sel === "all" ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          All matches
        </button>
      </div>

      {sel === "all" ? (
        <div className="space-y-5">
          {matchdays.map((d) => (
            <div key={d.key} className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-muted-foreground" /> {d.label}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {d.matches.map((f) => <FixtureCard key={f.id} f={f} />)}
              </div>
            </div>
          ))}
        </div>
      ) : selectedDay ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {selectedDay.matches.map((f) => <FixtureCard key={f.id} f={f} />)}
        </div>
      ) : (
        <EmptyState title="No matches" description="Fixtures will appear here once the schedule is set." icon={CalendarDays} />
      )}
    </div>
  );
}
