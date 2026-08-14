import Link from "next/link";
import type { Route } from "next";
import { CalendarCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requireAuth, visibleClassWhere } from "@/lib/auth/context";
import {
  createTranslator,
  formatDateWithWeekday,
  formatNumber,
  formatPercent,
  isLocale,
  pickName,
  studentName,
  DEFAULT_LOCALE,
} from "@/lib/i18n";
import { toDbDate, today } from "@/lib/date";
import { AttendanceStatus } from "@/generated/prisma/enums";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { buttonStyles } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { AttendanceTrend } from "@/features/dashboard/trend";
import { attendanceTrend } from "@/features/dashboard/queries";

/**
 * The landing page, answering the two questions someone opening this app in the
 * morning actually has: has the register been taken, and who is not here.
 *
 * It is scoped like everything else — a teacher's figures cover their own
 * classes, an administrator's the whole campus.
 */
/**
 * A headline figure. `tone` applies only when there is a figure to colour: an
 * em-dash rendered in the absent red is a small red bar that reads as a chart
 * mark rather than as "nothing recorded yet".
 */
function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null;
  tone?: string;
}) {
  const empty = value === null;
  return (
    <div className="rounded-card border border-ink-200 bg-white px-4 py-3">
      <p
        className={`text-2xl font-semibold tabular-nums ${
          empty ? "text-ink-300" : (tone ?? "text-ink-900")
        }`}
      >
        {empty ? "—" : value}
      </p>
      <p className="mt-0.5 text-sm text-ink-500">{label}</p>
    </div>
  );
}

export default async function DashboardPage({ params }: PageProps<"/[locale]">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requireAuth();
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: auth.schoolId },
    select: { timezone: true },
  });

  const day = today(school.timezone);
  const scope = await visibleClassWhere(auth);

  const classes = await prisma.class.findMany({
    where: {
      AND: [
        scope,
        { isActive: true },
        // A class with nobody enrolled has no register to take, so listing it as
        // outstanding is noise a teacher has to learn to ignore.
        { enrollments: { some: { status: "ENROLLED" } } },
      ],
    },
    select: { id: true, name: true, nameKm: true },
  });
  const classIds = classes.map((klass) => klass.id);

  const [studentCount, teacherCount, sessions, absentToday, trend] = await Promise.all([
    prisma.enrollment.count({
      where: { classId: { in: classIds }, status: "ENROLLED" },
    }),
    can(auth, "teachers.read")
      ? prisma.teacherProfile.count({ where: { schoolId: auth.schoolId } })
      : Promise.resolve(0),
    prisma.attendanceSession.findMany({
      where: { classId: { in: classIds }, date: toDbDate(day) },
      select: { classId: true, records: { select: { status: true } } },
    }),
    // Named children, because "seven absent" is a number and "who" is the
    // question that follows it.
    prisma.attendanceRecord.findMany({
      where: {
        status: AttendanceStatus.ABSENT,
        session: { classId: { in: classIds }, date: toDbDate(day) },
      },
      take: 12,
      select: {
        id: true,
        status: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            firstNameKm: true,
            lastNameKm: true,
          },
        },
        session: { select: { class: { select: { name: true, nameKm: true } } } },
      },
    }),
    attendanceTrend(classIds, day),
  ]);

  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const session of sessions) {
    for (const record of session.records) {
      if (record.status === AttendanceStatus.ABSENT) counts.absent += 1;
      else if (record.status === AttendanceStatus.LATE) counts.late += 1;
      else if (record.status === AttendanceStatus.EXCUSED) counts.excused += 1;
      else counts.present += 1;
    }
  }

  const marked = counts.present + counts.absent + counts.late + counts.excused;
  const counted = marked - counts.excused;
  const rate = counted > 0 ? (counts.present + counts.late) / counted : null;

  const takenIds = new Set(sessions.map((session) => session.classId));
  const outstanding = classes.filter((klass) => !takenIds.has(klass.id));

  return (
    <PageBody>
      <PageHeader
        title={t("nav.dashboard")}
        description={formatDateWithWeekday(t, day)}
        action={
          <Link href={`/${locale}/attendance` as Route} className={buttonStyles()}>
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            {t("dash.takeAttendance")}
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label={t("dash.attendanceRate")}
          value={rate === null ? null : formatPercent(locale, rate)}
          tone={
            rate !== null && rate < 0.85 ? "text-absent-700" : "text-present-700"
          }
        />
        <Tile
          label={t("dash.absentToday")}
          value={marked === 0 ? null : formatNumber(locale, counts.absent)}
          tone="text-absent-700"
        />
        <Tile
          label={t("dash.lateToday")}
          value={marked === 0 ? null : formatNumber(locale, counts.late)}
          tone="text-late-700"
        />
        <Tile
          label={t("dash.totalStudents")}
          value={formatNumber(locale, studentCount)}
        />
      </div>

      {trend.length >= 2 ? (
        <Card className="mt-4">
          <CardHeader title={t("dash.trend")} />
          <div className="p-4 sm:p-5">
            <AttendanceTrend points={trend} />
          </div>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title={t("dash.notTakenYet")}
            description={
              outstanding.length === 0
                ? t("attendance.allDone")
                : t.plural("attendance.classesRemaining", outstanding.length)
            }
          />
          {outstanding.length === 0 ? (
            <EmptyState title={t("attendance.allDone")} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {outstanding.map((klass) => (
                <li key={klass.id}>
                  <Link
                    href={`/${locale}/attendance/${klass.id}` as Route}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink-50 sm:px-5"
                  >
                    <span className="truncate font-medium text-ink-900">
                      {pickName(locale, klass.name, klass.nameKm)}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-brand-700">
                      {t("dash.takeAttendance")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={t("dash.absentList")} />
          {marked === 0 ? (
            <EmptyState title={t("dash.noneTakenYet")} />
          ) : absentToday.length === 0 ? (
            <EmptyState title={t("dash.nobodyAbsent")} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {absentToday.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
                >
                  <Link
                    href={`/${locale}/students/${record.student.id}` as Route}
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate font-medium text-ink-900">
                      {studentName(locale, record.student)}
                    </span>
                    <span className="block truncate text-sm text-ink-500">
                      {pickName(
                        locale,
                        record.session.class.name,
                        record.session.class.nameKm,
                      )}
                    </span>
                  </Link>
                  <StatusPill status={record.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {can(auth, "teachers.read") ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            label={t("dash.totalClasses")}
            value={formatNumber(locale, classes.length)}
          />
          <Tile
            label={t("dash.totalTeachers")}
            value={formatNumber(locale, teacherCount)}
          />
        </div>
      ) : null}
    </PageBody>
  );
}
