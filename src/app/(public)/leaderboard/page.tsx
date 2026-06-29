import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { getLeaderboard, getTeamMap, getLatestPredictions } from "@/lib/queries";
import { getCurrentParticipantId } from "@/lib/auth";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/domain/empty-state";
import { ActivityFeed } from "@/components/domain/activity-feed";
import { LeaderboardList } from "@/components/domain/leaderboard-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const [rows, teamMap, meId] = await Promise.all([getLeaderboard(), getTeamMap(), getCurrentParticipantId()]);
  // No rows arg → stable cache key; the feed reuses the cached leaderboard internally.
  const feed = await getLatestPredictions(30);
  const favIso: Record<string, string | null> = Object.fromEntries([...teamMap.values()].map((t) => [t.id, t.isoCode]));

  return (
    <div className="space-y-6">
      <PageHeader title="Leaderboard" description="Live standings. Tap a row for the points breakdown, or a name for the full profile." eyebrow="Standings" />

      {rows.length ? (
        <LeaderboardList rows={rows} meId={meId} favIso={favIso} />
      ) : (
        <EmptyState title="No players yet" description="Invite friends to join your league." />
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Latest predictions</CardTitle></CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          <ActivityFeed events={feed} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Match predictions stay private until each match kicks off. Tournament picks are hidden until the first match of the tournament.</p>
    </div>
  );
}
