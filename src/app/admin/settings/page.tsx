import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/settings";
import { getParticipants } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [config, participants, adjustments] = await Promise.all([
    getConfig(),
    getParticipants(),
    prisma.adminAdjustment.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div>
      <PageHeader title="Settings & adjustments" description="League configuration, lock timing, wildcards and manual point corrections." eyebrow="Configuration" />
      <SettingsForm
        config={{
          matchLockBufferMinutes: config.matchLockBufferMinutes,
          closingSoonMinutes: config.closingSoonMinutes,
          wildcardsPerParticipant: config.wildcardsPerParticipant,
          tournamentName: config.tournamentName,
        }}
        participants={participants}
        adjustments={adjustments.map((a) => ({ id: a.id, participantId: a.participantId, points: a.points, reason: a.reason }))}
      />
    </div>
  );
}
