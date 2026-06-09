"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { saveDeadline } from "@/actions/admin-deadlines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";

const SCOPES: { scope: string; label: string }[] = [
  { scope: "TOURNAMENT", label: "Tournament predictions" },
  { scope: "GROUP_STAGE", label: "Group rankings" },
  { scope: "KO_R32", label: "Round of 32 bracket" },
  { scope: "KO_R16", label: "Round of 16" },
  { scope: "KO_QF", label: "Quarter-finals" },
  { scope: "KO_SF", label: "Semi-finals" },
  { scope: "KO_FINAL", label: "Final" },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  try { return format(new Date(iso), "yyyy-MM-dd'T'HH:mm"); } catch { return ""; }
}

export function DeadlinesEditor({ deadlines }: { deadlines: { scope: string; deadline: string | null; manualLocked: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const byScope = new Map(deadlines.map((d) => [d.scope, d]));
  const [rows, setRows] = React.useState(
    SCOPES.map((s) => {
      const d = byScope.get(s.scope);
      return { ...s, deadline: toLocalInput(d?.deadline ?? null), manualLocked: d?.manualLocked ?? false };
    }),
  );

  function update(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function save(i: number) {
    const r = rows[i];
    start(async () => {
      const res = await saveDeadline(r.scope, r.deadline ? new Date(r.deadline).toISOString() : "", r.manualLocked);
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {rows.map((r, i) => (
          <div key={r.scope} className="grid gap-3 p-4 sm:grid-cols-[1.3fr_1.5fr_auto_auto] sm:items-end">
            <div><Label>{r.label}</Label></div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Deadline</Label>
              <Input type="datetime-local" value={r.deadline} onChange={(e) => update(i, { deadline: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={r.manualLocked} onCheckedChange={(v) => update(i, { manualLocked: v })} id={`lock-${r.scope}`} />
              <Label htmlFor={`lock-${r.scope}`} className="text-xs">Lock now</Label>
            </div>
            <Button size="sm" variant="outline" onClick={() => save(i)} disabled={pending}>Save</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
