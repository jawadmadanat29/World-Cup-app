// Matchday = a single calendar day in the fixed tournament timezone (decision
// Q4). Everything here is pure + dependency-free: day boundaries are resolved
// with Intl in TOURNAMENT_TZ so SSR and client agree regardless of the runtime
// locale. No date-fns-tz needed.

export const TOURNAMENT_TZ = "America/New_York";
export const TOURNAMENT_TZ_LABEL = "ET"; // shown next to kickoff times

const KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TOURNAMENT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const LABEL_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TOURNAMENT_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TOURNAMENT_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Stable YYYY-MM-DD key for a kickoff, in the tournament timezone. */
export function dayKey(date: Date): string {
  return KEY_FMT.format(date); // en-CA → "2026-06-11"
}

/** Human label for a matchday, e.g. "Thu 11 Jun" (tournament timezone). */
export function dayLabel(date: Date): string {
  return LABEL_FMT.format(date);
}

/** Kickoff time of day, e.g. "16:00", in the tournament timezone. */
export function timeLabel(date: Date): string {
  return TIME_FMT.format(date);
}

export interface Matchday<T> {
  key: string;
  label: string;
  date: Date; // the earliest kickoff that day (for sorting / display)
  items: T[];
}

/** Group items by their kickoff calendar day, ordered chronologically. */
export function groupMatchdays<T>(items: T[], getKickoff: (item: T) => Date): Matchday<T>[] {
  const byKey = new Map<string, T[]>();
  for (const it of items) {
    const k = dayKey(getKickoff(it));
    const bucket = byKey.get(k);
    if (bucket) bucket.push(it);
    else byKey.set(k, [it]);
  }
  const days = [...byKey.entries()].map(([key, group]) => {
    const sorted = [...group].sort((a, b) => +getKickoff(a) - +getKickoff(b));
    return { key, label: dayLabel(getKickoff(sorted[0])), date: getKickoff(sorted[0]), items: sorted };
  });
  return days.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Progressive unlock (Q4): the current matchday is the earliest day that is not
 * yet fully locked. Once every match in a day has locked, the next day becomes
 * current. Returns null for an empty schedule; falls back to the last day when
 * the whole tournament is locked/finished.
 */
export function currentMatchdayKey<T>(days: Matchday<T>[], isItemLocked: (item: T) => boolean): string | null {
  if (days.length === 0) return null;
  for (const d of days) {
    if (d.items.some((it) => !isItemLocked(it))) return d.key;
  }
  return days[days.length - 1].key;
}
