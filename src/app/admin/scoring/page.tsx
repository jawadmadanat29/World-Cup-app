import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/domain/page-header";
import { ScoringSettings } from "@/components/admin/scoring-settings";

export const dynamic = "force-dynamic";

export default async function AdminScoringPage() {
  const rules = await prisma.scoringRule.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }] });
  return (
    <div>
      <PageHeader
        title="Scoring settings"
        description="Every point value is editable. The number is the points awarded; the switch enables or disables that rule. Saving recalculates all scores."
        eyebrow="Scoring engine"
      />
      <ScoringSettings rules={rules.map((r) => ({ key: r.key, category: r.category, label: r.label, description: r.description, value: r.value, enabled: r.enabled }))} />
    </div>
  );
}
