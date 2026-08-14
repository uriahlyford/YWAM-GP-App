"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditAction, auditedWrite, requestMeta } from "@/lib/audit";
import {
  ForbiddenError,
  requireClassAccess,
  requirePermission,
} from "@/lib/auth/context";
import { toDbDate } from "@/lib/date";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import {
  dateOnlyField,
  invalid,
  optionalText,
  value,
  type ActionState,
} from "@/lib/form";

const assessmentSchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  termId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  titleKm: optionalText,
  date: dateOnlyField,
  maxScore: z.coerce.number().positive().max(1000),
  weight: z.coerce.number().positive().max(20),
});

export async function saveAssessment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("grades.write");

  const parsed = assessmentSchema.safeParse({
    id: value(formData, "id"),
    classId: value(formData, "classId"),
    subjectId: value(formData, "subjectId"),
    termId: value(formData, "termId"),
    title: value(formData, "title"),
    titleKm: value(formData, "titleKm"),
    date: value(formData, "date"),
    maxScore: value(formData, "maxScore"),
    weight: value(formData, "weight") ?? "1",
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id, classId, subjectId, termId, date, ...rest } = parsed.data;

  await requireClassAccess(auth, classId);

  // Subject and term must belong to this campus, and the term to this class's
  // own academic year — otherwise a forged field files a mark against another
  // school's calendar.
  const [subject, term, klass] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: subjectId },
      select: { schoolId: true },
    }),
    prisma.term.findUnique({
      where: { id: termId },
      select: { academicYearId: true },
    }),
    prisma.class.findUniqueOrThrow({
      where: { id: classId },
      select: { academicYearId: true },
    }),
  ]);
  if (!subject || subject.schoolId !== auth.schoolId) throw new ForbiddenError();
  if (!term || term.academicYearId !== klass.academicYearId) {
    throw new ForbiddenError("term is not in this class's year");
  }

  const before = id
    ? await prisma.assessment.findUniqueOrThrow({ where: { id } })
    : null;
  if (before && before.schoolId !== auth.schoolId) throw new ForbiddenError();

  const data = {
    ...rest,
    classId,
    subjectId,
    termId,
    schoolId: auth.schoolId,
    date: toDbDate(date),
    createdByUserId: before?.createdByUserId ?? auth.user.id,
  };

  const assessment = await auditedWrite(
    {
      auth,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Assessment",
      before,
      summary: data.title,
    },
    async (tx) => {
      const entity = id
        ? await tx.assessment.update({ where: { id }, data })
        : await tx.assessment.create({ data });
      return { entity, after: entity };
    },
  );

  const locale = isLocale(value(formData, "locale"))
    ? value(formData, "locale")!
    : DEFAULT_LOCALE;

  revalidatePath(`/${locale}/grades`);
  redirect(`/${locale}/grades/assessment/${assessment.id}` as Route);
}

// --- Marks -------------------------------------------------------------------

const marksSchema = z.object({
  assessmentId: z.string().min(1),
  locale: z.string().optional(),
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        score: z.number().min(0).nullable(),
        comment: z.string().trim().max(500).nullable(),
      }),
    )
    .min(1)
    .max(500),
});

export type SaveMarksInput = z.input<typeof marksSchema>;
export type SaveMarksResult = ActionState & { changed?: number };

/**
 * Save an assessment's marks.
 *
 * Same two rules as the attendance register, for the same reason: only marks that
 * actually changed are written and audited, and the whole sheet commits or none
 * of it does. A grade is a claim about a child's work — every change to one needs
 * a name and a timestamp against it.
 */
export async function saveMarks(
  input: SaveMarksInput,
): Promise<SaveMarksResult> {
  const auth = await requirePermission("grades.write");

  const parsed = marksSchema.safeParse(input);
  if (!parsed.success) return { error: "error.generic" };

  const { assessmentId, entries } = parsed.data;

  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, schoolId: auth.schoolId },
    select: { id: true, classId: true, maxScore: true, title: true },
  });
  if (!assessment) throw new ForbiddenError("unknown assessment");

  await requireClassAccess(auth, assessment.classId);

  const max = Number(assessment.maxScore);

  // Only enrolled children can be marked, and no mark may exceed the maximum —
  // both checked here rather than only in the browser.
  const enrolled = await prisma.enrollment.findMany({
    where: { classId: assessment.classId, status: "ENROLLED" },
    select: {
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });
  const allowed = new Map(enrolled.map((row) => [row.studentId, row.student]));

  if (entries.some((entry) => !allowed.has(entry.studentId))) {
    throw new ForbiddenError("not in this class");
  }
  if (entries.some((entry) => entry.score !== null && entry.score > max)) {
    return { error: "grades.tooHigh" };
  }

  const meta = await requestMeta();

  const changed = await prisma.$transaction(async (tx) => {
    const existing = await tx.gradeRecord.findMany({
      where: { assessmentId },
      select: { id: true, studentId: true, score: true, comment: true },
    });
    const byStudent = new Map(existing.map((record) => [record.studentId, record]));

    let changes = 0;

    for (const entry of entries) {
      const before = byStudent.get(entry.studentId);
      const comment = entry.comment?.trim() || null;
      const beforeScore =
        before?.score === null || before?.score === undefined
          ? null
          : Number(before.score);

      const unchanged =
        before && beforeScore === entry.score && before.comment === comment;
      if (unchanged) continue;

      const record = await tx.gradeRecord.upsert({
        where: {
          assessmentId_studentId: { assessmentId, studentId: entry.studentId },
        },
        create: {
          assessmentId,
          studentId: entry.studentId,
          score: entry.score,
          comment,
          enteredByUserId: auth.user.id,
        },
        update: { score: entry.score, comment, enteredByUserId: auth.user.id },
        select: { id: true },
      });

      const student = allowed.get(entry.studentId)!;

      await tx.auditLog.create({
        data: {
          schoolId: auth.schoolId,
          actorUserId: auth.user.id,
          action: before ? AuditAction.UPDATE : AuditAction.CREATE,
          entityType: "GradeRecord",
          entityId: record.id,
          summary: `${student.lastName} ${student.firstName} · ${assessment.title}`,
          before: before ? { score: beforeScore, comment: before.comment } : undefined,
          after: { score: entry.score, comment },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      });

      changes += 1;
    }

    return changes;
  });

  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : DEFAULT_LOCALE;
  revalidatePath(`/${locale}/grades`);
  revalidatePath(`/${locale}/grades/assessment/${assessmentId}`);

  return { ok: true, changed };
}
