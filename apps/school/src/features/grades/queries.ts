import "server-only";
import { prisma } from "@/lib/db";
import {
  type AuthContext,
  requireClassAccess,
  visibleClassWhere,
} from "@/lib/auth/context";
import { fromDbDate, type DateOnly } from "@/lib/date";

/**
 * The gradebook.
 *
 * Averages are computed from *percentages*, never from raw marks: a 10-point
 * quiz and a 100-point exam added together would otherwise say the exam is ten
 * times more important than a teacher intended, and `weight` exists precisely so
 * that intent is stated explicitly.
 */

export async function gradebookClasses(auth: AuthContext) {
  const scope = await visibleClassWhere(auth);
  return prisma.class.findMany({
    where: { AND: [scope, { isActive: true }] },
    orderBy: [
      { academicYear: { startDate: "desc" } },
      { gradeLevel: { ordinal: "asc" } },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      nameKm: true,
      academicYearId: true,
      academicYear: { select: { name: true, isCurrent: true } },
    },
  });
}

export async function termsForClass(auth: AuthContext, classId: string) {
  const klass = await prisma.class.findFirst({
    where: { id: classId, schoolId: auth.schoolId },
    select: { academicYearId: true },
  });
  if (!klass) return [];

  const terms = await prisma.term.findMany({
    where: { academicYearId: klass.academicYearId },
    orderBy: { ordinal: "asc" },
    select: {
      id: true,
      name: true,
      nameKm: true,
      ordinal: true,
      startDate: true,
      endDate: true,
    },
  });

  return terms.map((term) => ({
    ...term,
    startDate: fromDbDate(term.startDate),
    endDate: fromDbDate(term.endDate),
  }));
}

/**
 * The term to open on: the one today falls inside, else the most recent that has
 * already started, else the first. Landing a teacher on an empty sheet because
 * the year's first term ended in March is the kind of small wrongness that makes
 * software feel like it wasn't written for them.
 */
export function currentTermId(
  terms: { id: string; startDate: DateOnly; endDate: DateOnly }[],
  day: DateOnly,
): string | undefined {
  const containing = terms.find(
    (term) => term.startDate <= day && day <= term.endDate,
  );
  if (containing) return containing.id;

  const started = terms.filter((term) => term.startDate <= day);
  if (started.length > 0) return started[started.length - 1].id;

  return terms[0]?.id;
}

export type MatrixCell = { average: number | null; marked: number; total: number };

export type Matrix = {
  subjects: { id: string; name: string; nameKm: string | null }[];
  students: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    firstNameKm: string | null;
    lastNameKm: string | null;
    cells: Record<string, MatrixCell>;
    overall: number | null;
  }[];
  /** Per-subject class average, for the footer row. */
  subjectAverages: Record<string, number | null>;
};

/**
 * Students × subjects for one class and term, each cell a weighted average.
 *
 * One query for the roster and one for every mark in the term, reduced in
 * memory. The alternative — a query per cell — is 12 students × 6 subjects = 72
 * round trips for a single screen.
 */
export async function classMatrix(
  auth: AuthContext,
  classId: string,
  termId: string,
): Promise<Matrix> {
  await requireClassAccess(auth, classId);

  const [subjects, enrollments, records] = await Promise.all([
    prisma.subject.findMany({
      where: { schoolId: auth.schoolId, isActive: true },
      orderBy: [{ ordinal: "asc" }, { name: "asc" }],
      select: { id: true, name: true, nameKm: true },
    }),
    prisma.enrollment.findMany({
      where: { classId, status: "ENROLLED" },
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
    }),
    prisma.gradeRecord.findMany({
      where: { assessment: { classId, termId } },
      select: {
        studentId: true,
        score: true,
        assessment: {
          select: { subjectId: true, maxScore: true, weight: true },
        },
      },
    }),
  ]);

  type Accum = { weighted: number; weight: number; marked: number; total: number };
  const byStudent = new Map<string, Map<string, Accum>>();

  for (const record of records) {
    const { subjectId, maxScore, weight } = record.assessment;
    const max = Number(maxScore);
    if (max <= 0) continue;

    const perSubject =
      byStudent.get(record.studentId) ?? new Map<string, Accum>();
    const cell =
      perSubject.get(subjectId) ?? { weighted: 0, weight: 0, marked: 0, total: 0 };

    cell.total += 1;
    if (record.score !== null) {
      const w = Number(weight) || 1;
      cell.weighted += (Number(record.score) / max) * w;
      cell.weight += w;
      cell.marked += 1;
    }

    perSubject.set(subjectId, cell);
    byStudent.set(record.studentId, perSubject);
  }

  const students = enrollments.map(({ student }) => {
    const perSubject = byStudent.get(student.id);
    const cells: Record<string, MatrixCell> = {};

    for (const subject of subjects) {
      const cell = perSubject?.get(subject.id);
      cells[subject.id] = {
        average: cell && cell.weight > 0 ? cell.weighted / cell.weight : null,
        marked: cell?.marked ?? 0,
        total: cell?.total ?? 0,
      };
    }

    // Each subject counts once towards the overall figure, so a subject assessed
    // weekly doesn't outweigh one assessed twice a term.
    const withMarks = Object.values(cells).filter((cell) => cell.average !== null);
    const overall =
      withMarks.length > 0
        ? withMarks.reduce((sum, cell) => sum + (cell.average ?? 0), 0) /
          withMarks.length
        : null;

    return { ...student, cells, overall };
  });

  const subjectAverages: Record<string, number | null> = {};
  for (const subject of subjects) {
    const values = students
      .map((student) => student.cells[subject.id].average)
      .filter((value): value is number => value !== null);
    subjectAverages[subject.id] =
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;
  }

  return { subjects, students, subjectAverages };
}

export type AssessmentRow = {
  id: string;
  title: string;
  titleKm: string | null;
  date: DateOnly;
  maxScore: number;
  weight: number;
  marked: number;
  total: number;
  average: number | null;
};

/** Assessments for one class, subject and term, with how far marking has got. */
export async function assessmentsFor(
  auth: AuthContext,
  classId: string,
  subjectId: string,
  termId: string,
): Promise<AssessmentRow[]> {
  await requireClassAccess(auth, classId);

  const assessments = await prisma.assessment.findMany({
    where: { classId, subjectId, termId, schoolId: auth.schoolId },
    orderBy: [{ date: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      titleKm: true,
      date: true,
      maxScore: true,
      weight: true,
      records: { select: { score: true } },
    },
  });

  return assessments.map((assessment) => {
    const max = Number(assessment.maxScore);
    const marks = assessment.records
      .map((record) => record.score)
      .filter((score): score is NonNullable<typeof score> => score !== null)
      .map(Number);

    return {
      id: assessment.id,
      title: assessment.title,
      titleKm: assessment.titleKm,
      date: fromDbDate(assessment.date),
      maxScore: max,
      weight: Number(assessment.weight),
      marked: marks.length,
      total: assessment.records.length,
      average:
        marks.length > 0 && max > 0
          ? marks.reduce((sum, mark) => sum + mark, 0) / marks.length / max
          : null,
    };
  });
}

export type MarkSheet = {
  assessment: {
    id: string;
    title: string;
    titleKm: string | null;
    date: DateOnly;
    maxScore: number;
    weight: number;
    classId: string;
    subjectId: string;
    termId: string;
    subjectName: string;
    subjectNameKm: string | null;
    className: string;
    classNameKm: string | null;
  };
  students: {
    studentId: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    firstNameKm: string | null;
    lastNameKm: string | null;
    score: number | null;
    comment: string | null;
  }[];
};

/**
 * One assessment's marks, for entry.
 *
 * Enrolled students with no `GradeRecord` yet appear with a null score rather
 * than being absent from the list — "not marked" is a real state, distinct from
 * a zero, and the teacher needs to see who is still missing.
 */
export async function markSheet(
  auth: AuthContext,
  assessmentId: string,
): Promise<MarkSheet | null> {
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, schoolId: auth.schoolId },
    select: {
      id: true,
      title: true,
      titleKm: true,
      date: true,
      maxScore: true,
      weight: true,
      classId: true,
      subjectId: true,
      termId: true,
      subject: { select: { name: true, nameKm: true } },
      class: { select: { name: true, nameKm: true } },
      records: { select: { studentId: true, score: true, comment: true } },
    },
  });
  if (!assessment) return null;

  await requireClassAccess(auth, assessment.classId);

  const enrollments = await prisma.enrollment.findMany({
    where: { classId: assessment.classId, status: "ENROLLED" },
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
  });

  const recorded = new Map(
    assessment.records.map((record) => [record.studentId, record]),
  );

  return {
    assessment: {
      id: assessment.id,
      title: assessment.title,
      titleKm: assessment.titleKm,
      date: fromDbDate(assessment.date),
      maxScore: Number(assessment.maxScore),
      weight: Number(assessment.weight),
      classId: assessment.classId,
      subjectId: assessment.subjectId,
      termId: assessment.termId,
      subjectName: assessment.subject.name,
      subjectNameKm: assessment.subject.nameKm,
      className: assessment.class.name,
      classNameKm: assessment.class.nameKm,
    },
    students: enrollments.map(({ student }) => {
      const record = recorded.get(student.id);
      return {
        studentId: student.id,
        studentCode: student.studentCode,
        firstName: student.firstName,
        lastName: student.lastName,
        firstNameKm: student.firstNameKm,
        lastNameKm: student.lastNameKm,
        score: record?.score === null || record?.score === undefined
          ? null
          : Number(record.score),
        comment: record?.comment ?? null,
      };
    }),
  };
}
