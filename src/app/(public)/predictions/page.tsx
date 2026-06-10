import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, CalendarDays, Lock } from "lucide-react";
import { getCurrentParticipantId } from "@/lib/auth";
import { getPredictionHub, getTournamentBuilderData } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import { GettingStarted } from "@/components/domain/getting-started";
import { MatchPredictions } from "@/components/domain/match-predictions";
import { Countdown } from "@/components/domain/countdown";
import { TournamentBuilder } from "@/components/domain/tournament-builder";
import { saveMyTournamentBuilder } from "@/actions/my-predictions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MODES = [
  { key: "match", label: "Match-by-match", icon: CalendarDays },
  { key: "tournament", label: "Tournament", icon: Trophy },
] as const;

export default async function PredictionsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const pid = await getCurrentParticipantId();
  if (!pid) redirect("/login");
  const { mode = "match" } = await searchParams;
  const hub = await getPredictionHub(pid);
  if (!hub) redirect("/login");

  const groupsDone = hub.groups.filter((g) => g.ranked).length;
  const denom = hub.matchTotals.total + 12 + 1;
  const numer = hub.matchTotals.complete + groupsDone + (hub.tournamentDone ? 1 : 0);
  const pct = denom ? Math.round((numer / denom) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Your predictions"
        title={`Hi, ${hub.participant.name.split(" ")[0]} 👋`}
        description="Two ways to score: predict each match as the tournament unfolds, and lock in one big tournament forecast before kickoff."
        actions={<ParticipantAvatar initials={hub.participant.initials} color={hub.participant.accentColor} avatarId={hub.participant.avatarId} size="lg" />}
      />

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Overall completion</span>
          <span className="tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} indicatorClassName={pct >= 100 ? "bg-primary" : "bg-gold"} />
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">{hub.matchTotals.complete}/{hub.matchTotals.total} matches complete</Badge>
          <Badge variant="secondary">{groupsDone}/12 groups</Badge>
          <Badge variant={hub.tournamentDone ? "default" : "muted"}>{hub.tournamentDone ? "Tournament set" : "Tournament —"}</Badge>
          <Badge variant="secondary">Wildcards {hub.wildcardsUsed}/{hub.wildcardsMax}</Badge>
        </div>
      </Card>

      <GettingStarted tournamentDone={hub.tournamentDone} groupsDone={groupsDone} predicted={hub.matchTotals.predicted} />

      {/* Mode switch */}
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((m) => {
          const active = mode === m.key;
          return (
            <Link
              key={m.key}
              href={`/predictions?mode=${m.key}`}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <m.icon className="h-4 w-4" /> {m.label}
            </Link>
          );
        })}
      </div>

      {mode === "match" ? <MatchMode hub={hub} /> : <TournamentMode pid={pid} />}
    </div>
  );
}

function MatchMode({ hub }: { hub: NonNullable<Awaited<ReturnType<typeof getPredictionHub>>> }) {
  if (hub.matchdays.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Fixtures will appear here once the schedule is loaded.</Card>;
  }
  return <MatchPredictions matchdays={hub.matchdays} totals={hub.matchTotals} />;
}

async function TournamentMode({ pid }: { pid: string }) {
  const data = await getTournamentBuilderData(pid);
  if (!data) redirect("/login");
  const opensInFuture = data.firstKickoff && +data.firstKickoff > Date.now();
  return (
    <div className="space-y-4">
      <Card className="border-gold/30 bg-gold/5 p-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-gold" /> One forecast for the whole tournament — it locks permanently at the first kickoff.
        </span>
      </Card>
      {data.firstKickoff && (
        <Card className="flex flex-col items-center gap-2 p-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm">
            <span className="font-medium">Tournament picks lock when the opening match starts.</span>
            <span className="block text-xs text-muted-foreground sm:mt-0.5">
              {opensInFuture ? "Lock in your bracket before kickoff." : "Predictions are now closed."}
            </span>
          </p>
          {opensInFuture && <Countdown target={data.firstKickoff.toISOString()} />}
        </Card>
      )}
      <TournamentBuilder
        groups={data.groups}
        teams={data.teams}
        knockout={data.knockout}
        players={data.players}
        existing={data.existing}
        locked={data.locked}
        action={saveMyTournamentBuilder}
      />
    </div>
  );
}
