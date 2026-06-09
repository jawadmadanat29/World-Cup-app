import { getParticipants, getTeamMap } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { ParticipantManager } from "@/components/admin/participant-manager";

export const dynamic = "force-dynamic";

export default async function AdminParticipantsPage() {
  const [participants, teamMap] = await Promise.all([getParticipants(), getTeamMap()]);
  const teams = [...teamMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      <PageHeader title="Participants" description="Add and manage the friends in your league. Deleting a participant removes their predictions." eyebrow="People" />
      <ParticipantManager participants={participants} teams={teams} />
    </div>
  );
}
