import { NextResponse } from "next/server";
import { resultEntrySchema } from "@/lib/validation";
import { applyResult } from "@/lib/scoring/apply-result";
import { isAdmin } from "@/lib/auth";

// Key-protected result entry — same scoring pipeline as the admin "Enter results"
// form, but callable with a Bearer CRON_SECRET (or ?key=) so results can be
// entered without a browser session. Body = resultEntrySchema JSON.
export const dynamic = "force-dynamic";

async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
    if (new URL(req.url).searchParams.get("key") === secret) return true;
  }
  return isAdmin();
}

export async function POST(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = resultEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid result", issues: parsed.error.errors },
      { status: 400 },
    );
  }

  try {
    const out = await applyResult(parsed.data, "api-admin");
    return NextResponse.json({ ok: true, ...out }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
