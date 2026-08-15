import { prisma } from "@/lib/db";
import {
  requirePermission,
  visibleClassWhere,
  visibleStudentWhere,
} from "@/lib/auth/context";
import {
  createTranslator,
  isLocale,
  DEFAULT_LOCALE,
  type MessageKey,
} from "@/lib/i18n";
import { isDateOnly, startOfMonth, today, type DateOnly } from "@/lib/date";
import { buildReport } from "@/features/reports/queries";
import {
  isReportKind,
  REPORTS_NEEDING_CLASS,
  REPORTS_NEEDING_STUDENT,
  type ReportKind,
} from "@/features/reports/kinds";
import { ReportControls } from "@/features/reports/controls";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Alert, Card, CardHeader, EmptyState } from "@/components/ui/surface";

export default async function ReportsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reports">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("reports.read");
  const query = await searchParams;

  const school = await prisma.school.findUniqueOrThrow({
    where: { id: auth.schoolId },
    select: { timezone: true },
  });
  const day = today(school.timezone);

  const kind: ReportKind = isReportKind(query.kind) ? query.kind : "daily-attendance";

  const str = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : undefined;

  // Sensible defaults, so every report shows something the moment it is chosen
  // rather than an empty frame waiting for five parameters.
  const date = isDateOnly(str("date") ?? "") ? (str("date") as DateOnly) : day;
  const from = isDateOnly(str("from") ?? "")
    ? (str("from") as DateOnly)
    : startOfMonth(day);
  const to = isDateOnly(str("to") ?? "") ? (str("to") as DateOnly) : day;
  const month = /^\d{4}-\d{2}$/.test(str("month") ?? "")
    ? str("month")!
    : day.slice(0, 7);
  const classId = str("class");
  const studentId = str("student");

  const classScope = await visibleClassWhere(auth);
  const studentScope = await visibleStudentWhere(auth);

  const [classes, students] = await Promise.all([
    prisma.class.findMany({
      where: { AND: [classScope, { isActive: true }] },
      orderBy: [{ gradeLevel: { ordinal: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, nameKm: true },
    }),
    REPORTS_NEEDING_STUDENT.includes(kind)
      ? prisma.student.findMany({
          where: { AND: [studentScope, { archivedAt: null }] },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          take: 1000,
          select: {
            id: true,
            studentCode: true,
            firstName: true,
            lastName: true,
            firstNameKm: true,
            lastNameKm: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const missingStudent = REPORTS_NEEDING_STUDENT.includes(kind) && !studentId;
  const missingClass = REPORTS_NEEDING_CLASS.includes(kind) && !classId;
  const ready = !missingStudent && !missingClass;

  const table = ready
    ? await buildReport(auth, {
        kind,
        locale,
        date,
        from,
        to,
        month,
        classId,
        studentId,
      })
    : null;

  const download = new URLSearchParams({ locale });
  download.set("date", date);
  download.set("from", from);
  download.set("to", to);
  download.set("month", month);
  if (classId) download.set("class", classId);
  if (studentId) download.set("student", studentId);

  return (
    <PageBody>
      <PageHeader title={t("reports.title")} description={t("reports.subtitle")} />

      <ReportControls
        kind={kind}
        classes={classes}
        students={students}
        values={{ date, from, to, month, classId, studentId }}
        downloadQuery={download.toString()}
        canDownload={Boolean(table && table.rows.length > 0)}
      />

      {missingStudent ? (
        <Alert tone="info" className="mt-4">
          {t("reports.needStudent")}
        </Alert>
      ) : null}
      {missingClass ? (
        <Alert tone="info" className="mt-4">
          {t("reports.needClass")}
        </Alert>
      ) : null}

      {table ? (
        <Card className="mt-4 overflow-hidden">
          <CardHeader
            title={t(`reports.kind.${kind}` as MessageKey)}
            description={table.subtitle}
            action={
              <span className="text-sm text-ink-500">
                {t.plural("reports.rows", table.rows.length)}
              </span>
            }
          />

          {table.rows.length === 0 ? (
            <EmptyState title={t("reports.empty")} />
          ) : (
            // Reports are wide by nature; they scroll inside their own container
            // so the page body never scrolls sideways on a phone.
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-ink-500">
                    {table.columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className={`px-3 py-2.5 font-medium ${
                          column.align === "end" ? "text-end" : "text-start"
                        }`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-ink-100">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={`px-3 py-2 ${
                            table.columns[cellIndex]?.align === "end"
                              ? "text-end tabular-nums"
                              : "text-start"
                          } ${cellIndex === 0 ? "text-ink-900" : "text-ink-700"}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {table.total ? (
                  <tfoot>
                    <tr className="bg-ink-50 font-medium text-ink-800">
                      {table.total.map((cell, index) => (
                        <td
                          key={index}
                          className={`px-3 py-2.5 ${
                            table.columns[index]?.align === "end"
                              ? "text-end tabular-nums"
                              : "text-start"
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )}

          {table.notes?.length ? (
            <div className="border-t border-ink-200 px-4 py-3 sm:px-5">
              {table.notes.map((note) => (
                <p key={note} className="text-sm text-ink-500">
                  {note}
                </p>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}
    </PageBody>
  );
}
