"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload, FlaskConical, Trash2, RotateCcw, DatabaseBackup } from "lucide-react";
import { importTeamsJson, importFixturesJson, restoreBackup } from "@/actions/admin-data";
import { loadSampleResults, clearAllResults, resetAllPredictions } from "@/actions/admin-testing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ActionButton } from "@/components/admin/action-button";

const TEAM_TEMPLATE = `[
  { "name": "Brazil", "shortName": "BRA", "isoCode": "br", "confederation": "CONMEBOL" },
  { "name": "France", "shortName": "FRA", "isoCode": "fr", "confederation": "UEFA" }
]`;

const FIXTURE_TEMPLATE = `[
  { "matchNumber": 1, "kickoff": "2026-06-11T20:00:00", "homeShort": "MEX", "awayShort": "ITA", "venueName": "Estadio Azteca" },
  { "matchNumber": 2, "kickoff": "2026-06-11T17:00:00", "homeShort": "COL", "awayShort": "ALG" }
]`;

export function DataTools() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [teamsText, setTeamsText] = React.useState("");
  const [fixturesText, setFixturesText] = React.useState("");
  const [restoreText, setRestoreText] = React.useState("");

  function runImport(fn: (t: string) => Promise<{ ok: boolean; message: string }>, text: string, clear: () => void) {
    if (!text.trim()) { toast.error("Paste some JSON first."); return; }
    start(async () => {
      const res = await fn(text);
      if (res.ok) { toast.success(res.message); clear(); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Export & backup</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><a href="/api/export?type=all" download><Download className="h-4 w-4" /> Full backup (JSON)</a></Button>
          <Button asChild variant="outline"><a href="/api/export?type=leaderboard" download><Download className="h-4 w-4" /> Leaderboard (CSV)</a></Button>
          <Button asChild variant="outline"><a href="/api/export?type=scoring" download><Download className="h-4 w-4" /> Scoring breakdown (CSV)</a></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Import teams (JSON)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={teamsText} onChange={(e) => setTeamsText(e.target.value)} placeholder={TEAM_TEMPLATE} rows={6} className="font-mono text-xs" />
          <div className="flex justify-end">
            <Button onClick={() => runImport(importTeamsJson, teamsText, () => setTeamsText(""))} disabled={pending}><Upload className="h-4 w-4" /> Import teams</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Import / update fixtures (JSON)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={fixturesText} onChange={(e) => setFixturesText(e.target.value)} placeholder={FIXTURE_TEMPLATE} rows={6} className="font-mono text-xs" />
          <div className="flex justify-end">
            <Button onClick={() => runImport(importFixturesJson, fixturesText, () => setFixturesText(""))} disabled={pending}><Upload className="h-4 w-4" /> Update fixtures</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sample templates</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Accordion type="single" collapsible>
            <AccordionItem value="teams">
              <AccordionTrigger>Teams template</AccordionTrigger>
              <AccordionContent><pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{TEAM_TEMPLATE}</pre></AccordionContent>
            </AccordionItem>
            <AccordionItem value="fixtures" className="border-b-0">
              <AccordionTrigger>Fixtures template</AccordionTrigger>
              <AccordionContent><pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{FIXTURE_TEMPLATE}</pre></AccordionContent>
            </AccordionItem>
          </Accordion>
          <p className="mt-2 text-xs text-muted-foreground">
            Fixtures match on <code>matchNumber</code>; teams match on <code>shortName</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4 text-primary" /> Testing mode</CardTitle>
          <p className="text-sm text-muted-foreground">Rehearse before kickoff. Sample results never overwrite results you entered manually.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <ActionButton action={loadSampleResults} variant="outline" pendingLabel="Loading…"><FlaskConical className="h-4 w-4" /> Load sample results</ActionButton>
          <ActionButton action={clearAllResults} variant="outline" pendingLabel="Clearing…" confirm="Clear ALL results & events (predictions kept)?"><Trash2 className="h-4 w-4" /> Clear all results</ActionButton>
          <ActionButton action={resetAllPredictions} variant="outline" pendingLabel="Resetting…" confirm="Delete EVERYONE's predictions & wildcards? Accounts and results are kept."><RotateCcw className="h-4 w-4" /> Reset all predictions</ActionButton>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><DatabaseBackup className="h-4 w-4 text-destructive" /> Restore from backup</CardTitle>
          <p className="text-sm text-muted-foreground">Paste a “full backup” JSON to replace ALL data. Runs in one transaction — if the file is bad, nothing changes.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={restoreText} onChange={(e) => setRestoreText(e.target.value)} placeholder="Paste the contents of a wcp-backup-*.json file…" rows={5} className="font-mono text-xs" />
          <div className="flex justify-end">
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!restoreText.trim()) { toast.error("Paste a backup first."); return; }
                if (!window.confirm("Replace ALL current data with this backup? This cannot be undone.")) return;
                runImport(restoreBackup, restoreText, () => setRestoreText(""));
              }}
            >
              <DatabaseBackup className="h-4 w-4" /> Restore (replace everything)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Tip: download a fresh backup first. For a clean wipe, run <code>npm run db:reset</code> locally.</p>
        </CardContent>
      </Card>
    </div>
  );
}
