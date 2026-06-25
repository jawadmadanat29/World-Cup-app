"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ParticipantAvatar, FavoriteFlag } from "@/components/domain/participant-avatar";
import { Movement } from "@/components/domain/movement";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/queries";

export function LeaderboardList({ rows, meId, favIso }: { rows: LeaderboardRow[]; meId: string | null; favIso: Record<string, string | null> }) {
  const [open, setOpen] = React.useState<string | null>(null);

  return (
    <Card className="divide-y">
      {rows.map((row) => {
        const me = row.participant.id === meId;
        const b = row.byCategory;
        const cats = [
          { label: "Match", value: (b.MATCH ?? 0) + (b.WILDCARD ?? 0) },
          { label: "Group", value: b.GROUP ?? 0 },
          { label: "Bracket", value: (b.KNOCKOUT_PRE ?? 0) + (b.KNOCKOUT_STAGE ?? 0) + (b.TOURNAMENT ?? 0) },
          { label: "Awards", value: b.AWARD ?? 0 },
        ].filter((c) => c.value !== 0);
        const isOpen = open === row.participant.id;

        return (
          <div key={row.participant.id} className={cn(me && "bg-primary/5")}>
            <button
              onClick={() => setOpen(isOpen ? null : row.participant.id)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40"
              aria-expanded={isOpen}
            >
              <span className={cn("w-6 text-center text-sm font-bold tabular-nums", row.rank === 1 ? "text-gold" : "text-muted-foreground")}>{row.rank}</span>
              <Movement value={row.movement} className="hidden w-8 sm:flex" />
              <ParticipantAvatar initials={row.participant.initials} color={row.participant.accentColor} avatarId={row.participant.avatarId} size="sm" />
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <Link
                  href={`/participants/${row.participant.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate font-medium hover:underline"
                >
                  {row.participant.nickname || row.participant.name}
                </Link>
                <FavoriteFlag iso={favIso[row.participant.favoriteTeamId ?? ""] ?? null} />
                {me && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">You</span>}
              </span>
              <span className="font-mono text-base font-bold tabular-nums">{row.total}</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
              <div className="space-y-2 border-t bg-muted/20 px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {cats.length ? (
                    cats.map((c) => (
                      <span key={c.label} className="rounded-md bg-background px-2 py-1 font-medium">
                        {c.label} <span className="font-mono tabular-nums text-muted-foreground">+{c.value}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">No points yet.</span>
                  )}
                  {row.adjustment !== 0 && (
                    <span className="rounded-md bg-background px-2 py-1 font-medium">
                      Adjustment <span className="font-mono tabular-nums text-muted-foreground">{row.adjustment > 0 ? "+" : ""}{row.adjustment}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {row.stats.exactScores} exact · {row.stats.correctOutcomes} results · {row.stats.correctScorers} scorers
                  </span>
                  <Link href={`/participants/${row.participant.id}`} onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-primary hover:underline">
                    Full points audit →
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
