import type { Metadata } from "next";
import { getGroupsData } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { GroupTable } from "@/components/domain/group-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamLabel } from "@/components/domain/team-label";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Groups" };

export default async function GroupsPage() {
  const { groups, bestThirds } = await getGroupsData();

  return (
    <div className="space-y-6">
      <PageHeader title="Groups" description="Live group tables update automatically as results are entered." eyebrow="Group stage" />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Qualified (top 2)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" /> Best third-place</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Eliminated / pending</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => <GroupTable key={g.id} group={g} />)}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Best third-place ranking</CardTitle></CardHeader>
        <CardContent className="px-2 pt-0">
          {bestThirds.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pl-2 text-left font-medium">#</th>
                  <th className="text-left font-medium">Team</th>
                  <th className="px-1 text-center font-medium">Grp</th>
                  <th className="px-1 text-center font-medium">Pts</th>
                  <th className="px-1 text-center font-medium">GD</th>
                  <th className="px-2 text-center font-medium">GF</th>
                </tr>
              </thead>
              <tbody>
                {bestThirds.map((t) => (
                  <tr key={t.team.id} className={cn("border-l-2", t.qualified ? "border-l-gold" : "border-l-transparent opacity-60")}>
                    <td className="py-2 pl-2 tabular-nums text-muted-foreground">{t.rank}</td>
                    <td><TeamLabel name={t.team.name} iso={t.team.isoCode} showShort flagSize="sm" /></td>
                    <td className="px-1 text-center text-muted-foreground">{t.groupCode}</td>
                    <td className="px-1 text-center font-bold tabular-nums">{t.points}</td>
                    <td className="px-1 text-center tabular-nums">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                    <td className="px-2 text-center tabular-nums text-muted-foreground">{t.gf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Third-place ranking appears once groups complete.</p>
          )}
          <p className="px-2 py-2 text-xs text-muted-foreground">Top 8 third-placed teams (gold) advance to the Round of 32.</p>
        </CardContent>
      </Card>
    </div>
  );
}
