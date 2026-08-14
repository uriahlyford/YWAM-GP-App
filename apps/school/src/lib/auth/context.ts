import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { readSessionToken, validateSession, type SessionUser } from "./session";

/**
 * The data access layer.
 *
 * Every page and every mutation resolves its permissions here, against the
 * database, on the server. Nothing is trusted from the proxy, the client, or a
 * hidden form field. The rule this file exists to enforce: a teacher can reach
 * the children in their own classes and no others.
 */

export const ACTIVE_SCHOOL_COOKIE = "sala_school";

export type AuthContext = {
  user: SessionUser;
  memberships: { schoolId: string; role: Role }[];
  /** The campus this request is acting within. */
  schoolId: string;
  /** The user's role at that campus. */
  role: Role;
  isSuperAdmin: boolean;
};

/** Cached for the lifetime of one request, so a page with six guarded sections
 *  makes one session query, not six. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const session = await validateSession(await readSessionToken());
  if (!session) return null;

  const { memberships } = session;
  if (memberships.length === 0) return null;

  const isSuperAdmin = memberships.some((m) => m.role === Role.SUPER_ADMIN);

  const requested = (await cookies()).get(ACTIVE_SCHOOL_COOKIE)?.value;
  const active =
    memberships.find((m) => m.schoolId === requested) ?? memberships[0];

  return {
    user: session.user,
    memberships,
    schoolId: active.schoolId,
    role: active.role,
    isSuperAdmin,
  };
});

export async function currentLocale(): Promise<Locale> {
  const value = (await headers()).get("x-locale");
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

async function currentPath(): Promise<string> {
  return (await headers()).get("x-pathname") ?? "/";
}

/** Redirects to sign-in rather than returning null. Use this in every page. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) {
    const locale = await currentLocale();
    const next = encodeURIComponent(await currentPath());
    redirect(`/${locale}/login?next=${next}`);
  }
  return auth;
}

// --- Permissions -------------------------------------------------------------

/**
 * What each role may do, in one table rather than scattered through the pages.
 *
 * Note where SCHOOL_ADMIN stops: it runs the school but cannot create users or
 * change system-level settings, and it cannot see another campus.
 */
const PERMISSIONS = {
  "students.read": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER],
  "students.write": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN],
  "guardians.read": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER],
  "guardians.write": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN],
  "teachers.read": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER],
  "teachers.write": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN],
  "classes.read": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER],
  "classes.write": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN],
  "attendance.read": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER],
  "attendance.write": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER],
  "grades.read": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER],
  "grades.write": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER],
  "reports.read": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER],
  "school.read": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER],
  "school.write": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN],
  "audit.read": [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN],
  "users.write": [Role.SUPER_ADMIN],
  "settings.system": [Role.SUPER_ADMIN],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(auth: AuthContext, permission: Permission): boolean {
  if (auth.isSuperAdmin) return true;
  return (PERMISSIONS[permission] as readonly Role[]).includes(auth.role);
}

/** Thrown by the require* helpers. Server actions turn it into a message; pages
 *  let it reach the error boundary. */
export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requirePermission(
  permission: Permission,
): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!can(auth, permission)) throw new ForbiddenError(permission);
  return auth;
}

/** Guard a row that carries a schoolId against the caller's active campus. */
export function assertSameSchool(auth: AuthContext, schoolId: string) {
  if (auth.isSuperAdmin) return;
  if (schoolId !== auth.schoolId) throw new ForbiddenError("wrong school");
}

// --- Class-level scoping -----------------------------------------------------

/** The classes a teacher is attached to, as homeroom or subject teacher. */
export const teacherClassIds = cache(
  async (auth: AuthContext): Promise<string[]> => {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: auth.user.id },
      select: {
        classAssignments: { select: { classId: true } },
        homeroomClasses: { select: { id: true } },
      },
    });
    if (!profile) return [];
    return [
      ...new Set([
        ...profile.classAssignments.map((a) => a.classId),
        ...profile.homeroomClasses.map((c) => c.id),
      ]),
    ];
  },
);

/**
 * Combine an access scope with additional conditions.
 *
 * Always use this rather than an object spread. `{ ...scope, id }` looks
 * equivalent and is not: the caller's `id` silently replaces the scope's own
 * `id` constraint, which removes the restriction entirely and hands a teacher
 * any class in the school. `AND` cannot be overwritten by a later key.
 */
export function scoped<T extends object>(scope: T, ...extra: T[]): { AND: T[] } {
  return { AND: [scope, ...extra] };
}

/**
 * A `where` fragment restricting Class queries to what the caller may see.
 * Administrators see the whole campus; a teacher sees their own classes.
 */
export async function visibleClassWhere(
  auth: AuthContext,
): Promise<Prisma.ClassWhereInput> {
  if (can(auth, "classes.write")) {
    return { schoolId: auth.schoolId };
  }
  const ids = await teacherClassIds(auth);
  return { schoolId: auth.schoolId, id: { in: ids } };
}

/**
 * A `where` fragment restricting Student queries. This is the one that matters:
 * a teacher may only reach children enrolled in a class they teach.
 */
export async function visibleStudentWhere(
  auth: AuthContext,
): Promise<Prisma.StudentWhereInput> {
  if (can(auth, "students.write")) {
    return { schoolId: auth.schoolId };
  }
  const ids = await teacherClassIds(auth);
  return {
    schoolId: auth.schoolId,
    enrollments: { some: { classId: { in: ids }, status: "ENROLLED" } },
  };
}

/** Throws unless the caller may act on this specific class. */
export async function requireClassAccess(
  auth: AuthContext,
  classId: string,
): Promise<void> {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, schoolId: true },
  });
  if (!klass) throw new ForbiddenError("unknown class");
  assertSameSchool(auth, klass.schoolId);

  if (can(auth, "classes.write")) return;

  const ids = await teacherClassIds(auth);
  if (!ids.includes(classId)) throw new ForbiddenError("not your class");
}

/** Throws unless the caller may act on this specific student. */
export async function requireStudentAccess(
  auth: AuthContext,
  studentId: string,
): Promise<void> {
  const where = await visibleStudentWhere(auth);
  const found = await prisma.student.findFirst({
    where: scoped(where, { id: studentId }),
    select: { id: true },
  });
  if (!found) throw new ForbiddenError("not your student");
}
