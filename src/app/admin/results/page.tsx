import Link from "next/link";
import { getFixtures } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TeamLabel } from "@/components/domain/team-label";
import { ScorePill } from "@/components/domain/score-pill";
import { STAGE_SHORT } from "@/lib/enums";
import { formatKickoffShort } from "@/lib/format";
import type { FixtureRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

function Row({ f }: { f: FixtureRow }) {
  const hasTeams = !!(f.home && f.away);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
        {f.stage === "GROUP" && f.groupCode ? f.groupCode : STAGE_SHORT[f.stage as keyof typeof STAGE_SHORT]}
      </Badge>
      <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">#{f.matchNumber}</span>
      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamLabel name={f.home?.name} iso={f.home?.isoCode} placeholder={f.homePlaceholder} showShort flagSize="sm" className="justify-start" />
        {f.result ? <ScorePill home={f.result.ftHome} away={f.result.ftAway} muted /> : <span className="text-center text-xs text-muted-foreground">{formatKickoffShort(f.kickoff)}</span>}
        <TeamLabel name={f.away?.name} iso={f.away?.isoCode} placeholder={f.awayPlaceholder} showShort flagSize="sm" reverse className="justify-end" />
      </div>
      <Button asChild size="sm" variant={f.result ? "outline" : "default"} disabled={!hasTeams}>
        <Link href={`/admin/results/${f.id}`}>{f.result ? "Edit" : "Enter"}</Link>
      </Button>
    </div>
  );
}

export default async function AdminResultsPage() {
  const fixtures = await getFixtures();
  const now = new Date();
  const needs = fixtures.filter((f) => f.home && f.away && !f.result && f.kickoff < now);
  const completed = fixtures.filter((f) => f.result).sort((a, b) => +b.kickoff - +a.kickoff);
  const upcoming = fixtures.filter((f) => f.home && f.away && !f.result && f.kickoff >= now);

  return (
    <div className="space-y-6">
      <PageHeader title="Results" description="Enter scores, scorers and cards. Saving recalculates every affected prediction automatically." eyebrow="Match results" />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Awaiting result <Badge variant="warning" className="ml-1">{needs.length}</Badge></h2>
        <Card className="divide-y">{needs.length ? needs.map((f) => <Row key={f.id} f={f} />) : <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing waiting — you’re all caught up.</p>}</Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Upcoming</h2>
        <Card className="divide-y">{upcoming.slice(0, 12).map((f) => <Row key={f.id} f={f} />)}</Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Completed <Badge variant="muted" className="ml-1">{completed.length}</Badge></h2>
        <Card className="divide-y">{completed.map((f) => <Row key={f.id} f={f} />)}</Card>
      </section>
    </div>
  );
}
