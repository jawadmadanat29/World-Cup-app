// Edge-safe admin session token (HMAC-SHA256, Web Crypto only). Imported by
// both middleware (edge) and server code, so it must NOT touch next/headers.

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function createAdminToken(secret: string): Promise<string> {
  const payload = `admin.${Date.now() + TTL_MS}`;
  const payloadB64 = toBase64Url(encoder.encode(payload));
  const sig = await hmac(secret, payload);
  return `${payloadB64}.${sig}`;
}

export async function verifyAdminToken(secret: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;
  let payload: string;
  try {
    const norm = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    payload = atob(norm);
  } catch {
    return false;
  }
  const expected = await hmac(secret, payload);
  if (expected !== sig) return false;
  const [, expiryStr] = payload.split(".");
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  return true;
}

export const ADMIN_COOKIE = "wcp_admin";
export const USER_COOKIE = "wcp_user";

// Participant session token: payload `user.<participantId>.<expiry>`.
export async function createUserToken(secret: string, participantId: string): Promise<string> {
  const payload = `user.${participantId}.${Date.now() + TTL_MS}`;
  const payloadB64 = toBase64Url(encoder.encode(payload));
  const sig = await hmac(secret, payload);
  return `${payloadB64}.${sig}`;
}

/** Returns the participantId if the token is valid & unexpired, else null. */
export async function verifyUserToken(secret: string, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  let payload: string;
  try {
    payload = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
  const expected = await hmac(secret, payload);
  if (expected !== sig) return null;
  const [kind, participantId, expiryStr] = payload.split(".");
  if (kind !== "user" || !participantId) return null;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
  return participantId;
}
