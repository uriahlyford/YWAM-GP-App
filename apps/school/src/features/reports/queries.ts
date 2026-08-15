import "server-only";
import { prisma } from "@/lib/db";
import {
  type AuthContext,
  requireClassAccess,
  requireStudentAccess,
  visibleClassWhere,
} from "@/lib/auth/context";
import { AttendanceStatus } from "@/generated/prisma/enums";
import {
  endOfMonth,
  fromDbDate,
  startOfMonth,
  toDbDate,
  type DateOnly,
} from "@/lib/date";
import {
  createTranslator,
  formatDate,
  formatPercent,
  pickName,
  studentName,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";
import type { ReportTable } from "@/lib/export/table";
import type { ReportKind } from "./kinds";

/**
 * Reports, each returning the one `ReportTable` shape that the screen, the CSV,
 * the spreadsheet and the PDF all render. Building the numbers once is what keeps
 * an exported figure from disagreeing with the same figure on screen.
 *
 * Every report is scoped: a teacher's report covers their own classes.
 */

export type ReportParams = {
  kind: ReportKind;
  locale: Locale;
  date?: DateOnly;
  from?: DateOnly;
  to?: DateOnly;
  month?: string;
  classId?: string;
  studentId?: string;
  termId?: string;
};

const STATUSES: AttendanceStatus[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.ABSENT,
  AttendanceStatus.LATE,
  AttendanceStatus.EXCUSED,
  AttendanceStatus.LEFT_EARLY,
];

type Tally = Record<AttendanceStatus, number>;

function emptyTally(): Tally {
  return Object.fromEntries(STATUSES.map((status) => [status, 0])) as Tally;
}

/**
 * Present or late over days counted. Excused sits outside both sides — an
 * authorised absence is not truancy, and counting it as one would put every
 * child with a doctor's note below the school's threshold.
 */
function rateOf(tally: Tally): number | null {
  const counted =
    tally.PRESENT + tally.ABSENT + tally.LATE + tally.LEFT_EARLY;
  if (counted === 0) return null;
  return (tally.PRESENT + tally.LATE + tally.LEFT_EARLY) / counted;
}

async function scopedClassIds(auth: AuthContext, classId?: string) {
  if (classId) {
    await requireClassAccess(auth, classId);
    return [classId];
  }
  const scope = await visibleClassWhere(auth);
  const classes = await prisma.class.findMany({
    where: { AND: [scope, { isActive: true }] },
    select: { id: true },
  });
  return classes.map((klass) => klass.id);
}

// --- Daily attendance --------------------------------------------------------

/** One row per class for a single day: how many present, absent, late, excused. */
async function dailyAttendance(
  auth: AuthContext,
  params: ReportParams & { date: DateOnly },
): Promise<ReportTable> {
  const t = createTranslator(params.locale);
  const classIds = await scopedClassIds(auth, params.classId);

  const sessions = await prisma.attendanceSession.findMany({
    where: { classId: { in: classIds }, date: toDbDate(params.date) },
    select: {
      class: {
        select: {
          name: true,
          nameKm: true,
          gradeLevel: { select: { ordinal: true } },
        },
      },
      takenBy: { select: { displayName: true, displayNameKm: true } },
      records: { select: { status: true } },
    },
  });

  const notTaken = await prisma.class.findMany({
    where: {
      id: { in: classIds },
      enrollments: { some: { status: "ENROLLED" } },
      attendanceSessions: { none: { date: toDbDate(params.date) } },
    },
    select: { name: true, nameKm: true },
  });

  const rows = sessions
    .map((session) => {
      const tally = emptyTally();
      for (const record of session.records) tally[record.status] += 1;
      return {
        ordinal: session.class.gradeLevel.ordinal,
        cells: [
          pickName(params.locale, session.class.name, session.class.nameKm),
          session.records.length,
          tally.PRESENT,
          tally.ABSENT,
          tally.LATE,
          tally.EXCUSED,
          rateOf(tally) === null ? "" : formatPercent(params.locale, rateOf(tally)!),
          pickName(
            params.locale,
            session.takenBy.displayName,
            session.takenBy.displayNameKm,
          ),
        ],
      };
    })
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((row) => row.cells);

  const overall = emptyTally();
  for (const session of sessions) {
    for (const record of session.records) overall[record.status] += 1;
  }
  const totalStudents = sessions.reduce((sum, s) => sum + s.records.length, 0);

  return {
    title: t("report.daily.title"),
    subtitle: formatDate(t, params.date),
    columns: [
      { key: "class", label: t("report.classColumn"), width: 121 },
      { key: "total", label: t("common.total"), align: "end", width: 32 },
      { key: "present", label: t("attendance.status.PRESENT"), align: "end", width: 44 },
      { key: "absent", label: t("attendance.status.ABSENT"), align: "end", width: 38 },
      { key: "late", label: t("attendance.status.LATE"), align: "end", width: 32 },
      { key: "excused", label: t("attendance.status.EXCUSED"), align: "end", width: 62 },
      { key: "rate", label: t("report.rate"), align: "end", width: 56 },
      { key: "takenBy", label: t("report.takenBy"), width: 130 },
    ],
    rows,
    total: [
      t("common.total"),
      totalStudents,
      overall.PRESENT,
      overall.ABSENT,
      overall.LATE,
      overall.EXCUSED,
      rateOf(overall) === null ? "" : formatPercent(params.locale, rateOf(overall)!),
      "",
    ],
    notes: notTaken.length
      ? [
          `${t("attendance.notTaken")}: ${notTaken
            .map((klass) => pickName(params.locale, klass.name, klass.nameKm))
            .join(", ")}`,
          t("report.excusedNote"),
        ]
      : [t("report.excusedNote")],
  };
}

// --- Class attendance over a range -------------------------------------------

/** One row per student in a class, over a date range. */
async function classAttendance(
  auth: AuthContext,
  params: ReportParams & { classId: string; from: DateOnly; to: DateOnly },
): Promise<ReportTable> {
  const t = createTranslator(params.locale);
  await requireClassAccess(auth, params.classId);

  const klass = await prisma.class.findUniqueOrThrow({
    where: { id: params.classId },
    select: {
      name: true,
      nameKm: true,
      enrollments: {
        where: { status: "ENROLLED" },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        select: {
          student: {
            select: {
              id: true,
              studentCode: true,
              firstName: true,
              lastName: true,
              firstNameKm: true,
              lastNameKm: true,
            },
          },
        },
      },
    },
  });

  const records = await prisma.attendanceRecord.findMany({
    where: {
      session: {
        classId: params.classId,
        date: { gte: toDbDate(params.from), lte: toDbDate(params.to) },
      },
    },
    select: { studentId: true, status: true },
  });

  const byStudent = new Map<string, Tally>();
  for (const record of records) {
    const tally = byStudent.get(record.studentId) ?? emptyTally();
    tally[record.status] += 1;
    byStudent.set(record.studentId, tally);
  }

  const rows = klass.enrollments.map(({ student }) => {
    const tally = byStudent.get(student.id) ?? emptyTally();
    const rate = rateOf(tally);
    return [
      student.studentCode,
      studentName(params.locale, student),
      tally.PRESENT,
      tally.ABSENT,
      tally.LATE,
      tally.EXCUSED,
      rate === null ? "" : formatPercent(params.locale, rate),
    ];
  });

  const overall = emptyTally();
  for (const tally of byStudent.values()) {
    for (const status of STATUSES) overall[status] += tally[status];
  }

  return {
    title: t("report.class.title"),
    subtitle: `${pickName(params.locale, klass.name, klass.nameKm)} · ${formatDate(t, params.from)} – ${formatDate(t, params.to)}`,
    columns: [
      { key: "code", label: t("student.code"), width: 68 },
      { key: "name", label: t("grades.student"), width: 211 },
      { key: "present", label: t("attendance.status.PRESENT"), align: "end", width: 44 },
      { key: "absent", label: t("attendance.status.ABSENT"), align: "end", width: 38 },
      { key: "late", label: t("attendance.status.LATE"), align: "end", width: 32 },
      { key: "excused", label: t("attendance.status.EXCUSED"), align: "end", width: 62 },
      { key: "rate", label: t("report.rate"), align: "end", width: 56 },
    ],
    rows,
    total: [
      "",
      t("common.total"),
      overall.PRESENT,
      overall.ABSENT,
      overall.LATE,
      overall.EXCUSED,
      rateOf(overall) === null ? "" : formatPercent(params.locale, rateOf(overall)!),
    ],
    notes: [t("report.excusedNote")],
  };
}

// --- Monthly attendance ------------------------------------------------------

/** Attendance percentage per student for a calendar month, across the school. */
async function monthlyAttendance(
  auth: AuthContext,
  params: ReportParams & { month: string },
): Promise<ReportTable> {
  const t = createTranslator(params.locale);
  const classIds = await scopedClassIds(auth, params.classId);

  const first = `${params.month}-01` as DateOnly;
  const from = startOfMonth(first);
  const to = endOfMonth(first);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      session: {
        classId: { in: classIds },
        date: { gte: toDbDate(from), lte: toDbDate(to) },
      },
    },
    select: {
      status: true,
      student: {
        select: {
          id: true,
          studentCode: true,
          firstName: true,
          lastName: true,
          firstNameKm: true,
          lastNameKm: true,
        },
      },
      session: { select: { class: { select: { name: true, nameKm: true } } } },
    },
  });

  type Row = {
    student: (typeof records)[number]["student"];
    className: string;
    tally: Tally;
  };
  const byStudent = new Map<string, Row>();

  for (const record of records) {
    const row =
      byStudent.get(record.student.id) ??
      {
        student: record.student,
        className: pickName(
          params.locale,
          record.session.class.name,
          record.session.class.nameKm,
        ),
        tally: emptyTally(),
      };
    row.tally[record.status] += 1;
    byStudent.set(record.student.id, row);
  }

  const rows = [...byStudent.values()]
    .sort((a, b) => {
      const rateA = rateOf(a.tally) ?? 1;
      const rateB = rateOf(b.tally) ?? 1;
      // Lowest attendance first: this report exists to find the children who
      // are missing school, so they should not be on page three.
      return rateA - rateB;
    })
    .map((row) => {
      const rate = rateOf(row.tally);
      return [
        row.student.studentCode,
        studentName(params.locale, row.student),
        row.className,
        row.tally.PRESENT,
        row.tally.ABSENT,
        row.tally.LATE,
        rate === null ? "" : formatPercent(params.locale, rate),
      ];
    });

  return {
    title: t("report.monthly.title"),
    subtitle: `${formatDate(t, from)} – ${formatDate(t, to)}`,
    columns: [
      { key: "code", label: t("student.code"), width: 68 },
      { key: "name", label: t("grades.student"), width: 160 },
      { key: "class", label: t("report.classColumn"), width: 115 },
      { key: "present", label: t("attendance.status.PRESENT"), align: "end", width: 44 },
      { key: "absent", label: t("attendance.status.ABSENT"), align: "end", width: 38 },
      { key: "late", label: t("attendance.status.LATE"), align: "end", width: 32 },
      { key: "rate", label: t("report.rate"), align: "end", width: 56 },
    ],
    rows,
    notes: [t("report.monthly.note"), t("report.excusedNote")],
  };
}

// --- One student's attendance ------------------------------------------------

async function studentAttendance(
  auth: AuthContext,
  params: ReportParams & { studentId: string; from: DateOnly; to: DateOnly },
): Promise<ReportTable> {
  const t = createTranslator(params.locale);
  await requireStudentAccess(auth, params.studentId);

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: params.studentId },
    select: {
      studentCode: true,
      firstName: true,
      lastName: true,
      firstNameKm: true,
      lastNameKm: true,
    },
  });

  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId: params.studentId,
      session: { date: { gte: toDbDate(params.from), lte: toDbDate(params.to) } },
    },
    orderBy: { session: { date: "desc" } },
    select: {
      status: true,
      minutesLate: true,
      note: true,
      session: {
        select: { date: true, class: { select: { name: true, nameKm: true } } },
      },
    },
  });

  const tally = emptyTally();
  for (const record of records) tally[record.status] += 1;
  const rate = rateOf(tally);

  return {
    title: t("report.student.title"),
    subtitle: `${studentName(params.locale, student)} · ${student.studentCode} · ${formatDate(t, params.from)} – ${formatDate(t, params.to)}`,
    columns: [
      { key: "date", label: t("common.date"), width: 100 },
      { key: "class", label: t("report.classColumn"), width: 120 },
      { key: "status", label: t("common.status"), width: 90 },
      { key: "late", label: t("attendance.minutesLate"), align: "end", width: 62 },
      { key: "note", label: t("common.notes"), width: 140 },
    ],
    rows: records.map((record) => [
      formatDate(t, fromDbDate(record.session.date)),
      pickName(params.locale, record.session.class.name, record.session.class.nameKm),
      t(`attendance.status.${record.status}` as MessageKey),
      record.minutesLate ?? "",
      record.note ?? "",
    ]),
    notes: [
      `${t("student.presentDays")}: ${tally.PRESENT} · ${t("student.absentDays")}: ${tally.ABSENT} · ${t("student.lateDays")}: ${tally.LATE} · ${t("attendance.status.EXCUSED")}: ${tally.EXCUSED}`,
      rate === null
        ? t("common.empty")
        : `${t("report.rate")}: ${formatPercent(params.locale, rate)}`,
      t("report.excusedNote"),
    ],
  };
}

// --- One student's academic report -------------------------------------------

/** Subject averages plus attendance — the basis of a printable report card. */
async function studentReport(
  auth: AuthContext,
  params: ReportParams & { studentId: string; termId?: string },
): Promise<ReportTable> {
  const t = createTranslator(params.locale);
  await requireStudentAccess(auth, params.studentId);

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: params.studentId },
    select: {
      studentCode: true,
      firstName: true,
      lastName: true,
      firstNameKm: true,
      lastNameKm: true,
      enrollments: {
        where: { status: "ENROLLED" },
        take: 1,
        select: {
          class: {
            select: {
              name: true,
              nameKm: true,
              academicYear: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const records = await prisma.gradeRecord.findMany({
    where: {
      studentId: params.studentId,
      ...(params.termId ? { assessment: { termId: params.termId } } : {}),
    },
    select: {
      score: true,
      comment: true,
      assessment: {
        select: {
          maxScore: true,
          weight: true,
          subject: { select: { id: true, name: true, nameKm: true, ordinal: true } },
        },
      },
    },
  });

  type Accum = {
    name: string;
    nameKm: string | null;
    ordinal: number;
    weighted: number;
    weight: number;
    marked: number;
    total: number;
    comments: string[];
  };
  const bySubject = new Map<string, Accum>();

  for (const record of records) {
    const { subject, maxScore, weight } = record.assessment;
    const max = Number(maxScore);
    const accum =
      bySubject.get(subject.id) ??
      {
        name: subject.name,
        nameKm: subject.nameKm,
        ordinal: subject.ordinal,
        weighted: 0,
        weight: 0,
        marked: 0,
        total: 0,
        comments: [],
      };

    accum.total += 1;
    if (record.score !== null && max > 0) {
      const w = Number(weight) || 1;
      accum.weighted += (Number(record.score) / max) * w;
      accum.weight += w;
      accum.marked += 1;
    }
    if (record.comment) accum.comments.push(record.comment);

    bySubject.set(subject.id, accum);
  }

  const subjects = [...bySubject.values()].sort(
    (a, b) => a.ordinal - b.ordinal || a.name.localeCompare(b.name),
  );

  const averages = subjects
    .map((subject) => (subject.weight > 0 ? subject.weighted / subject.weight : null))
    .filter((value): value is number => value !== null);
  const overall =
    averages.length > 0
      ? averages.reduce((sum, value) => sum + value, 0) / averages.length
      : null;

  const attendance = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { studentId: params.studentId },
    _count: { _all: true },
  });
  const tally = emptyTally();
  for (const row of attendance) tally[row.status] = row._count._all;
  const attendanceRate = rateOf(tally);

  const klass = student.enrollments[0]?.class;

  return {
    title: t("report.card.title"),
    subtitle: [
      studentName(params.locale, student),
      student.studentCode,
      klass ? pickName(params.locale, klass.name, klass.nameKm) : null,
      klass?.academicYear.name,
    ]
      .filter(Boolean)
      .join(" · "),
    columns: [
      { key: "subject", label: t("grades.pickSubject"), width: 140 },
      { key: "average", label: t("grades.average"), align: "end", width: 42 },
      { key: "marked", label: t("grades.assessments"), align: "end", width: 68 },
      { key: "comment", label: t("grades.comment"), width: 259 },
    ],
    rows: subjects.map((subject) => {
      const average = subject.weight > 0 ? subject.weighted / subject.weight : null;
      return [
        pickName(params.locale, subject.name, subject.nameKm),
        average === null ? "" : formatPercent(params.locale, average),
        `${subject.marked}/${subject.total}`,
        subject.comments.join("; "),
      ];
    }),
    total: [
      t("grades.overall"),
      overall === null ? "" : formatPercent(params.locale, overall),
      "",
      "",
    ],
    notes: [
      `${t("student.attendanceSummary")} — ${t("student.presentDays")}: ${tally.PRESENT} · ${t("student.absentDays")}: ${tally.ABSENT} · ${t("student.lateDays")}: ${tally.LATE}${
        attendanceRate === null
          ? ""
          : ` · ${t("report.rate")}: ${formatPercent(params.locale, attendanceRate)}`
      }`,
      t("report.card.note"),
    ],
  };
}

// --- Dispatch ----------------------------------------------------------------

export async function buildReport(
  auth: AuthContext,
  params: ReportParams,
): Promise<ReportTable> {
  switch (params.kind) {
    case "daily-attendance":
      if (!params.date) throw new Error("date is required");
      return dailyAttendance(auth, { ...params, date: params.date });

    case "class-attendance":
      if (!params.classId || !params.from || !params.to) {
        throw new Error("classId, from and to are required");
      }
      return classAttendance(auth, {
        ...params,
        classId: params.classId,
        from: params.from,
        to: params.to,
      });

    case "monthly-attendance":
      if (!params.month) throw new Error("month is required");
      return monthlyAttendance(auth, { ...params, month: params.month });

    case "student-attendance":
      if (!params.studentId || !params.from || !params.to) {
        throw new Error("studentId, from and to are required");
      }
      return studentAttendance(auth, {
        ...params,
        studentId: params.studentId,
        from: params.from,
        to: params.to,
      });

    case "student-report":
      if (!params.studentId) throw new Error("studentId is required");
      return studentReport(auth, { ...params, studentId: params.studentId });
  }
}
