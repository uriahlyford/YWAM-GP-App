"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditAction, auditedWrite } from "@/lib/audit";
import { ForbiddenError, requirePermission } from "@/lib/auth/context";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import {
  cambodianPhone,
  checkbox,
  invalid,
  optionalText,
  value,
  type ActionState,
} from "@/lib/form";
import { GuardianRelationship, Locale } from "@/generated/prisma/enums";

const guardianSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  nameKm: optionalText,
  phone: cambodianPhone,
  phone2: cambodianPhone.optional(),
  email: z.email({ error: "invalidEmail" }).optional(),
  occupation: optionalText,
  address: optionalText,
  preferredLocale: z.enum(Locale),
  notes: optionalText,
});

export async function saveGuardian(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("guardians.write");

  const parsed = guardianSchema.safeParse({
    id: value(formData, "id"),
    name: value(formData, "name"),
    nameKm: value(formData, "nameKm"),
    phone: value(formData, "phone"),
    phone2: value(formData, "phone2"),
    email: value(formData, "email"),
    occupation: value(formData, "occupation"),
    address: value(formData, "address"),
    preferredLocale: value(formData, "preferredLocale") ?? Locale.KM,
    notes: value(formData, "notes"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...rest } = parsed.data;

  const before = id
    ? await prisma.guardian.findUniqueOrThrow({ where: { id } })
    : null;
  if (before && before.schoolId !== auth.schoolId) throw new ForbiddenError();

  const data = {
    ...rest,
    schoolId: auth.schoolId,
    phone2: rest.phone2 ?? null,
    email: rest.email ?? null,
  };

  const guardian = await auditedWrite(
    {
      auth,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Guardian",
      before,
      summary: data.name,
    },
    async (tx) => {
      const entity = id
        ? await tx.guardian.update({ where: { id }, data })
        : await tx.guardian.create({ data });
      return { entity, after: entity };
    },
  );

  const locale = isLocale(value(formData, "locale"))
    ? value(formData, "locale")!
    : DEFAULT_LOCALE;

  revalidatePath(`/${locale}/parents`);
  redirect(`/${locale}/parents/${guardian.id}` as Route);
}

const linkSchema = z.object({
  guardianId: z.string().min(1),
  studentId: z.string().min(1),
  relationship: z.enum(GuardianRelationship),
  isPrimary: z.boolean(),
  isEmergencyContact: z.boolean(),
  canPickUp: z.boolean(),
});

/**
 * Link a child to a guardian. A student may have several guardians and a
 * guardian several children, so this writes the join row rather than a field on
 * either side.
 */
export async function linkStudentToGuardian(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("guardians.write");

  const parsed = linkSchema.safeParse({
    guardianId: value(formData, "guardianId"),
    studentId: value(formData, "studentId"),
    relationship: value(formData, "relationship"),
    isPrimary: checkbox(formData, "isPrimary"),
    isEmergencyContact: checkbox(formData, "isEmergencyContact"),
    canPickUp: checkbox(formData, "canPickUp"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { guardianId, studentId, ...flags } = parsed.data;

  // Both ends must belong to this campus.
  const [guardian, student] = await Promise.all([
    prisma.guardian.findUnique({
      where: { id: guardianId },
      select: { schoolId: true, name: true },
    }),
    prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, firstName: true, lastName: true },
    }),
  ]);
  if (!guardian || guardian.schoolId !== auth.schoolId) throw new ForbiddenError();
  if (!student || student.schoolId !== auth.schoolId) throw new ForbiddenError();

  await auditedWrite(
    {
      auth,
      action: AuditAction.CREATE,
      entityType: "StudentGuardian",
      summary: `${student.lastName} ${student.firstName} → ${guardian.name}`,
    },
    async (tx) => {
      // Only one main contact per child, and the switch belongs in the same
      // transaction as the link that caused it.
      if (flags.isPrimary) {
        await tx.studentGuardian.updateMany({
          where: { studentId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const entity = await tx.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId, guardianId } },
        create: { studentId, guardianId, ...flags },
        update: flags,
      });
      return { entity, after: entity };
    },
  );

  const locale = isLocale(value(formData, "locale"))
    ? value(formData, "locale")!
    : DEFAULT_LOCALE;

  revalidatePath(`/${locale}/parents/${guardianId}`);
  revalidatePath(`/${locale}/students/${studentId}`);
  return { ok: true };
}

export async function unlinkStudentFromGuardian(
  linkId: string,
  locale: string,
): Promise<void> {
  const auth = await requirePermission("guardians.write");

  const link = await prisma.studentGuardian.findUnique({
    where: { id: linkId },
    include: {
      guardian: { select: { schoolId: true, name: true, id: true } },
      student: { select: { firstName: true, lastName: true, id: true } },
    },
  });
  if (!link || link.guardian.schoolId !== auth.schoolId) throw new ForbiddenError();

  await auditedWrite(
    {
      auth,
      action: AuditAction.DELETE,
      entityType: "StudentGuardian",
      before: { studentId: link.studentId, guardianId: link.guardianId },
      summary: `${link.student.lastName} ${link.student.firstName} ⇸ ${link.guardian.name}`,
    },
    async (tx) => {
      await tx.studentGuardian.delete({ where: { id: linkId } });
      return { entity: { id: linkId }, after: null };
    },
  );

  const safe = isLocale(locale) ? locale : DEFAULT_LOCALE;
  revalidatePath(`/${safe}/parents/${link.guardian.id}`);
  revalidatePath(`/${safe}/students/${link.student.id}`);
}
