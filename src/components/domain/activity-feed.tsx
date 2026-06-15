"use client";
import * as React from "react";
import Link from "next/link";
import { Activity, Sparkles, Trophy, MessageSquare, Target, Crown, Lock, PencilLine } from "lucide-react";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import { EmptyState } from "@/components/domain/empty-state";
import { timeUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FeedEvent } from "@/lib/queries";

const FEED_ICON = {
  MATCH: Activity,
  WILDCARD: Sparkles,
  TOURNAMENT: Trophy,
  BOLD: MessageSquare,
  EXACT: Target,
  LEAD: Crown,
  PICK: PencilLine,
  LOCK: Lock,
} as const;

// Which filter chips each event kind belongs to.
const FILTERS = [
  { key: "all", label: "All" },
  { key: "picks", label: "Picks" },
  { key: "nailed", label: "Nailed scores" },
  { key: "points", label: "Points" },
  { key: "locks", label: "Locks" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const KIND_GROUPS: Record<FeedEvent["kind"], FilterKey[]> = {
  PICK: ["picks"],
  MATCH: ["picks"],
  TOURNAMENT: ["picks"],
  BOLD: ["picks"],
  WILDCARD: ["picks"],
  EXACT: ["nailed", "points"],
  LEAD: ["points"],
  LOCK: ["locks"],
};

export function ActivityFeed({ events }: { events: FeedEvent[] }) {
  const [filter, setFilter] = React.useState<FilterKey>("all");

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: events.length };
    for (const e of events) for (const g of KIND_GROUPS[e.kind]) c[g] = (c[g] ?? 0) + 1;
    return c;
  }, [events]);

  const visible = filter === "all" ? events : events.filter((e) => KIND_GROUPS[e.kind].includes(filter));

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            {counts[f.key] ? <span className="ml-1 tabular-nums opacity-70">{counts[f.key]}</span> : null}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Activity appears as picks are made and points come in — match picks become visible once each match kicks off."
          icon={Activity}
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map((e) => {
            const Icon = FEED_ICON[e.kind];
            return (
              <div key={e.id} className="flex items-center gap-2.5 text-sm">
                {e.participant ? (
                  <ParticipantAvatar initials={e.participant.initials} color={e.participant.accentColor} avatarId={e.participant.avatarId} size="sm" />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">
                  {e.participant ? (
                    <>
                      <Link href={`/participants/${e.participant.id}`} className="font-medium hover:underline">
                        {e.participant.nickname || e.participant.name.split(" ")[0]}
                      </Link>
                      <span className="text-muted-foreground"> {e.text}</span>
                    </>
                  ) : (
                    <span>{e.text}</span>
                  )}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{timeUntil(e.at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
