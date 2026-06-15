import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync/sync";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Scheduler endpoint — point a cron (e.g. Vercel Cron) at this with a Bearer
// CRON_SECRET, or call it while signed in as admin. Safe to hit repeatedly:
// runSync throttles itself and never throws.
async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
    const url = new URL(req.url);
    if (url.searchParams.get("key") === secret) return true;
  }
  return isAdmin();
}

async function handle(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const out = await runSync({ force: true });
  // Always 200 so an unattended scheduler (cron-job.org) never auto-disables the
  // job over a transient failure like an exhausted daily quota — the run's real
  // outcome is in the body and on the admin sync page, and it self-heals next run.
  return NextResponse.json(out, { status: 200 });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
