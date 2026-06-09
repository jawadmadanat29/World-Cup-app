"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AWARD_TYPES, AWARD_LABELS } from "@/lib/enums";
import type { AwardPick } from "@/lib/prediction-writes";
import type { ActionResult } from "@/lib/action-result";

const NONE = "none";

export function AwardsForm({
  participantId, players, existing, action,
}: {
  participantId: string;
  players: { id: string; name: string; team: string }[];
  existing: Record<string, string>;
  action: (participantId: string, picks: AwardPick[]) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [picks, setPicks] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const t of AWARD_TYPES) init[t] = existing[t] ?? NONE;
    return init;
  });

  function submit() {
    start(async () => {
      const res = await action(
        participantId,
        AWARD_TYPES.map((t) => ({ awardType: t, playerId: picks[t] === NONE ? undefined : picks[t] })),
      );
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {AWARD_TYPES.map((t) => (
          <div key={t} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_2fr] sm:items-center">
            <Label>{AWARD_LABELS[t]}</Label>
            <Select value={picks[t]} onValueChange={(v) => setPicks((p) => ({ ...p, [t]: v }))}>
              <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {players.map((pl) => <SelectItem key={pl.id} value={pl.id}>{pl.team} · {pl.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save award predictions"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
