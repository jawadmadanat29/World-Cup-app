"use server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { scoringRuleUpdateSchema } from "@/lib/validation";
import { recomputeEverything } from "@/lib/scoring/recompute";
import { writeAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidateEverything } from "@/lib/revalidate";

export async function updateScoringRules(rules: { key: string; value: number; enabled: boolean }[]): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = scoringRuleUpdateSchema.safeParse({ rules });
    if (!parsed.success) return fail("Invalid scoring values.");
    await prisma.$transaction(
      parsed.data.rules.map((r) =>
        prisma.scoringRule.update({ where: { key: r.key }, data: { value: r.value, enabled: r.enabled } }),
      ),
    );
    const counts = await recomputeEverything();
    await writeAudit({ action: "UPDATE", entity: "scoring_rules", summary: `Updated ${parsed.data.rules.length} scoring rules; recalculated ${counts.match + counts.group + counts.tournament} transactions.` });
    revalidateEverything();
    return ok("Scoring rules saved — all scores recalculated.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not update scoring rules.");
  }
}
