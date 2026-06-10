import type { Metadata } from "next";
import Link from "next/link";
import { GitCompareArrows } from "lucide-react";
import { getLeaderboard, getTeamMap } from "@/lib/queries";
import { getCurrentParticipantId } from "@/lib/auth";
import { PageHeader } from "@/components/domain/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ParticipantAvatar, FavoriteFlag } from "@/components/domain/participant-avatar";
import { EmptyState } from "@/components/domain/empty-state";
import { ordinal } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Players" };

export default async function ParticipantsPage() {
  const [rows, teamMap, viewerId] = await Promise.all([getLeaderboard(), getTeamMap(), getCurrentParticipantId()]);

  return (
    <div>
      <PageHeader
        title="Players"
        description="Everyone in the league. Tap a player for their full prediction profile."
        eyebrow="The crew"
        actions={viewerId ? <Button asChild variant="outline" size="sm"><Link href="/compare"><GitCompareArrows className="h-4 w-4" /> Compare picks</Link></Button> : undefined}
      />
      {rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const favIso = r.participant.favoriteTeamId ? teamMap.get(r.participant.favoriteTeamId)?.isoCode ?? null : null;
            return (
              <Link key={r.participant.id} href={`/participants/${r.participant.id}`} className="group block">
                <Card className="flex h-full items-center gap-4 p-5 transition-colors group-hover:border-primary/50">
                  <ParticipantAvatar initials={r.participant.initials} color={r.participant.accentColor} avatarId={r.participant.avatarId} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {r.participant.nickname || r.participant.name}
                      <FavoriteFlag iso={favIso} />
                    </p>
                    <p className="text-xs text-muted-foreground">{ordinal(r.rank)} place</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums">{r.total}</p>
                    <p className="text-xs text-muted-foreground">pts</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No players yet" description="Invite friends to join your league." />
      )}
    </div>
  );
}
