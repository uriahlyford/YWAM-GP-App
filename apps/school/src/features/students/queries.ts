import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { StudentStatus } from "@/generated/prisma/enums";
import { type AuthContext, scoped, visibleStudentWhere } from "@/lib/auth/context";

export const STUDENT_PAGE_SIZE = 30;

export type StudentFilters = {
  q?: string;
  classId?: string;
  status?: StudentStatus;
  page: number;
};

/**
 * Khmer is written without spaces between words, so Postgres full-text search
 * indexes a whole Khmer name as one token that no query reaches. `contains` is
 * a substring match, which is what Khmer needs, and the pg_trgm GIN indexes in
 * the first migration are what stop it from being a sequential scan.
 *
 * `mode: "insensitive"` matters only for the Latin columns — Khmer has no case —
 * but applying it uniformly keeps the query one shape.
 */
function searchWhere(q: string): Prisma.StudentWhereInput {
  const term = q.trim();
  if (!term) return {};
  const contains = { contains: term, mode: "insensitive" as const };
  return {
    OR: [
      { firstName: contains },
      { lastName: contains },
      { firstNameKm: contains },
      { lastNameKm: contains },
      { englishName: contains },
      { studentCode: contains },
      { guardians: { some: { guardian: { name: contains } } } },
      { guardians: { some: { guardian: { nameKm: contains } } } },
      { guardians: { some: { guardian: { phone: contains } } } },
    ],
  };
}

export async function listStudents(auth: AuthContext, filters: StudentFilters) {
  const scope = await visibleStudentWhere(auth);

  // Composed with AND, never spread. The class filter comes from the URL and
  // sets `enrollments`, which is the very key a teacher's scope uses — a spread
  // would let `?class=<someone else's class>` overwrite the restriction and
  // list that class's children.
  const where: Prisma.StudentWhereInput = scoped<Prisma.StudentWhereInput>(
    scope,
    { archivedAt: null },
    ...(filters.status ? [{ status: filters.status }] : []),
    ...(filters.classId
      ? [{ enrollments: { some: { classId: filters.classId, status: "ENROLLED" as const } } }]
      : []),
    searchWhere(filters.q ?? ""),
  );

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (filters.page - 1) * STUDENT_PAGE_SIZE,
      take: STUDENT_PAGE_SIZE,
      select: {
        id: true,
        studentCode: true,
        firstName: true,
        lastName: true,
        firstNameKm: true,
        lastNameKm: true,
        englishName: true,
        gender: true,
        status: true,
        photoKey: true,
        enrollments: {
          where: { status: "ENROLLED" },
          select: {
            class: { select: { id: true, name: true, nameKm: true } },
          },
          take: 1,
        },
      },
    }),
  ]);

  return { students, total };
}

/** Full profile. Returns null rather than throwing when out of scope, so the
 *  page can render a plain not-found instead of confirming the record exists. */
export async function getStudent(auth: AuthContext, id: string) {
  const scope = await visibleStudentWhere(auth);

  return prisma.student.findFirst({
    where: scoped(scope, { id }),
    include: {
      guardians: {
        include: { guardian: true },
        orderBy: [{ isPrimary: "desc" }],
      },
      enrollments: {
        orderBy: { startDate: "desc" },
        include: {
          class: {
            select: {
              id: true,
              name: true,
              nameKm: true,
              gradeLevel: { select: { name: true, nameKm: true } },
              academicYear: { select: { id: true, name: true, isCurrent: true } },
            },
          },
        },
      },
    },
  });
}

/** Classes the caller may enroll a student into, for the form's dropdown. */
export async function enrollableClasses(auth: AuthContext) {
  return prisma.class.findMany({
    where: { schoolId: auth.schoolId, isActive: true },
    orderBy: [{ academicYear: { startDate: "desc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nameKm: true,
      academicYear: { select: { name: true, isCurrent: true } },
    },
  });
}

/**
 * The next free student code, as `S1234`. Suggested rather than enforced — a
 * school that already numbers its students keeps its own scheme.
 */
export async function suggestStudentCode(auth: AuthContext): Promise<string> {
  const latest = await prisma.student.findFirst({
    where: { schoolId: auth.schoolId, studentCode: { startsWith: "S" } },
    orderBy: { studentCode: "desc" },
    select: { studentCode: true },
  });

  const digits = Number(latest?.studentCode.replace(/\D/g, "") ?? 0);
  return `S${Number.isFinite(digits) && digits > 0 ? digits + 1 : 1001}`;
}
