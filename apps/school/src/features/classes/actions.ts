"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditAction, auditedWrite, recordAudit } from "@/lib/audit";
import {
  ForbiddenError,
  requireClassAccess,
  requirePermission,
} from "@/lib/auth/context";
import { today, toDbDate } from "@/lib/date";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import { checkbox, invalid, optionalText, value, type ActionState } from "@/lib/form";
import { ClassTeacherRole } from "@/generated/prisma/enums";

const classSchema = z.object({
  id: z.string().optional(),
  academicYearId: z.string().min(1),
  gradeLevelId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  nameKm: optionalText,
  room: optionalText,
  homeroomTeacherId: z.string().optional(),
  isActive: z.boolean(),
});

/** Both the year and the grade level must belong to the caller's campus. */
async function assertOwnership(
  schoolId: string,
  academicYearId: string,
  gradeLevelId: string,
) {
  const [year, level] = await Promise.all([
    prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { schoolId: true },
    }),
    prisma.gradeLevel.findUnique({
      where: { id: gradeLevelId },
      select: { schoolId: true },
    }),
  ]);
  if (!year || year.schoolId !== schoolId) throw new ForbiddenError();
  if (!level || level.schoolId !== schoolId) throw new ForbiddenError();
}

export async function saveClass(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("classes.write");

  const parsed = classSchema.safeParse({
    id: value(formData, "id"),
    academicYearId: value(formData, "academicYearId"),
    gradeLevelId: value(formData, "gradeLevelId"),
    name: value(formData, "name"),
    nameKm: value(formData, "nameKm"),
    room: value(formData, "room"),
    homeroomTeacherId: value(formData, "homeroomTeacherId"),
    isActive: checkbox(formData, "isActive"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id, homeroomTeacherId, ...rest } = parsed.data;

  await assertOwnership(auth.schoolId, rest.academicYearId, rest.gradeLevelId);

  const before = id ? await prisma.class.findUniqueOrThrow({ where: { id } }) : null;
  if (before && before.schoolId !== auth.schoolId) throw new ForbiddenError();

  if (homeroomTeacherId) {
    const teacher = await prisma.teacherProfile.findUnique({
      where: { id: homeroomTeacherId },
      select: { schoolId: true },
    });
    if (!teacher || teacher.schoolId !== auth.schoolId) throw new ForbiddenError();
  }

  // The database enforces this too, but a caught unique violation reads as a
  // server error rather than a message next to the field.
  const clash = await prisma.class.findFirst({
    where: {
      academicYearId: rest.academicYearId,
      name: rest.name,
      ...(id ? { NOT: { id } } : {}),
    },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { name: "error.classNameTaken" } };

  const data = {
    ...rest,
    schoolId: auth.schoolId,
    homeroomTeacherId: homeroomTeacherId ?? null,
  };

  const klass = await auditedWrite(
    {
      auth,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Class",
      before,
      summary: data.name,
    },
    async (tx) => {
      const entity = id
        ? await tx.class.update({ where: { id }, data })
        : await tx.class.create({ data });

      // The homeroom teacher is also a ClassTeacher row, because that join is
      // what every authorization check reads. Keeping the two in step here means
      // no query has to remember to check both.
      if (homeroomTeacherId) {
        await tx.classTeacher.deleteMany({
          where: { classId: entity.id, role: ClassTeacherRole.HOMEROOM },
        });
        await tx.classTeacher.create({
          data: {
            classId: entity.id,
            teacherId: homeroomTeacherId,
            role: ClassTeacherRole.HOMEROOM,
          },
        });
      } else {
        await tx.classTeacher.deleteMany({
          where: { classId: entity.id, role: ClassTeacherRole.HOMEROOM },
        });
      }

      return { entity, after: entity };
    },
  );

  const locale = isLocale(value(formData, "locale"))
    ? value(formData, "locale")!
    : DEFAULT_LOCALE;

  revalidatePath(`/${locale}/classes`);
  redirect(`/${locale}/classes/${klass.id}` as Route);
}

// --- Teacher assignment ------------------------------------------------------

const assignSchema = z.object({
  classId: z.string().min(1),
  teacherId: z.string().min(1),
  role: z.enum(ClassTeacherRole),
});

export async function assignTeacher(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("classes.write");

  const parsed = assignSchema.safeParse({
    classId: value(formData, "classId"),
    teacherId: value(formData, "teacherId"),
    role: value(formData, "role") ?? ClassTeacherRole.SUBJECT,
  });
  if (!parsed.success) return invalid(parsed.error);

  const { classId, teacherId, role } = parsed.data;
  await requireClassAccess(auth, classId);

  const teacher = await prisma.teacherProfile.findUnique({
    where: { id: teacherId },
    select: { schoolId: true, user: { select: { displayName: true } } },
  });
  if (!teacher || teacher.schoolId !== auth.schoolId) throw new ForbiddenError();

  await auditedWrite(
    {
      auth,
      action: AuditAction.CREATE,
      entityType: "ClassTeacher",
      summary: teacher.user.displayName,
    },
    async (tx) => {
      const entity = await tx.classTeacher.upsert({
        where: { classId_teacherId_role: { classId, teacherId, role } },
        create: { classId, teacherId, role },
        update: {},
      });

      if (role === ClassTeacherRole.HOMEROOM) {
        await tx.class.update({
          where: { id: classId },
          data: { homeroomTeacherId: teacherId },
        });
      }

      return { entity, after: entity };
    },
  );

  const locale = isLocale(value(formData, "locale"))
    ? value(formData, "locale")!
    : DEFAULT_LOCALE;
  revalidatePath(`/${locale}/classes/${classId}`);
  return { ok: true };
}

export async function removeTeacher(
  assignmentId: string,
  locale: string,
): Promise<void> {
  const auth = await requirePermission("classes.write");

  const assignment = await prisma.classTeacher.findUnique({
    where: { id: assignmentId },
    include: {
      class: { select: { id: true, schoolId: true, homeroomTeacherId: true } },
      teacher: { select: { id: true, user: { select: { displayName: true } } } },
    },
  });
  if (!assignment || assignment.class.schoolId !== auth.schoolId) {
    throw new ForbiddenError();
  }

  await auditedWrite(
    {
      auth,
      action: AuditAction.DELETE,
      entityType: "ClassTeacher",
      before: { teacherId: assignment.teacherId, role: assignment.role },
      summary: assignment.teacher.user.displayName,
    },
    async (tx) => {
      await tx.classTeacher.delete({ where: { id: assignmentId } });

      // Removing the homeroom assignment must also clear the shortcut column,
      // or the class keeps pointing at a teacher who is no longer attached.
      if (assignment.class.homeroomTeacherId === assignment.teacherId) {
        await tx.class.update({
          where: { id: assignment.class.id },
          data: { homeroomTeacherId: null },
        });
      }

      return { entity: { id: assignmentId }, after: null };
    },
  );

  const safe = isLocale(locale) ? locale : DEFAULT_LOCALE;
  revalidatePath(`/${safe}/classes/${assignment.class.id}`);
}

// --- Enrollment --------------------------------------------------------------

export async function enrollStudent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("classes.write");

  const classId = value(formData, "classId");
  const studentId = value(formData, "studentId");
  if (!classId || !studentId) return { error: "error.generic" };

  const [klass, student, school] = await Promise.all([
    prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true, academicYearId: true, name: true },
    }),
    prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, firstName: true, lastName: true },
    }),
    prisma.school.findUniqueOrThrow({
      where: { id: auth.schoolId },
      select: { timezone: true },
    }),
  ]);
  if (!klass || klass.schoolId !== auth.schoolId) throw new ForbiddenError();
  if (!student || student.schoolId !== auth.schoolId) throw new ForbiddenError();

  const startDate = toDbDate(today(school.timezone));

  await auditedWrite(
    {
      auth,
      action: AuditAction.CREATE,
      entityType: "Enrollment",
      summary: `${student.lastName} ${student.firstName} → ${klass.name}`,
    },
    async (tx) => {
      // A student sits in one class per academic year. Ending the previous
      // enrollment rather than editing it keeps the record of where they were.
      const existing = await tx.enrollment.findFirst({
        where: {
          studentId,
          academicYearId: klass.academicYearId,
          status: "ENROLLED",
          NOT: { classId },
        },
      });
      if (existing) {
        await tx.enrollment.update({
          where: { id: existing.id },
          data: { status: "TRANSFERRED_OUT", endDate: startDate },
        });
      }

      const entity = await tx.enrollment.upsert({
        where: { studentId_classId: { studentId, classId } },
        create: {
          studentId,
          classId,
          academicYearId: klass.academicYearId,
          startDate,
          status: "ENROLLED",
        },
        update: { status: "ENROLLED", endDate: null },
      });

      return { entity, after: entity };
    },
  );

  const locale = isLocale(value(formData, "locale"))
    ? value(formData, "locale")!
    : DEFAULT_LOCALE;
  revalidatePath(`/${locale}/classes/${classId}`);
  return { ok: true };
}

export async function unenrollStudent(
  enrollmentId: string,
  locale: string,
): Promise<void> {
  const auth = await requirePermission("classes.write");

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      class: { select: { id: true, schoolId: true, name: true } },
      student: { select: { firstName: true, lastName: true } },
    },
  });
  if (!enrollment || enrollment.class.schoolId !== auth.schoolId) {
    throw new ForbiddenError();
  }

  const school = await prisma.school.findUniqueOrThrow({
    where: { id: auth.schoolId },
    select: { timezone: true },
  });

  await auditedWrite(
    {
      auth,
      action: AuditAction.UPDATE,
      entityType: "Enrollment",
      before: { status: enrollment.status, endDate: enrollment.endDate },
      summary: `${enrollment.student.lastName} ${enrollment.student.firstName} ⇸ ${enrollment.class.name}`,
    },
    async (tx) => {
      // Withdrawn, not deleted: the attendance records against this enrollment
      // still have to make sense.
      const entity = await tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: "WITHDRAWN",
          endDate: toDbDate(today(school.timezone)),
        },
      });
      return { entity, after: entity };
    },
  );

  const safe = isLocale(locale) ? locale : DEFAULT_LOCALE;
  revalidatePath(`/${safe}/classes/${enrollment.class.id}`);
}

// --- Promotion ---------------------------------------------------------------

export async function promoteClass(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("classes.write");

  const fromClassId = value(formData, "fromClassId");
  const toClassId = value(formData, "toClassId");
  if (!fromClassId || !toClassId) return { error: "error.generic" };
  if (fromClassId === toClassId) return { fieldErrors: { toClassId: "error.sameClass" } };

  const [from, to, school] = await Promise.all([
    prisma.class.findUnique({
      where: { id: fromClassId },
      select: { schoolId: true, name: true },
    }),
    prisma.class.findUnique({
      where: { id: toClassId },
      select: { schoolId: true, name: true, academicYearId: true },
    }),
    prisma.school.findUniqueOrThrow({
      where: { id: auth.schoolId },
      select: { timezone: true },
    }),
  ]);
  if (!from || from.schoolId !== auth.schoolId) throw new ForbiddenError();
  if (!to || to.schoolId !== auth.schoolId) throw new ForbiddenError();

  const boundary = toDbDate(today(school.timezone));

  const moved = await prisma.$transaction(async (tx) => {
    const enrollments = await tx.enrollment.findMany({
      where: { classId: fromClassId, status: "ENROLLED" },
      select: { id: true, studentId: true },
    });

    for (const enrollment of enrollments) {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", endDate: boundary },
      });

      await tx.enrollment.upsert({
        where: {
          studentId_classId: { studentId: enrollment.studentId, classId: toClassId },
        },
        create: {
          studentId: enrollment.studentId,
          classId: toClassId,
          academicYearId: to.academicYearId,
          startDate: boundary,
          status: "ENROLLED",
        },
        update: { status: "ENROLLED", endDate: null },
      });
    }

    return enrollments.length;
  });

  // One entry for the whole move rather than one per child — this is a single
  // decision an administrator made, and a hundred rows would bury it.
  await recordAudit({
    action: AuditAction.UPDATE,
    entityType: "Enrollment",
    schoolId: auth.schoolId,
    actorUserId: auth.user.id,
    summary: `${from.name} → ${to.name}`,
    after: { promoted: moved, fromClassId, toClassId },
  });

  const locale = isLocale(value(formData, "locale"))
    ? value(formData, "locale")!
    : DEFAULT_LOCALE;
  revalidatePath(`/${locale}/classes/${fromClassId}`);
  revalidatePath(`/${locale}/classes/${toClassId}`);
  return { ok: true, createdId: String(moved) };
}
