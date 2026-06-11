import Link from "next/link";
import { ArrowUpRight, CalendarDays, Trophy, BarChart3, Activity, ListChecks, ChevronRight, Goal, Users, Clock } from "lucide-react";
import { getHomeData, getPredictionHub } from "@/lib/queries";
import { Countdown } from "@/components/domain/countdown";
import { getCurrentParticipantId } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TeamLabel } from "@/components/domain/team-label";
import { ParticipantBadge, ParticipantAvatar, FavoriteFlag } from "@/components/domain/participant-avatar";
import { Movement } from "@/components/domain/movement";
import { EmptyState } from "@/components/domain/empty-state";
import { timeUntil } from "@/lib/format";
import { timeLabel, TOURNAMENT_TZ_LABEL } from "@/lib/matchday";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const participantId = await getCurrentParticipantId();
  const loggedIn = !!participantId;
  const [d, hub] = await Promise.all([getHomeData(), loggedIn ? getPredictionHub(participantId) : Promise.resolve(null)]);
  const startHref = loggedIn ? "/predictions" : "/signup";
  const { progress: pg, teamMap } = d;

  // Logged-in personal progress (Phase 1.2).
  const groupsDone = hub ? hub.groups.filter((g) => g.ranked).length : 0;
  const hubDenom = hub ? hub.matchTotals.total + 12 + 1 : 0;
  const hubNumer = hub ? hub.matchTotals.complete + groupsDone + (hub.tournamentDone ? 1 : 0) : 0;
  const hubPct = hubDenom ? Math.round((hubNumer / hubDenom) * 100) : 0;
  const continueHref = hub && !hub.tournamentDone ? "/predictions?mode=tournament" : "/predictions";
  const wildcardsLeft = hub ? hub.wildcardsMax - hub.wildcardsUsed : 0;
  const favIso = (favoriteTeamId: string | null) => (favoriteTeamId ? teamMap.get(favoriteTeamId)?.isoCode ?? null : null);
  const tournamentStarted = d.stats.completedMatches > 0;
  const tProgress = d.stats.totalMatches ? Math.round((d.stats.completedMatches / d.stats.totalMatches) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="rounded-xl border bg-card p-6 sm:p-8">
        <Badge variant="gold">{d.tournamentName}</Badge>
        <h1 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
          Predict the World Cup with your friends.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          Call every match result and build your tournament bracket before kickoff, then climb a shared leaderboard.
          It’s a private prediction game — just your crew.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={startHref}>Start Predicting <ArrowUpRight className="h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline"><Link href="/how-it-works">How It Works</Link></Button>
          <Button asChild variant="outline"><Link href="/leaderboard">View Leaderboard</Link></Button>
        </div>
      </section>

      {/* Logged-in personal progress (Phase 1.2) */}
      {hub && (
        <Card className="border-primary/30">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" /> Your predictions, {hub.participant.name.split(" ")[0]}
            </CardTitle>
            <span className="text-sm font-medium tabular-nums text-muted-foreground">{hubPct}% complete</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={hubPct} indicatorClassName={hubPct >= 100 ? "bg-primary" : "bg-gold"} />
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={hub.tournamentDone ? "default" : "muted"}>{hub.tournamentDone ? "Tournament set ✓" : "Tournament not set"}</Badge>
              <Badge variant="secondary">Group rankings {groupsDone}/12</Badge>
              <Badge variant="secondary">{hub.matchTotals.complete}/{hub.matchTotals.total} matches predicted</Badge>
              <Badge variant="secondary">Wildcards {wildcardsLeft} left</Badge>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link href={continueHref}>Continue Predictions <ArrowUpRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Next prediction lock — live countdown */}
      {d.ribbon[0] && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-card px-4 py-2.5 text-sm">
          <Clock className="h-4 w-4 shrink-0 text-gold" />
          <span className="text-muted-foreground">Next lock:</span>
          <span className="font-medium">{d.ribbon[0].home?.name} v {d.ribbon[0].away?.name}</span>
          <span className="text-muted-foreground">in</span>
          <span className="font-mono font-semibold text-foreground"><Countdown target={d.ribbon[0].kickoff.toISOString()} compact /></span>
        </div>
      )}

      {/* Minimal upcoming-matches ribbon */}
      {d.ribbon.length > 0 && (
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto rounded-lg border bg-secondary/30 px-3 py-2">
          <span className="shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Up next</span>
          {d.ribbon.map((f) => (
            <Link
              key={f.id}
              href={`/fixtures/${f.id}`}
              className="flex shrink-0 items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-sm transition-colors hover:border-primary/50"
            >
              <TeamLabel name={f.home?.name} iso={f.home?.isoCode} showShort flagSize="sm" />
              <span className="text-xs text-muted-foreground">v</span>
              <TeamLabel name={f.away?.name} iso={f.away?.isoCode} showShort flagSize="sm" reverse />
              <span className="ml-1 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                {timeLabel(f.kickoff)} {TOURNAMENT_TZ_LABEL}
              </span>
            </Link>
          ))}
          <Link href="/tournament" className="ml-auto shrink-0 whitespace-nowrap pl-2 text-xs font-medium text-primary hover:underline">
            Full schedule
          </Link>
        </div>
      )}

      {/* Focused dashboard cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Upcoming Matchday */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Upcoming matchday</CardTitle>
            <Link href="/tournament" className="text-xs font-medium text-primary hover:underline">Full schedule</Link>
          </CardHeader>
          <CardContent className="pt-0">
            {d.currentMatchday ? (
              <>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.currentMatchday.label}</p>
                <ul className="divide-y">
                  {d.currentMatchday.matches.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                        <TeamLabel name={m.home?.name} iso={m.home?.isoCode} showShort flagSize="sm" className="justify-start" />
                        <span className="text-xs text-muted-foreground">v</span>
                        <TeamLabel name={m.away?.name} iso={m.away?.isoCode} showShort flagSize="sm" reverse className="justify-end" />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{timeLabel(m.kickoff)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState title="The first matchday opens soon" description="Upcoming fixtures will appear here." icon={CalendarDays} />
            )}
          </CardContent>
        </Card>

        {/* Recent Result */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Goal className="h-4 w-4" /> Recent result</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {d.recentResult?.result ? (
              <Link href={`/fixtures/${d.recentResult.id}`} className="block">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <TeamLabel name={d.recentResult.home?.name} iso={d.recentResult.home?.isoCode} showShort flagSize="lg" bold className="justify-start" />
                  <span className="rounded-md bg-secondary px-3 py-1 text-lg font-bold tabular-nums">
                    {d.recentResult.result.ftHome}–{d.recentResult.result.ftAway}
                  </span>
                  <TeamLabel name={d.recentResult.away?.name} iso={d.recentResult.away?.isoCode} showShort flagSize="lg" bold reverse className="justify-end" />
                </div>
              </Link>
            ) : (
              <EmptyState title="No results yet" description="Results will appear once matches begin." icon={Goal} />
            )}
          </CardContent>
        </Card>

        {/* Tournament Progress */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4" /> Tournament progress</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-0">
            <p className="text-2xl font-bold tabular-nums">
              {d.stats.completedMatches} <span className="text-base font-normal text-muted-foreground">/ {d.stats.totalMatches} matches played</span>
            </p>
            <Progress value={tProgress} indicatorClassName={tProgress >= 100 ? "bg-primary" : "bg-gold"} />
            <p className="text-xs text-muted-foreground">{tournamentStarted ? `${tProgress}% of the way through.` : "Kicks off soon — predictions are open."}</p>
          </CardContent>
        </Card>

        {/* Prediction Progress */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4" /> Prediction progress</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            <p className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> <b>{pg.playersJoined}</b> players joined</p>
            {pg.currentDayMatchCount > 0 ? (
              <p><b className="tabular-nums">{pg.completedToday}</b> of {pg.playersJoined} completed today’s predictions</p>
            ) : (
              <p className="text-muted-foreground">The first matchday opens soon.</p>
            )}
            <p><b className="tabular-nums">{pg.tournamentPicksSubmitted}</b> of {pg.playersJoined} submitted tournament picks</p>
            <Button asChild variant="ghost" size="sm" className="w-full justify-between">
              <Link href={startHref}>{loggedIn ? "Make your predictions" : "Join & predict"} <ChevronRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        {/* Leaderboard Preview */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" /> Leaderboard</CardTitle>
            <Link href="/leaderboard" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {d.leaderboard.length > 0 ? (
              d.leaderboard.map((row) => (
                <div key={row.participant.id} className="flex items-center gap-3 rounded-md px-1 py-1.5">
                  <span className="w-5 text-center text-sm font-bold tabular-nums text-muted-foreground">{row.rank}</span>
                  <div className="min-w-0 flex-1">
                    <ParticipantBadge
                      id={row.participant.id}
                      name={row.participant.name}
                      initials={row.participant.initials}
                      color={row.participant.accentColor}
                      avatarId={row.participant.avatarId}
                      favoriteIso={favIso(row.participant.favoriteTeamId)}
                      size="sm"
                    />
                  </div>
                  <Movement value={row.movement} />
                  <span className="w-10 text-right font-mono text-sm font-semibold tabular-nums">{row.total}</span>
                </div>
              ))
            ) : (
              <EmptyState title="No players yet" description="Invite friends to join your league." icon={Users} />
            )}
          </CardContent>
        </Card>

        {/* Friend Activity */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Friend activity</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {d.activity.length > 0 ? (
              d.activity.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 text-sm">
                  <ParticipantAvatar initials={a.participant.initials} color={a.participant.accentColor} avatarId={a.participant.avatarId} size="sm" />
                  <span className="min-w-0 flex-1 truncate">
                    <Link href={`/participants/${a.participant.id}`} className="font-medium hover:underline">{a.participant.name.split(" ")[0]}</Link>
                    <FavoriteFlag iso={favIso(a.participant.favoriteTeamId)} className="mx-1" />
                    <span className="text-muted-foreground"> {a.text}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{timeUntil(a.at)}</span>
                </div>
              ))
            ) : (
              <EmptyState title="No activity yet" description="Your friends’ predictions and wildcards show up here." icon={Activity} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
