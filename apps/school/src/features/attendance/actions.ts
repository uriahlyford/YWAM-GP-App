"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditAction, requestMeta } from "@/lib/audit";
import { ForbiddenError, requireClassAccess, requirePermission } from "@/lib/auth/context";
import { isDateOnly, toDbDate, type DateOnly } from "@/lib/date";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import type { ActionState } from "@/lib/form";
import { AttendanceStatus } from "@/generated/prisma/enums";

/**
 * Saving a register.
 *
 * Two rules the school depends on:
 *
 *  1. Nothing is overwritten silently. Every record whose status, lateness or
 *     note actually changed gets its own audit entry naming the child and both
 *     values, so "who changed Dara from Present to Absent, and when" has an
 *     answer years later. Records that did not change write nothing — a register
 *     confirmed unchanged should not produce thirty log lines.
 *
 *  2. The whole register commits or none of it does. A teacher who loses signal
 *     halfway through saving must not end up with a half-marked class.
 */

const entrySchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(AttendanceStatus),
  minutesLate: z.number().int().min(0).max(600).nullable(),
  note: z.string().trim().max(500).nullable(),
});

const registerSchema = z.object({
  classId: z.string().min(1),
  date: z.string().refine(isDateOnly),
  locale: z.string().optional(),
  entries: z.array(entrySchema).min(1).max(500),
});

export type SaveRegisterInput = z.input<typeof registerSchema>;

export type SaveRegisterResult = ActionState & {
  /** How many records the save actually changed, for the confirmation message. */
  changed?: number;
  savedAt?: string;
};

export async function saveRegister(
  input: SaveRegisterInput,
): Promise<SaveRegisterResult> {
  const auth = await requirePermission("attendance.write");

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: "error.generic" };

  const { classId, entries } = parsed.data;
  const date = parsed.data.date as DateOnly;

  await requireClassAccess(auth, classId);

  // Only children actually enrolled in this class may be marked. Without this,
  // a forged request could write an attendance record for any student id.
  const enrolled = await prisma.enrollment.findMany({
    where: { classId, status: "ENROLLED" },
    select: {
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });
  const allowed = new Map(enrolled.map((row) => [row.studentId, row.student]));

  const accepted = parsed.data.entries.filter((entry) =>
    allowed.has(entry.studentId),
  );
  if (accepted.length !== entries.length) throw new ForbiddenError("not in this class");

  const meta = await requestMeta();
  const dbDate = toDbDate(date);

  const changed = await prisma.$transaction(async (tx) => {
    const session = await tx.attendanceSession.upsert({
      where: { classId_date: { classId, date: dbDate } },
      create: {
        classId,
        date: dbDate,
        takenByUserId: auth.user.id,
        finalizedAt: new Date(),
      },
      update: {
        // Whoever saved last is who the register is attributed to, and the audit
        // entries below carry the trail of everyone who touched it before.
        takenByUserId: auth.user.id,
        takenAt: new Date(),
        finalizedAt: new Date(),
      },
      select: { id: true },
    });

    const existing = await tx.attendanceRecord.findMany({
      where: { sessionId: session.id },
      select: {
        id: true,
        studentId: true,
        status: true,
        minutesLate: true,
        note: true,
      },
    });
    const byStudent = new Map(existing.map((record) => [record.studentId, record]));

    let changes = 0;

    for (const entry of accepted) {
      const before = byStudent.get(entry.studentId);
      const minutesLate =
        entry.status === AttendanceStatus.LATE ? entry.minutesLate : null;
      const note = entry.note?.trim() || null;

      const unchanged =
        before &&
        before.status === entry.status &&
        before.minutesLate === minutesLate &&
        before.note === note;

      if (unchanged) continue;

      const record = await tx.attendanceRecord.upsert({
        where: {
          sessionId_studentId: { sessionId: session.id, studentId: entry.studentId },
        },
        create: {
          sessionId: session.id,
          studentId: entry.studentId,
          status: entry.status,
          minutesLate,
          note,
        },
        update: { status: entry.status, minutesLate, note },
        select: { id: true },
      });

      const student = allowed.get(entry.studentId)!;

      await tx.auditLog.create({
        data: {
          schoolId: auth.schoolId,
          actorUserId: auth.user.id,
          action: before ? AuditAction.UPDATE : AuditAction.CREATE,
          entityType: "AttendanceRecord",
          entityId: record.id,
          // The child's name and the date are in the summary so the entry still
          // reads correctly after the record itself has changed again.
          summary: `${student.lastName} ${student.firstName} · ${date}`,
          before: before
            ? {
                status: before.status,
                minutesLate: before.minutesLate,
                note: before.note,
              }
            : undefined,
          after: { status: entry.status, minutesLate, note },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      });

      changes += 1;
    }

    return changes;
  });

  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : DEFAULT_LOCALE;
  revalidatePath(`/${locale}/attendance`);
  revalidatePath(`/${locale}/attendance/${classId}`);

  return { ok: true, changed, savedAt: new Date().toISOString() };
}
