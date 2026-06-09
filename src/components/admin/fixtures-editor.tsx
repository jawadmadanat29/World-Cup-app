"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Pencil, Search } from "lucide-react";
import { updateFixture } from "@/actions/admin-fixtures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamLabel } from "@/components/domain/team-label";
import { STAGE_SHORT } from "@/lib/enums";
import type { TeamLite } from "@/lib/queries";

const NONE = "none";

export type EditableFixture = {
  id: string; matchNumber: number; stage: string; groupCode: string | null;
  kickoffISO: string; venueId: string | null; homeTeamId: string | null; awayTeamId: string | null;
  homePlaceholder: string | null; awayPlaceholder: string | null; manualLock: string | null; hasResult: boolean;
};

export function FixturesEditor({
  fixtures, teams, venues,
}: {
  fixtures: EditableFixture[];
  teams: TeamLite[];
  venues: { id: string; name: string; city: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const teamMap = React.useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const [q, setQ] = React.useState("");
  const [stage, setStage] = React.useState("ALL");
  const [editing, setEditing] = React.useState<EditableFixture | null>(null);
  const [form, setForm] = React.useState({ kickoff: "", venueId: NONE, homeTeamId: NONE, awayTeamId: NONE, manualLock: "AUTO" });

  const stages = Array.from(new Set(fixtures.map((f) => f.stage)));
  const filtered = fixtures.filter((f) => {
    if (stage !== "ALL" && f.stage !== stage) return false;
    if (q) {
      const home = f.homeTeamId ? teamMap.get(f.homeTeamId)?.name ?? "" : f.homePlaceholder ?? "";
      const away = f.awayTeamId ? teamMap.get(f.awayTeamId)?.name ?? "" : f.awayPlaceholder ?? "";
      if (!`${home} ${away} ${f.matchNumber}`.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  });

  function openEdit(f: EditableFixture) {
    setEditing(f);
    setForm({
      kickoff: f.kickoffISO ? format(new Date(f.kickoffISO), "yyyy-MM-dd'T'HH:mm") : "",
      venueId: f.venueId ?? NONE,
      homeTeamId: f.homeTeamId ?? NONE,
      awayTeamId: f.awayTeamId ?? NONE,
      manualLock: f.manualLock ?? "AUTO",
    });
  }
  function save() {
    if (!editing) return;
    start(async () => {
      const res = await updateFixture({
        matchId: editing.id,
        kickoffISO: form.kickoff ? new Date(form.kickoff).toISOString() : undefined,
        venueId: form.venueId === NONE ? "" : form.venueId,
        homeTeamId: form.homeTeamId === NONE ? "" : form.homeTeamId,
        awayTeamId: form.awayTeamId === NONE ? "" : form.awayTeamId,
        manualLock: form.manualLock as "AUTO" | "LOCKED" | "OPEN",
      });
      if (res.ok) { toast.success(res.message); setEditing(null); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team or match #…" className="pl-9" />
        </div>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All stages</SelectItem>
            {stages.map((s) => <SelectItem key={s} value={s}>{STAGE_SHORT[s as keyof typeof STAGE_SHORT] ?? s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="divide-y">
        {filtered.map((f) => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">#{f.matchNumber}</span>
            <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">{f.stage === "GROUP" && f.groupCode ? f.groupCode : STAGE_SHORT[f.stage as keyof typeof STAGE_SHORT]}</Badge>
            <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
              <TeamLabel name={f.homeTeamId ? teamMap.get(f.homeTeamId)?.name : undefined} iso={f.homeTeamId ? teamMap.get(f.homeTeamId)?.isoCode : undefined} placeholder={f.homePlaceholder} showShort flagSize="sm" className="justify-start" />
              <span className="text-xs text-muted-foreground">v</span>
              <TeamLabel name={f.awayTeamId ? teamMap.get(f.awayTeamId)?.name : undefined} iso={f.awayTeamId ? teamMap.get(f.awayTeamId)?.isoCode : undefined} placeholder={f.awayPlaceholder} showShort flagSize="sm" reverse className="justify-end" />
            </div>
            {f.manualLock && <Badge variant={f.manualLock === "LOCKED" ? "destructive" : "teal"}>{f.manualLock}</Badge>}
            <Button variant="ghost" size="icon" onClick={() => openEdit(f)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit fixture #{editing?.matchNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Kickoff</Label>
              <Input type="datetime-local" value={form.kickoff} onChange={(e) => setForm({ ...form, kickoff: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Venue</Label>
              <Select value={form.venueId} onValueChange={(v) => setForm({ ...form, venueId: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}, {v.city}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Home team</Label>
                <Select value={form.homeTeamId} onValueChange={(v) => setForm({ ...form, homeTeamId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— (placeholder)</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Away team</Label>
                <Select value={form.awayTeamId} onValueChange={(v) => setForm({ ...form, awayTeamId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— (placeholder)</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Lock override</Label>
              <Select value={form.manualLock} onValueChange={(v) => setForm({ ...form, manualLock: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Automatic (kickoff − buffer)</SelectItem>
                  <SelectItem value="LOCKED">Force locked</SelectItem>
                  <SelectItem value="OPEN">Force open</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save fixture"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
