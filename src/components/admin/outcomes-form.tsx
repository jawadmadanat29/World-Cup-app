"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { saveOutcomes } from "@/actions/admin-outcomes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AWARD_TYPES, AWARD_LABELS } from "@/lib/enums";
import type { TeamLite } from "@/lib/queries";

const NONE = "none";

interface Suggestions {
  goldenBootPlayerId: string | null; goldenBootLabel: string | null;
  topAssistPlayerId: string | null; topAssistLabel: string | null;
  mostGoalsMatchPlayerId: string | null; mostGoalsMatchLabel: string | null;
  highestScoringTeamId: string | null; highestScoringTeamName: string | null;
  bestDefensiveTeamId: string | null; bestDefensiveTeamName: string | null;
  totalGoals: number; redCards: number; hatTricks: number;
}
interface Current {
  championTeamId: string; runnerUpTeamId: string; thirdTeamId: string; fourthTeamId: string;
  surpriseTeamId: string; disappointingTeamId: string; highestScoringTeamId: string; bestDefensiveTeamId: string;
  totalGoals: string; finalWentToPens: boolean; redCards: string; hatTricks: string;
  awards: Record<string, string>;
}

const SUGGEST_AWARD: Record<string, "goldenBoot" | "topAssist" | "mostGoalsMatch"> = {
  GOLDEN_BOOT: "goldenBoot",
  TOP_ASSIST: "topAssist",
  MOST_GOALS_MATCH: "mostGoalsMatch",
};

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
  const [f, setF] = React.useState({
    championTeamId: current.championTeamId || NONE,
    runnerUpTeamId: current.runnerUpTeamId || NONE,
    thirdTeamId: current.thirdTeamId || NONE,
    fourthTeamId: current.fourthTeamId || NONE,
    surpriseTeamId: current.surpriseTeamId || NONE,
    disappointingTeamId: current.disappointingTeamId || NONE,
    highestScoringTeamId: current.highestScoringTeamId || NONE,
    bestDefensiveTeamId: current.bestDefensiveTeamId || NONE,
    totalGoals: current.totalGoals,
    redCards: current.redCards,
    hatTricks: current.hatTricks,
  });
  const [pens, setPens] = React.useState(current.finalWentToPens);
  const [awards, setAwards] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const t of AWARD_TYPES) init[t] = current.awards[t] ?? NONE;
    return init;
  });

  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

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
        championTeamId: f.championTeamId === NONE ? "" : f.championTeamId,
        runnerUpTeamId: f.runnerUpTeamId === NONE ? "" : f.runnerUpTeamId,
        thirdTeamId: f.thirdTeamId === NONE ? "" : f.thirdTeamId,
        fourthTeamId: f.fourthTeamId === NONE ? "" : f.fourthTeamId,
        surpriseTeamId: f.surpriseTeamId === NONE ? "" : f.surpriseTeamId,
        disappointingTeamId: f.disappointingTeamId === NONE ? "" : f.disappointingTeamId,
        highestScoringTeamId: f.highestScoringTeamId === NONE ? "" : f.highestScoringTeamId,
        bestDefensiveTeamId: f.bestDefensiveTeamId === NONE ? "" : f.bestDefensiveTeamId,
        totalGoals: f.totalGoals,
        redCards: f.redCards,
        hatTricks: f.hatTricks,
        finalWentToPens: pens,
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

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="text-base">Final standings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Champion"><TeamSelect value={f.championTeamId} onChange={set("championTeamId")} /></Field>
          <Field label="Runner-up"><TeamSelect value={f.runnerUpTeamId} onChange={set("runnerUpTeamId")} /></Field>
          <Field label="Third place"><TeamSelect value={f.thirdTeamId} onChange={set("thirdTeamId")} /></Field>
          <Field label="Fourth place"><TeamSelect value={f.fourthTeamId} onChange={set("fourthTeamId")} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Team & tournament awards</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Surprise team"><TeamSelect value={f.surpriseTeamId} onChange={set("surpriseTeamId")} /></Field>
          <Field label="Most disappointing"><TeamSelect value={f.disappointingTeamId} onChange={set("disappointingTeamId")} /></Field>
          <Field label="Highest-scoring team" hint={suggestions.highestScoringTeamName && <Suggest label={suggestions.highestScoringTeamName} onClick={() => set("highestScoringTeamId")(suggestions.highestScoringTeamId!)} />}>
            <TeamSelect value={f.highestScoringTeamId} onChange={set("highestScoringTeamId")} />
          </Field>
          <Field label="Best defensive team" hint={suggestions.bestDefensiveTeamName && <Suggest label={suggestions.bestDefensiveTeamName} onClick={() => set("bestDefensiveTeamId")(suggestions.bestDefensiveTeamId!)} />}>
            <TeamSelect value={f.bestDefensiveTeamId} onChange={set("bestDefensiveTeamId")} />
          </Field>
          <Field label="Total tournament goals" hint={<Suggest label={String(suggestions.totalGoals)} onClick={() => setF((p) => ({ ...p, totalGoals: String(suggestions.totalGoals) }))} />}>
            <Input type="number" value={f.totalGoals} onChange={(e) => setF((p) => ({ ...p, totalGoals: e.target.value }))} />
          </Field>
          <Field label="Red cards" hint={<Suggest label={String(suggestions.redCards)} onClick={() => setF((p) => ({ ...p, redCards: String(suggestions.redCards) }))} />}>
            <Input type="number" value={f.redCards} onChange={(e) => setF((p) => ({ ...p, redCards: e.target.value }))} />
          </Field>
          <Field label="Hat-tricks" hint={<Suggest label={String(suggestions.hatTricks)} onClick={() => setF((p) => ({ ...p, hatTricks: String(suggestions.hatTricks) }))} />}>
            <Input type="number" value={f.hatTricks} onChange={(e) => setF((p) => ({ ...p, hatTricks: e.target.value }))} />
          </Field>
          <div className="flex items-center justify-between rounded-md border px-3">
            <Label>Final went to penalties?</Label>
            <Switch checked={pens} onCheckedChange={setPens} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Player award winners</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {AWARD_TYPES.map((t) => {
            const sKey = SUGGEST_AWARD[t];
            const sLabel = sKey === "goldenBoot" ? suggestions.goldenBootLabel : sKey === "topAssist" ? suggestions.topAssistLabel : sKey === "mostGoalsMatch" ? suggestions.mostGoalsMatchLabel : null;
            const sId = sKey === "goldenBoot" ? suggestions.goldenBootPlayerId : sKey === "topAssist" ? suggestions.topAssistPlayerId : sKey === "mostGoalsMatch" ? suggestions.mostGoalsMatchPlayerId : null;
            return (
              <Field key={t} label={AWARD_LABELS[t]} hint={sLabel && sId && <Suggest label={sLabel} onClick={() => setAwards((a) => ({ ...a, [t]: sId }))} />}>
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
