"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "@/components/domain/flag";
import type { TeamLite } from "@/lib/queries";
import type { GroupPredInput } from "@/lib/prediction-writes";
import type { ActionResult } from "@/lib/action-result";

const POS = ["Winner", "Runner-up", "Third", "Fourth"];

export function GroupRankingForm({
  participantId, group, teams, existingOrder, action,
}: {
  participantId: string;
  group: { id: string; code: string; name: string };
  teams: TeamLite[];
  existingOrder: string[];
  action: (input: GroupPredInput) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const initial = existingOrder.length === 4 ? existingOrder : teams.map((t) => t.id);
  const [order, setOrder] = React.useState<string[]>(initial);

  function setSlot(i: number, teamId: string) {
    setOrder((o) => o.map((x, idx) => (idx === i ? teamId : x)));
  }

  function submit() {
    if (new Set(order).size !== 4) { toast.error("Each team must take a different position."); return; }
    start(async () => {
      const res = await action({ participantId, groupId: group.id, order });
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        {order.map((teamId, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-sm font-medium text-muted-foreground">{POS[i]}</span>
            <Select value={teamId} onValueChange={(v) => setSlot(i, v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teams.find((t) => t.id === teamId) && <Flag iso={teams.find((t) => t.id === teamId)!.isoCode} />}
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : `Save Group ${group.code} ranking`}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
