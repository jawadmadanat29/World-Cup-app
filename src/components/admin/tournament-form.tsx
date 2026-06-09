"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TournamentPredInput } from "@/lib/prediction-writes";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TOURNAMENT_GOALS_RANGES, RED_CARD_RANGES, HATTRICK_RANGES } from "@/lib/enums";
import type { TeamLite } from "@/lib/queries";

const NONE = "none";

type Existing = {
  championTeamId: string; runnerUpTeamId: string; thirdTeamId: string; fourthTeamId: string;
  surpriseTeamId: string; disappointingTeamId: string; highestScoringTeamId: string; bestDefensiveTeamId: string;
  totalGoalsRange: string; finalPenaltyShootout: boolean; redCardRange: string; hatTrickRange: string;
  semifinalistTeamIds: string[]; quarterfinalistTeamIds: string[]; roundOf16TeamIds: string[]; bestThirdTeamIds: string[];
} | null;

export function TournamentForm({ participantId, teams, existing, action }: { participantId: string; teams: TeamLite[]; existing: Existing; action: (input: TournamentPredInput) => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  const [f, setF] = React.useState({
    championTeamId: existing?.championTeamId || NONE,
    runnerUpTeamId: existing?.runnerUpTeamId || NONE,
    thirdTeamId: existing?.thirdTeamId || NONE,
    fourthTeamId: existing?.fourthTeamId || NONE,
    surpriseTeamId: existing?.surpriseTeamId || NONE,
    disappointingTeamId: existing?.disappointingTeamId || NONE,
    highestScoringTeamId: existing?.highestScoringTeamId || NONE,
    bestDefensiveTeamId: existing?.bestDefensiveTeamId || NONE,
    totalGoalsRange: existing?.totalGoalsRange || NONE,
    redCardRange: existing?.redCardRange || NONE,
    hatTrickRange: existing?.hatTrickRange || NONE,
  });
  const [pens, setPens] = React.useState(existing?.finalPenaltyShootout ?? false);
  const pad = (arr: string[] | undefined, n: number) => Array.from({ length: n }, (_, i) => arr?.[i] ?? NONE);
  const [semis, setSemis] = React.useState(pad(existing?.semifinalistTeamIds, 4));
  const [quarters, setQuarters] = React.useState(pad(existing?.quarterfinalistTeamIds, 8));
  const [r16, setR16] = React.useState(pad(existing?.roundOf16TeamIds, 16));
  const [thirds, setThirds] = React.useState(pad(existing?.bestThirdTeamIds, 8));

  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const clean = (v: string) => (v === NONE ? undefined : v);

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
  function RangeSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  function Slots({ values, onChange, cols = "sm:grid-cols-4" }: { values: string[]; onChange: (i: number, v: string) => void; cols?: string }) {
    return (
      <div className={`grid grid-cols-2 gap-2 ${cols}`}>
        {values.map((v, i) => <TeamSelect key={i} value={v} onChange={(nv) => onChange(i, nv)} />)}
      </div>
    );
  }

  function submit() {
    start(async () => {
      const res = await action({
        participantId,
        championTeamId: clean(f.championTeamId), runnerUpTeamId: clean(f.runnerUpTeamId),
        thirdTeamId: clean(f.thirdTeamId), fourthTeamId: clean(f.fourthTeamId),
        surpriseTeamId: clean(f.surpriseTeamId), disappointingTeamId: clean(f.disappointingTeamId),
        highestScoringTeamId: clean(f.highestScoringTeamId), bestDefensiveTeamId: clean(f.bestDefensiveTeamId),
        totalGoalsRange: clean(f.totalGoalsRange), redCardRange: clean(f.redCardRange), hatTrickRange: clean(f.hatTrickRange),
        finalPenaltyShootout: pens,
        semifinalistTeamIds: semis.filter((x) => x !== NONE),
        quarterfinalistTeamIds: quarters.filter((x) => x !== NONE),
        roundOf16TeamIds: r16.filter((x) => x !== NONE),
        bestThirdTeamIds: thirds.filter((x) => x !== NONE),
      });
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="text-base">Final four</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Champion"><TeamSelect value={f.championTeamId} onChange={set("championTeamId")} /></Field>
          <Field label="Runner-up"><TeamSelect value={f.runnerUpTeamId} onChange={set("runnerUpTeamId")} /></Field>
          <Field label="Third"><TeamSelect value={f.thirdTeamId} onChange={set("thirdTeamId")} /></Field>
          <Field label="Fourth"><TeamSelect value={f.fourthTeamId} onChange={set("fourthTeamId")} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Semi-finalists (4)</CardTitle></CardHeader>
        <CardContent><Slots values={semis} onChange={(i, v) => setSemis((a) => a.map((x, idx) => (idx === i ? v : x)))} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Quarter-finalists (8)</CardTitle></CardHeader>
        <CardContent><Slots values={quarters} onChange={(i, v) => setQuarters((a) => a.map((x, idx) => (idx === i ? v : x)))} /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Round of 16 (16)</CardTitle>
          <p className="text-xs text-muted-foreground">Who reaches the last 16. (The Round of 32 = your group top-2 plus your best-third picks.)</p>
        </CardHeader>
        <CardContent><Slots values={r16} onChange={(i, v) => setR16((a) => a.map((x, idx) => (idx === i ? v : x)))} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Best third-place qualifiers (8)</CardTitle></CardHeader>
        <CardContent><Slots values={thirds} onChange={(i, v) => setThirds((a) => a.map((x, idx) => (idx === i ? v : x)))} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Team & tournament specials</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Surprise team"><TeamSelect value={f.surpriseTeamId} onChange={set("surpriseTeamId")} /></Field>
          <Field label="Most disappointing"><TeamSelect value={f.disappointingTeamId} onChange={set("disappointingTeamId")} /></Field>
          <Field label="Highest scoring"><TeamSelect value={f.highestScoringTeamId} onChange={set("highestScoringTeamId")} /></Field>
          <Field label="Best defensive"><TeamSelect value={f.bestDefensiveTeamId} onChange={set("bestDefensiveTeamId")} /></Field>
          <Field label="Total goals range"><RangeSelect value={f.totalGoalsRange} onChange={set("totalGoalsRange")} options={[...TOURNAMENT_GOALS_RANGES]} /></Field>
          <Field label="Red-card range"><RangeSelect value={f.redCardRange} onChange={set("redCardRange")} options={[...RED_CARD_RANGES]} /></Field>
          <Field label="Hat-trick range"><RangeSelect value={f.hatTrickRange} onChange={set("hatTrickRange")} options={[...HATTRICK_RANGES]} /></Field>
          <div className="flex items-center justify-between rounded-md border px-3">
            <Label>Final goes to penalties?</Label>
            <Switch checked={pens} onCheckedChange={setPens} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save tournament prediction"}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
