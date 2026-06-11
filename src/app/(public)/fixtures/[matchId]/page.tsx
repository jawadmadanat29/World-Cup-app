import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, MapPin, ArrowRight, Goal as GoalIcon, Square } from "lucide-react";
import { getMatchDetail } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Flag } from "@/components/domain/flag";
import { ScorePill } from "@/components/domain/score-pill";
import { StatusBadge } from "@/components/domain/status-badge";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import { EmptyState } from "@/components/domain/empty-state";
import { STAGE_LABELS } from "@/lib/enums";
import { KickoffTime } from "@/components/domain/kickoff-time";
import { decisiveLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const m = await getMatchDetail(matchId);
  if (!m) notFound();

  const completed = !!m.result;
  const stageLabel = m.stage === "GROUP" && m.groupCode ? `Group ${m.groupCode}` : STAGE_LABELS[m.stage as keyof typeof STAGE_LABELS] ?? m.stage;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/fixtures" className="text-sm text-muted-foreground hover:text-foreground">← All fixtures</Link>

      <Card>
        <CardContent className="p-6">
          <div className="mb-5 flex items-center justify-between gap-2">
            <Badge variant="secondary">{stageLabel} · Match {m.matchNumber}</Badge>
            <StatusBadge state={m.lockState} />
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Flag iso={m.home?.isoCode} size="xl" />
              <span className="font-semibold">{m.home?.name ?? m.homePlaceholder ?? "TBD"}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              {completed ? (
                <ScorePill home={m.result!.ftHome} away={m.result!.ftAway} className="text-lg" />
              ) : (
                <span className="font-mono text-sm text-muted-foreground"><KickoffTime iso={m.kickoff} mode="full" /></span>
              )}
              {completed && (
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {m.result!.decisiveScore === "PENS" && m.result!.pensHome != null
                    ? `Pens ${m.result!.pensHome}–${m.result!.pensAway}`
                    : decisiveLabel(m.result!.decisiveScore)}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <Flag iso={m.away?.isoCode} size="xl" />
              <span className="font-semibold">{m.away?.name ?? m.awayPlaceholder ?? "TBD"}</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><KickoffTime iso={m.kickoff} mode="full" /></span>
            {m.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {m.venue.name}, {m.venue.city}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Events */}
      {completed && m.events.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Match events</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-0">
            {m.events.map((e, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{e.minute != null ? `${e.minute}'` : "—"}</span>
                {e.type === "GOAL" || e.type === "PENALTY_GOAL" || e.type === "OWN_GOAL" ? (
                  <GoalIcon className="h-4 w-4 text-primary" />
                ) : (
                  <Square className={e.type === "RED" ? "h-4 w-4 fill-destructive text-destructive" : "h-4 w-4 fill-gold text-gold"} />
                )}
                <span className="flex-1 truncate">
                  {e.playerName ?? "Unknown"}
                  {e.type === "PENALTY_GOAL" && <span className="text-muted-foreground"> (pen)</span>}
                  {e.type === "OWN_GOAL" && <span className="text-muted-foreground"> (OG)</span>}
                </span>
                <span className="text-xs text-muted-foreground">{e.side === "HOME" ? m.home?.shortName : e.side === "AWAY" ? m.away?.shortName : ""}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Predictions / consensus */}
      {m.revealed ? (
        <>
          {m.consensus && (
            <Card>
              <CardHeader><CardTitle className="text-base">League consensus</CardTitle></CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div>
                  <div className="mb-1.5 flex justify-between text-xs font-medium text-muted-foreground">
                    <span>{m.home?.shortName} {m.consensus.home}%</span>
                    <span>Draw {m.consensus.draw}%</span>
                    <span>{m.away?.shortName} {m.consensus.away}%</span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full">
                    <div className="bg-primary" style={{ width: `${m.consensus.home}%` }} />
                    <div className="bg-muted-foreground/50" style={{ width: `${m.consensus.draw}%` }} />
                    <div className="bg-gold" style={{ width: `${m.consensus.away}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Most common score</p><p className="font-semibold">{m.consensus.topScore ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Popular scorer pick</p><p className="font-semibold">{m.consensus.popularScorer ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Wildcards used</p><p className="font-semibold">{m.consensus.wildcards.length || "—"}</p></div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Everyone’s predictions</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {m.predictions.length ? (
                <div className="space-y-1">
                  {m.predictions.map((p) => (
                    <div key={p.participant.id} className="flex items-center gap-3 rounded-md px-2 py-2">
                      <ParticipantAvatar initials={p.participant.initials} color={p.participant.accentColor} size="sm" />
                      <Link href={`/participants/${p.participant.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                        {p.participant.name}
                      </Link>
                      {p.wildcard && <Badge variant="gold">×2</Badge>}
                      {p.advanceTeam && <Badge variant="outline" className="gap-1">{p.advanceTeam} <ArrowRight className="h-3 w-3" /></Badge>}
                      <ScorePill home={p.homeGoals} away={p.awayGoals} muted />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No predictions entered" description="Nobody predicted this match." />
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Lock}
              title="Predictions are hidden"
              description="To keep things fair, everyone’s picks for this match stay hidden until it locks at kickoff. Then they’re revealed for comparison."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href={`/me/match/${m.id}`}>Make your prediction</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
