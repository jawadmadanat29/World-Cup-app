import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchEditData } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { ResultEntryForm } from "@/components/admin/result-entry-form";
import { STAGE_LABELS } from "@/lib/enums";
import { formatKickoff } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminResultPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const m = await getMatchEditData(matchId);
  if (!m) notFound();

  const stageLabel = m.stage === "GROUP" && m.groupCode ? `Group ${m.groupCode}` : STAGE_LABELS[m.stage as keyof typeof STAGE_LABELS] ?? m.stage;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/results" className="text-sm text-muted-foreground hover:text-foreground">← All results</Link>
      <PageHeader
        eyebrow={`${stageLabel} · #${m.matchNumber} · ${formatKickoff(m.kickoff)}`}
        title={`${m.home?.name ?? m.homePlaceholder ?? "TBD"} v ${m.away?.name ?? m.awayPlaceholder ?? "TBD"}`}
        className="mt-3"
      />
      {m.home && m.away ? (
        <ResultEntryForm
          matchId={m.id}
          home={m.home}
          away={m.away}
          isKnockout={m.isKnockout}
          homePlayers={m.homePlayers}
          awayPlayers={m.awayPlayers}
          initial={{ result: m.result, events: m.events }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Both teams must be set before entering a result. Resolve this knockout fixture’s teams in the Fixtures editor first.
        </p>
      )}
    </div>
  );
}
