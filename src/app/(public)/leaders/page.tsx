import type { Metadata } from "next";
import { Goal, Handshake, Shield, ShieldOff, Sparkles } from "lucide-react";
import { getLeaders } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/domain/stat";
import { Flag } from "@/components/domain/flag";
import { TeamChip } from "@/components/domain/team-chip";
import { EmptyState } from "@/components/domain/empty-state";
import { cn } from "@/lib/utils";
import type { TeamLite } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaders" };

function PlayerCell({ player }: { player: { name: string; team: TeamLite | null } }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {player.team && <Flag iso={player.team.isoCode} size="sm" title={player.team.name} />}
      <span className="truncate">{player.name}</span>
      {player.team && <span className="shrink-0 text-xs text-muted-foreground">{player.team.shortName}</span>}
    </span>
  );
}

function RankTable({
  title, icon: Icon, rows, valueLabel,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: { key: string; cell: React.ReactNode; value: React.ReactNode }[];
  valueLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> {title}</CardTitle></CardHeader>
      <CardContent className="px-2 pt-0">
        {rows.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="w-8 py-1.5 pl-2 text-left font-medium">#</th>
                <th className="text-left font-medium">Player</th>
                <th className="px-2 text-right font-medium">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="border-t">
                  <td className={cn("py-2 pl-2 tabular-nums", i === 0 ? "font-bold text-gold" : "text-muted-foreground")}>{i + 1}</td>
                  <td className="py-2">{r.cell}</td>
                  <td className="px-2 text-right font-mono font-semibold tabular-nums">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function LeadersPage() {
  const l = await getLeaders();

  if (l.totals.matchesPlayed === 0) {
    return (
      <div>
        <PageHeader title="Tournament leaders" description="Golden Boot race, top assists and team stats — built automatically from results." eyebrow="Stats" />
        <EmptyState icon={Goal} title="No stats yet" description="The Golden Boot race and all leaders fill in automatically as match results and goalscorers come in." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tournament leaders" description="Auto-computed from every goal, assist and card entered." eyebrow="Stats" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Goals" value={l.totals.goals} icon={Goal} accent="teal" />
        <Stat label="Matches played" value={l.totals.matchesPlayed} />
        <Stat label="Hat-tricks" value={l.totals.hatTricks} accent="gold" />
        <Stat label="Red cards" value={l.totals.redCards} accent={l.totals.redCards ? "default" : "default"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankTable
          title="Golden Boot race"
          icon={Goal}
          valueLabel="Goals"
          rows={l.topScorers.map((s) => ({ key: s.player.id, cell: <PlayerCell player={s.player} />, value: s.goals }))}
        />
        <RankTable
          title="Top assists"
          icon={Handshake}
          valueLabel="Assists"
          rows={l.topAssisters.map((s) => ({ key: s.player.id, cell: <PlayerCell player={s.player} />, value: s.assists }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" /> Most goals scored (team)</CardTitle></CardHeader>
          <CardContent className="px-2 pt-0">
            <table className="w-full text-sm">
              <tbody>
                {l.teamGoals.map((t, i) => (
                  <tr key={t.team?.id ?? i} className="border-t">
                    <td className="py-2 pl-2 w-8 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="py-2">{t.team ? <TeamChip team={t.team} /> : "—"}</td>
                    <td className="px-2 text-right text-xs text-muted-foreground">{t.played} pld</td>
                    <td className="px-2 text-right font-mono font-semibold tabular-nums">{t.gf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldOff className="h-4 w-4 text-primary" /> Best defences (fewest conceded)</CardTitle></CardHeader>
          <CardContent className="px-2 pt-0">
            <table className="w-full text-sm">
              <tbody>
                {l.teamDefence.map((t, i) => (
                  <tr key={t.team?.id ?? i} className="border-t">
                    <td className="py-2 pl-2 w-8 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="py-2">{t.team ? <TeamChip team={t.team} /> : "—"}</td>
                    <td className="px-2 text-right text-xs text-muted-foreground">{t.played} pld</td>
                    <td className="px-2 text-right font-mono font-semibold tabular-nums">{t.ga}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-gold" /> Hat-tricks</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-0">
            {l.bestMatchHaul && (
              <p className="text-sm text-muted-foreground">
                Best single-match haul: <span className="font-medium text-foreground">{l.bestMatchHaul.player.name}</span> ({l.bestMatchHaul.goals} goals).
              </p>
            )}
            {l.hatTrickPlayers.length ? (
              <div className="flex flex-wrap gap-2">
                {l.hatTrickPlayers.map((h) => (
                  <Badge key={h.player.id} variant="gold" className="gap-1">
                    {h.player.name}{h.count > 1 ? ` ×${h.count}` : ""}
                  </Badge>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No hat-tricks yet.</p>}
          </CardContent>
        </Card>
        <RankTable
          title="Discipline (cards)"
          icon={ShieldOff}
          valueLabel="🟨 / 🟥"
          rows={l.discipline.map((d) => ({ key: d.player.id, cell: <PlayerCell player={d.player} />, value: `${d.yellow} / ${d.red}` }))}
        />
      </div>
    </div>
  );
}
