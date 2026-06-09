import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamLabel } from "@/components/domain/team-label";
import { ScorePill } from "@/components/domain/score-pill";
import { StatusBadge } from "@/components/domain/status-badge";
import { STAGE_SHORT, STAGE_LABELS } from "@/lib/enums";
import { formatKickoff, decisiveLabel } from "@/lib/format";
import { format } from "date-fns";
import type { FixtureRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function FixtureCard({ f, className }: { f: FixtureRow; className?: string }) {
  const completed = !!f.result;
  const stageLabel = f.stage === "GROUP" && f.groupCode ? `Group ${f.groupCode}` : STAGE_SHORT[f.stage as keyof typeof STAGE_SHORT] ?? f.stage;

  return (
    <Link href={`/fixtures/${f.id}`} className={cn("group block", className)} aria-label={`Match ${f.matchNumber} details`}>
      <Card className="h-full p-4 transition-colors group-hover:border-primary/50">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Badge variant="secondary" className="font-medium">
            {stageLabel}
          </Badge>
          <StatusBadge state={f.lockState} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
          <TeamLabel name={f.home?.name} iso={f.home?.isoCode} placeholder={f.homePlaceholder} className="justify-start" bold />
          <div className="flex flex-col items-center">
            {completed ? (
              <ScorePill home={f.result!.ftHome} away={f.result!.ftAway} />
            ) : (
              <span className="rounded-md bg-secondary/60 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                {format(f.kickoff, "HH:mm")}
              </span>
            )}
            {completed && f.result!.decisiveScore !== "FT" && (
              <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {f.result!.decisiveScore === "PENS" && f.result!.pensHome != null
                  ? `pens ${f.result!.pensHome}-${f.result!.pensAway}`
                  : decisiveLabel(f.result!.decisiveScore)}
              </span>
            )}
          </div>
          <TeamLabel name={f.away?.name} iso={f.away?.isoCode} placeholder={f.awayPlaceholder} reverse className="justify-end" bold />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            #{f.matchNumber} · {formatKickoff(f.kickoff)}
          </span>
          {f.venue && <span className="truncate">{f.venue.city}</span>}
        </div>
      </Card>
    </Link>
  );
}
