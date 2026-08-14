import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth/context";


export const GUARDIAN_PAGE_SIZE = 30;

/** Substring matching, for the same reason student search uses it: Khmer has no
 *  word boundaries for a tokeniser to find. */
function searchWhere(q: string): Prisma.GuardianWhereInput {
  const term = q.trim();
  if (!term) return {};
  const contains = { contains: term, mode: "insensitive" as const };
  return {
    OR: [
      { name: contains },
      { nameKm: contains },
      { phone: contains },
      { phone2: contains },
      { email: contains },
      { students: { some: { student: { firstName: contains } } } },
      { students: { some: { student: { lastName: contains } } } },
      { students: { some: { student: { firstNameKm: contains } } } },
      { students: { some: { student: { lastNameKm: contains } } } },
    ],
  };
}

export async function listGuardians(
  auth: AuthContext,
  { q, page }: { q?: string; page: number },
) {
  const where: Prisma.GuardianWhereInput = {
    schoolId: auth.schoolId,
    isActive: true,
    ...searchWhere(q ?? ""),
  };

  const [total, guardians] = await Promise.all([
    prisma.guardian.count({ where }),
    prisma.guardian.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * GUARDIAN_PAGE_SIZE,
      take: GUARDIAN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        nameKm: true,
        phone: true,
        _count: { select: { students: true } },
      },
    }),
  ]);

  return { guardians, total };
}

export async function getGuardian(auth: AuthContext, id: string) {
  return prisma.guardian.findFirst({
    where: { id, schoolId: auth.schoolId },
    include: {
      students: {
        orderBy: [{ isPrimary: "desc" }],
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              firstName: true,
              lastName: true,
              firstNameKm: true,
              lastNameKm: true,
              photoKey: true,
              enrollments: {
                where: { status: "ENROLLED" },
                take: 1,
                select: { class: { select: { name: true, nameKm: true } } },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Students available to link, excluding the ones already linked. Only reachable
 * from a page that requires `guardians.write`, which is administrator-only, so
 * this is campus-wide by design.
 */
export async function linkableStudents(auth: AuthContext, guardianId: string) {
  return prisma.student.findMany({
    where: {
      schoolId: auth.schoolId,
      archivedAt: null,
      guardians: { none: { guardianId } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
    select: {
      id: true,
      studentCode: true,
      firstName: true,
      lastName: true,
      firstNameKm: true,
      lastNameKm: true,
    },
  });
}
