"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { FixtureCard } from "@/components/domain/fixture-card";
import { EmptyState } from "@/components/domain/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGES, STAGE_SHORT } from "@/lib/enums";
import { cn } from "@/lib/utils";
import type { FixtureRow } from "@/lib/queries";

const STAGE_FILTERS = [{ key: "ALL", label: "All" }, ...STAGES.map((s) => ({ key: s, label: STAGE_SHORT[s] }))];

export function FixturesView({ fixtures }: { fixtures: FixtureRow[] }) {
  const [stage, setStage] = React.useState("ALL");
  const [status, setStatus] = React.useState("ALL");
  const [group, setGroup] = React.useState("ALL");
  const [q, setQ] = React.useState("");

  const groups = React.useMemo(
    () => Array.from(new Set(fixtures.map((f) => f.groupCode).filter(Boolean))).sort() as string[],
    [fixtures],
  );

  const filtered = fixtures.filter((f) => {
    if (stage !== "ALL" && f.stage !== stage) return false;
    if (group !== "ALL" && f.groupCode !== group) return false;
    if (status === "COMPLETED" && !f.result) return false;
    if (status === "UPCOMING" && (f.result || f.lockState === "LOCKED")) return false;
    if (status === "LOCKED" && f.lockState !== "LOCKED") return false;
    if (q) {
      const hay = `${f.home?.name ?? ""} ${f.away?.name ?? ""} ${f.homePlaceholder ?? ""} ${f.awayPlaceholder ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Stage chips */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {STAGE_FILTERS.map((s) => (
          <button
            key={s.key}
            onClick={() => setStage(s.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              stage === s.key ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All status</SelectItem>
            <SelectItem value="UPCOMING">Open / upcoming</SelectItem>
            <SelectItem value="LOCKED">Locked</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
        {groups.length > 0 && (
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="sm:w-36"><SelectValue placeholder="Group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All groups</SelectItem>
              {groups.map((g) => <SelectItem key={g} value={g}>Group {g}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} match{filtered.length === 1 ? "" : "es"}</p>

      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => <FixtureCard key={f.id} f={f} />)}
        </div>
      ) : (
        <EmptyState title="No matches found" description="Try clearing a filter or searching a different team." />
      )}
    </div>
  );
}
