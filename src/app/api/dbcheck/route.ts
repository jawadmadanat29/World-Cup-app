import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TEMPORARY diagnostic — remove after migration cutover is verified.
// Key-protected. Reports what connection value the deployment actually sees
// (masked) and the real DB error, without leaking the password.
export const dynamic = "force-dynamic";

function describe(raw: string | undefined) {
  if (!raw) return { set: false };
  const hasWhitespace = raw !== raw.trim();
  const hasNewline = /[\r\n]/.test(raw);
  let parsed: Record<string, unknown> = {};
  try {
    const u = new URL(raw.trim());
    parsed = {
      protocol: u.protocol,
      user: u.username,
      passwordLen: u.password.length,
      host: u.hostname,
      port: u.port,
      dbname: u.pathname,
      query: u.search,
    };
  } catch (e) {
    parsed = { parseError: e instanceof Error ? e.message : String(e) };
  }
  return { set: true, rawLen: raw.length, trimmedLen: raw.trim().length, hasWhitespace, hasNewline, ...parsed };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const env = {
    DATABASE_URL: describe(process.env.DATABASE_URL),
    DIRECT_URL: describe(process.env.DIRECT_URL),
  };

  let db: Record<string, unknown>;
  try {
    const rows = await prisma.$queryRaw<{ n: number; db: string; usr: string }[]>`
      select 1 as n, current_database() as db, current_user as usr`;
    db = { ok: true, rows };
  } catch (e) {
    db = {
      ok: false,
      name: e instanceof Error ? e.name : undefined,
      message: e instanceof Error ? e.message : String(e),
      // Prisma errors carry a code like P1001 / P1000
      code: (e as { code?: string })?.code,
    };
  }

  return NextResponse.json({ env, db }, { headers: { "Cache-Control": "no-store" } });
}
