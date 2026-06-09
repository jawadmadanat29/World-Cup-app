import type { Metadata } from "next";
import Link from "next/link";
import {
  UserPlus, ListChecks, BarChart3, Trophy, CalendarDays, Lock, Sparkles, Eye, ArrowRight,
  Network, ListOrdered, Goal, Medal, ChevronRight,
} from "lucide-react";
import { getCurrentParticipantId } from "@/lib/auth";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  { icon: UserPlus, title: "Create your account", body: "Pick a name and password — that’s it. No email needed." , href: "/signup", cta: "Sign up" },
  { icon: ListChecks, title: "Make your predictions", body: "Fill in your one-time tournament prediction, then pick scores match by match.", href: "/predictions", cta: "My predictions" },
  { icon: BarChart3, title: "Climb the leaderboard", body: "Points land automatically as results come in. Compare with everyone.", href: "/leaderboard", cta: "Leaderboard" },
];

export default async function HowItWorksPage() {
  const loggedIn = !!(await getCurrentParticipantId());

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Welcome"
        title="Predict the World Cup 2026 with your friends"
        description="Make your calls, lock them in before kickoff, and climb the leaderboard across the whole tournament. Here’s everything you need to know."
        actions={
          loggedIn ? (
            <Button asChild><Link href="/predictions">Go to your predictions <ArrowRight className="h-4 w-4" /></Link></Button>
          ) : (
            <div className="flex gap-2">
              <Button asChild><Link href="/signup">Create account</Link></Button>
              <Button asChild variant="outline"><Link href="/login">Sign in</Link></Button>
            </div>
          )
        }
      />

      {/* 3 steps */}
      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <Card key={s.title} className="p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">{i + 1}</span>
              <s.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-semibold">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            <Link href={s.href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {s.cta} <ChevronRight className="h-4 w-4" />
            </Link>
          </Card>
        ))}
      </div>

      {/* The two prediction types */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Two ways to predict</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-5 w-5 text-gold" /> Tournament prediction <Badge variant="gold">once</Badge></CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Your big-picture call for the whole tournament — fill it in <b className="text-foreground">once</b> before it starts:</p>
              <ul className="space-y-1.5">
                <li className="flex gap-2"><ListOrdered className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Final order of all 12 groups</li>
                <li className="flex gap-2"><Network className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Who reaches the Round of 16, quarters, semis & final</li>
                <li className="flex gap-2"><Trophy className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Champion, runner-up, 3rd & 4th</li>
                <li className="flex gap-2"><Goal className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Best third-placed qualifiers + surprise/disappointment teams</li>
                <li className="flex gap-2"><Medal className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Top scorer, top assister & Player of the Tournament</li>
              </ul>
              <p className="rounded-md bg-secondary/50 px-3 py-2 text-foreground"><Lock className="mr-1 inline h-3.5 w-3.5" /> Locks when the opening match kicks off — set it before then.</p>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5 text-teal" /> Match predictions <Badge variant="teal">every matchday</Badge></CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>For <b className="text-foreground">each match</b>, predict the score — and optionally go deeper:</p>
              <ul className="space-y-1.5">
                <li className="flex gap-2"><Goal className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Exact score (the more precise, the more points)</li>
                <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> First & any-time goalscorers, assists, both-teams-to-score</li>
                <li className="flex gap-2"><ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Total goals / cards ranges, clean sheets</li>
                <li className="flex gap-2"><Trophy className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> Knockouts: who advances, extra time, penalties</li>
                <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> Play a <b className="text-foreground">wildcard</b> to double a match’s result points</li>
              </ul>
              <p className="rounded-md bg-secondary/50 px-3 py-2 text-foreground"><Lock className="mr-1 inline h-3.5 w-3.5" /> Each match locks at its kickoff — keep coming back through the tournament.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rules + scoring */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4 text-primary" /> Locking & fair play</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>You can edit a prediction freely until it locks. Watch the badges: <Badge variant="teal" className="mx-0.5">Open</Badge> → <Badge variant="warning" className="mx-0.5">Closing soon</Badge> → <Badge variant="destructive" className="mx-0.5">Locked</Badge>.</div>
            <p className="flex gap-2"><Eye className="mt-0.5 h-4 w-4 shrink-0" /> To keep it fair, <b className="text-foreground">everyone’s picks stay hidden until a match locks</b> — then they’re revealed for comparison.</p>
            <p>No edits after lock. Simple as that.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" /> How points work</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Correct result earns points; nailing the exact score earns more. Goalscorers, group finishes, bracket calls and awards all add up.</p>
            <p>Everything recalculates automatically as results come in.</p>
            <Link href="/scoring" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">See the full points guide <ChevronRight className="h-4 w-4" /></Link>
          </CardContent>
        </Card>
      </div>

      {/* Where to look */}
      <Card>
        <CardHeader><CardTitle className="text-base">Explore the league</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {[
            { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
            { href: "/leaders", label: "Golden Boot race", icon: Goal },
            { href: "/groups", label: "Group tables", icon: ListOrdered },
            { href: "/bracket", label: "Bracket", icon: Network },
            { href: "/fixtures", label: "Fixtures", icon: CalendarDays },
            { href: "/scoring", label: "Scoring", icon: Trophy },
          ].map((l) => (
            <Button key={l.href} asChild variant="outline" size="sm">
              <Link href={l.href}><l.icon className="h-4 w-4" /> {l.label}</Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      {!loggedIn && (
        <Card className="bg-primary/5">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-lg font-semibold">Ready to play?</p>
            <p className="text-sm text-muted-foreground">Create your account in seconds and lock in your predictions before kickoff.</p>
            <Button asChild size="lg"><Link href="/signup">Create my account <ArrowRight className="h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
