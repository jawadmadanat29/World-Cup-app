"use client";
import * as React from "react";

function parts(ms: number) {
  const clamp = Math.max(0, ms);
  const d = Math.floor(clamp / 86400000);
  const h = Math.floor((clamp % 86400000) / 3600000);
  const m = Math.floor((clamp % 3600000) / 60000);
  const s = Math.floor((clamp % 60000) / 1000);
  return { d, h, m, s };
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="rounded-md bg-secondary px-3 py-2 font-mono text-xl font-bold tabular-nums sm:text-2xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

export function Countdown({ target }: { target: string }) {
  const targetMs = React.useMemo(() => new Date(target).getTime(), [target]);
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) {
    return <div className="h-[68px]" aria-hidden />;
  }
  const { d, h, m, s } = parts(targetMs - now);
  return (
    <div className="flex items-center gap-2 sm:gap-3" role="timer" aria-live="off">
      <Cell value={d} label="Days" />
      <Cell value={h} label="Hrs" />
      <Cell value={m} label="Min" />
      <Cell value={s} label="Sec" />
    </div>
  );
}
