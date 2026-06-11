"use client";
import * as React from "react";

// Viewer-facing timezone preference. Kickoffs are stored as absolute instants;
// this only controls which wall-clock zone we render them in. Default is each
// viewer's own device zone ("local"), so friends in Brazil / Japan / Jordan all
// see correct local times with no setup. The choice is persisted in a cookie so
// the server can render directly in the chosen zone on the next request.

export type TzChoice = "local" | string; // "local" or an IANA zone id

const COOKIE_CHOICE = "tzChoice"; // what the user picked ("local" | IANA)
const COOKIE_RESOLVED = "tz"; // the concrete IANA zone we last resolved to
export const DEFAULT_TZ = "Asia/Amman";

export interface TzOption {
  id: TzChoice;
  label: string;
}

export const TZ_OPTIONS: TzOption[] = [
  { id: "local", label: "My local time" },
  { id: "Asia/Amman", label: "Jordan" },
  { id: "America/Sao_Paulo", label: "Brazil" },
  { id: "Asia/Tokyo", label: "Japan" },
  { id: "America/New_York", label: "US East" },
  { id: "Europe/London", label: "UK" },
];

function resolveZone(choice: TzChoice): string {
  if (choice === "local") {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
    } catch {
      return DEFAULT_TZ;
    }
  }
  return choice;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

interface Ctx {
  tz: string; // concrete IANA zone to format with
  choice: TzChoice; // the user's selection
  setChoice: (c: TzChoice) => void;
}

const TimeZoneContext = React.createContext<Ctx | null>(null);

export function TimeZoneProvider({
  children,
  initialTz,
  initialChoice,
}: {
  children: React.ReactNode;
  initialTz: string;
  initialChoice: TzChoice;
}) {
  const [choice, setChoiceState] = React.useState<TzChoice>(initialChoice);
  // Start from the server-resolved zone so the first client render matches SSR.
  const [tz, setTz] = React.useState<string>(initialTz);

  // After mount, resolve the real zone (handles "local", which the server can't
  // know) and remember it so the next SSR renders straight into this zone.
  React.useEffect(() => {
    const resolved = resolveZone(choice);
    setTz(resolved);
    writeCookie(COOKIE_RESOLVED, resolved);
  }, [choice]);

  const setChoice = React.useCallback((c: TzChoice) => {
    writeCookie(COOKIE_CHOICE, c);
    setChoiceState(c);
  }, []);

  const value = React.useMemo(() => ({ tz, choice, setChoice }), [tz, choice, setChoice]);
  return <TimeZoneContext.Provider value={value}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone(): Ctx {
  const ctx = React.useContext(TimeZoneContext);
  if (!ctx) return { tz: DEFAULT_TZ, choice: "Asia/Amman", setChoice: () => {} };
  return ctx;
}
