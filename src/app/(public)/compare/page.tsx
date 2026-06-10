import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, GitCompareArrows, Check, Equal } from "lucide-react";
import { getCurrentParticipantId } from "@/lib/auth";
import { getComparison, getParticipants } from "@/lib/queries";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import { EmptyState } from "@/components/domain/empty-state";
import { STAGE_SHORT } from "@/lib/enums";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare picks" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const viewerId = await getCurrentParticipantId();
  if (!viewerId) redirect("/login");
  const { with: rivalId } = await searchParams;

  if (!rivalId) return <Picker viewerId={viewerId} />;

  const data = await getComparison(viewerId, rivalId);
  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Compare picks" eyebrow="Head-to-head" />
        <EmptyState title="Can’t compare with that player" description="Pick someone else from your league." icon={GitCompareArrows} />
        <Link href="/compare" className="text-sm text-primary hover:underline">← Choose a player</Link>
      </div>
    );
  }
  const { viewer, rival, rivalRevealed, scalars, groups, matches, matchSummary } = data;

  return (
    <div className="space-y-6">
      <Link href="/compare" className="text-sm text-muted-foreground hover:text-foreground">← Compare with someone else</Link>

      <PageHeader title="Head-to-head" eyebrow="Compare picks" description="Where you agree, and where you’re betting against each other." />

      {/* Versus header */}
      <Card className="flex items-center justify-center gap-4 p-5 text-center sm:gap-8">
        <Side p={viewer} tag="You" />
        <span className="text-sm font-bold text-muted-foreground">vs</span>
        <Side p={rival} />
      </Card>

      {/* Tournament forecast */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Tournament forecast</CardTitle></CardHeader>
        <CardContent className="space-y-4 pt-1">
          {!rivalRevealed && (
            <p className="flex items-center gap-2 rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0 text-gold" />
              {rival.nickname || rival.name.split(" ")[0]}’s tournament picks stay hidden until the first kickoff. Yours are shown.
            </p>
          )}
          <div className="overflow-hidden rounded-lg border">
            <Row left="" mid="You" right={rival.nickname || rival.name.split(" ")[0]} header />
            {scalars.map((s) => (
              <Row
                key={s.key}
                left={s.label}
                mid={s.viewer ?? "—"}
                right={rivalRevealed ? (s.rival ?? "—") : "hidden"}
                rightMuted={!rivalRevealed}
                differ={rivalRevealed && !!s.viewer && !!s.rival && s.viewer !== s.rival}
                agree={rivalRevealed && !!s.viewer && s.viewer === s.rival}
              />
            ))}
          </div>

          {groups.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Group finishes</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {groups.map((g) => {
                  const vWin = g.viewer[0];
                  const rWin = g.rival?.[0] ?? null;
                  const differ = rivalRevealed && !!vWin && !!rWin && vWin !== rWin;
                  return (
                    <div key={g.name} className="rounded-md border p-2.5 text-xs">
                      <p className="mb-1 font-medium">{g.name}{differ && <Badge variant="warning" className="ml-2 font-normal">differ</Badge>}</p>
                      <p><span className="text-muted-foreground">You: </span>{g.viewer.map((t) => t ?? "?").join(" › ")}</p>
                      <p><span className="text-muted-foreground">{rival.nickname || rival.name.split(" ")[0]}: </span>{rivalRevealed ? (g.rival ?? []).map((t) => t ?? "?").join(" › ") || "—" : <span className="italic text-muted-foreground">hidden until kickoff</span>}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match predictions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Match predictions</CardTitle>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 text-teal"><Check className="h-3 w-3" />{matchSummary.agree} agree</span>
            <span className="inline-flex items-center gap-1 text-gold">{matchSummary.differ} differ</span>
          </span>
        </CardHeader>
        <CardContent className="pt-1">
          {matches.length === 0 ? (
            <EmptyState title="No match picks yet" description="Your match-by-match predictions will line up here." icon={GitCompareArrows} />
          ) : (
            <div className="divide-y">
              {matches.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                    {m.stage === "GROUP" && m.groupCode ? m.groupCode : STAGE_SHORT[m.stage as keyof typeof STAGE_SHORT]}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">{m.home ?? "?"} <span className="text-muted-foreground">v</span> {m.away ?? "?"}</span>
                  <span className="w-12 shrink-0 text-center font-mono font-semibold tabular-nums">{m.viewerScore}</span>
                  <span className="w-6 shrink-0 text-center">
                    {m.agree ? <Equal className="mx-auto h-3.5 w-3.5 text-teal" /> : <span className="text-muted-foreground">·</span>}
                  </span>
                  <span className={cn(
                    "w-16 shrink-0 text-center font-mono font-semibold tabular-nums",
                    m.rivalHidden && "text-muted-foreground",
                    !m.agree && m.rivalScore != null && "text-gold",
                    m.agree && "text-teal",
                  )}>
                    {m.rivalScore ?? (m.rivalHidden ? "🔒" : "—")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Side({ p, tag }: { p: { name: string; nickname: string | null; initials: string; accentColor: string; avatarId: string | null }; tag?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ParticipantAvatar initials={p.initials} color={p.accentColor} avatarId={p.avatarId} size="lg" />
      <span className="text-sm font-semibold">{p.nickname || p.name}</span>
      {tag && <Badge variant="default" className="text-[10px]">{tag}</Badge>}
    </div>
  );
}

function Row({
  left, mid, right, header = false, differ = false, agree = false, rightMuted = false,
}: {
  left: string; mid: string; right: string; header?: boolean; differ?: boolean; agree?: boolean; rightMuted?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-sm", header ? "border-b bg-secondary/30 text-xs font-medium uppercase tracking-wide text-muted-foreground" : "border-b last:border-b-0")}>
      <span className={header ? "" : "text-muted-foreground"}>{left}</span>
      <span className={cn("w-24 text-right font-medium", agree && !header && "text-teal", differ && !header && "text-foreground")}>{mid}</span>
      <span className={cn("w-24 text-right font-medium", agree && !header && "text-teal", differ && !header && "text-gold", rightMuted && "italic text-muted-foreground")}>{right}</span>
    </div>
  );
}

async function Picker({ viewerId }: { viewerId: string }) {
  const participants = (await getParticipants()).filter((p) => p.id !== viewerId);
  return (
    <div className="space-y-6">
      <PageHeader title="Compare picks" eyebrow="Head-to-head" description="Pick a rival to see where your predictions agree — and where you clash." />
      {participants.length === 0 ? (
        <EmptyState title="No one to compare with yet" description="Invite friends to join your league." icon={GitCompareArrows} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {participants.map((p) => (
            <Link key={p.id} href={`/compare?with=${p.id}`} className="group block">
              <Card className="flex items-center gap-3 p-4 transition-colors group-hover:border-primary/50">
                <ParticipantAvatar initials={p.initials} color={p.accentColor} avatarId={p.avatarId} size="md" />
                <span className="min-w-0 flex-1 truncate font-medium">{p.nickname || p.name}</span>
                <GitCompareArrows className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
