import "server-only";
import { prisma } from "@/lib/db";
import { AttendanceStatus } from "@/generated/prisma/enums";
import { fromDbDate, toDbDate, addDays, type DateOnly } from "@/lib/date";
import type { TrendPoint } from "./trend";

/**
 * Attendance rate per day over a recent window, for the dashboard's trend.
 *
 * One query. Days on which no register was taken anywhere are omitted rather
 * than plotted as zero — a public holiday is not a day when nobody came, and a
 * zero would put a cliff in the chart that never happened.
 *
 * Excused absences are left out of both the numerator and the denominator: an
 * authorised absence should not read as truancy.
 */
export async function attendanceTrend(
  classIds: string[],
  today: DateOnly,
  days = 20,
): Promise<TrendPoint[]> {
  if (classIds.length === 0) return [];

  const from = addDays(today, -days);

  const records = await prisma.attendanceRecord.groupBy({
    by: ["status", "sessionId"],
    where: {
      session: {
        classId: { in: classIds },
        date: { gte: toDbDate(from), lte: toDbDate(today) },
      },
    },
    _count: { _all: true },
  });

  if (records.length === 0) return [];

  const sessions = await prisma.attendanceSession.findMany({
    where: { id: { in: [...new Set(records.map((row) => row.sessionId))] } },
    select: { id: true, date: true },
  });
  const dateOf = new Map(sessions.map((s) => [s.id, fromDbDate(s.date)]));

  const byDay = new Map<DateOnly, { attended: number; counted: number }>();

  for (const row of records) {
    const day = dateOf.get(row.sessionId);
    if (!day) continue;

    const bucket = byDay.get(day) ?? { attended: 0, counted: 0 };
    const n = row._count._all;

    if (row.status === AttendanceStatus.EXCUSED) {
      // Neither present nor counted against them.
    } else {
      bucket.counted += n;
      if (row.status !== AttendanceStatus.ABSENT) bucket.attended += n;
    }

    byDay.set(day, bucket);
  }

  return [...byDay.entries()]
    .filter(([, bucket]) => bucket.counted > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      rate: bucket.attended / bucket.counted,
      marked: bucket.counted,
    }));
}
