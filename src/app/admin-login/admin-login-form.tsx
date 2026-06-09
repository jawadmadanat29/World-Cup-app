"use client";
import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

export function AdminLoginForm({ from }: { from: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="from" value={from} />
      <div className="space-y-1.5">
        <Label htmlFor="password">Admin password</Label>
        <Input id="password" name="password" type="password" autoFocus autoComplete="current-password" placeholder="••••••••" />
      </div>
      {state.error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in as admin"}
      </Button>
    </form>
  );
}
