"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditAction, auditedWrite } from "@/lib/audit";
import { ForbiddenError, requirePermission } from "@/lib/auth/context";
import { toDbDate } from "@/lib/date";
import {
  cambodianPhone,
  checkbox,
  dateOnlyField,
  invalid,
  optionalText,
  value,
  type ActionState,
} from "@/lib/form";

/**
 * Structural settings: the school itself, its academic years and terms, the
 * grade levels it runs and the subjects it teaches.
 *
 * Every mutation here goes through `auditedWrite`, so the change and its log
 * entry commit together or not at all. Nothing in this file writes to Prisma
 * outside that wrapper.
 */

function refresh() {
  // The settings pages are the only readers of this data that need to be
  // correct immediately; everything else picks it up on its next request.
  revalidatePath("/[locale]/settings", "layout");
}

// --- School ------------------------------------------------------------------

const schoolSchema = z.object({
  name: z.string().trim().min(1).max(200),
  nameKm: optionalText,
  address: optionalText,
  addressKm: optionalText,
  phone: cambodianPhone.optional(),
  email: z.email({ error: "invalidEmail" }).optional(),
  timezone: z.string().trim().min(1).max(64),
});

export async function saveSchool(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("school.write");

  const parsed = schoolSchema.safeParse({
    name: value(formData, "name"),
    nameKm: value(formData, "nameKm"),
    address: value(formData, "address"),
    addressKm: value(formData, "addressKm"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    timezone: value(formData, "timezone"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const before = await prisma.school.findUniqueOrThrow({
    where: { id: auth.schoolId },
  });

  await auditedWrite(
    {
      auth,
      action: AuditAction.UPDATE,
      entityType: "School",
      before,
      summary: before.name,
    },
    async (tx) => {
      const entity = await tx.school.update({
        where: { id: auth.schoolId },
        data: {
          ...parsed.data,
          phone: parsed.data.phone ?? null,
          email: parsed.data.email ?? null,
        },
      });
      return { entity, after: entity };
    },
  );

  refresh();
  return { ok: true };
}

// --- Academic years ----------------------------------------------------------

const yearSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(60),
    nameKm: optionalText,
    startDate: dateOnlyField,
    endDate: dateOnlyField,
    isCurrent: z.boolean(),
  })
  .refine((v) => v.startDate < v.endDate, {
    path: ["endDate"],
    error: "invalidDate",
  });

export async function saveAcademicYear(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("school.write");

  const parsed = yearSchema.safeParse({
    id: value(formData, "id"),
    name: value(formData, "name"),
    nameKm: value(formData, "nameKm"),
    startDate: value(formData, "startDate"),
    endDate: value(formData, "endDate"),
    isCurrent: checkbox(formData, "isCurrent"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id, isCurrent, startDate, endDate, ...rest } = parsed.data;

  const before = id
    ? await prisma.academicYear.findUniqueOrThrow({ where: { id } })
    : null;
  if (before && before.schoolId !== auth.schoolId) throw new ForbiddenError();

  const data = {
    ...rest,
    schoolId: auth.schoolId,
    startDate: toDbDate(startDate),
    endDate: toDbDate(endDate),
    isCurrent,
  };

  await auditedWrite(
    {
      auth,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "AcademicYear",
      before,
      summary: data.name,
    },
    async (tx) => {
      // Exactly one year can be current, and the switch has to happen inside
      // this transaction or a failure leaves the school with two — or none.
      if (isCurrent) {
        await tx.academicYear.updateMany({
          where: { schoolId: auth.schoolId, isCurrent: true, ...(id ? { NOT: { id } } : {}) },
          data: { isCurrent: false },
        });
      }

      const entity = id
        ? await tx.academicYear.update({ where: { id }, data })
        : await tx.academicYear.create({ data });

      return { entity, after: entity };
    },
  );

  refresh();
  return { ok: true };
}

// --- Terms -------------------------------------------------------------------

const termSchema = z
  .object({
    id: z.string().optional(),
    academicYearId: z.string().min(1),
    name: z.string().trim().min(1).max(60),
    nameKm: optionalText,
    ordinal: z.coerce.number().int().min(1).max(12),
    startDate: dateOnlyField,
    endDate: dateOnlyField,
  })
  .refine((v) => v.startDate < v.endDate, {
    path: ["endDate"],
    error: "invalidDate",
  });

export async function saveTerm(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("school.write");

  const parsed = termSchema.safeParse({
    id: value(formData, "id"),
    academicYearId: value(formData, "academicYearId"),
    name: value(formData, "name"),
    nameKm: value(formData, "nameKm"),
    ordinal: value(formData, "ordinal"),
    startDate: value(formData, "startDate"),
    endDate: value(formData, "endDate"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id, academicYearId, startDate, endDate, ...rest } = parsed.data;

  // The year must belong to this campus — otherwise a forged form field would
  // attach a term to another school's calendar.
  const year = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { schoolId: true, name: true },
  });
  if (!year || year.schoolId !== auth.schoolId) throw new ForbiddenError();

  const before = id ? await prisma.term.findUniqueOrThrow({ where: { id } }) : null;

  const data = {
    ...rest,
    academicYearId,
    startDate: toDbDate(startDate),
    endDate: toDbDate(endDate),
  };

  await auditedWrite(
    {
      auth,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Term",
      before,
      summary: `${year.name} · ${data.name}`,
    },
    async (tx) => {
      const entity = id
        ? await tx.term.update({ where: { id }, data })
        : await tx.term.create({ data });
      return { entity, after: entity };
    },
  );

  refresh();
  return { ok: true };
}

// --- Grade levels ------------------------------------------------------------

const gradeLevelSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  nameKm: optionalText,
  ordinal: z.coerce.number().int().min(0).max(20),
  isActive: z.boolean(),
});

export async function saveGradeLevel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("school.write");

  const parsed = gradeLevelSchema.safeParse({
    id: value(formData, "id"),
    name: value(formData, "name"),
    nameKm: value(formData, "nameKm"),
    ordinal: value(formData, "ordinal"),
    isActive: checkbox(formData, "isActive"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...rest } = parsed.data;

  const before = id
    ? await prisma.gradeLevel.findUniqueOrThrow({ where: { id } })
    : null;
  if (before && before.schoolId !== auth.schoolId) throw new ForbiddenError();

  const data = { ...rest, schoolId: auth.schoolId };

  await auditedWrite(
    {
      auth,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "GradeLevel",
      before,
      summary: data.name,
    },
    async (tx) => {
      const entity = id
        ? await tx.gradeLevel.update({ where: { id }, data })
        : await tx.gradeLevel.create({ data });
      return { entity, after: entity };
    },
  );

  refresh();
  return { ok: true };
}

// --- Subjects ----------------------------------------------------------------

const subjectSchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1).max(80),
  nameKm: optionalText,
  ordinal: z.coerce.number().int().min(0).max(99),
  isActive: z.boolean(),
});

export async function saveSubject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("school.write");

  const parsed = subjectSchema.safeParse({
    id: value(formData, "id"),
    code: value(formData, "code"),
    name: value(formData, "name"),
    nameKm: value(formData, "nameKm"),
    ordinal: value(formData, "ordinal") ?? "0",
    isActive: checkbox(formData, "isActive"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...rest } = parsed.data;

  const before = id ? await prisma.subject.findUniqueOrThrow({ where: { id } }) : null;
  if (before && before.schoolId !== auth.schoolId) throw new ForbiddenError();

  const clash = await prisma.subject.findFirst({
    where: {
      schoolId: auth.schoolId,
      code: rest.code,
      ...(id ? { NOT: { id } } : {}),
    },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { code: "error.duplicateCode" } };

  const data = { ...rest, schoolId: auth.schoolId };

  await auditedWrite(
    {
      auth,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Subject",
      before,
      summary: data.name,
    },
    async (tx) => {
      const entity = id
        ? await tx.subject.update({ where: { id }, data })
        : await tx.subject.create({ data });
      return { entity, after: entity };
    },
  );

  refresh();
  return { ok: true };
}
