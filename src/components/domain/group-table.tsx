import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TeamLabel } from "@/components/domain/team-label";
import { ScorePill } from "@/components/domain/score-pill";
import { formatKickoffShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GroupData } from "@/lib/queries";

const QUAL_STYLES: Record<string, { row: string; dot: string }> = {
  AUTO: { row: "border-l-2 border-l-primary", dot: "bg-primary" },
  BEST_THIRD: { row: "border-l-2 border-l-gold", dot: "bg-gold" },
  ELIMINATED: { row: "border-l-2 border-l-transparent opacity-60", dot: "bg-muted-foreground/40" },
  PENDING: { row: "border-l-2 border-l-transparent", dot: "bg-muted-foreground/40" },
};

export function GroupTable({ group }: { group: GroupData }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{group.name}</CardTitle>
        <Badge variant={group.complete ? "muted" : "teal"}>{group.complete ? "Final" : "In progress"}</Badge>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-1.5 pl-2 text-left font-medium">Team</th>
              <th className="px-1 text-center font-medium">P</th>
              <th className="px-1 text-center font-medium">W</th>
              <th className="px-1 text-center font-medium">D</th>
              <th className="px-1 text-center font-medium">L</th>
              <th className="hidden px-1 text-center font-medium sm:table-cell">GF</th>
              <th className="hidden px-1 text-center font-medium sm:table-cell">GA</th>
              <th className="px-1 text-center font-medium">GD</th>
              <th className="px-2 text-center font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {group.standings.map((r, i) => {
              const q = QUAL_STYLES[r.qualification];
              return (
                <tr key={r.team.id} className={cn("rounded", q.row)}>
                  <td className="py-2 pl-2">
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", q.dot)} />
                      <TeamLabel name={r.team.name} iso={r.team.isoCode} showShort flagSize="sm" />
                    </div>
                  </td>
                  <td className="px-1 text-center tabular-nums text-muted-foreground">{r.played}</td>
                  <td className="px-1 text-center tabular-nums">{r.won}</td>
                  <td className="px-1 text-center tabular-nums">{r.drawn}</td>
                  <td className="px-1 text-center tabular-nums">{r.lost}</td>
                  <td className="hidden px-1 text-center tabular-nums text-muted-foreground sm:table-cell">{r.gf}</td>
                  <td className="hidden px-1 text-center tabular-nums text-muted-foreground sm:table-cell">{r.ga}</td>
                  <td className="px-1 text-center tabular-nums">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="px-2 text-center font-bold tabular-nums">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <Accordion type="single" collapsible>
          <AccordionItem value="fixtures" className="border-b-0">
            <AccordionTrigger className="px-2 text-xs text-muted-foreground">Group fixtures ({group.fixtures.length})</AccordionTrigger>
            <AccordionContent className="px-2">
              <div className="space-y-1.5">
                {group.fixtures.map((f) => (
                  <div key={f.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                    <TeamLabel name={f.home?.name} iso={f.home?.isoCode} showShort flagSize="sm" className="justify-start" />
                    {f.result ? <ScorePill home={f.result.ftHome} away={f.result.ftAway} muted /> : (
                      <span className="text-center text-muted-foreground">{formatKickoffShort(f.kickoff)}</span>
                    )}
                    <TeamLabel name={f.away?.name} iso={f.away?.isoCode} showShort flagSize="sm" reverse className="justify-end" />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
