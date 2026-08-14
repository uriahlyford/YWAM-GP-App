import "server-only";
import { prisma } from "@/lib/db";
import { AttendanceStatus } from "@/generated/prisma/enums";
import { fromDbDate, type DateOnly } from "@/lib/date";

/**
 * Attendance and academic summaries for one student.
 *
 * Both are computed with `groupBy` rather than by loading rows and reducing in
 * JavaScript. A child with three years of history has several hundred
 * attendance records and as many grades; the profile page should not pull them
 * across the wire to count them.
 */

export type AttendanceSummary = {
  counts: Record<AttendanceStatus, number>;
  totalDays: number;
  /** Present or late, over days recorded. Excused days are excluded from both
   *  sides — an authorised absence shouldn't read as truancy. */
  rate: number | null;
  recent: { date: DateOnly; status: AttendanceStatus; minutesLate: number | null }[];
};

export async function attendanceSummary(
  studentId: string,
  { recentDays = 10 }: { recentDays?: number } = {},
): Promise<AttendanceSummary> {
  const [grouped, recent] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { studentId },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId },
      orderBy: { session: { date: "desc" } },
      take: recentDays,
      select: {
        status: true,
        minutesLate: true,
        session: { select: { date: true } },
      },
    }),
  ]);

  const counts = Object.fromEntries(
    Object.values(AttendanceStatus).map((status) => [status, 0]),
  ) as Record<AttendanceStatus, number>;

  for (const row of grouped) counts[row.status] = row._count._all;

  const totalDays = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const counted = totalDays - counts.EXCUSED;
  const attended = counts.PRESENT + counts.LATE + counts.LEFT_EARLY;

  return {
    counts,
    totalDays,
    rate: counted > 0 ? attended / counted : null,
    recent: recent.map((r) => ({
      date: fromDbDate(r.session.date),
      status: r.status,
      minutesLate: r.minutesLate,
    })),
  };
}

export type SubjectAverage = {
  subjectId: string;
  name: string;
  nameKm: string | null;
  /** Weighted by each assessment's `weight`, as a fraction of its max score. */
  average: number | null;
  assessments: number;
};

export type AcademicSummary = {
  subjects: SubjectAverage[];
  overall: number | null;
};

export async function academicSummary(
  studentId: string,
  options: { termId?: string } = {},
): Promise<AcademicSummary> {
  const records = await prisma.gradeRecord.findMany({
    where: {
      studentId,
      score: { not: null },
      ...(options.termId ? { assessment: { termId: options.termId } } : {}),
    },
    select: {
      score: true,
      assessment: {
        select: {
          maxScore: true,
          weight: true,
          subject: { select: { id: true, name: true, nameKm: true, ordinal: true } },
        },
      },
    },
  });

  // Weighted mean of percentage scores, per subject. Percentages rather than raw
  // marks, because a 10-point quiz and a 100-point exam are otherwise added
  // together as if they were the same thing.
  const bySubject = new Map<
    string,
    { name: string; nameKm: string | null; ordinal: number; weighted: number; weight: number; n: number }
  >();

  for (const record of records) {
    const { subject, maxScore, weight } = record.assessment;
    const max = Number(maxScore);
    if (max <= 0) continue;

    const fraction = Number(record.score) / max;
    const w = Number(weight) || 1;

    const entry =
      bySubject.get(subject.id) ??
      {
        name: subject.name,
        nameKm: subject.nameKm,
        ordinal: subject.ordinal,
        weighted: 0,
        weight: 0,
        n: 0,
      };

    entry.weighted += fraction * w;
    entry.weight += w;
    entry.n += 1;
    bySubject.set(subject.id, entry);
  }

  // Sorted by the school's own subject order, then dropped — the ordinal is a
  // sorting input, not something the caller should have to carry around.
  const ordered = [...bySubject.entries()].sort(
    ([, a], [, b]) => a.ordinal - b.ordinal || a.name.localeCompare(b.name),
  );

  const subjects: SubjectAverage[] = ordered.map(([subjectId, entry]) => ({
    subjectId,
    name: entry.name,
    nameKm: entry.nameKm,
    average: entry.weight > 0 ? entry.weighted / entry.weight : null,
    assessments: entry.n,
  }));

  // The overall figure gives each subject equal weight, not each assessment —
  // otherwise a subject that happens to be assessed weekly dominates a report
  // card over one assessed twice a term.
  const withAverages = subjects.filter((s) => s.average !== null);
  const overall =
    withAverages.length > 0
      ? withAverages.reduce((sum, s) => sum + (s.average ?? 0), 0) /
        withAverages.length
      : null;

  return { subjects, overall };
}
