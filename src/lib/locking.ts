import { subMinutes } from "date-fns";
import type { LockState } from "@/lib/enums";

export interface MatchLockInput {
  kickoff: Date;
  manualLock?: string | null; // LOCKED | OPEN | null
  hasResult: boolean;
  status?: string | null;
  lockBufferMinutes?: number | null; // per-match override
}

/**
 * Resolve a match's lock state (section 7). Time-based by default — locks at
 * kickoff minus the configured buffer — but admin manual overrides win, and a
 * completed match is always shown as completed.
 */
export function matchLockState(
  input: MatchLockInput,
  globalBufferMin: number,
  closingSoonMin: number,
  now: Date = new Date(),
): LockState {
  if (input.hasResult || input.status === "COMPLETED") return "COMPLETED";
  if (input.manualLock === "LOCKED") return "LOCKED";

  const buffer = input.lockBufferMinutes ?? globalBufferMin;
  const lockAt = subMinutes(input.kickoff, buffer);

  if (input.manualLock === "OPEN") {
    // Admin forced open: never auto-lock, but still surface "closing soon".
    return now >= subMinutes(lockAt, closingSoonMin) ? "CLOSING_SOON" : "OPEN";
  }

  if (now >= lockAt) return "LOCKED";
  if (now >= subMinutes(lockAt, closingSoonMin)) return "CLOSING_SOON";
  return "OPEN";
}

export function isLocked(state: LockState): boolean {
  return state === "LOCKED" || state === "COMPLETED";
}

export interface SectionLockInput {
  deadline?: Date | null;
  manualLocked?: boolean;
}

/** Lock state for a whole prediction section (tournament / group / a KO round). */
export function sectionLockState(
  input: SectionLockInput,
  closingSoonMin: number,
  now: Date = new Date(),
): LockState {
  if (input.manualLocked) return "LOCKED";
  if (!input.deadline) return "OPEN";
  if (now >= input.deadline) return "LOCKED";
  if (now >= subMinutes(input.deadline, closingSoonMin)) return "CLOSING_SOON";
  return "OPEN";
}

export const LOCK_STATE_META: Record<LockState, { label: string; tone: "open" | "warn" | "locked" | "done" | "upcoming" }> = {
  UPCOMING: { label: "Upcoming", tone: "upcoming" },
  OPEN: { label: "Open", tone: "open" },
  CLOSING_SOON: { label: "Closing soon", tone: "warn" },
  LOCKED: { label: "Locked", tone: "locked" },
  COMPLETED: { label: "Completed", tone: "done" },
};
