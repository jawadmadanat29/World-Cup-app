"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { saveOutcomes } from "@/actions/admin-outcomes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AWARD_TYPES, AWARD_LABELS } from "@/lib/enums";
import type { TeamLite } from "@/lib/queries";

const NONE = "none";

interface Suggestions {
  goldenBootPlayerId: string | null; goldenBootLabel: string | null;
  topAssistPlayerId: string | null; topAssistLabel: string | null;
}
interface Current {
  championTeamId: string;
  runnerUpTeamId: string;
  awards: Record<string, string>;
}

export function OutcomesForm({
  teams, players, current, suggestions,
}: {
  teams: TeamLite[];
  players: { id: string; name: string; team: string }[];
  current: Current;
  suggestions: Suggestions;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [champion, setChampion] = React.useState(current.championTeamId || NONE);
  const [runnerUp, setRunnerUp] = React.useState(current.runnerUpTeamId || NONE);
  const [awards, setAwards] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const t of AWARD_TYPES) init[t] = current.awards[t] ?? NONE;
    return init;
  });

  function TeamSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  function submit() {
    start(async () => {
      const res = await saveOutcomes({
        championTeamId: champion === NONE ? "" : champion,
        runnerUpTeamId: runnerUp === NONE ? "" : runnerUp,
        awards: Object.fromEntries(Object.entries(awards).map(([k, v]) => [k, v === NONE ? "" : v])),
      });
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  function Suggest({ onClick, label }: { onClick: () => void; label: string }) {
    return (
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Wand2 className="h-3 w-3" /> Use leader: {label}
      </button>
    );
  }

  const awardSuggest: Record<string, { id: string | null; label: string | null }> = {
    GOLDEN_BOOT: { id: suggestions.goldenBootPlayerId, label: suggestions.goldenBootLabel },
    TOP_ASSIST: { id: suggestions.topAssistPlayerId, label: suggestions.topAssistLabel },
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finalists</CardTitle>
          <p className="text-xs text-muted-foreground">The semi-finalists, quarter-finalists and Round-of-16 teams are derived automatically from the knockout results — you only set the two finalists here.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Champion"><TeamSelect value={champion} onChange={setChampion} /></Field>
          <Field label="Runner-up (finalist)"><TeamSelect value={runnerUp} onChange={setRunnerUp} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Player award winners</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {AWARD_TYPES.map((t) => {
            const s = awardSuggest[t];
            return (
              <Field key={t} label={AWARD_LABELS[t]} hint={s?.label && s.id && <Suggest label={s.label} onClick={() => setAwards((a) => ({ ...a, [t]: s.id! }))} />}>
                <Select value={awards[t]} onValueChange={(v) => setAwards((a) => ({ ...a, [t]: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select player" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {players.map((pl) => <SelectItem key={pl.id} value={pl.id}>{pl.team} · {pl.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            );
          })}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={submit} disabled={pending} size="lg">{pending ? "Saving & rescoring…" : "Save outcomes & awards"}</Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {hint}
      </div>
      {children}
    </div>
  );
}
