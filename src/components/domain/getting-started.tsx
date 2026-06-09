"use client";
import * as React from "react";
import Link from "next/link";
import { Check, Circle, X, Sparkles, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const KEY = "wcp_gs_dismissed";

export function GettingStarted({ tournamentDone, groupsDone, predicted }: { tournamentDone: boolean; groupsDone: number; predicted: number }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    setShow(typeof window !== "undefined" && localStorage.getItem(KEY) !== "1");
  }, []);
  if (!show) return null;

  const steps = [
    { done: tournamentDone, label: "Set your one-time tournament prediction", href: "/predictions?mode=tournament&sub=tournament" },
    { done: groupsDone >= 12, label: `Rank the 12 groups (${groupsDone}/12 done)`, href: "/predictions?mode=tournament&sub=groups" },
    { done: predicted > 0, label: "Predict the opening matches", href: "/predictions?mode=match" },
  ];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-gold" /> Getting started</p>
          <button onClick={() => { localStorage.setItem(KEY, "1"); setShow(false); }} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-1.5">
          {steps.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-background/60">
                {s.done ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className={s.done ? "text-muted-foreground line-through" : "font-medium"}>{s.label}</span>
                {!s.done && <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 px-2 text-xs text-muted-foreground">
          New to this? <Link href="/how-it-works" className="font-medium text-primary hover:underline">How it works →</Link>
        </p>
      </CardContent>
    </Card>
  );
}
