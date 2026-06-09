import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getFixtures, getGroupsData, getBracket } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { GroupTable } from "@/components/domain/group-table";
import { TournamentMatches, type MatchdayGroup } from "@/components/domain/tournament-matches";
import { KnockoutRound } from "@/components/domain/knockout-round";
import { groupMatchdays, currentMatchdayKey, TOURNAMENT_TZ_LABEL } from "@/lib/matchday";
import { isLocked } from "@/lib/locking";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tournament" };

const TABS = [
  { key: "matches", label: "Matches" },
  { key: "groups", label: "Groups" },
  { key: "r32", label: "Round of 32", stage: "R32" },
  { key: "r16", label: "Round of 16", stage: "R16" },
  { key: "qf", label: "Quarter-finals", stage: "QF" },
  { key: "sf", label: "Semi-finals", stage: "SF" },
  { key: "final", label: "Final", stage: "FINAL" },
] as const;

const KO_KEYS = ["r32", "r16", "qf", "sf", "final"] as const;

export default async function TournamentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "matches" } = await searchParams;
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Browse the competition"
        title="Tournament"
        description={`All 104 matches, group tables and the knockout bracket. Kickoff times shown in ${TOURNAMENT_TZ_LABEL}.`}
      />

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/tournament?tab=${t.key}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active.key === t.key ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {active.key === "matches" && <MatchesTab />}
      {active.key === "groups" && <GroupsTab />}
      {"stage" in active && <KnockoutTab tabKey={active.key} stage={active.stage} label={active.label} />}
    </div>
  );
}

async function MatchesTab() {
  const fixtures = await getFixtures();
  const withTeams = fixtures.filter((f) => f.home && f.away);
  const days = groupMatchdays(withTeams, (f) => f.kickoff);
  const currentKey = currentMatchdayKey(days, (f) => isLocked(f.lockState));
  const currentIndex = days.findIndex((d) => d.key === currentKey);
  const matchdays: MatchdayGroup[] = days.map((d, idx) => ({
    key: d.key,
    label: d.label,
    status: currentIndex < 0 ? "done" : idx < currentIndex ? "done" : idx === currentIndex ? "current" : "upcoming",
    matches: d.items,
  }));
  const recent = fixtures.filter((f) => f.result).sort((a, b) => +b.kickoff - +a.kickoff).slice(0, 4);
  return <TournamentMatches matchdays={matchdays} currentKey={currentKey} recent={recent} />;
}

async function GroupsTab() {
  const { groups } = await getGroupsData();
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => <GroupTable key={g.id} group={g} />)}
    </div>
  );
}

async function KnockoutTab({ tabKey, stage, label }: { tabKey: string; stage: string; label: string }) {
  const byStage = await getBracket();
  const ties = byStage[stage] ?? [];
  const thirdPlace = stage === "FINAL" ? byStage["THIRD_PLACE"]?.[0] ?? null : null;

  const idx = KO_KEYS.indexOf(tabKey as (typeof KO_KEYS)[number]);
  const prev = idx > 0 ? TABS.find((t) => t.key === KO_KEYS[idx - 1]) : null;
  const next = idx < KO_KEYS.length - 1 ? TABS.find((t) => t.key === KO_KEYS[idx + 1]) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {prev ? (
          <Link href={`/tournament?tab=${prev.key}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> {prev.label}
          </Link>
        ) : <span />}
        <span className="text-sm font-semibold">{label}</span>
        {next ? (
          <Link href={`/tournament?tab=${next.key}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            {next.label} <ChevronRight className="h-4 w-4" />
          </Link>
        ) : <span />}
      </div>
      <KnockoutRound stage={stage} ties={ties} thirdPlace={thirdPlace} />
    </div>
  );
}
