import { getOutcomesData } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { OutcomesForm } from "@/components/admin/outcomes-form";

export const dynamic = "force-dynamic";

export default async function AdminOutcomesPage() {
  const data = await getOutcomesData();
  return (
    <div>
      <PageHeader
        title="Outcomes & awards"
        description="Confirm the final standings and official award winners. Fields with a “Use leader” link are auto-suggested from the goals/assists you’ve entered. Saving rescores everyone’s tournament & award predictions."
        eyebrow="End-of-tournament"
      />
      <OutcomesForm teams={data.teams} players={data.players} current={data.current} suggestions={data.suggestions} />
    </div>
  );
}
