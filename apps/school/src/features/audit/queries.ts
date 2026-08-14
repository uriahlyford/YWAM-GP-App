import "server-only";
import { prisma } from "@/lib/db";
import type { AuthContext } from "@/lib/auth/context";
import { AuditAction } from "@/generated/prisma/enums";

export const AUDIT_PAGE_SIZE = 40;

export type AuditFilters = {
  action?: AuditAction;
  entityType?: string;
  page: number;
};

/**
 * The log is scoped to the caller's campus. A super administrator sees entries
 * with no school attached too — a failed sign-in against an unknown username
 * belongs to no school, and that is exactly the entry worth seeing.
 */
export async function listAuditEntries(
  auth: AuthContext,
  filters: AuditFilters,
) {
  const where = {
    ...(auth.isSuperAdmin
      ? { OR: [{ schoolId: auth.schoolId }, { schoolId: null }] }
      : { schoolId: auth.schoolId }),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        before: true,
        after: true,
        ip: true,
        createdAt: true,
        actor: {
          select: { id: true, displayName: true, displayNameKm: true },
        },
      },
    }),
  ]);

  return { entries, total };
}

/** Distinct record types actually present, so the filter offers only real options. */
export async function auditEntityTypes(auth: AuthContext): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    where: auth.isSuperAdmin
      ? { OR: [{ schoolId: auth.schoolId }, { schoolId: null }] }
      : { schoolId: auth.schoolId },
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });
  return rows.map((r) => r.entityType);
}
