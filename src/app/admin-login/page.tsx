import type { Metadata } from "next";
import Link from "next/link";
import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/layout/logo";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: "Admin sign in" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <Logo />
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Shield className="h-5 w-5" />
          </span>
          <CardTitle>Admin sign in</CardTitle>
          <CardDescription>Manage results, scoring, deadlines, sync and outcomes.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLoginForm from={from ?? "/admin"} />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Default dev password is <code className="rounded bg-muted px-1 py-0.5">worldcup2026</code> — change <code>ADMIN_PASSWORD</code> before deploying.
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Not the admin? <Link href="/login" className="text-primary hover:underline">Player sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
