import type { Metadata } from "next";
import { getFixtures } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { FixturesView } from "@/components/domain/fixtures-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fixtures" };

export default async function FixturesPage() {
  const fixtures = await getFixtures();
  return (
    <div>
      <PageHeader
        title="Fixtures"
        description="All 104 matches across the group stage and knockouts. Filter by stage, status, group or team."
        eyebrow="Schedule"
      />
      <FixturesView fixtures={fixtures} />
    </div>
  );
}
