import { format, formatDistanceToNowStrict } from "date-fns";
import type { DecisiveScore } from "@/lib/enums";
import { TOURNAMENT_TZ, TOURNAMENT_TZ_LABEL } from "@/lib/matchday";

// Kickoffs are always shown in the fixed tournament timezone so SSR and client
// agree and the displayed time matches the schedule regardless of viewer locale.
const KICKOFF_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TOURNAMENT_TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
});
const KICKOFF_SHORT_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TOURNAMENT_TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
});

/** CSS class for a country flag via the bundled `flag-icons` set. */
export function flagClass(isoCode: string | null | undefined): string {
  if (!isoCode) return "fi fi-xx";
  return `fi fi-${isoCode.toLowerCase()}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatKickoff(date: Date): string {
  return `${KICKOFF_FMT.format(date)} ${TOURNAMENT_TZ_LABEL}`;
}

export function formatKickoffShort(date: Date): string {
  return KICKOFF_SHORT_FMT.format(date);
}

export function formatDate(date: Date): string {
  return format(date, "d MMM yyyy");
}

export function timeUntil(date: Date): string {
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function decisiveLabel(decisive: DecisiveScore | string | null | undefined): string {
  switch (decisive) {
    case "AET":
      return "After extra time";
    case "PENS":
      return "After penalties";
    case "FT":
    default:
      return "After 90 minutes";
  }
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function pts(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? "pt" : "pts"}`;
}

export function signedPts(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}
