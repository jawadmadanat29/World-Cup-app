"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateScoringRules } from "@/actions/admin-scoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Rule = { key: string; category: string; label: string; description: string | null; value: number; enabled: boolean };

const CATEGORY_LABELS: Record<string, string> = {
  MATCH: "Match scoring", GROUP: "Group stage", KNOCKOUT_PRE: "Bracket / tournament rounds",
  KNOCKOUT_STAGE: "Stage-by-stage knockout", TOURNAMENT: "Tournament specials", AWARD: "Player awards",
};

export function ScoringSettings({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const editable = rules.filter((r) => r.category !== "SYSTEM");
  const [state, setState] = React.useState<Record<string, { value: number; enabled: boolean }>>(
    () => Object.fromEntries(editable.map((r) => [r.key, { value: r.value, enabled: r.enabled }])),
  );

  const categories = Array.from(new Set(editable.map((r) => r.category)));

  function submit() {
    start(async () => {
      const res = await updateScoringRules(editable.map((r) => ({ key: r.key, value: state[r.key].value, enabled: state[r.key].enabled })));
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-5">
      {categories.map((cat) => (
        <Card key={cat}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{CATEGORY_LABELS[cat] ?? cat}</CardTitle></CardHeader>
          <CardContent className="divide-y pt-0">
            {editable.filter((r) => r.category === cat).map((r) => (
              <div key={r.key} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                </div>
                <Input
                  type="number"
                  value={state[r.key].value}
                  onChange={(e) => setState((s) => ({ ...s, [r.key]: { ...s[r.key], value: Number(e.target.value) } }))}
                  className="h-9 w-20 text-center"
                />
                <Switch
                  checked={state[r.key].enabled}
                  onCheckedChange={(v) => setState((s) => ({ ...s, [r.key]: { ...s[r.key], enabled: v } }))}
                  aria-label="Enabled"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={submit} disabled={pending} size="lg">{pending ? "Saving & recalculating…" : "Save scoring rules"}</Button>
      </div>
    </div>
  );
}
