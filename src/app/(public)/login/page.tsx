import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { getCurrentParticipantId } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function PlayerLoginPage() {
  if (await getCurrentParticipantId()) redirect("/predictions");
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center">
      <Card className="w-full">
        <CardHeader className="space-y-2 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            <LogIn className="h-5 w-5" />
          </span>
          <CardTitle>Player sign in</CardTitle>
          <CardDescription>Sign in to enter and manage your own predictions.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New here? <Link href="/signup" className="font-medium text-primary hover:underline">Create an account</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
