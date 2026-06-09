"use server";
import { requireAdmin } from "@/lib/auth";
import { recomputeEverything } from "@/lib/scoring/recompute";
import { writeAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

export async function recomputeAllAction(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const counts = await recomputeEverything();
    await writeAudit({ action: "RECOMPUTE", entity: "scoring", summary: `Full recalculation (match ${counts.match}, group ${counts.group}, tournament ${counts.tournament}).` });
    revalidateEverything();
    return ok(`Recalculated all scores · ${counts.match + counts.group + counts.tournament} transactions written.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Recalculation failed.");
  }
}
