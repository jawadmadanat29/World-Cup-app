import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { buildRuleMap, ruleValue } from "@/lib/scoring/rules";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, ListOrdered, Network, Sparkles, Medal, Scale } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "How scoring works" };

export default async function ScoringPage() {
  const rules = buildRuleMap(await prisma.scoringRule.findMany());
  const v = (key: string) => ruleValue(rules, key);

  const summary = [
    { label: "Correct result", points: `+${v("MATCH_OUTCOME")}` },
    { label: "Exact score", points: `+${v("MATCH_EXACT")}` },
    { label: "Group winner", points: `+${v("GROUP_WINNER")}` },
    { label: "Reach a round", points: `+${v("GROUP_ADVANCE")}–${v("KO_PRE_FINAL")}` },
    { label: "Champion", points: `+${v("KO_PRE_CHAMPION")}` },
    { label: "Golden Boot", points: `+${v("AWARD_GOLDEN_BOOT")}` },
    { label: "Top Assister", points: `+${v("AWARD_TOP_ASSIST")}` },
  ];

  const Row = ({ label, points, note }: { label: string; points: number | string; note?: string }) => (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span>
        {label}
        {note && <span className="ml-1 text-xs text-muted-foreground">· {note}</span>}
      </span>
      <span className="font-mono font-semibold tabular-nums">{typeof points === "number" ? `+${points}` : points}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="How scoring works"
        description="Simple by design. Make the predictions football fans love making — the points follow."
        eyebrow="Points guide"
      />

      {/* 30-second version */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> The 30-second version</CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {summary.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-mono font-semibold tabular-nums">{s.points}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Match predictions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Every match</CardTitle>
            <p className="text-xs text-muted-foreground">Predict the score. The exact-score bonus stacks on top of the correct result.</p>
          </CardHeader>
          <CardContent className="divide-y pt-0">
            <Row label="Correct result (win / draw / loss)" points={v("MATCH_OUTCOME")} />
            <Row label="Exact score" points={v("MATCH_EXACT")} note="bonus on top of the result" />
            <Row label="First team to score" points={v("BONUS_FIRST_TO_SCORE")} />
            <Row label="Both teams to score" points={v("BONUS_BTTS")} />
            <Row label="Clean sheet" points={v("BONUS_CLEAN_SHEET")} />
            <Row label="Any-time goalscorer" points={v("BONUS_ANYTIME_SCORER")} note="pick one player" />
            <Row label="Knockout: correct team to advance" points={v("KO_ADVANCE")} note="extra time / penalties don't matter" />
          </CardContent>
        </Card>

        {/* Group stage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ListOrdered className="h-4 w-4 text-primary" /> Group stage</CardTitle>
            <p className="text-xs text-muted-foreground">Your predicted finishing order in each group.</p>
          </CardHeader>
          <CardContent className="divide-y pt-0">
            <Row label="Correct group winner" points={v("GROUP_WINNER")} />
            <Row label="Correct runner-up" points={v("GROUP_RUNNER_UP")} />
            <Row label="Correct third place" points={v("GROUP_THIRD")} />
            <Row label="Correct fourth place" points={v("GROUP_FOURTH")} />
            <Row label="Entire group correct" points={v("GROUP_EXACT_BONUS")} note="bonus" />
            <Row label="Each team you correctly send through" points={v("GROUP_ADVANCE")} />
            <Row label="Each correct best third-placed qualifier" points={v("GROUP_BEST_THIRD")} />
          </CardContent>
        </Card>

        {/* Tournament bracket */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Network className="h-4 w-4 text-primary" /> Tournament bracket</CardTitle>
            <p className="text-xs text-muted-foreground">Your one-time prediction of how far each team goes.</p>
          </CardHeader>
          <CardContent className="divide-y pt-0">
            <Row label="Reach the Round of 32" points={v("GROUP_ADVANCE")} note="scored via your group + best-third picks" />
            <Row label="Reach the Round of 16" points={v("KO_PRE_R16")} />
            <Row label="Reach the Quarter-finals" points={v("KO_PRE_QF")} />
            <Row label="Reach the Semi-finals" points={v("KO_PRE_SF")} />
            <Row label="Reach the Final (finalist)" points={v("KO_PRE_FINAL")} />
            <Row label="Champion" points={v("KO_PRE_CHAMPION")} />
          </CardContent>
        </Card>

        {/* Player awards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Medal className="h-4 w-4 text-primary" /> Player awards</CardTitle>
            <p className="text-xs text-muted-foreground">Two picks for the whole tournament.</p>
          </CardHeader>
          <CardContent className="divide-y pt-0">
            <Row label="Golden Boot (top scorer)" points={v("AWARD_GOLDEN_BOOT")} />
            <Row label="Top Assister" points={v("AWARD_TOP_ASSIST")} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-gold" /> Wildcards</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Each player gets {v("WILDCARDS_PER_PARTICIPANT")} wildcards for the whole tournament. Play one before a match
            locks to <b className="text-foreground">double your result points</b> (correct result + exact score) for that
            game. Bonus picks are never doubled.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scale className="h-4 w-4 text-primary" /> Ties on the leaderboard</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Level on points? We rank by, in order: most exact scores → most correct results → most correct knockout
            winners → most correct goalscorers → most correct award picks → earliest tournament prediction submitted →
            otherwise a shared position.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
