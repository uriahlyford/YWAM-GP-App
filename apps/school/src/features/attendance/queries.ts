import "server-only";
import { prisma } from "@/lib/db";
import {
  type AuthContext,
  requireClassAccess,
  visibleClassWhere,
} from "@/lib/auth/context";
import { AttendanceStatus } from "@/generated/prisma/enums";
import { fromDbDate, toDbDate, type DateOnly } from "@/lib/date";

/**
 * Which of the caller's classes have had a register taken on a given day.
 *
 * One query for the classes and one for the sessions, joined in memory. The
 * `@@unique([classId, date])` on AttendanceSession is what makes the second one
 * an index lookup rather than a scan of every child's record for the day — the
 * reason session and records are separate tables at all.
 */
export async function classesForDate(auth: AuthContext, date: DateOnly) {
  const scope = await visibleClassWhere(auth);

  const classes = await prisma.class.findMany({
    where: { AND: [scope, { isActive: true }] },
    orderBy: [{ gradeLevel: { ordinal: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nameKm: true,
      room: true,
      gradeLevel: { select: { name: true, nameKm: true } },
      academicYear: { select: { name: true, isCurrent: true } },
      _count: { select: { enrollments: { where: { status: "ENROLLED" } } } },
    },
  });

  if (classes.length === 0) return [];

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      date: toDbDate(date),
      classId: { in: classes.map((klass) => klass.id) },
    },
    select: {
      classId: true,
      takenAt: true,
      takenBy: { select: { displayName: true, displayNameKm: true } },
      records: { select: { status: true } },
    },
  });

  const byClass = new Map(sessions.map((session) => [session.classId, session]));

  return classes.map((klass) => {
    const session = byClass.get(klass.id);
    const counts = { present: 0, absent: 0, late: 0 };
    for (const record of session?.records ?? []) {
      if (record.status === AttendanceStatus.ABSENT) counts.absent += 1;
      else if (record.status === AttendanceStatus.LATE) counts.late += 1;
      else counts.present += 1;
    }
    return { ...klass, session: session ?? null, counts };
  });
}

export type RegisterStudent = {
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  firstNameKm: string | null;
  lastNameKm: string | null;
  englishName: string | null;
  photoKey: string | null;
  status: AttendanceStatus;
  minutesLate: number | null;
  note: string | null;
};

export type Register = {
  classId: string;
  className: string;
  classNameKm: string | null;
  date: DateOnly;
  /** Null when nobody has taken this register yet. */
  takenBy: { displayName: string; displayNameKm: string | null } | null;
  takenAt: Date | null;
  students: RegisterStudent[];
};

/**
 * The register for one class on one day.
 *
 * Students with no record yet default to PRESENT. That default is the whole
 * design of this screen: a teacher confirms a class of thirty by changing the
 * two or three children who are not there, rather than by making thirty
 * decisions.
 */
export async function getRegister(
  auth: AuthContext,
  classId: string,
  date: DateOnly,
): Promise<Register | null> {
  await requireClassAccess(auth, classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
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
              englishName: true,
              photoKey: true,
            },
          },
        },
      },
    },
  });
  if (!klass) return null;

  const session = await prisma.attendanceSession.findUnique({
    where: { classId_date: { classId, date: toDbDate(date) } },
    select: {
      takenAt: true,
      takenBy: { select: { displayName: true, displayNameKm: true } },
      records: {
        select: {
          studentId: true,
          status: true,
          minutesLate: true,
          note: true,
        },
      },
    },
  });

  const recorded = new Map(
    (session?.records ?? []).map((record) => [record.studentId, record]),
  );

  return {
    classId: klass.id,
    className: klass.name,
    classNameKm: klass.nameKm,
    date,
    takenBy: session?.takenBy ?? null,
    takenAt: session?.takenAt ?? null,
    students: klass.enrollments.map(({ student }) => {
      const record = recorded.get(student.id);
      return {
        studentId: student.id,
        studentCode: student.studentCode,
        firstName: student.firstName,
        lastName: student.lastName,
        firstNameKm: student.firstNameKm,
        lastNameKm: student.lastNameKm,
        englishName: student.englishName,
        photoKey: student.photoKey,
        status: record?.status ?? AttendanceStatus.PRESENT,
        minutesLate: record?.minutesLate ?? null,
        note: record?.note ?? null,
      };
    }),
  };
}

/**
 * Every recorded change to this register, newest first.
 *
 * Looked up by the audit log's `entityId` against this session's record ids —
 * an index hit on `[entityType, entityId]` — rather than by matching text in the
 * summary, which would break the moment the summary's wording changed.
 */
export async function registerHistory(
  auth: AuthContext,
  classId: string,
  date: DateOnly,
) {
  await requireClassAccess(auth, classId);

  const session = await prisma.attendanceSession.findUnique({
    where: { classId_date: { classId, date: toDbDate(date) } },
    select: { records: { select: { id: true } } },
  });
  if (!session || session.records.length === 0) return [];

  return prisma.auditLog.findMany({
    where: {
      entityType: "AttendanceRecord",
      entityId: { in: session.records.map((record) => record.id) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      summary: true,
      before: true,
      after: true,
      createdAt: true,
      actor: { select: { displayName: true, displayNameKm: true } },
    },
  });
}

export { fromDbDate };
