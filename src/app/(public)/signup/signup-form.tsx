"use client";
import { useActionState, useState } from "react";
import { signup, type AuthState } from "@/actions/participant-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check } from "lucide-react";
import { AVATARS, DEFAULT_AVATAR_ID } from "@/lib/avatars";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import { cn } from "@/lib/utils";

export interface SignupTeam {
  id: string;
  name: string;
}

export function SignupForm({ teams }: { teams: SignupTeam[] }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signup, {});
  const [avatarId, setAvatarId] = useState<string>(DEFAULT_AVATAR_ID);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" autoComplete="username" placeholder="How you'll sign in" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nickname">Nickname / display name</Label>
        <Input id="nickname" name="nickname" placeholder="Shown on the leaderboard, e.g. The Oracle" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" />
      </div>

      <div className="space-y-2">
        <Label>Pick your avatar</Label>
        <input type="hidden" name="avatarId" value={avatarId} />
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((a) => {
            const selected = a.id === avatarId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAvatarId(a.id)}
                aria-pressed={selected}
                title={a.label}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-full ring-2 transition",
                  selected ? "ring-primary" : "ring-transparent hover:ring-border",
                )}
              >
                <ParticipantAvatar initials="" avatarId={a.id} size="lg" className="h-full w-full" />
                {selected && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="favoriteTeamId">Favourite national team</Label>
        <select
          id="favoriteTeamId"
          name="favoriteTeamId"
          defaultValue=""
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">No favourite (skip)</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Shows a flag by your name. Doesn’t affect scoring.</p>
      </div>

      {state.error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account & start predicting"}
      </Button>
    </form>
  );
}
