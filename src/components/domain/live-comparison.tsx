import Link from "next/link";
import { Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamLabel } from "@/components/domain/team-label";
import { ScorePill } from "@/components/domain/score-pill";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import type { getMatchDetail } from "@/lib/queries";

type Detail = NonNullable<Awaited<ReturnType<typeof getMatchDetail>>>;

export function LiveComparison({ m }: { m: Detail }) {
  const c = m.consensus;
  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          Live now — how everyone called it
        </CardTitle>
        <Link href={`/fixtures/${m.id}`} className="text-xs font-medium text-primary hover:underline">Match page</Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamLabel name={m.home?.name} iso={m.home?.isoCode} bold className="justify-start" />
          <Radio className="h-4 w-4 text-muted-foreground" />
          <TeamLabel name={m.away?.name} iso={m.away?.isoCode} reverse bold className="justify-end" />
        </div>

        {c ? (
          <>
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-medium text-muted-foreground">
                <span>{m.home?.shortName} {c.home}%</span>
                <span>Draw {c.draw}%</span>
                <span>{m.away?.shortName} {c.away}%</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full">
                <div className="bg-primary" style={{ width: `${c.home}%` }} />
                <div className="bg-muted-foreground/40" style={{ width: `${c.draw}%` }} />
                <div className="bg-gold" style={{ width: `${c.away}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Most common score</p><p className="font-semibold">{c.topScore ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Popular scorer</p><p className="truncate font-semibold">{c.popularScorer ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Wildcards</p><p className="font-semibold">{c.wildcards.length || "—"}</p></div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Everyone’s pick</p>
              <div className="flex flex-wrap gap-2">
                {m.predictions.map((p) => (
                  <span key={p.participant.id} className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-sm">
                    <ParticipantAvatar initials={p.participant.initials} color={p.participant.accentColor} size="sm" />
                    <ScorePill home={p.homeGoals} away={p.awayGoals} muted className="px-1.5 py-0 text-xs" />
                    {p.wildcard && <Badge variant="gold" className="px-1.5 py-0">×2</Badge>}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No predictions were entered for this match.</p>
        )}
      </CardContent>
    </Card>
  );
}
