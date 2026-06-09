import { Trophy } from "lucide-react";
import { Flag } from "@/components/domain/flag";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import type { BracketMatch } from "@/lib/queries";

const COLUMN_ORDER = ["R32", "R16", "QF", "SF", "FINAL"] as const;

function Side({
  name, iso, placeholder, isWinner, score, decided,
}: {
  name?: string | null; iso?: string | null; placeholder?: string | null; isWinner: boolean; score: number | null; decided: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2 px-2.5 py-1.5", decided && !isWinner && "opacity-55")}>
      <span className="flex min-w-0 items-center gap-1.5">
        {name ? <Flag iso={iso} size="sm" /> : null}
        <span className={cn("truncate text-xs", isWinner ? "font-bold" : "font-medium")}>
          {name ?? placeholder ?? "TBD"}
        </span>
      </span>
      {score != null && <span className="font-mono text-xs font-semibold tabular-nums">{score}</span>}
    </div>
  );
}

function Cell({ m }: { m: BracketMatch }) {
  const adv = m.result?.advancingTeamId ?? null;
  const decided = !!m.result;
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <Side
        name={m.home?.name} iso={m.home?.isoCode} placeholder={m.homePlaceholder}
        isWinner={!!adv && adv === m.home?.id} score={m.result?.ftHome ?? null} decided={decided}
      />
      <div className="h-px bg-border" />
      <Side
        name={m.away?.name} iso={m.away?.isoCode} placeholder={m.awayPlaceholder}
        isWinner={!!adv && adv === m.away?.id} score={m.result?.ftAway ?? null} decided={decided}
      />
    </div>
  );
}

export function Bracket({ byStage }: { byStage: Record<string, BracketMatch[]> }) {
  const final = byStage["FINAL"]?.[0];
  const champion =
    final?.result?.advancingTeamId === final?.home?.id ? final?.home : final?.result?.advancingTeamId === final?.away?.id ? final?.away : null;

  return (
    <div className="space-y-6">
      {champion && (
        <div className="flex items-center gap-3 rounded-lg border border-gold/40 bg-gold/10 p-4">
          <Trophy className="h-6 w-6 text-gold" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Champion</p>
            <p className="flex items-center gap-2 text-lg font-bold"><Flag iso={champion.isoCode} /> {champion.name}</p>
          </div>
        </div>
      )}

      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {COLUMN_ORDER.map((stage) => {
          const matches = byStage[stage] ?? [];
          if (!matches.length) return null;
          return (
            <div key={stage} className="w-56 shrink-0 space-y-2">
              <Badge variant="secondary" className="w-full justify-center">{STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}</Badge>
              {matches.map((m) => <Cell key={m.id} m={m} />)}
              {stage === "FINAL" && byStage["THIRD_PLACE"]?.[0] && (
                <>
                  <Badge variant="muted" className="mt-3 w-full justify-center">Third-place match</Badge>
                  <Cell m={byStage["THIRD_PLACE"][0]} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
