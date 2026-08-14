"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditAction, recordAudit } from "@/lib/audit";
import { DEFAULT_LOCALE, isLocale, type MessageKey } from "@/lib/i18n";
import {
  checkPasswordStrength,
  fakeVerify,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  createSession,
  clearSessionCookie,
  destroyAllSessions,
  destroySession,
  readSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { getAuth, requireAuth } from "@/lib/auth/context";
import { requestMeta } from "@/lib/audit";

/**
 * Sign-in has three jobs beyond checking the password: don't tell an attacker
 * which usernames exist, don't let them try forever, and leave a record either
 * way. All three are here rather than in the page.
 */

/** Lock the account after this many failures… */
const MAX_FAILED_ATTEMPTS = 8;
/** …for this long. Long enough to stop scripted guessing, short enough that a
 *  teacher who fat-fingered their password isn't locked out of the register. */
const LOCKOUT_MS = 15 * 60 * 1000;
/**
 * …counting only failures inside this window. Without it the counter is a
 * lifetime total, and a teacher who mistypes twice a term is eventually locked
 * out by their own history.
 */
const ATTEMPT_WINDOW_MS = 30 * 60 * 1000;

export type AuthFormState = {
  /** A message key, so the error is rendered in the reader's language. */
  error?: MessageKey;
  ok?: boolean;
};

/**
 * `FormData.get` returns `null` for a field that isn't in the form, and zod's
 * `.optional()` accepts `undefined` but not `null` — so reading an absent
 * optional field directly fails the whole parse. Every form read goes through
 * this.
 */
function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

const signInSchema = z.object({
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
  locale: z.string().optional(),
  next: z.string().optional(),
});

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    username: field(formData, "username"),
    password: field(formData, "password"),
    locale: field(formData, "locale"),
    next: field(formData, "next"),
  });

  if (!parsed.success) return { error: "auth.invalidCredentials" };

  const { username, password } = parsed.data;
  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : DEFAULT_LOCALE;

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
      failedLoginCount: true,
      lastFailedLoginAt: true,
      lockedUntil: true,
      mustChangePassword: true,
      locale: true,
      memberships: { select: { schoolId: true } },
    },
  });

  if (!user) {
    // Spend the same CPU as a real verification so the response time doesn't
    // reveal that this username is unknown.
    await fakeVerify(password);
    await recordAudit({
      action: AuditAction.LOGIN_FAILED,
      entityType: "User",
      summary: `unknown username: ${username}`,
    });
    return { error: "auth.invalidCredentials" };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordAudit({
      action: AuditAction.LOGIN_FAILED,
      entityType: "User",
      entityId: user.id,
      summary: "attempt while locked",
      schoolId: user.memberships[0]?.schoolId ?? null,
    });
    return { error: "auth.accountLocked" };
  }

  const valid = await verifyPassword(user.passwordHash, password);

  if (!valid) {
    const now = Date.now();
    // A lockout that has run its course, or a long gap since the last failure,
    // both start the count again — otherwise the very next mistake re-locks the
    // account immediately and forever.
    const lockExpired = Boolean(user.lockedUntil && user.lockedUntil.getTime() <= now);
    const stale =
      !user.lastFailedLoginAt ||
      now - user.lastFailedLoginAt.getTime() > ATTEMPT_WINDOW_MS;
    const failed = (lockExpired || stale ? 0 : user.failedLoginCount) + 1;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed,
        lastFailedLoginAt: new Date(now),
        lockedUntil:
          failed >= MAX_FAILED_ATTEMPTS ? new Date(now + LOCKOUT_MS) : null,
      },
    });
    await recordAudit({
      action: AuditAction.LOGIN_FAILED,
      entityType: "User",
      entityId: user.id,
      summary: `wrong password (${failed})`,
      schoolId: user.memberships[0]?.schoolId ?? null,
    });
    return {
      error:
        failed >= MAX_FAILED_ATTEMPTS
          ? "auth.accountLocked"
          : "auth.invalidCredentials",
    };
  }

  // A deactivated account is checked *after* the password, so the message
  // doesn't confirm a valid username to someone guessing.
  if (!user.isActive) {
    return { error: "auth.accountInactive" };
  }

  if (user.memberships.length === 0) {
    // No campus, nothing to show. Treat as inactive rather than crashing later.
    return { error: "auth.accountInactive" };
  }

  const meta = await requestMeta();
  const { token, expiresAt } = await createSession(user.id, meta);
  await setSessionCookie(token, expiresAt);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  await recordAudit({
    action: AuditAction.LOGIN,
    entityType: "User",
    entityId: user.id,
    actorUserId: user.id,
    schoolId: user.memberships[0]?.schoolId ?? null,
  });

  if (user.mustChangePassword) {
    redirect(`/${locale}/account/password`);
  }

  // Only same-origin relative paths — an open redirect here would be a phishing
  // gift, and this is the page people are trained to type a password into.
  const requested = parsed.data.next ?? "";
  const safeNext =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : null;

  redirect((safeNext ?? `/${locale}/dashboard`) as Route);
}

export async function signOut(locale: string) {
  const auth = await getAuth();
  const token = await readSessionToken();

  if (auth) {
    await recordAudit({
      action: AuditAction.LOGOUT,
      entityType: "User",
      entityId: auth.user.id,
      actorUserId: auth.user.id,
      schoolId: auth.schoolId,
    });
  }

  await destroySession(token);
  await clearSessionCookie();

  redirect(`/${isLocale(locale) ? locale : DEFAULT_LOCALE}/login`);
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(500),
    newPassword: z.string().min(1).max(500),
    confirmPassword: z.string().min(1).max(500),
    locale: z.string().optional(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
  });

export async function changePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const auth = await requireAuth();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: field(formData, "currentPassword"),
    newPassword: field(formData, "newPassword"),
    confirmPassword: field(formData, "confirmPassword"),
    locale: field(formData, "locale"),
  });

  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((i) =>
      i.path.includes("confirmPassword"),
    );
    return { error: mismatch ? "auth.passwordMismatch" : "error.generic" };
  }

  const { currentPassword, newPassword } = parsed.data;

  const problem = checkPasswordStrength(newPassword);
  if (problem === "tooShort") return { error: "auth.passwordTooShort" };
  if (problem === "tooCommon") return { error: "auth.passwordTooShort" };

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { passwordHash: true },
  });
  if (!user) return { error: "error.generic" };

  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    return { error: "auth.invalidCredentials" };
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
    },
  });

  await recordAudit({
    action: AuditAction.PASSWORD_CHANGE,
    entityType: "User",
    entityId: auth.user.id,
    actorUserId: auth.user.id,
    schoolId: auth.schoolId,
  });

  // Every other device is signed out — a password change is usually a response
  // to a device being lost, and leaving those sessions live defeats the point.
  await destroyAllSessions(auth.user.id);

  const meta = await requestMeta();
  const { token, expiresAt } = await createSession(auth.user.id, meta);
  await setSessionCookie(token, expiresAt);

  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : DEFAULT_LOCALE;
  redirect(`/${locale}/dashboard`);
}
