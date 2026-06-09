import { Trophy } from "lucide-react";
import { Flag } from "@/components/domain/flag";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import type { BracketMatch } from "@/lib/queries";

function Side({ name, iso, placeholder, isWinner, score, decided }: {
  name?: string | null; iso?: string | null; placeholder?: string | null; isWinner: boolean; score: number | null; decided: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2 px-3 py-2", decided && !isWinner && "opacity-55")}>
      <span className="flex min-w-0 items-center gap-2">
        {name ? <Flag iso={iso} size="sm" /> : <span className="h-3 w-4 rounded-[2px] bg-muted" />}
        <span className={cn("truncate text-sm", isWinner ? "font-bold" : "font-medium")}>{name ?? placeholder ?? "TBD"}</span>
      </span>
      {score != null && <span className="font-mono text-sm font-semibold tabular-nums">{score}</span>}
    </div>
  );
}

export function TieCard({ m }: { m: BracketMatch }) {
  const adv = m.result?.advancingTeamId ?? null;
  const decided = !!m.result;
  return (
    <Card className="overflow-hidden">
      <Side name={m.home?.name} iso={m.home?.isoCode} placeholder={m.homePlaceholder} isWinner={!!adv && adv === m.home?.id} score={m.result?.ftHome ?? null} decided={decided} />
      <div className="flex items-center"><div className="h-px flex-1 bg-border" /><span className="px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{decided ? (m.result?.decisiveScore !== "FT" ? m.result?.decisiveScore : "FT") : "vs"}</span><div className="h-px flex-1 bg-border" /></div>
      <Side name={m.away?.name} iso={m.away?.isoCode} placeholder={m.awayPlaceholder} isWinner={!!adv && adv === m.away?.id} score={m.result?.ftAway ?? null} decided={decided} />
    </Card>
  );
}

export function KnockoutRound({ stage, ties, thirdPlace }: { stage: string; ties: BracketMatch[]; thirdPlace?: BracketMatch | null }) {
  const final = stage === "FINAL" ? ties[0] : null;
  const champion = final?.result?.advancingTeamId === final?.home?.id ? final?.home : final?.result?.advancingTeamId === final?.away?.id ? final?.away : null;

  if (ties.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">This round’s matchups appear once the previous round is decided.</Card>;
  }

  return (
    <div className="space-y-4">
      {champion && (
        <div className="flex items-center gap-3 rounded-lg border border-gold/40 bg-gold/10 p-4">
          <Trophy className="h-6 w-6 text-gold" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Champion</p>
            <p className="flex items-center gap-2 text-lg font-bold"><Flag iso={champion.isoCode} /> {champion.name}</p>
          </div>
        </div>
      )}
      <div className={cn("grid gap-3", stage === "FINAL" ? "mx-auto max-w-md" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {ties.map((m) => <TieCard key={m.id} m={m} />)}
      </div>
      {stage === "FINAL" && thirdPlace && (
        <div className="mx-auto max-w-md space-y-2">
          <Badge variant="muted" className="w-full justify-center">Third-place match</Badge>
          <TieCard m={thirdPlace} />
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">{STAGE_LABELS[stage as keyof typeof STAGE_LABELS]} · {ties.length} {ties.length === 1 ? "match" : "matches"}</p>
    </div>
  );
}
