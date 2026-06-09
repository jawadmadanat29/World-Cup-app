import Link from "next/link";
import { Users, CalendarDays, ClipboardList, Calculator, ScrollText, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { recomputeAllAction } from "@/actions/admin-core";
import { PageHeader } from "@/components/domain/page-header";
import { Stat } from "@/components/domain/stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/admin/action-button";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const now = new Date();
  const [participants, totalMatches, completed, predictions, transactions, pendingResults, audit] = await Promise.all([
    prisma.participant.count(),
    prisma.match.count(),
    prisma.matchResult.count(),
    prisma.participantMatchPrediction.count(),
    prisma.pointTransaction.count(),
    prisma.match.count({ where: { kickoff: { lt: now }, result: { is: null }, homeTeamId: { not: null } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  const links = [
    { href: "/admin/results", label: "Enter results", icon: CalendarDays, desc: "Scores, scorers & cards. Auto-scores." },
    { href: "/admin/outcomes", label: "Outcomes & awards", icon: ClipboardList, desc: "Confirm winners; auto-suggested." },
    { href: "/admin/participants", label: "Participants", icon: Users, desc: "Manage accounts; reset if needed." },
    { href: "/admin/scoring", label: "Scoring settings", icon: Calculator, desc: "Tune every point value." },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin overview"
        description="Manage the league, enter results & predictions, and tune scoring."
        eyebrow="Control room"
        actions={
          <ActionButton action={recomputeAllAction} variant="outline" pendingLabel="Recalculating…">
            <Calculator className="h-4 w-4" /> Recalculate all scores
          </ActionButton>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Participants" value={participants} icon={Users} />
        <Stat label="Matches played" value={`${completed}/${totalMatches}`} icon={CalendarDays} />
        <Stat label="Match predictions" value={predictions} icon={ClipboardList} />
        <Stat label="Point transactions" value={transactions} icon={Calculator} accent="primary" />
      </div>

      {pendingResults > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm">
              <Badge variant="warning" className="mr-2">{pendingResults}</Badge>
              match{pendingResults === 1 ? "" : "es"} have kicked off but still need a result.
            </p>
            <Button asChild size="sm"><Link href="/admin/results">Enter results <ArrowRight className="h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} className="group">
              <Card className="h-full p-4 transition-colors group-hover:border-primary/50">
                <Icon className="mb-2 h-5 w-5 text-primary" />
                <p className="font-medium">{l.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{l.desc}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4" /> Recent activity</CardTitle>
          <Link href="/admin/audit" className="text-xs font-medium text-primary hover:underline">Full log</Link>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-0">
          {audit.length ? audit.map((a) => (
            <div key={a.id} className="flex items-center gap-3 text-sm">
              <Badge variant="muted" className="shrink-0">{a.action}</Badge>
              <span className="flex-1 truncate text-muted-foreground">{a.summary}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{a.createdAt.toLocaleString()}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground">No activity yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
