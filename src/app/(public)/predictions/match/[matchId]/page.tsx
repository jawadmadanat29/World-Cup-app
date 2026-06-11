import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentParticipantId } from "@/lib/auth";
import { getMatchPrediction } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { MatchPredictionForm } from "@/components/admin/match-prediction-form";
import { saveMyMatchPrediction } from "@/actions/my-predictions";
import { StatusBadge } from "@/components/domain/status-badge";
import { Countdown } from "@/components/domain/countdown";
import { STAGE_LABELS } from "@/lib/enums";
import { KickoffTime } from "@/components/domain/kickoff-time";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const pid = await getCurrentParticipantId();
  if (!pid) redirect("/login");
  const { matchId } = await params;
  const data = await getMatchPrediction(pid, matchId);
  if (!data) notFound();
  const { match } = data;
  const locked = data.lockState === "LOCKED" || data.lockState === "COMPLETED";
  const stageLabel = match.stage === "GROUP" && match.groupCode ? `Group ${match.groupCode}` : STAGE_LABELS[match.stage as keyof typeof STAGE_LABELS] ?? match.stage;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/predictions?mode=match" className="text-sm text-muted-foreground hover:text-foreground">← Back to my matches</Link>
      <PageHeader
        className="mt-3"
        eyebrow={<>{stageLabel} · #{match.matchNumber} · <KickoffTime iso={match.kickoff} mode="full" /></>}
        title={`${match.home?.name ?? "TBD"} v ${match.away?.name ?? "TBD"}`}
        actions={<StatusBadge state={data.lockState} />}
      />
      {locked ? (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-muted-foreground">
          This match is locked — your prediction is final and now visible to everyone.
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm">
          <Clock className="h-4 w-4 shrink-0 text-gold" />
          <span className="text-muted-foreground">Locks at kickoff — in</span>
          <span className="font-mono font-semibold"><Countdown target={match.kickoff.toISOString()} compact /></span>
        </div>
      )}
      <MatchPredictionForm
        action={saveMyMatchPrediction}
        readOnly={locked}
        participantId={pid}
        match={{ id: match.id, isKnockout: match.isKnockout, home: match.home, away: match.away }}
        homePlayers={data.homePlayers}
        awayPlayers={data.awayPlayers}
        lockState={data.lockState}
        existing={data.existing}
        wildcardApplied={data.wildcardApplied}
        wildcardsRemaining={data.wildcardsRemaining}
      />
    </div>
  );
}
