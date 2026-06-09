"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, AlertTriangle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "@/components/domain/flag";
import { cn } from "@/lib/utils";
import type { TeamLite, KoTie, KoSlot } from "@/lib/queries";
import type { TournamentBuilderInput } from "@/actions/my-predictions";
import type { ActionResult } from "@/lib/action-result";

type Group = { id: string; code: string; name: string; teams: TeamLite[] };
type PlayerLite = { id: string; name: string; team: string };
type Existing = {
  orders: Record<string, string[]>;
  bestThirdTeamIds: string[];
  roundOf16TeamIds: string[];
  quarterfinalistTeamIds: string[];
  semifinalistTeamIds: string[];
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  goldenBootPlayerId: string | null;
  topAssistPlayerId: string | null;
};

const STEPS = ["Group finishes", "Best thirds", "Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final", "Top players", "Review"] as const;
const STEP_STAGE: Record<number, string> = { 2: "R32", 3: "R16", 4: "QF", 5: "SF", 6: "FINAL" };

// ---- pure bracket resolution -------------------------------------------------
interface Ctx {
  codeToGid: Record<string, string>;
  orders: Record<string, string[]>;
  validThirds: string[];
  tieByNum: Map<number, KoTie>;
}
function slotTeam(slot: KoSlot, ctx: Ctx, winners: Record<number, string>): string | null {
  switch (slot.kind) {
    case "GW": return ctx.orders[ctx.codeToGid[slot.group]]?.[0] ?? null;
    case "RU": return ctx.orders[ctx.codeToGid[slot.group]]?.[1] ?? null;
    case "THIRD": return ctx.validThirds[slot.index] ?? null;
    case "WIN": return winnerOf(slot.match, ctx, winners);
  }
}
function tieTeams(mn: number, ctx: Ctx, winners: Record<number, string>): { home: string | null; away: string | null } {
  const t = ctx.tieByNum.get(mn);
  if (!t) return { home: null, away: null };
  return { home: slotTeam(t.home, ctx, winners), away: slotTeam(t.away, ctx, winners) };
}
function winnerOf(mn: number, ctx: Ctx, winners: Record<number, string>): string | null {
  const { home, away } = tieTeams(mn, ctx, winners);
  const w = winners[mn];
  return w && (w === home || w === away) ? w : null;
}
function reconstruct(knockout: KoTie[], ctx: Ctx, existing: Existing): Record<number, string> {
  const w: Record<number, string> = {};
  const sets: Record<string, Set<string>> = {
    R32: new Set(existing.roundOf16TeamIds),
    R16: new Set(existing.quarterfinalistTeamIds),
    QF: new Set(existing.semifinalistTeamIds),
    SF: new Set([existing.championTeamId, existing.runnerUpTeamId].filter((x): x is string => !!x)),
    FINAL: new Set([existing.championTeamId].filter((x): x is string => !!x)),
  };
  for (const stage of ["R32", "R16", "QF", "SF", "FINAL"]) {
    for (const t of knockout.filter((k) => k.stage === stage)) {
      const home = slotTeam(t.home, ctx, w);
      const away = slotTeam(t.away, ctx, w);
      const set = sets[stage];
      if (home && set.has(home)) w[t.matchNumber] = home;
      else if (away && set.has(away)) w[t.matchNumber] = away;
    }
  }
  return w;
}

export function TournamentBuilder({
  groups, teams, knockout, players, existing, locked, action,
}: {
  groups: Group[];
  teams: TeamLite[];
  knockout: KoTie[];
  players: PlayerLite[];
  existing: Existing;
  locked: boolean;
  action: (input: TournamentBuilderInput) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [step, setStep] = React.useState(0);

  const teamMap = React.useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const codeToGid = React.useMemo(() => Object.fromEntries(groups.map((g) => [g.code, g.id])), [groups]);
  const tieByNum = React.useMemo(() => new Map(knockout.map((t) => [t.matchNumber, t])), [knockout]);

  const ordersInit = React.useMemo(() => {
    const o: Record<string, string[]> = {};
    for (const g of groups) o[g.id] = existing.orders[g.id]?.length === 4 ? existing.orders[g.id] : g.teams.map((t) => t.id);
    return o;
  }, [groups, existing.orders]);

  const [orders, setOrders] = React.useState<Record<string, string[]>>(ordersInit);
  const [bestThirds, setBestThirds] = React.useState<string[]>(existing.bestThirdTeamIds);
  const [goldenBoot, setGoldenBoot] = React.useState<string>(existing.goldenBootPlayerId ?? "");
  const [topAssist, setTopAssist] = React.useState<string>(existing.topAssistPlayerId ?? "");

  const thirdsPool = groups.map((g) => orders[g.id]?.[2]).filter(Boolean) as string[];
  const validThirds = bestThirds.filter((t) => thirdsPool.includes(t));
  const ctx: Ctx = { codeToGid, orders, validThirds, tieByNum };

  const [winners, setWinners] = React.useState<Record<number, string>>(() =>
    reconstruct(knockout, { codeToGid, orders: ordersInit, validThirds: existing.bestThirdTeamIds, tieByNum }, existing),
  );

  // Derived advancing sets (= what scoring uses).
  const wins = (stage: string) => knockout.filter((t) => t.stage === stage).map((t) => winnerOf(t.matchNumber, ctx, winners)).filter((x): x is string => !!x);
  const r32W = wins("R32");
  const r16W = wins("R16");
  const qfW = wins("QF");
  const sfW = wins("SF");
  const finalTie = knockout.find((t) => t.stage === "FINAL");
  const champion = finalTie ? winnerOf(finalTie.matchNumber, ctx, winners) : null;
  const runnerUp = sfW.find((t) => t !== champion) ?? null;

  const groupsComplete = groups.every((g) => { const o = orders[g.id] ?? []; return o.length === 4 && new Set(o).size === 4; });
  const checks = [
    { label: "Group finishes", done: groupsComplete },
    { label: "8 best thirds", done: validThirds.length === 8 },
    { label: "Round of 32 winners", done: r32W.length === 16 },
    { label: "Round of 16 winners", done: r16W.length === 8 },
    { label: "Quarter-final winners", done: qfW.length === 4 },
    { label: "Semi-final winners", done: sfW.length === 2 },
    { label: "Champion", done: !!champion },
    { label: "Top scorer & assist", done: !!goldenBoot && !!topAssist },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const pct = Math.round((doneCount / checks.length) * 100);
  const teamLabel = (id: string | null) => (id ? teamMap.get(id)?.name ?? "?" : "");

  function pick(mn: number, teamId: string) {
    setWinners((w) => ({ ...w, [mn]: w[mn] === teamId ? "" : teamId }));
  }

  function submit() {
    start(async () => {
      const res = await action({
        groupOrders: groups.map((g) => ({ groupId: g.id, order: orders[g.id] ?? [] })),
        bestThirdTeamIds: validThirds,
        roundOf16TeamIds: r32W,
        quarterfinalistTeamIds: r16W,
        semifinalistTeamIds: qfW,
        championTeamId: champion || undefined,
        runnerUpTeamId: runnerUp || undefined,
        goldenBootPlayerId: goldenBoot || undefined,
        topAssistPlayerId: topAssist || undefined,
      });
      if (res.ok) { toast.success(pct === 100 ? "Tournament locked in!" : "Saved — some picks still missing."); router.refresh(); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Tournament picks: {pct}% complete</span>
          <span className="tabular-nums text-muted-foreground">{doneCount}/{checks.length}</span>
        </div>
        <Progress value={pct} indicatorClassName={pct >= 100 ? "bg-primary" : "bg-gold"} />
      </Card>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              step === i ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="tabular-nums">{i + 1}</span> {s}
          </button>
        ))}
      </div>

      <div className="min-h-[220px]">
        {step === 0 && <GroupsStep groups={groups} orders={orders} setOrders={setOrders} teamMap={teamMap} />}
        {step === 1 && (
          <BestThirdsStep pool={thirdsPool.map((id) => teamMap.get(id)).filter((t): t is TeamLite => !!t)} selected={validThirds}
            onToggle={(id) => {
              const chosen = bestThirds.filter((t) => thirdsPool.includes(t));
              if (chosen.includes(id)) setBestThirds(chosen.filter((t) => t !== id));
              else if (chosen.length < 8) setBestThirds([...chosen, id]);
              else toast.error("Pick exactly 8 best thirds.");
            }} />
        )}
        {step >= 2 && step <= 6 && (
          <BracketRound
            stage={STEP_STAGE[step]}
            knockout={knockout}
            ctx={ctx}
            winners={winners}
            teamMap={teamMap}
            onPick={pick}
            isFinal={step === 6}
          />
        )}
        {step === 7 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Top players</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <PlayerPick label="Tournament top goalscorer (Golden Boot)" value={goldenBoot} onChange={setGoldenBoot} players={players} />
              <PlayerPick label="Tournament top assist provider" value={topAssist} onChange={setTopAssist} players={players} />
            </CardContent>
          </Card>
        )}
        {step === 8 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Review &amp; submit</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    {c.done ? <Check className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-gold" />}
                    <span className={c.done ? "" : "text-muted-foreground"}>{c.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{c.done ? "Done" : "Missing"}</span>
                  </li>
                ))}
              </ul>
              {champion && (
                <p className="rounded-md border bg-secondary/40 px-3 py-2 text-sm">
                  🏆 Champion: <b>{teamLabel(champion)}</b>
                  {runnerUp && <> · runner-up <b>{teamLabel(runnerUp)}</b></>}
                </p>
              )}
              {pct < 100 && <p className="text-xs text-muted-foreground">You can submit now and finish before the first kickoff — partial picks are saved.</p>}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="sm" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Next <ChevronRight className="h-4 w-4" /></Button>
        ) : (
          <Button size="sm" onClick={submit} disabled={pending || locked}>{pending ? "Saving…" : locked ? "Locked" : "Save tournament picks"}</Button>
        )}
      </div>
    </div>
  );
}

function GroupsStep({ groups, orders, setOrders, teamMap }: {
  groups: Group[];
  orders: Record<string, string[]>;
  setOrders: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  teamMap: Map<string, TeamLite>;
}) {
  const POS = ["1st", "2nd", "3rd", "4th"];
  const setSlot = (gid: string, i: number, teamId: string) =>
    setOrders((o) => ({ ...o, [gid]: (o[gid] ?? []).map((x, idx) => (idx === i ? teamId : x)) }));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => {
        const order = orders[g.id] ?? [];
        const dup = new Set(order).size !== order.length;
        return (
          <Card key={g.id}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{g.name}{dup && <span className="ml-2 text-xs font-normal text-gold">duplicate pick</span>}</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {order.map((teamId, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-xs font-medium text-muted-foreground">{POS[i]}</span>
                  <Select value={teamId} onValueChange={(v) => setSlot(g.id, i, v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {g.teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {teamMap.get(teamId) && <Flag iso={teamMap.get(teamId)!.isoCode} />}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function BestThirdsStep({ pool, selected, onToggle }: { pool: TeamLite[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Best third-placed teams</span>
          <span className={cn("text-xs font-medium", selected.length === 8 ? "text-primary" : "text-muted-foreground")}>{selected.length}/8</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">8 of the 12 third-placed teams advance to the Round of 32. (Rank your groups first to populate this.)</p>
      </CardHeader>
      <CardContent>
        {pool.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Finish ranking your groups to choose best thirds.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {pool.map((t) => {
              const on = selected.includes(t.id);
              return (
                <button key={t.id} onClick={() => onToggle(t.id)}
                  className={cn("flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors", on ? "border-primary bg-primary/10" : "hover:bg-secondary/60")}>
                  <Flag iso={t.isoCode} />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BracketRound({ stage, knockout, ctx, winners, teamMap, onPick, isFinal }: {
  stage: string; knockout: KoTie[]; ctx: Ctx; winners: Record<number, string>; teamMap: Map<string, TeamLite>; onPick: (mn: number, teamId: string) => void; isFinal: boolean;
}) {
  const ties = knockout.filter((t) => t.stage === stage).sort((a, b) => a.matchNumber - b.matchNumber);
  const picked = ties.filter((t) => winnerOf(t.matchNumber, ctx, winners)).length;

  function TeamRow({ mn, teamId, selected }: { mn: number; teamId: string | null; selected: boolean }) {
    const t = teamId ? teamMap.get(teamId) : null;
    return (
      <button
        disabled={!teamId}
        onClick={() => teamId && onPick(mn, teamId)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
          !teamId ? "cursor-not-allowed border-dashed text-muted-foreground" : selected ? "border-primary bg-primary/10 font-medium" : "hover:bg-secondary/60",
        )}
      >
        {t ? <Flag iso={t.isoCode} /> : <span className="h-3 w-4 rounded-[2px] bg-muted" />}
        <span className="min-w-0 flex-1 truncate">{t ? t.name : "TBD"}</span>
        {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">{isFinal && <Trophy className="h-4 w-4 text-gold" />}{isFinal ? "Pick the champion" : "Pick each winner"}</span>
          <span className={cn("text-xs font-medium", picked === ties.length ? "text-primary" : "text-muted-foreground")}>{picked}/{ties.length}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{isFinal ? "Your two finalists meet here — choose who lifts the trophy." : "Winners advance to the next round automatically."}</p>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-3", isFinal ? "max-w-sm" : "sm:grid-cols-2")}>
          {ties.map((t) => {
            const { home, away } = tieTeams(t.matchNumber, ctx, winners);
            const w = winnerOf(t.matchNumber, ctx, winners);
            return (
              <div key={t.matchNumber} className="space-y-1.5 rounded-lg border p-2">
                <TeamRow mn={t.matchNumber} teamId={home} selected={!!w && w === home} />
                <div className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">vs</div>
                <TeamRow mn={t.matchNumber} teamId={away} selected={!!w && w === away} />
              </div>
            );
          })}
        </div>
        {tieTeams(ties[0]?.matchNumber ?? -1, ctx, winners).home === null && (
          <p className="mt-3 text-center text-xs text-muted-foreground">Complete the previous round to reveal these matchups.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PlayerPick({ label, value, onChange, players }: { label: string; value: string; onChange: (v: string) => void; players: PlayerLite[] }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">—</option>
        {players.map((p) => <option key={p.id} value={p.id}>{p.team} · {p.name}</option>)}
      </select>
    </div>
  );
}
