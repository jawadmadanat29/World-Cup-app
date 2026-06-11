import Link from "next/link";
import { Check, AlertTriangle, Plus } from "lucide-react";
import { TeamLabel } from "@/components/domain/team-label";
import { KickoffTime } from "@/components/domain/kickoff-time";
import type { HubMatch } from "@/lib/queries";

/**
 * Homepage sanity-check: the next still-open matches and whether the viewer has
 * locked in a prediction for each, so a missed pick is obvious at a glance.
 */
export function PredictionChecklist({ matches }: { matches: HubMatch[] }) {
  if (matches.length === 0) return null;
  const missing = matches.filter((m) => !m.complete).length;

  return (
    <div className="rounded-lg border bg-background/60">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next up — locked in?</span>
        <span className="text-xs text-muted-foreground">
          {missing === 0 ? "All set ✓" : `${missing} still need ${missing === 1 ? "a pick" : "picks"}`}
        </span>
      </div>
      <ul className="divide-y">
        {matches.map((m) => {
          const partial = m.predicted && !m.complete;
          return (
            <li key={m.id}>
              <Link
                href={`/predictions/match/${m.id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
              >
                <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                  <TeamLabel name={m.home?.name} shortName={m.home?.shortName} iso={m.home?.isoCode} showShort flagSize="sm" className="justify-start" />
                  <span className="text-xs text-muted-foreground">v</span>
                  <TeamLabel name={m.away?.name} shortName={m.away?.shortName} iso={m.away?.isoCode} showShort flagSize="sm" reverse className="justify-end" />
                </div>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  <KickoffTime iso={m.kickoff} showZone={false} />
                </span>
                {m.complete ? (
                  <span className="inline-flex w-[4.5rem] shrink-0 items-center justify-end gap-1 text-xs font-medium text-success">
                    <Check className="h-3.5 w-3.5" /> Locked in
                  </span>
                ) : partial ? (
                  <span className="inline-flex w-[4.5rem] shrink-0 items-center justify-end gap-1 text-xs font-medium text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" /> Partial
                  </span>
                ) : (
                  <span className="inline-flex w-[4.5rem] shrink-0 items-center justify-end gap-1 text-xs font-medium text-destructive">
                    <Plus className="h-3.5 w-3.5" /> Add pick
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
