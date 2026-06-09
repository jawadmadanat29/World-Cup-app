import type { Metadata } from "next";
import { getBracket } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { Bracket } from "@/components/domain/bracket";
import { EmptyState } from "@/components/domain/empty-state";
import { Network } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bracket" };

export default async function BracketPage() {
  const byStage = await getBracket();
  const hasAny = Object.values(byStage).some((arr) => arr.length);

  return (
    <div>
      <PageHeader
        title="Knockout bracket"
        description="Round of 32 through the Final. Teams populate as the group stage resolves and knockout results come in."
        eyebrow="Knockouts"
      />
      {hasAny ? (
        <Bracket byStage={byStage} />
      ) : (
        <EmptyState icon={Network} title="Bracket not available yet" description="Knockout fixtures will appear here." />
      )}
    </div>
  );
}
