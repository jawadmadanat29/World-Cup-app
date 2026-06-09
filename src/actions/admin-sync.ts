"use server";
import { requireAdmin } from "@/lib/auth";
import { runSync } from "@/lib/sync/sync";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

export async function runSyncAction(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const out = await runSync({ force: true });
    revalidateEverything();
    if (out.status === "FAILED") return fail(out.error ?? "Sync failed.");
    return ok(out.summary);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Sync failed.");
  }
}
