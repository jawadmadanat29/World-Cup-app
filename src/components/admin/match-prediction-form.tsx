"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Check, AlertTriangle } from "lucide-react";
import type { MatchPredInput } from "@/lib/prediction-writes";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/domain/status-badge";
import { Flag } from "@/components/domain/flag";
import { cn } from "@/lib/utils";
import type { LockState } from "@/lib/enums";

type Team = { id: string; name: string; isoCode: string; shortName: string } | null;
type Player = { id: string; name: string; position: string };

const NONE = "none";
const triToStr = (v: boolean | null | undefined) => (v === true ? "yes" : v === false ? "no" : "unset");
const strToTri = (v: string): boolean | undefined => (v === "yes" ? true : v === "no" ? false : undefined);

export function MatchPredictionForm({
  participantId, match, homePlayers, awayPlayers, lockState, existing, wildcardApplied, wildcardsRemaining, action, readOnly = false,
}: {
  participantId: string;
  action: (input: MatchPredInput) => Promise<ActionResult>;
  readOnly?: boolean;
  match: { id: string; isKnockout: boolean; home: Team; away: Team };
  homePlayers: Player[];
  awayPlayers: Player[];
  lockState: LockState;
  existing: {
    homeGoals: number | null; awayGoals: number | null; advanceTeamId: string | null;
    predictExtraTime: boolean | null; predictPenalties: boolean | null; penaltyHome: number | null; penaltyAway: number | null;
    firstTeamToScore: string | null; bttsPrediction: boolean | null; cleanSheetPrediction: boolean | null;
    wildcardPick: string | null;
    anytimeScorerPlayerIds: string[]; assistPlayerIds: string[]; multiScorerPlayerIds: string[];
  } | null;
  wildcardApplied: boolean;
  wildcardsRemaining: number;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const e = existing;

  const [homeGoals, setHomeGoals] = React.useState(e?.homeGoals != null ? String(e.homeGoals) : "");
  const [awayGoals, setAwayGoals] = React.useState(e?.awayGoals != null ? String(e.awayGoals) : "");
  const [advance, setAdvance] = React.useState(e?.advanceTeamId ?? "");
  const [et, setEt] = React.useState(triToStr(e?.predictExtraTime));
  const [pens, setPens] = React.useState(triToStr(e?.predictPenalties));
  const [firstTeam, setFirstTeam] = React.useState(e?.firstTeamToScore ?? NONE);
  const [btts, setBtts] = React.useState(triToStr(e?.bttsPrediction));
  const [clean, setClean] = React.useState(triToStr(e?.cleanSheetPrediction));
  const [anytime, setAnytime] = React.useState<string[]>([e?.anytimeScorerPlayerIds[0] ?? NONE, e?.anytimeScorerPlayerIds[1] ?? NONE]);
  const [assists, setAssists] = React.useState<string[]>([e?.assistPlayerIds[0] ?? NONE, e?.assistPlayerIds[1] ?? NONE]);
  const [multi, setMulti] = React.useState(e?.multiScorerPlayerIds[0] ?? NONE);
  const [boldCall, setBoldCall] = React.useState(e?.wildcardPick ?? "");
  const [useWildcard, setUseWildcard] = React.useState(wildcardApplied);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const allPlayers = [
    ...homePlayers.map((p) => ({ ...p, label: `${match.home?.shortName} · ${p.name}` })),
    ...awayPlayers.map((p) => ({ ...p, label: `${match.away?.shortName} · ${p.name}` })),
  ];
  const outcome =
    homeGoals !== "" && awayGoals !== "" ? (Number(homeGoals) > Number(awayGoals) ? match.home?.name : Number(homeGoals) < Number(awayGoals) ? match.away?.name : "Draw") : null;
  const locked = lockState === "LOCKED" || lockState === "COMPLETED";

  const anytimeCount = anytime.filter((x) => x !== NONE).length;
  const assistCount = assists.filter((x) => x !== NONE).length;

  // Completeness checklist (Q2 — advanced predictions are mandatory to maximise points).
  const checks = [
    { label: "Predicted score", done: homeGoals !== "" && awayGoals !== "" },
    { label: "First team to score", done: firstTeam !== NONE },
    { label: "Both teams to score", done: btts !== "unset" },
    { label: "Clean sheet", done: clean !== "unset" },
    { label: "2 any-time goalscorers", done: anytimeCount === 2 },
    { label: "2 assist providers", done: assistCount === 2 },
    { label: "Multi-goal scorer", done: multi !== NONE },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const complete = doneCount === checks.length;

  function PlayerSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <Select value={value} onValueChange={onChange} disabled={readOnly}>
        <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {allPlayers.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  function submit() {
    if (homeGoals === "" || awayGoals === "") { toast.error("Enter a predicted score."); return; }
    if (anytimeCount > 2) { toast.error("Pick at most 2 any-time scorers."); return; }
    start(async () => {
      const res = await action({
        participantId,
        matchId: match.id,
        homeGoals: Number(homeGoals),
        awayGoals: Number(awayGoals),
        advanceTeamId: match.isKnockout && advance ? advance : undefined,
        predictExtraTime: match.isKnockout ? strToTri(et) : undefined,
        predictPenalties: match.isKnockout ? strToTri(pens) : undefined,
        firstTeamToScore: firstTeam === NONE ? undefined : (firstTeam as "HOME" | "AWAY" | "NONE"),
        bttsPrediction: strToTri(btts),
        cleanSheetPrediction: strToTri(clean),
        anytimeScorerPlayerIds: anytime.filter((x) => x !== NONE),
        assistPlayerIds: assists.filter((x) => x !== NONE),
        multiScorerPlayerIds: multi === NONE ? [] : [multi],
        wildcardPick: boldCall || undefined,
        applyWildcard: useWildcard,
      });
      if (res.ok) { toast.success(complete ? res.message : "Saved — some bonus picks are still missing."); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-5">
      {locked && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <StatusBadge state={lockState} /> This match is locked — picks are final.
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Predicted score</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <Flag iso={match.home?.isoCode} size="lg" /><span className="text-sm font-medium">{match.home?.shortName}</span>
            </div>
            <Input type="number" min={0} value={homeGoals} onChange={(ev) => setHomeGoals(ev.target.value)} className="w-16 text-center" inputMode="numeric" disabled={readOnly} />
            <span className="text-muted-foreground">–</span>
            <Input type="number" min={0} value={awayGoals} onChange={(ev) => setAwayGoals(ev.target.value)} className="w-16 text-center" inputMode="numeric" disabled={readOnly} />
            <div className="flex flex-col items-center gap-1">
              <Flag iso={match.away?.isoCode} size="lg" /><span className="text-sm font-medium">{match.away?.shortName}</span>
            </div>
          </div>
          {outcome && <p className="text-center text-sm text-muted-foreground">Outcome: <span className="font-medium text-foreground">{outcome}</span></p>}
        </CardContent>
      </Card>

      {match.isKnockout && (
        <Card>
          <CardHeader><CardTitle className="text-base">Knockout</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Team to advance</Label>
              <Select value={advance || NONE} onValueChange={(v) => setAdvance(v === NONE ? "" : v)} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {match.home && <SelectItem value={match.home.id}>{match.home.name}</SelectItem>}
                  {match.away && <SelectItem value={match.away.id}>{match.away.name}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TriField label="Extra time?" value={et} onChange={setEt} disabled={readOnly} />
              <TriField label="Penalties?" value={pens} onChange={setPens} disabled={readOnly} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bonus predictions — mandatory to maximise points (Q2). */}
      <Card className={complete ? "" : "border-gold/40"}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Bonus predictions</CardTitle>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", complete ? "bg-primary/15 text-primary" : "bg-gold/15 text-gold")}>
            {doneCount}/{checks.length} done
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          {!complete && (
            <p className="flex items-start gap-2 rounded-md border border-gold/40 bg-gold/5 px-3 py-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
              These aren’t optional — leaving them blank costs you points. Fill them all before kickoff.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>First team to score</Label>
              <Select value={firstTeam} onValueChange={setFirstTeam} disabled={readOnly}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  <SelectItem value="HOME">{match.home?.shortName}</SelectItem>
                  <SelectItem value="AWAY">{match.away?.shortName}</SelectItem>
                  <SelectItem value="NONE">No goals</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TriField label="Both teams to score?" value={btts} onChange={setBtts} disabled={readOnly} />
            <TriField label="Clean sheet?" value={clean} onChange={setClean} disabled={readOnly} />
          </div>

          <div className="space-y-1.5">
            <Label>Any-time goalscorers (pick 2)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {anytime.map((v, i) => <PlayerSelect key={i} value={v} onChange={(nv) => setAnytime((a) => a.map((x, idx) => (idx === i ? nv : x)))} />)}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assist providers (pick 2)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {assists.map((v, i) => <PlayerSelect key={i} value={v} onChange={(nv) => setAssists((a) => a.map((x, idx) => (idx === i ? nv : x)))} />)}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Multi-goal scorer (player to score 2+)</Label>
            <PlayerSelect value={multi} onChange={setMulti} />
          </div>
        </CardContent>
      </Card>

      {/* Bold Call — social only, never scored. */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bold Call <span className="text-xs font-normal text-muted-foreground">· just for fun, doesn’t score</span></CardTitle></CardHeader>
        <CardContent>
          <Input value={boldCall} onChange={(ev) => setBoldCall(ev.target.value)} placeholder="e.g. a red card in the first half" disabled={readOnly} />
          <p className="mt-1.5 text-xs text-muted-foreground">Shown next to your name after the match locks.</p>
        </CardContent>
      </Card>

      <Card className={useWildcard ? "border-gold/50 bg-gold/5" : ""}>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className={useWildcard ? "h-5 w-5 text-gold" : "h-5 w-5 text-muted-foreground"} />
            <div>
              <p className="text-sm font-medium">Use a wildcard (×2 result points)</p>
              <p className="text-xs text-muted-foreground">{wildcardsRemaining} remaining{wildcardApplied ? " · applied here" : ""}</p>
            </div>
          </div>
          <Switch
            checked={useWildcard}
            onCheckedChange={(v) => { if (v && !useWildcard) setConfirmOpen(true); else setUseWildcard(false); }}
            disabled={readOnly || (!wildcardApplied && wildcardsRemaining <= 0)}
          />
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use a wildcard on this match?</DialogTitle>
            <DialogDescription>
              A wildcard <b>doubles the result points</b> (outcome + exact/GD/total) you earn from this match —
              it does not affect the bonus picks. You have <b>{wildcardsRemaining}</b> wildcard{wildcardsRemaining === 1 ? "" : "s"} left
              for the whole tournament, so spend them on matches you’re most confident about. You can switch it off again until the match locks.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => { setUseWildcard(true); setConfirmOpen(false); }}>Use wildcard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!complete && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-gold" /> {checks.length - doneCount} bonus pick(s) missing
            </span>
          )}
          {complete && <span className="flex items-center gap-1.5 text-xs text-primary"><Check className="h-3.5 w-3.5" /> All picks complete</span>}
          <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save prediction"}</Button>
        </div>
      )}
    </div>
  );
}

function TriField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="unset">—</SelectItem>
          <SelectItem value="yes">Yes</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
