"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditAction, auditedWrite } from "@/lib/audit";
import {
  ForbiddenError,
  requirePermission,
  requireStudentAccess,
} from "@/lib/auth/context";
import { toDbDate } from "@/lib/date";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  newPhotoKey,
  put,
  remove,
} from "@/lib/storage";
import {
  cambodianPhone,
  dateOnlyField,
  invalid,
  optionalText,
  value,
  type ActionState,
} from "@/lib/form";
import { Gender, StudentStatus } from "@/generated/prisma/enums";

const studentSchema = z.object({
  id: z.string().optional(),
  studentCode: z.string().trim().min(1).max(30),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  firstNameKm: optionalText,
  lastNameKm: optionalText,
  englishName: optionalText,
  dateOfBirth: dateOnlyField.optional(),
  gender: z.enum(Gender).optional(),
  status: z.enum(StudentStatus),
  enrollmentDate: dateOnlyField,
  address: optionalText,
  phone: cambodianPhone.optional(),
  emergencyNote: optionalText,
  medicalNote: optionalText,
  notes: optionalText,
  classId: z.string().optional(),
});

async function readPhoto(
  formData: FormData,
): Promise<{ key: string } | { error: "photoTooLarge" | "photoType" } | null> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.size > MAX_PHOTO_BYTES) return { error: "photoTooLarge" };
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) return { error: "photoType" };

  const key = newPhotoKey(file.type);
  await put(key, Buffer.from(await file.arrayBuffer()), file.type);
  return { key };
}

export async function saveStudent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("students.write");

  const parsed = studentSchema.safeParse({
    id: value(formData, "id"),
    studentCode: value(formData, "studentCode"),
    firstName: value(formData, "firstName"),
    lastName: value(formData, "lastName"),
    firstNameKm: value(formData, "firstNameKm"),
    lastNameKm: value(formData, "lastNameKm"),
    englishName: value(formData, "englishName"),
    dateOfBirth: value(formData, "dateOfBirth"),
    gender: value(formData, "gender"),
    status: value(formData, "status") ?? StudentStatus.ACTIVE,
    enrollmentDate: value(formData, "enrollmentDate"),
    address: value(formData, "address"),
    phone: value(formData, "phone"),
    emergencyNote: value(formData, "emergencyNote"),
    medicalNote: value(formData, "medicalNote"),
    notes: value(formData, "notes"),
    classId: value(formData, "classId"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id, classId, dateOfBirth, enrollmentDate, ...rest } = parsed.data;

  const before = id
    ? await prisma.student.findUniqueOrThrow({ where: { id } })
    : null;
  if (before && before.schoolId !== auth.schoolId) throw new ForbiddenError();

  const clash = await prisma.student.findFirst({
    where: {
      schoolId: auth.schoolId,
      studentCode: rest.studentCode,
      ...(id ? { NOT: { id } } : {}),
    },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { studentCode: "error.duplicateStudentCode" } };

  const photo = await readPhoto(formData);
  if (photo && "error" in photo) {
    return {
      fieldErrors: {
        photo: photo.error === "photoTooLarge" ? "error.photoTooLarge" : "error.photoType",
      },
    };
  }

  // The class must be on this campus — a forged form field would otherwise
  // enroll a child into another school's register.
  if (classId) {
    const klass = await prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true, academicYearId: true },
    });
    if (!klass || klass.schoolId !== auth.schoolId) throw new ForbiddenError();
  }

  const data = {
    ...rest,
    schoolId: auth.schoolId,
    dateOfBirth: dateOfBirth ? toDbDate(dateOfBirth) : null,
    enrollmentDate: toDbDate(enrollmentDate),
    phone: rest.phone ?? null,
    ...(photo ? { photoKey: photo.key } : {}),
  };

  const student = await auditedWrite(
    {
      auth,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Student",
      before,
      summary: `${data.lastName} ${data.firstName}`,
    },
    async (tx) => {
      const entity = id
        ? await tx.student.update({ where: { id }, data })
        : await tx.student.create({ data });

      if (classId) {
        const klass = await tx.class.findUniqueOrThrow({
          where: { id: classId },
          select: { academicYearId: true },
        });

        // One enrollment per student per class. Changing class ends the old
        // enrollment rather than rewriting it, so the child's history survives.
        const current = await tx.enrollment.findFirst({
          where: {
            studentId: entity.id,
            academicYearId: klass.academicYearId,
            status: "ENROLLED",
          },
        });

        if (current && current.classId !== classId) {
          await tx.enrollment.update({
            where: { id: current.id },
            data: { status: "TRANSFERRED_OUT", endDate: data.enrollmentDate },
          });
        }

        if (!current || current.classId !== classId) {
          await tx.enrollment.upsert({
            where: { studentId_classId: { studentId: entity.id, classId } },
            create: {
              studentId: entity.id,
              classId,
              academicYearId: klass.academicYearId,
              startDate: data.enrollmentDate,
              status: "ENROLLED",
            },
            update: { status: "ENROLLED", endDate: null },
          });
        }
      }

      return { entity, after: entity };
    },
  );

  // The old photograph is deleted only after the row pointing at it is gone.
  if (photo && before?.photoKey) await remove(before.photoKey);

  const locale = isLocale(value(formData, "locale"))
    ? value(formData, "locale")!
    : DEFAULT_LOCALE;

  revalidatePath(`/${locale}/students`);
  redirect(`/${locale}/students/${student.id}` as Route);
}

/**
 * Archive, not delete. A child's record is the school's evidence that they were
 * there; the register from three years ago has to still make sense.
 */
export async function archiveStudent(
  studentId: string,
  locale: string,
): Promise<void> {
  const auth = await requirePermission("students.write");
  await requireStudentAccess(auth, studentId);

  const before = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
  });

  await auditedWrite(
    {
      auth,
      action: before.archivedAt ? AuditAction.RESTORE : AuditAction.ARCHIVE,
      entityType: "Student",
      before,
      summary: `${before.lastName} ${before.firstName}`,
    },
    async (tx) => {
      const entity = await tx.student.update({
        where: { id: studentId },
        data: before.archivedAt
          ? { archivedAt: null, status: StudentStatus.ACTIVE }
          : { archivedAt: new Date(), status: StudentStatus.INACTIVE },
      });
      return { entity, after: entity };
    },
  );

  const safe = isLocale(locale) ? locale : DEFAULT_LOCALE;
  revalidatePath(`/${safe}/students`);
  redirect(`/${safe}/students/${studentId}` as Route);
}
