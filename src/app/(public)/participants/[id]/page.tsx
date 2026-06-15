import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, Target, TrendingUp, Lock, Sparkles, MessageSquare, GitCompareArrows, Award, Flame, Percent } from "lucide-react";
import { getPublicProfile } from "@/lib/queries";
import { getCurrentParticipantId } from "@/lib/auth";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/domain/stat";
import { Movement } from "@/components/domain/movement";
import { ParticipantAvatar, FavoriteFlag } from "@/components/domain/participant-avatar";
import { TeamChip } from "@/components/domain/team-chip";
import { TeamLabel } from "@/components/domain/team-label";
import { EmptyState } from "@/components/domain/empty-state";
import { ordinal } from "@/lib/format";
import { STAGE_SHORT } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { AchievementBadges } from "@/components/domain/achievement-badges";

export const dynamic = "force-dynamic";

const triLabel = (v: boolean | null) => (v === true ? "Yes" : v === false ? "No" : null);
const ftsLabel = (v: string | null) => (v === "HOME" ? "Home first" : v === "AWAY" ? "Away first" : v === "NONE" ? "No goals" : null);

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, viewerId] = await Promise.all([getPublicProfile(id), getCurrentParticipantId()]);
  if (!profile) notFound();
  const { participant, row, favorite, avgTotal, leaderboardSize, matchStats, revealedMatches, tournament, stats, achievements } = profile;
  const diff = row ? Math.round(row.total - avgTotal) : 0;
  const canCompare = !!viewerId && viewerId !== id;

  return (
    <div className="space-y-6">
      <Link href="/participants" className="text-sm text-muted-foreground hover:text-foreground">← All players</Link>

      <PageHeader
        eyebrow={row ? `${ordinal(row.rank)} place` : "Player"}
        title={participant.nickname || participant.name}
        description={favorite ? `Supports ${favorite.name}` : undefined}
        actions={
          <div className="flex items-center gap-3">
            {canCompare && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/compare?with=${id}`}><GitCompareArrows className="h-4 w-4" /> Compare</Link>
              </Button>
            )}
            <ParticipantAvatar initials={participant.initials} color={participant.accentColor} avatarId={participant.avatarId} size="lg" />
          </div>
        }
      />

      <AchievementBadges achievements={achievements} className="-mt-2" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total points" value={row?.total ?? 0} icon={Trophy} accent="gold" />
        <Stat
          label="Rank"
          value={<span className="flex items-center gap-2">{row ? ordinal(row.rank) : "—"} {row && <Movement value={row.movement} />}</span>}
          hint={`of ${leaderboardSize}`}
          icon={TrendingUp}
        />
        <Stat label="Exact scores" value={row?.stats.exactScores ?? 0} icon={Target} accent="primary" />
        <Stat label="vs. average" value={`${diff >= 0 ? "+" : ""}${diff}`} hint={`league avg ${Math.round(avgTotal)}`} accent={diff >= 0 ? "teal" : "default"} />
      </div>

      {/* Player statistics (Phase 2.4) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Percent className="h-4 w-4" /> Statistics</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <MiniStat label="Accuracy" value={stats.scoredMatches ? `${stats.accuracyPct}%` : "—"} hint={`${stats.correctOutcomes}/${stats.scoredMatches} results`} />
          <MiniStat label="Current streak" value={stats.currentStreak} hint="correct in a row" />
          <MiniStat label="Best streak" value={stats.longestStreak} hint="all-time" />
          <MiniStat label="Best matchday" value={stats.bestMatchday ? `+${stats.bestMatchday.points}` : "—"} hint={stats.bestMatchday?.label ?? "—"} />
          <MiniStat label="Worst matchday" value={stats.worstMatchday ? `+${stats.worstMatchday.points}` : "—"} hint={stats.worstMatchday?.label ?? "—"} />
          <MiniStat label="Wildcards used" value={stats.wildcardsUsed} hint="of the tournament" />
        </CardContent>
      </Card>

      {/* Achievements (Phase 2.5) — cosmetic, no scoring */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Award className="h-4 w-4" /> Achievements</CardTitle>
          <p className="text-xs text-muted-foreground">{achievements.filter((a) => a.earned).length} of {achievements.length} unlocked · just for bragging rights.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3 lg:grid-cols-5">
          {achievements.map((a) => (
            <div
              key={a.key}
              title={a.description}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-center",
                a.earned ? "border-gold/40 bg-gold/5" : "opacity-55",
              )}
            >
              {a.key === "HOT_STREAK" ? <Flame className={cn("mx-auto h-5 w-5", a.earned ? "text-gold" : "text-muted-foreground")} /> : <Award className={cn("mx-auto h-5 w-5", a.earned ? "text-gold" : "text-muted-foreground")} />}
              <span className="text-xs font-semibold">{a.label}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">{a.description}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tournament forecast — hidden until first kickoff */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4" /> Tournament forecast</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {!tournament.locked ? (
            <div className="flex items-center gap-2 rounded-md border border-gold/30 bg-gold/5 px-3 py-2.5 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0 text-gold" />
              {tournament.submitted ? "Picks are in — hidden until the first kickoff to keep it fair." : "No tournament picks submitted yet."}
            </div>
          ) : tournament.data ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Champion"><TeamChip team={tournament.data.champion} /></Field>
                <Field label="Runner-up"><TeamChip team={tournament.data.runnerUp} /></Field>
              </div>
              <ChipRow label="Semi-finalists" teams={tournament.data.semifinalists} />
              <ChipRow label="Quarter-finalists" teams={tournament.data.quarterfinalists} />
              <ChipRow label="Reached Round of 16" teams={tournament.data.roundOf16} />
              <ChipRow label="Best thirds" teams={tournament.data.bestThirds} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Golden Boot"><span className="text-sm">{tournament.data.goldenBoot ?? "—"}</span></Field>
                <Field label="Top assists"><span className="text-sm">{tournament.data.topAssist ?? "—"}</span></Field>
              </div>
              {tournament.data.groups.length > 0 && (
                <Field label="Group finishes">
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {tournament.data.groups.map((g) => (
                      <div key={g.name} className="rounded-md border px-2.5 py-1.5 text-xs">
                        <span className="font-medium">{g.name}</span>
                        <span className="text-muted-foreground"> · {g.order.map((t) => t?.shortName ?? "?").join(" › ")}</span>
                      </div>
                    ))}
                  </div>
                </Field>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tournament picks submitted.</p>
          )}
        </CardContent>
      </Card>

      {/* Match predictions — only those whose match has locked */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Match predictions</CardTitle>
          <span className="text-xs text-muted-foreground">{matchStats.revealed} shown · {matchStats.hidden} hidden until kickoff</span>
        </CardHeader>
        <CardContent className="pt-0">
          {revealedMatches.length ? (
            <div className="divide-y">
              {revealedMatches.map((m) => {
                const chips = [
                  ftsLabel(m.firstTeamToScore) && `1st: ${ftsLabel(m.firstTeamToScore)}`,
                  triLabel(m.btts) && `BTTS: ${triLabel(m.btts)}`,
                  triLabel(m.cleanSheet) && `CS: ${triLabel(m.cleanSheet)}`,
                  m.anytime.length ? `Scorers: ${m.anytime.join(", ")}` : null,
                  m.assists.length ? `Assists: ${m.assists.join(", ")}` : null,
                  m.multi ? `2+: ${m.multi}` : null,
                ].filter(Boolean) as string[];
                return (
                  <div key={m.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">{m.stage === "GROUP" && m.groupCode ? m.groupCode : STAGE_SHORT[m.stage as keyof typeof STAGE_SHORT]}</Badge>
                      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <TeamLabel name={m.home?.name} iso={m.home?.isoCode} showShort flagSize="sm" className="justify-start" />
                        <span className="font-mono text-sm font-bold tabular-nums">{m.score ?? "—"}</span>
                        <TeamLabel name={m.away?.name} iso={m.away?.isoCode} showShort flagSize="sm" reverse className="justify-end" />
                      </div>
                      {m.result && <Badge variant="muted" className="shrink-0">actual {m.result}</Badge>}
                      {m.wildcard && <Sparkles className="h-4 w-4 shrink-0 text-gold" />}
                    </div>
                    {(chips.length > 0 || m.boldCall) && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-0 sm:pl-12">
                        {chips.map((c) => <Badge key={c} variant="secondary" className="font-normal">{c}</Badge>)}
                        {m.boldCall && <Badge variant="gold" className="gap-1 font-normal"><MessageSquare className="h-3 w-3" /> {m.boldCall}</Badge>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Nothing to show yet" description="Match predictions become visible here once each match kicks off." icon={Lock} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ChipRow({ label, teams }: { label: string; teams: { id: string; name: string; isoCode: string; shortName: string }[] }) {
  if (!teams.length) return null;
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {teams.map((t) => <TeamChip key={t.id} team={t} />)}
      </div>
    </Field>
  );
}
