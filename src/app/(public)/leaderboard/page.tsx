import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Sparkles, Trophy, MessageSquare } from "lucide-react";
import { getLeaderboard, getTeamMap, getLatestPredictions } from "@/lib/queries";
import { getCurrentParticipantId } from "@/lib/auth";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParticipantAvatar, FavoriteFlag } from "@/components/domain/participant-avatar";
import { Movement } from "@/components/domain/movement";
import { EmptyState } from "@/components/domain/empty-state";
import { timeUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaderboard" };

const FEED_ICON = { MATCH: Activity, WILDCARD: Sparkles, TOURNAMENT: Trophy, BOLD: MessageSquare } as const;

export default async function LeaderboardPage() {
  const [rows, teamMap, meId, feed] = await Promise.all([getLeaderboard(), getTeamMap(), getCurrentParticipantId(), getLatestPredictions(15)]);
  const favIso = (id: string | null) => (id ? teamMap.get(id)?.isoCode ?? null : null);

  return (
    <div className="space-y-6">
      <PageHeader title="Leaderboard" description="Live standings across the league. Tap a player for their full profile." eyebrow="Standings" />

      {rows.length ? (
        <Card className="divide-y">
          {rows.map((row) => {
            const me = row.participant.id === meId;
            return (
              <Link
                key={row.participant.id}
                href={`/participants/${row.participant.id}`}
                className={cn("flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40", me && "bg-primary/5")}
              >
                <span className={cn("w-6 text-center text-sm font-bold tabular-nums", row.rank === 1 ? "text-gold" : "text-muted-foreground")}>{row.rank}</span>
                <Movement value={row.movement} className="hidden w-8 sm:flex" />
                <ParticipantAvatar initials={row.participant.initials} color={row.participant.accentColor} avatarId={row.participant.avatarId} size="sm" />
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate font-medium">{row.participant.nickname || row.participant.name}</span>
                  <FavoriteFlag iso={favIso(row.participant.favoriteTeamId)} />
                  {me && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">You</span>}
                </span>
                <span className="font-mono text-base font-bold tabular-nums">{row.total}</span>
              </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState title="No players yet" description="Invite friends to join your league." />
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Latest predictions</CardTitle></CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          {feed.length ? feed.map((e) => {
            const Icon = FEED_ICON[e.kind];
            return (
              <div key={e.id} className="flex items-center gap-2.5 text-sm">
                <ParticipantAvatar initials={e.participant.initials} color={e.participant.accentColor} avatarId={e.participant.avatarId} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  <Link href={`/participants/${e.participant.id}`} className="font-medium hover:underline">{e.participant.nickname || e.participant.name.split(" ")[0]}</Link>
                  <span className="text-muted-foreground"> {e.text}</span>
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{timeUntil(e.at)}</span>
              </div>
            );
          }) : (
            <EmptyState title="Nothing yet" description="Predictions appear here as they’re made — and match picks become visible once each match kicks off." icon={Activity} />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Match predictions stay private until each match kicks off. Tournament picks are hidden until the first match of the tournament.</p>
    </div>
  );
}
