import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Sessions are rows, not JWTs. A JWT cannot be revoked before it expires, and
 * this application holds children's records — when a teacher's phone is lost,
 * an administrator has to be able to end that session immediately.
 *
 * The browser holds a random token; the database stores only its SHA-256. A
 * dump of the session table therefore contains nothing an attacker can present
 * as a cookie. (SHA-256 rather than argon2 is correct here: the token is 256
 * bits of entropy, so there is no dictionary to slow down, and session lookup
 * happens on every request.)
 */

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "sala_session";

/** Absolute lifetime. After this the user signs in again, whatever they do. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Idle timeout. A session untouched for this long is dead even if not expired. */
const IDLE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Don't write `lastSeenAt` on every page load; once an hour is enough. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

function sessionIdFrom(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  displayNameKm: string | null;
  locale: "EN" | "KM";
  mustChangePassword: boolean;
};

export type ValidatedSession = {
  sessionId: string;
  user: SessionUser;
  memberships: { schoolId: string; role: import("@/generated/prisma/enums").Role }[];
};

/**
 * Create a session and return the raw token. The token is returned exactly once
 * and never stored anywhere the server can read it back.
 */
export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      id: sessionIdFrom(token),
      userId,
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
    },
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Look up the session behind the current request's cookie. Returns null for
 * anything that isn't a live session — missing, unknown, expired, idle too long,
 * or belonging to a deactivated user.
 */
export async function validateSession(
  token: string | null,
): Promise<ValidatedSession | null> {
  if (!token) return null;

  const sessionId = sessionIdFrom(token);
  const row = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: { memberships: { select: { schoolId: true, role: true } } },
      },
    },
  });

  if (!row) return null;

  const now = Date.now();
  const expired = row.expiresAt.getTime() <= now;
  const idle = now - row.lastSeenAt.getTime() > IDLE_TTL_MS;

  if (expired || idle) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  if (!row.user.isActive) {
    await prisma.session.deleteMany({ where: { userId: row.userId } });
    return null;
  }

  if (now - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session
      .update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return {
    sessionId,
    user: {
      id: row.user.id,
      username: row.user.username,
      displayName: row.user.displayName,
      displayNameKm: row.user.displayNameKm,
      locale: row.user.locale,
      mustChangePassword: row.user.mustChangePassword,
    },
    memberships: row.user.memberships,
  };
}

export async function destroySession(token: string | null) {
  if (!token) return;
  await prisma.session
    .delete({ where: { id: sessionIdFrom(token) } })
    .catch(() => {});
}

/** Sign out everywhere — used when a password changes or an account is disabled. */
export async function destroyAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Constant-time comparison for anything else that has to match a secret, so a
 * future caller doesn't reach for `===`.
 */
export function safeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
