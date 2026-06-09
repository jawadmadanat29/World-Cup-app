import "server-only";
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  ADMIN_COOKIE,
  USER_COOKIE,
  createAdminToken,
  verifyAdminToken,
  createUserToken,
  verifyUserToken,
} from "@/lib/auth-token";
import { prisma } from "@/lib/db";

function secret(): string {
  return process.env.AUTH_SECRET || "dev-only-change-me-to-a-long-random-string";
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt; Node runtime only — used in server actions)
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function normalizeLoginName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Participant sessions (open self-signup)
// ---------------------------------------------------------------------------

export async function startUserSession(participantId: string): Promise<void> {
  const token = await createUserToken(secret(), participantId);
  const store = await cookies();
  store.set(USER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endUserSession(): Promise<void> {
  const store = await cookies();
  store.delete(USER_COOKIE);
}

export async function getCurrentParticipantId(): Promise<string | null> {
  const store = await cookies();
  return verifyUserToken(secret(), store.get(USER_COOKIE)?.value);
}

export async function getCurrentParticipant() {
  const id = await getCurrentParticipantId();
  if (!id) return null;
  return prisma.participant.findUnique({
    where: { id },
    select: { id: true, name: true, nickname: true, initials: true, accentColor: true, avatarId: true, favoriteTeamId: true },
  });
}

export async function requireParticipant(): Promise<string> {
  const id = await getCurrentParticipantId();
  if (!id) throw new Error("Unauthorized: please sign in.");
  return id;
}

/** Constant-time-ish password check against the ADMIN_PASSWORD env var. */
export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "worldcup2026";
  if (password.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function startAdminSession(): Promise<void> {
  const token = await createAdminToken(secret());
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

/** Whether the current request carries a valid admin session. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  return verifyAdminToken(secret(), token);
}

/** Throw if not admin — used to guard server actions. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized: admin session required.");
  }
}
