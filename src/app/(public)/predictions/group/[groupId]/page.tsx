import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentParticipantId } from "@/lib/auth";
import { getGroupPrediction } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { GroupRankingForm } from "@/components/admin/group-ranking-form";
import { saveMyGroupPrediction } from "@/actions/my-predictions";

export const dynamic = "force-dynamic";

export default async function MyGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const pid = await getCurrentParticipantId();
  if (!pid) redirect("/login");
  const { groupId } = await params;
  const data = await getGroupPrediction(pid, groupId);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/predictions?mode=tournament&sub=groups" className="text-sm text-muted-foreground hover:text-foreground">← Back to my groups</Link>
      <PageHeader className="mt-3" eyebrow="Predict the final standings" title={data.group.name} />
      <GroupRankingForm action={saveMyGroupPrediction} participantId={pid} group={data.group} teams={data.teams} existingOrder={data.existingOrder} />
    </div>
  );
}
