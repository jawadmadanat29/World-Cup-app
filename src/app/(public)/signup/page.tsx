import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignupForm } from "./signup-form";
import { getCurrentParticipant } from "@/lib/auth";
import { getTeamMap } from "@/lib/queries";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  // Existence check (not just a valid token) so a stale cookie for a deleted
  // account doesn't loop /signup ↔ /predictions.
  if (await getCurrentParticipant()) redirect("/predictions");
  const teamMap = await getTeamMap();
  const teams = [...teamMap.values()]
    .map((t) => ({ id: t.id, name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center">
      <Card className="w-full">
        <CardHeader className="space-y-2 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserPlus className="h-5 w-5" />
          </span>
          <CardTitle>Join the league</CardTitle>
          <CardDescription>Name, avatar and your team — then start predicting.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm teams={teams} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already joined? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            First time? <Link href="/how-it-works" className="font-medium text-primary hover:underline">See how it works</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
