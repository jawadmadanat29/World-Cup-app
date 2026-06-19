"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { saveParticipant, deleteParticipant, resetParticipantPassword, type ParticipantInput } from "@/actions/admin-participants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import { TeamChip } from "@/components/domain/team-chip";
import type { ParticipantLite, TeamLite } from "@/lib/queries";

export function ParticipantManager({ participants, teams }: { participants: ParticipantLite[]; teams: TeamLite[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ParticipantLite | null>(null);
  const [pending, start] = React.useTransition();
  const teamMap = React.useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const [form, setForm] = React.useState<ParticipantInput>({ name: "", nickname: "", accentColor: "#10b981", favoriteTeamId: "" });

  function openNew() {
    setEditing(null);
    setForm({ name: "", nickname: "", accentColor: "#10b981", favoriteTeamId: "" });
    setOpen(true);
  }
  function openEdit(p: ParticipantLite) {
    setEditing(p);
    setForm({ id: p.id, name: p.name, nickname: p.nickname ?? "", accentColor: p.accentColor, favoriteTeamId: p.favoriteTeamId ?? "" });
    setOpen(true);
  }

  function submit() {
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    start(async () => {
      const res = await saveParticipant(form);
      if (res.ok) { toast.success(res.message); setOpen(false); router.refresh(); }
      else toast.error(res.message);
    });
  }

  function resetPw(p: ParticipantLite) {
    const pw = window.prompt(`New temporary password for ${p.name} (min 6 characters).\nShare it with them — they can change it after signing in.`);
    if (pw == null) return; // cancelled
    if (pw.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    start(async () => {
      const res = await resetParticipantPassword(p.id, pw);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  function remove(p: ParticipantLite) {
    if (!window.confirm(`Remove ${p.name} and all their predictions? This cannot be undone.`)) return;
    start(async () => {
      const res = await deleteParticipant(p.id);
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4" /> Add participant</Button>
      </div>

      <Card className="divide-y">
        {participants.length ? participants.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <ParticipantAvatar initials={p.initials} color={p.accentColor} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              {p.nickname && <p className="truncate text-xs text-muted-foreground">“{p.nickname}”</p>}
            </div>
            {p.favoriteTeamId && teamMap.get(p.favoriteTeamId) && <TeamChip team={teamMap.get(p.favoriteTeamId)!} />}
            <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => resetPw(p)} aria-label="Reset password" disabled={pending}><KeyRound className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => remove(p)} aria-label="Delete" disabled={pending}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        )) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">No participants yet. Add your first friend.</p>}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit participant" : "Add participant"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Alex Johnson" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-nick">Nickname (optional)</Label>
              <Input id="p-nick" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="e.g. The Oracle" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-color">Accent colour</Label>
                <Input id="p-color" type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="h-10 w-full p-1" />
              </div>
              <div className="space-y-1.5">
                <Label>Favourite team</Label>
                <Select value={form.favoriteTeamId || "none"} onValueChange={(v) => setForm({ ...form, favoriteTeamId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
