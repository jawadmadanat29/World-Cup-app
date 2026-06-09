import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ChevronRight, Trophy, CalendarDays, Lock } from "lucide-react";
import { getCurrentParticipantId } from "@/lib/auth";
import { getPredictionHub, getTournamentBuilderData } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import { GettingStarted } from "@/components/domain/getting-started";
import { TeamLabel } from "@/components/domain/team-label";
import { StatusBadge } from "@/components/domain/status-badge";
import { TournamentBuilder } from "@/components/domain/tournament-builder";
import { saveMyTournamentBuilder } from "@/actions/my-predictions";
import { STAGE_SHORT } from "@/lib/enums";
import { timeLabel, TOURNAMENT_TZ_LABEL } from "@/lib/matchday";
import type { HubMatch } from "@/lib/queries";
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
  return (
    <div className="space-y-4">
      {hub.currentMatchday && (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Today’s slate · {hub.currentMatchday.label}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <b className="tabular-nums text-foreground">{hub.currentMatchday.complete}</b> of {hub.currentMatchday.total} predictions complete — don’t leave points on the table before kickoff.
          </p>
        </Card>
      )}
      {hub.matchdays.map((d) => (
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
      ))}
    </div>
  );
}

function MatchRow({ m }: { m: HubMatch }) {
  const inner = (
    <div className={cn("flex items-center gap-3 px-4 py-2.5", m.editable || m.predicted ? "transition-colors hover:bg-muted/40" : "opacity-70")}>
      <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
        {m.stage === "GROUP" && m.groupCode ? m.groupCode : STAGE_SHORT[m.stage as keyof typeof STAGE_SHORT]}
      </Badge>
      <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{timeLabel(m.kickoff)} {TOURNAMENT_TZ_LABEL}</span>
      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamLabel name={m.home.name} iso={m.home.isoCode} showShort flagSize="sm" className="justify-start" />
        <span className="text-xs text-muted-foreground">v</span>
        <TeamLabel name={m.away.name} iso={m.away.isoCode} showShort flagSize="sm" reverse className="justify-end" />
      </div>
      {m.lockState === "UPCOMING" ? (
        <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Upcoming</Badge>
      ) : m.predicted ? (
        <Badge variant={m.complete ? "default" : "warning"} className="gap-1">
          <Check className="h-3 w-3" /> {m.score}{!m.complete && " · partial"}
        </Badge>
      ) : (
        <StatusBadge state={m.lockState} />
      )}
      {m.lockState !== "UPCOMING" && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
  if (m.lockState === "UPCOMING") {
    return <div title="Opens when the previous matchday ends">{inner}</div>;
  }
  return <Link href={`/predictions/match/${m.id}`}>{inner}</Link>;
}

async function TournamentMode({ pid }: { pid: string }) {
  const data = await getTournamentBuilderData(pid);
  if (!data) redirect("/login");
  return (
    <div className="space-y-4">
      <Card className="border-gold/30 bg-gold/5 p-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-gold" /> One forecast for the whole tournament — it locks permanently at the first kickoff.
        </span>
      </Card>
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
