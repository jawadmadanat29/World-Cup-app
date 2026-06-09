"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Goal, Square } from "lucide-react";
import { saveResult, clearResult } from "@/actions/admin-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "@/components/domain/flag";

type Player = { id: string; name: string; position: string };
type Team = { id: string; name: string; isoCode: string; shortName: string } | null;
type EventRow = { type: string; teamId: string; playerId: string; minute: string };

const EVENT_TYPES = [
  { value: "GOAL", label: "Goal" },
  { value: "PENALTY_GOAL", label: "Penalty goal" },
  { value: "OWN_GOAL", label: "Own goal" },
  { value: "ASSIST", label: "Assist" },
  { value: "YELLOW", label: "Yellow card" },
  { value: "RED", label: "Red card" },
];

export function ResultEntryForm({
  matchId, home, away, isKnockout, homePlayers, awayPlayers, initial,
}: {
  matchId: string;
  home: Team;
  away: Team;
  isKnockout: boolean;
  homePlayers: Player[];
  awayPlayers: Player[];
  initial: {
    result: { ftHome: number; ftAway: number; wentToExtraTime: boolean; aetHome: number | null; aetAway: number | null; wentToPenalties: boolean; pensHome: number | null; pensAway: number | null; advancingTeamId: string | null } | null;
    events: { type: string; teamId: string | null; playerId: string | null; minute: number | null }[];
  };
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const r = initial.result;

  const [ftHome, setFtHome] = React.useState(r ? String(r.ftHome) : "");
  const [ftAway, setFtAway] = React.useState(r ? String(r.ftAway) : "");
  const [et, setEt] = React.useState(r?.wentToExtraTime ?? false);
  const [pens, setPens] = React.useState(r?.wentToPenalties ?? false);
  const [pensHome, setPensHome] = React.useState(r?.pensHome != null ? String(r.pensHome) : "");
  const [pensAway, setPensAway] = React.useState(r?.pensAway != null ? String(r.pensAway) : "");
  const [advancing, setAdvancing] = React.useState(r?.advancingTeamId ?? "");
  const [events, setEvents] = React.useState<EventRow[]>(
    initial.events.map((e) => ({ type: e.type, teamId: e.teamId ?? home?.id ?? "", playerId: e.playerId ?? "", minute: e.minute != null ? String(e.minute) : "" })),
  );

  const rosterFor = (teamId: string) => (teamId === home?.id ? homePlayers : awayPlayers);

  function addEvent(type: string) {
    setEvents((ev) => [...ev, { type, teamId: home?.id ?? "", playerId: "", minute: "" }]);
  }
  function updateEvent(i: number, patch: Partial<EventRow>) {
    setEvents((ev) => ev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function removeEvent(i: number) {
    setEvents((ev) => ev.filter((_, idx) => idx !== i));
  }

  function submit() {
    if (ftHome === "" || ftAway === "") { toast.error("Enter the 90-minute score."); return; }
    if (isKnockout && !advancing) { toast.error("Select which team advances."); return; }
    start(async () => {
      const res = await saveResult({
        matchId,
        ftHome: Number(ftHome),
        ftAway: Number(ftAway),
        wentToExtraTime: et,
        wentToPenalties: pens,
        pensHome: pens && pensHome !== "" ? Number(pensHome) : undefined,
        pensAway: pens && pensAway !== "" ? Number(pensAway) : undefined,
        advancingTeamId: isKnockout && advancing ? advancing : undefined,
        decisiveScore: "FT",
        status: "COMPLETED",
        events: events
          .filter((e) => e.teamId)
          .map((e) => ({
            type: e.type as never,
            teamId: e.teamId,
            playerId: e.playerId || undefined,
            minute: e.minute !== "" ? Number(e.minute) : undefined,
            relatedPlayerId: undefined,
          })),
      });
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  function clear() {
    if (!window.confirm("Clear this result and recalculate? This removes the score and events.")) return;
    start(async () => {
      const res = await clearResult(matchId);
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="text-base">Score after 90 minutes</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <Flag iso={home?.isoCode} size="lg" />
              <span className="text-sm font-medium">{home?.shortName ?? "Home"}</span>
            </div>
            <Input type="number" min={0} value={ftHome} onChange={(e) => setFtHome(e.target.value)} className="w-16 text-center" inputMode="numeric" />
            <span className="text-muted-foreground">–</span>
            <Input type="number" min={0} value={ftAway} onChange={(e) => setFtAway(e.target.value)} className="w-16 text-center" inputMode="numeric" />
            <div className="flex flex-col items-center gap-1">
              <Flag iso={away?.isoCode} size="lg" />
              <span className="text-sm font-medium">{away?.shortName ?? "Away"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isKnockout && (
        <Card>
          <CardHeader><CardTitle className="text-base">Knockout</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="et">Went to extra time</Label>
              <Switch id="et" checked={et} onCheckedChange={setEt} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="pens">Went to penalties</Label>
              <Switch id="pens" checked={pens} onCheckedChange={setPens} />
            </div>
            {pens && (
              <div className="flex items-center gap-3">
                <Label className="text-sm">Shootout</Label>
                <Input type="number" min={0} value={pensHome} onChange={(e) => setPensHome(e.target.value)} className="w-16 text-center" placeholder={home?.shortName} />
                <span className="text-muted-foreground">–</span>
                <Input type="number" min={0} value={pensAway} onChange={(e) => setPensAway(e.target.value)} className="w-16 text-center" placeholder={away?.shortName} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Team that advances</Label>
              <Select value={advancing || "none"} onValueChange={(v) => setAdvancing(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {home && <SelectItem value={home.id}>{home.name}</SelectItem>}
                  {away && <SelectItem value={away.id}>{away.name}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Goals, assists & cards</CardTitle>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => addEvent("GOAL")}><Goal className="h-4 w-4" /> Goal</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addEvent("YELLOW")}><Square className="h-4 w-4 text-gold" /> Card</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 && <p className="text-sm text-muted-foreground">No events yet. Add goals to enable goalscorer scoring.</p>}
          {events.map((e, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-2">
              <Select value={e.type} onValueChange={(v) => updateEvent(i, { type: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={e.teamId} onValueChange={(v) => updateEvent(i, { teamId: v, playerId: "" })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Team" /></SelectTrigger>
                <SelectContent>
                  {home && <SelectItem value={home.id}>{home.shortName}</SelectItem>}
                  {away && <SelectItem value={away.id}>{away.shortName}</SelectItem>}
                </SelectContent>
              </Select>
              <Select value={e.playerId || "none"} onValueChange={(v) => updateEvent(i, { playerId: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Player" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {rosterFor(e.teamId).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min={1} max={120} value={e.minute} onChange={(ev) => updateEvent(i, { minute: ev.target.value })} className="h-9 w-16 text-center" placeholder="min" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeEvent(i)} aria-label="Remove"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {r ? <Button variant="outline" onClick={clear} disabled={pending}>Clear result</Button> : <span />}
        <Button onClick={submit} disabled={pending}>{pending ? "Saving & scoring…" : "Save result & recalculate"}</Button>
      </div>
    </div>
  );
}
