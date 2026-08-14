import Link from "next/link";
import type { Route } from "next";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/auth/context";
import {
  createTranslator,
  formatPercent,
  isLocale,
  pickName,
  studentName,
  DEFAULT_LOCALE,
} from "@/lib/i18n";
import { today } from "@/lib/date";
import {
  assessmentsFor,
  classMatrix,
  currentTermId,
  gradebookClasses,
  termsForClass,
} from "@/features/grades/queries";
import { GradePickers } from "@/features/grades/pickers";
import { AssessmentForm } from "@/features/grades/assessment-form";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";

/** Colour by band, so a report can be skimmed before it is read. */
function bandClass(value: number | null) {
  if (value === null) return "text-ink-300";
  if (value >= 0.8) return "text-present-700";
  if (value >= 0.5) return "text-late-700";
  return "text-absent-700";
}

export default async function GradesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/grades">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("grades.read");
  const query = await searchParams;

  const classes = await gradebookClasses(auth);
  if (classes.length === 0) {
    return (
      <PageBody>
        <PageHeader title={t("grades.title")} description={t("grades.subtitle")} />
        <Card>
          <EmptyState title={t("grades.noClasses")} />
        </Card>
      </PageBody>
    );
  }

  const classId =
    typeof query.class === "string" && classes.some((c) => c.id === query.class)
      ? query.class
      : (classes.find((c) => c.academicYear.isCurrent) ?? classes[0]).id;

  const school = await prisma.school.findUniqueOrThrow({
    where: { id: auth.schoolId },
    select: { timezone: true },
  });
  const day = today(school.timezone);

  const terms = await termsForClass(auth, classId);
  const termId =
    typeof query.term === "string" && terms.some((term) => term.id === query.term)
      ? query.term
      : currentTermId(terms, day);

  const subjects = await prisma.subject.findMany({
    where: { schoolId: auth.schoolId, isActive: true },
    orderBy: [{ ordinal: "asc" }, { name: "asc" }],
    select: { id: true, name: true, nameKm: true },
  });

  const subjectId =
    typeof query.subject === "string" &&
    subjects.some((subject) => subject.id === query.subject)
      ? query.subject
      : undefined;

  const matrix = termId ? await classMatrix(auth, classId, termId) : null;
  const assessments =
    termId && subjectId
      ? await assessmentsFor(auth, classId, subjectId, termId)
      : null;

  return (
    <PageBody>
      <PageHeader title={t("grades.title")} description={t("grades.subtitle")} />

      <GradePickers
        classes={classes}
        terms={terms}
        subjects={subjects}
        classId={classId}
        termId={termId}
        subjectId={subjectId}
      />

      {!termId ? (
        <Card className="mt-4">
          <EmptyState title={t("common.empty")} />
        </Card>
      ) : null}

      {matrix && matrix.students.length === 0 ? (
        <Card className="mt-4">
          <EmptyState title={t("grades.noStudents")} />
        </Card>
      ) : null}

      {/* The spec's table: a student per row, a subject per column. It is wide by
          nature, so it scrolls inside its own container rather than pushing the
          page sideways, and the name column stays put while it does. */}
      {matrix && matrix.students.length > 0 ? (
        <Card className="mt-4 overflow-hidden">
          <CardHeader
            title={t("grades.average")}
            description={pickName(
              locale,
              classes.find((c) => c.id === classId)?.name,
              classes.find((c) => c.id === classId)?.nameKm,
            )}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-ink-500">
                  <th
                    scope="col"
                    className="sticky start-0 z-10 bg-white px-4 py-2.5 text-start font-medium"
                  >
                    {t("grades.student")}
                  </th>
                  {matrix.subjects.map((subject) => (
                    <th
                      key={subject.id}
                      scope="col"
                      className="px-3 py-2.5 text-end font-medium"
                    >
                      <Link
                        href={
                          `/${locale}/grades?class=${classId}&term=${termId}&subject=${subject.id}` as Route
                        }
                        className="hover:text-brand-700"
                        title={t("grades.openSubject", {
                          subject: pickName(locale, subject.name, subject.nameKm),
                        })}
                      >
                        {pickName(locale, subject.name, subject.nameKm)}
                      </Link>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    {t("grades.overall")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.students.map((student) => (
                  <tr key={student.id} className="border-b border-ink-100">
                    <th
                      scope="row"
                      className="sticky start-0 z-10 max-w-52 truncate bg-white px-4 py-2 text-start font-medium text-ink-900"
                    >
                      <Link
                        href={`/${locale}/students/${student.id}` as Route}
                        className="hover:text-brand-700"
                      >
                        {studentName(locale, student)}
                      </Link>
                    </th>
                    {matrix.subjects.map((subject) => {
                      const cell = student.cells[subject.id];
                      return (
                        <td
                          key={subject.id}
                          className={`px-3 py-2 text-end tabular-nums ${bandClass(cell.average)}`}
                        >
                          {cell.average === null
                            ? "—"
                            : formatPercent(locale, cell.average)}
                        </td>
                      );
                    })}
                    <td
                      className={`px-4 py-2 text-end font-semibold tabular-nums ${bandClass(student.overall)}`}
                    >
                      {student.overall === null
                        ? "—"
                        : formatPercent(locale, student.overall)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-ink-50 text-ink-600">
                  <th
                    scope="row"
                    className="sticky start-0 z-10 bg-ink-50 px-4 py-2.5 text-start font-medium"
                  >
                    {t("grades.classAverage")}
                  </th>
                  {matrix.subjects.map((subject) => (
                    <td
                      key={subject.id}
                      className="px-3 py-2.5 text-end font-medium tabular-nums"
                    >
                      {matrix.subjectAverages[subject.id] === null
                        ? "—"
                        : formatPercent(locale, matrix.subjectAverages[subject.id]!)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Choosing a subject reveals its assessments — the place marks are
          actually entered. */}
      {assessments && termId && subjectId ? (
        <Card className="mt-4 overflow-hidden">
          <CardHeader
            title={t("grades.assessments")}
            description={pickName(
              locale,
              subjects.find((s) => s.id === subjectId)?.name,
              subjects.find((s) => s.id === subjectId)?.nameKm,
            )}
          />
          {assessments.length === 0 ? (
            <EmptyState title={t("grades.noAssessments")} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {assessments.map((assessment) => (
                <li key={assessment.id}>
                  <Link
                    href={`/${locale}/grades/assessment/${assessment.id}` as Route}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-900">
                        {pickName(locale, assessment.title, assessment.titleKm)}
                      </span>
                      <span className="block truncate text-sm text-ink-500">
                        {assessment.date} · {t("grades.outOf", { max: assessment.maxScore })}
                        {" · "}
                        {t("grades.markedCount", {
                          marked: assessment.marked,
                          total: assessment.total,
                        })}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${bandClass(assessment.average)}`}
                    >
                      {assessment.average === null
                        ? "—"
                        : formatPercent(locale, assessment.average)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {termId && can(auth, "grades.write") ? (
        <div className="mt-4">
          <AssessmentForm
            classId={classId}
            termId={termId}
            subjects={subjects}
            subjectId={subjectId}
            defaultDate={day}
          />
        </div>
      ) : null}
    </PageBody>
  );
}
