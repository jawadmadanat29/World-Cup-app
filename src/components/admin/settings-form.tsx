"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { updateSettings, addAdjustment, deleteAdjustment } from "@/actions/admin-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ParticipantLite } from "@/lib/queries";
import { signedPts } from "@/lib/format";

export function SettingsForm({
  config, participants, adjustments,
}: {
  config: { matchLockBufferMinutes: number; closingSoonMinutes: number; wildcardsPerParticipant: number; tournamentName: string };
  participants: ParticipantLite[];
  adjustments: { id: string; participantId: string; points: number; reason: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [c, setC] = React.useState(config);

  // Adjustment form state
  const [adjP, setAdjP] = React.useState(participants[0]?.id ?? "");
  const [adjPts, setAdjPts] = React.useState("");
  const [adjReason, setAdjReason] = React.useState("");
  const nameById = new Map(participants.map((p) => [p.id, p.name]));

  function saveSettings() {
    start(async () => {
      const res = await updateSettings(c);
      res.ok ? toast.success(res.message) : toast.error(res.message);
      if (res.ok) router.refresh();
    });
  }
  function submitAdjustment() {
    if (!adjP || adjPts === "" || !adjReason.trim()) { toast.error("Participant, points and reason are required."); return; }
    start(async () => {
      const res = await addAdjustment({ participantId: adjP, points: Number(adjPts), reason: adjReason });
      if (res.ok) { toast.success(res.message); setAdjPts(""); setAdjReason(""); router.refresh(); }
      else toast.error(res.message);
    });
  }
  function removeAdjustment(id: string) {
    start(async () => {
      const res = await deleteAdjustment(id);
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">League settings</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tn">Tournament name</Label>
            <Input id="tn" value={c.tournamentName} onChange={(e) => setC({ ...c, tournamentName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buf">Lock buffer (minutes before kickoff)</Label>
            <Input id="buf" type="number" min={0} value={c.matchLockBufferMinutes} onChange={(e) => setC({ ...c, matchLockBufferMinutes: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs">“Closing soon” window (minutes)</Label>
            <Input id="cs" type="number" min={0} value={c.closingSoonMinutes} onChange={(e) => setC({ ...c, closingSoonMinutes: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wc">Wildcards per participant</Label>
            <Input id="wc" type="number" min={0} value={c.wildcardsPerParticipant} onChange={(e) => setC({ ...c, wildcardsPerParticipant: Number(e.target.value) })} />
          </div>
          <div className="flex items-end">
            <Button onClick={saveSettings} disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual point adjustments</CardTitle>
          <p className="text-sm text-muted-foreground">Kept separate from auto-calculated points and never overwritten by recalculation.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1.5fr_0.7fr_2fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label>Participant</Label>
              <Select value={adjP} onValueChange={setAdjP}>
                <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                <SelectContent>{participants.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Points</Label>
              <Input type="number" value={adjPts} onChange={(e) => setAdjPts(e.target.value)} placeholder="±" />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Audit reason" />
            </div>
            <Button onClick={submitAdjustment} disabled={pending}>Add</Button>
          </div>

          <div className="divide-y rounded-md border">
            {adjustments.length ? adjustments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Badge variant={a.points >= 0 ? "teal" : "destructive"}>{signedPts(a.points)}</Badge>
                <span className="font-medium">{nameById.get(a.participantId) ?? "?"}</span>
                <span className="flex-1 truncate text-muted-foreground">{a.reason}</span>
                <Button variant="ghost" size="icon" onClick={() => removeAdjustment(a.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            )) : <p className="px-3 py-4 text-sm text-muted-foreground">No manual adjustments.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
