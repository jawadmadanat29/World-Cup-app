import { prisma } from "@/lib/db";
import { getTeamMap } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { FixturesEditor } from "@/components/admin/fixtures-editor";

export const dynamic = "force-dynamic";

export default async function AdminFixturesPage() {
  const [teamMap, matches, venues] = await Promise.all([
    getTeamMap(),
    prisma.match.findMany({ orderBy: { matchNumber: "asc" }, include: { group: true, result: { select: { id: true } } } }),
    prisma.venue.findMany({ orderBy: { name: "asc" } }),
  ]);
  const teams = [...teamMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      <PageHeader
        title="Fixtures editor"
        description="Correct kickoff times, venues, knockout team assignments and per-match lock overrides. Use this to resolve knockout placeholders to real teams."
        eyebrow="Tournament data"
      />
      <FixturesEditor
        teams={teams}
        venues={venues.map((v) => ({ id: v.id, name: v.name, city: v.city }))}
        fixtures={matches.map((m) => ({
          id: m.id, matchNumber: m.matchNumber, stage: m.stage, groupCode: m.group?.code ?? null,
          kickoffISO: m.kickoff.toISOString(), venueId: m.venueId, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
          homePlaceholder: m.homePlaceholder, awayPlaceholder: m.awayPlaceholder, manualLock: m.manualLock, hasResult: !!m.result,
        }))}
      />
    </div>
  );
}
