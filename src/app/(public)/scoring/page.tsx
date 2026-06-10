import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, ListOrdered, Network, Sparkles, Medal, Scale } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "How scoring works" };

const CATEGORY_META: Record<string, { title: string; blurb: string; icon: React.ComponentType<{ className?: string }> }> = {
  MATCH: { title: "Match predictions", blurb: "Per match. Get the result right, get more for the exact score. Exact score replaces the goal-difference and total-goals bonuses (no double-counting). Knockout extras score the advancing team, extra time and penalties.", icon: Target },
  GROUP: { title: "Group stage", blurb: "Your predicted finishing order in each group, plus correctly tipping who advances and the best third-placed qualifiers.", icon: ListOrdered },
  KNOCKOUT_PRE: { title: "Tournament bracket (one-time)", blurb: "Your one-time prediction of how far each team goes — Round of 16, quarter-finals, semis, the final, the champion and third place.", icon: Network },
  TOURNAMENT: { title: "Tournament specials", blurb: "Surprise team, biggest disappointment, highest-scoring & best defensive teams, and the final penalty-shootout call.", icon: Trophy },
  AWARD: { title: "Player awards", blurb: "Golden Boot, top assister, Player of the Tournament and the rest.", icon: Medal },
  KNOCKOUT_STAGE: { title: "Stage-by-stage knockout", blurb: "Optional per-round winner picks once the bracket is set.", icon: Network },
};

const CATEGORY_ORDER = ["MATCH", "GROUP", "KNOCKOUT_PRE", "TOURNAMENT", "AWARD", "KNOCKOUT_STAGE"];

export default async function ScoringPage() {
  const rules = await prisma.scoringRule.findMany({ orderBy: [{ category: "asc" }, { value: "desc" }] });
  const byCat = new Map<string, typeof rules>();
  for (const r of rules) {
    if (r.category === "SYSTEM") continue;
    (byCat.get(r.category) ?? byCat.set(r.category, []).get(r.category)!).push(r);
  }
  const cats = CATEGORY_ORDER.filter((c) => byCat.has(c));

  const val = (key: string) => rules.find((r) => r.key === key)?.value ?? 0;
  const SUMMARY = [
    { label: "Right result", points: val("MATCH_OUTCOME") },
    { label: "Exact score", points: val("MATCH_OUTCOME") + val("MATCH_EXACT") },
    { label: "Group winner", points: val("GROUP_WINNER") },
    { label: "Reach a round", points: `${val("KO_PRE_R16")}–${val("KO_PRE_FINAL")}` },
    { label: "Champion", points: val("KO_PRE_CHAMPION") },
    { label: "Golden Boot", points: val("AWARD_GOLDEN_BOOT") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="How scoring works"
        description="Every prediction earns points. These are the current values — they can be fine-tuned, and any change instantly recalculates the leaderboard."
        eyebrow="Points guide"
      />

      {/* 30-second summary (Phase 3.4) — the gist for a new player. */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> The 30-second version</CardTitle>
          <p className="text-xs text-muted-foreground">Right result <b className="text-foreground">+{val("MATCH_OUTCOME")}</b>, exact score <b className="text-foreground">+{val("MATCH_OUTCOME") + val("MATCH_EXACT")}</b>, nail your group finishes and how far teams go, pick the champion <b className="text-foreground">+{val("KO_PRE_CHAMPION")}</b> and the Golden Boot — plus a pile of fun bonuses. Full detail below.</p>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUMMARY.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-mono font-semibold tabular-nums">+{s.points}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> The basics (a match)</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Predict the score of each match. You earn:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><b className="text-foreground">Correct result</b> (win/draw/loss) — the base points.</li>
            <li><b className="text-foreground">Exact score</b> — a bigger bonus on top. This <i>replaces</i> the goal-difference and total-goals bonuses, so you’re never double-counted.</li>
            <li><b className="text-foreground">Close calls</b> — right goal difference, or right total goals, each earn a small bonus when the score isn’t exact.</li>
            <li>Optional extras: first scorer, any-time scorers, assists, both-teams-to-score, clean sheet, and a multi-goal scorer.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {cats.map((cat) => {
          const meta = CATEGORY_META[cat];
          const Icon = meta?.icon ?? Trophy;
          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> {meta?.title ?? cat}</CardTitle>
                {meta?.blurb && <p className="text-xs text-muted-foreground">{meta.blurb}</p>}
              </CardHeader>
              <CardContent className="divide-y pt-0">
                {byCat.get(cat)!.map((r) => (
                  <div key={r.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className={r.enabled ? "" : "text-muted-foreground line-through"}>{r.label}</span>
                    <span className="flex items-center gap-2">
                      {!r.enabled && <Badge variant="muted">off</Badge>}
                      <span className="font-mono font-semibold tabular-nums">{r.value > 0 ? `+${r.value}` : r.value}</span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-gold" /> Wildcards</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Each player gets a few wildcards for the whole tournament. Play one before a match locks to <b className="text-foreground">double your result points</b> (outcome + exact/goal-difference) for that game. Goalscorer, assist, card and award points are never doubled.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scale className="h-4 w-4 text-primary" /> Ties on the leaderboard</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Level on points? We rank by, in order: most exact scores → most correct results → most correct knockout winners → most correct goalscorers → most correct award picks → earliest tournament prediction submitted → otherwise a shared position.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
