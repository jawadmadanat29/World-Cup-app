import { UPCOMING_WINDOW_MS, type LockState } from "@/lib/enums";

export interface MatchLockInput {
  kickoff: Date;
  manualLock?: string | null; // LOCKED | OPEN | null
  hasResult: boolean;
  status?: string | null;
  /** @deprecated No longer used — matches lock at the exact kickoff. */
  lockBufferMinutes?: number | null;
}

/**
 * A match's lock state. Predictions stay editable right up to the exact kickoff
 * — there is no buffer. "Upcoming" is a display-only urgency flag (kickoff
 * within 24h) and never locks anything. Admin manual overrides still win, and a
 * completed match always shows as completed.
 *
 * The two numeric params are retained (ignored) for call-site compatibility with
 * the old buffer/closing-soon model.
 */
export function matchLockState(
  input: MatchLockInput,
  _legacyBufferMin: number = 0,
  _legacyClosingSoonMin: number = 0,
  now: Date = new Date(),
): LockState {
  if (input.hasResult || input.status === "COMPLETED") return "COMPLETED";
  if (input.manualLock === "LOCKED") return "LOCKED";
  if (input.manualLock === "OPEN") return "OPEN"; // admin forced open

  if (now >= input.kickoff) return "LOCKED";
  if (+input.kickoff - +now <= UPCOMING_WINDOW_MS) return "UPCOMING";
  return "OPEN";
}

/** A locked state means predictions can no longer be entered or edited. */
export function isLocked(state: LockState): boolean {
  return state === "LOCKED" || state === "COMPLETED";
}

export interface SectionLockInput {
  deadline?: Date | null;
  manualLocked?: boolean;
}

/** Lock state for a whole prediction section (tournament / group). */
export function sectionLockState(
  input: SectionLockInput,
  _legacyClosingSoonMin: number = 0,
  now: Date = new Date(),
): LockState {
  if (input.manualLocked) return "LOCKED";
  if (!input.deadline) return "OPEN";
  if (now >= input.deadline) return "LOCKED";
  return "OPEN";
}

export const LOCK_STATE_META: Record<LockState, { label: string; tone: "open" | "warn" | "locked" | "done" | "upcoming" }> = {
  OPEN: { label: "Open", tone: "open" },
  UPCOMING: { label: "Upcoming", tone: "upcoming" },
  LOCKED: { label: "Locked", tone: "locked" },
  COMPLETED: { label: "Completed", tone: "done" },
};

// ---------------------------------------------------------------------------
// Next-lock summary — powers the "Next lock: … in 6h 42m" countdown.
// ---------------------------------------------------------------------------

export interface LockableMatch {
  id: string;
  kickoff: Date;
  label: string; // e.g. "Mexico v South Africa"
  lockState: LockState;
}

export interface LockSummary {
  /** The soonest still-editable match (the next one to lock), or null. */
  next: { id: string; kickoff: string; label: string } | null;
  /** How many still-editable matches lock within the next 24h. */
  within24h: number;
}

export function lockSummary(matches: LockableMatch[], now: Date = new Date()): LockSummary {
  const open = matches
    .filter((m) => m.lockState === "OPEN" || m.lockState === "UPCOMING")
    .sort((a, b) => +a.kickoff - +b.kickoff);
  const next = open[0]
    ? { id: open[0].id, kickoff: open[0].kickoff.toISOString(), label: open[0].label }
    : null;
  const within24h = open.filter((m) => +m.kickoff - +now <= UPCOMING_WINDOW_MS).length;
  return { next, within24h };
}
