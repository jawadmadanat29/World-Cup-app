"use client";
import * as React from "react";
import { useTimeZone } from "@/components/providers/timezone-provider";
import { cn } from "@/lib/utils";

type Mode = "time" | "short" | "full";

function format(value: string | Date, tz: string, mode: Mode): { main: string; zone: string } {
  const date = typeof value === "string" ? new Date(value) : value;
  const opts: Intl.DateTimeFormatOptions = { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false };
  if (mode === "full") {
    opts.weekday = "short";
    opts.day = "numeric";
    opts.month = "short";
  } else if (mode === "short") {
    opts.day = "numeric";
    opts.month = "short";
  }
  const main = new Intl.DateTimeFormat("en-GB", opts).format(date);
  let zone = "";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", timeZoneName: "short" }).formatToParts(date);
    zone = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    /* zone abbrev is best-effort */
  }
  return { main, zone };
}

/**
 * Renders a kickoff instant in the viewer's selected timezone (see
 * TimeZoneProvider). `iso` accepts a Date or ISO string. The first render uses
 * the server-resolved zone so it matches SSR; it re-renders if the viewer
 * switches zones.
 */
export function KickoffTime({
  iso,
  mode = "time",
  showZone = true,
  className,
  zoneClassName,
}: {
  iso: string | Date;
  mode?: Mode;
  showZone?: boolean;
  className?: string;
  zoneClassName?: string;
}) {
  const { tz } = useTimeZone();
  const { main, zone } = format(iso, tz, mode);
  return (
    <span className={className} suppressHydrationWarning>
      {main}
      {showZone && zone && <span className={cn("text-muted-foreground", zoneClassName)}> {zone}</span>}
    </span>
  );
}
