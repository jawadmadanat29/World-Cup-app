import Link from "next/link";
import { Activity, Sparkles, Trophy, MessageSquare, Target, Crown } from "lucide-react";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import { EmptyState } from "@/components/domain/empty-state";
import { timeUntil } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";

const FEED_ICON = {
  MATCH: Activity,
  WILDCARD: Sparkles,
  TOURNAMENT: Trophy,
  BOLD: MessageSquare,
  EXACT: Target,
  LEAD: Crown,
} as const;

export function ActivityFeed({ events }: { events: FeedEvent[] }) {
  if (!events.length) {
    return (
      <EmptyState
        title="Nothing yet"
        description="Activity appears here as picks are made and points come in — match picks become visible once each match kicks off."
        icon={Activity}
      />
    );
  }
  return (
    <div className="space-y-2.5">
      {events.map((e) => {
        const Icon = FEED_ICON[e.kind];
        return (
          <div key={e.id} className="flex items-center gap-2.5 text-sm">
            <ParticipantAvatar initials={e.participant.initials} color={e.participant.accentColor} avatarId={e.participant.avatarId} size="sm" />
            <span className="min-w-0 flex-1 truncate">
              <Link href={`/participants/${e.participant.id}`} className="font-medium hover:underline">
                {e.participant.nickname || e.participant.name.split(" ")[0]}
              </Link>
              <span className="text-muted-foreground"> {e.text}</span>
            </span>
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{timeUntil(e.at)}</span>
          </div>
        );
      })}
    </div>
  );
}
