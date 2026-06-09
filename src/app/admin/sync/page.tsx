import Link from "next/link";
import { RefreshCw, CheckCircle2, XCircle, Clock, PlugZap, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/sync/provider";
import { runSyncAction } from "@/actions/admin-sync";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/domain/stat";
import { ActionButton } from "@/components/admin/action-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { variant: React.ComponentProps<typeof Badge>["variant"]; label: string }> = {
  OK: { variant: "default", label: "Healthy" },
  FAILED: { variant: "destructive", label: "Failed" },
  RUNNING: { variant: "warning", label: "Running" },
  NOT_CONFIGURED: { variant: "muted", label: "Not configured" },
  SKIPPED: { variant: "muted", label: "Idle" },
  NEVER: { variant: "muted", label: "Never run" },
};

export default async function AdminSyncPage() {
  const provider = getProvider();
  const [state, logs] = await Promise.all([
    prisma.syncState.findUnique({ where: { id: "default" } }),
    prisma.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const status = state?.status ?? "NEVER";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.NEVER;

  return (
    <div className="space-y-6">
      <PageHeader
        title="API sync"
        description="Pull live fixtures & results from the football data API. The API is only called here (and by the scheduler) — never per visitor — so it never affects load times or breaks the site."
        eyebrow="Live data"
        actions={
          <ActionButton action={runSyncAction} pendingLabel="Syncing…">
            <RefreshCw className="h-4 w-4" /> Sync now
          </ActionButton>
        }
      />

      {!provider.configured && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="font-medium">Running in manual mode (no API key).</p>
              <p className="text-muted-foreground">
                Set <code className="rounded bg-muted px-1">FOOTBALL_API_KEY</code> (API-Football / API-Sports) in your environment to enable live sync — optionally{" "}
                <code className="rounded bg-muted px-1">FOOTBALL_API_LEAGUE</code>, <code className="rounded bg-muted px-1">FOOTBALL_API_SEASON</code>. Everything keeps working without it; you just enter results manually.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Badge variant={badge.variant} className="gap-1.5">
          {status === "OK" ? <CheckCircle2 className="h-3.5 w-3.5" /> : status === "FAILED" ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {badge.label}
        </Badge>
        <span className="text-sm text-muted-foreground">Provider: {provider.name}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Last sync" value={state?.lastSyncAt ? state.lastSyncAt.toLocaleString() : "—"} icon={RefreshCw} />
        <Stat label="Last success" value={state?.lastSuccessAt ? state.lastSuccessAt.toLocaleString() : "—"} icon={CheckCircle2} />
        <Stat label="Quota remaining" value={state?.quotaRemaining != null ? `${state.quotaRemaining}${state.quotaLimit ? ` / ${state.quotaLimit}` : ""}` : "—"} />
        <Stat label="Next scheduled" value={state?.nextScheduledAt ? state.nextScheduledAt.toLocaleString() : "On cron"} icon={Clock} />
      </div>

      {state?.lastSummary && (
        <Card><CardContent className="p-4 text-sm">{state.lastSummary}</CardContent></Card>
      )}
      {state?.lastError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span className="break-words">{state.lastError}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Manual results always win: anything you enter in{" "}
          <Link href="/admin/results" className="text-primary hover:underline">Results</Link> is marked as a manual override and will <b>not</b> be overwritten by a sync. Unmatched teams (name differences) are reported in each sync summary and can be entered by hand.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent syncs</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {logs.length ? (
            <Table>
              <TableHeader>
                <TableRow><TableHead>When</TableHead><TableHead>Status</TableHead><TableHead>Summary</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{l.createdAt.toLocaleString()}</TableCell>
                    <TableCell><Badge variant={l.status === "OK" ? "default" : l.status === "FAILED" ? "destructive" : "muted"}>{l.status}</Badge></TableCell>
                    <TableCell className="text-sm">{l.error ? <span className="text-destructive">{l.error}</span> : l.summary}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No syncs yet. Hit “Sync now”.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
