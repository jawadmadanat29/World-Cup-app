import type { Metadata } from "next";
import { getAwardsBoard } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import { EmptyState } from "@/components/domain/empty-state";
import { AWARD_TYPES, AWARD_LABELS } from "@/lib/enums";
import { Check, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Player awards" };

export default async function AwardsPage() {
  const { byType, actuals } = await getAwardsBoard();
  const hasAny = AWARD_TYPES.some((t) => (byType.get(t)?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Player awards" description="Golden Boot and Top Assister — every friend’s pick." eyebrow="Individual awards" />

      {hasAny ? (
        <div className="grid gap-4 md:grid-cols-2">
          {AWARD_TYPES.map((type) => {
            const picks = byType.get(type) ?? [];
            const actual = actuals[type];
            return (
              <Card key={type}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><Medal className="h-4 w-4 text-gold" /> {AWARD_LABELS[type]}</CardTitle>
                  {actual && <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> {actual.name}</Badge>}
                </CardHeader>
                <CardContent className="space-y-1.5 pt-0">
                  {picks.length ? picks.map((p) => (
                    <div key={p.participant.id} className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5", p.correct && "bg-primary/10")}>
                      <ParticipantAvatar initials={p.participant.initials} color={p.participant.accentColor} size="sm" />
                      <span className="flex-1 truncate text-sm font-medium">{p.participant.name}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {p.pick ? `${p.pick.name}${p.pick.team ? ` · ${p.pick.team}` : ""}` : "—"}
                      </span>
                      {p.correct && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  )) : <p className="px-2 py-3 text-sm text-muted-foreground">No picks yet.</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No award predictions yet" description="These will appear once players submit their tournament picks. Sign in to add yours." />
      )}
    </div>
  );
}
