import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { Pencil, Phone } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/context";
import {
  createTranslator,
  formatDate,
  formatNumber,
  formatPercent,
  isLocale,
  pickName,
  studentName,
  DEFAULT_LOCALE,
  type MessageKey,
} from "@/lib/i18n";
import { ageOn, fromDbDate, today } from "@/lib/date";
import { getStudent } from "@/features/students/queries";
import { academicSummary, attendanceSummary } from "@/features/students/summary";
import { archiveStudent } from "@/features/students/actions";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Alert, Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonStyles } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-900">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-ink-50 px-3 py-2.5 text-center">
      <p className={`text-xl font-semibold tabular-nums ${tone ?? "text-ink-900"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-500">{label}</p>
    </div>
  );
}

export default async function StudentProfilePage({
  params,
}: PageProps<"/[locale]/students/[id]">) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("students.read");
  const student = await getStudent(auth, id);
  if (!student) notFound();

  const [attendance, academic] = await Promise.all([
    attendanceSummary(student.id),
    academicSummary(student.id),
  ]);

  const name = studentName(locale, student);
  const enrolled = student.enrollments.find((e) => e.status === "ENROLLED");
  const editable = can(auth, "students.write");

  return (
    <PageBody>
      <PageHeader
        title={name}
        description={`${student.studentCode}${
          enrolled
            ? ` · ${pickName(locale, enrolled.class.name, enrolled.class.nameKm)}`
            : ` · ${t("students.noClass")}`
        }`}
        action={
          editable ? (
            <Link
              href={`/${locale}/students/${student.id}/edit` as Route}
              className={buttonStyles({ variant: "secondary" })}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("action.edit")}
            </Link>
          ) : null
        }
      />

      {student.archivedAt ? (
        <Alert tone="warning" className="mb-4">
          <strong>{t("student.archived")}</strong> — {t("student.archived.body")}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Attendance first: it is what a teacher opening a child's record is
              most often checking. */}
          <Card>
            <CardHeader title={t("student.attendanceSummary")} />
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label={t("student.attendanceRate")}
                  value={
                    attendance.rate === null
                      ? "—"
                      : formatPercent(locale, attendance.rate)
                  }
                  tone={
                    attendance.rate !== null && attendance.rate < 0.85
                      ? "text-absent-700"
                      : "text-present-700"
                  }
                />
                <Stat
                  label={t("student.presentDays")}
                  value={formatNumber(locale, attendance.counts.PRESENT)}
                />
                <Stat
                  label={t("student.absentDays")}
                  value={formatNumber(locale, attendance.counts.ABSENT)}
                />
                <Stat
                  label={t("student.lateDays")}
                  value={formatNumber(locale, attendance.counts.LATE)}
                />
              </div>

              {attendance.recent.length > 0 ? (
                <>
                  <h3 className="mt-5 text-sm font-medium text-ink-600">
                    {t("student.recentAttendance")}
                  </h3>
                  <ul className="mt-2 divide-y divide-ink-100">
                    {attendance.recent.map((entry) => (
                      <li
                        key={entry.date}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="text-sm text-ink-600">
                          {formatDate(t, entry.date)}
                        </span>
                        <StatusPill status={entry.status} minutesLate={entry.minutesLate} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t("student.grades")}
              action={
                academic.overall !== null ? (
                  <span className="text-sm text-ink-500">
                    {t("student.overallAverage")}{" "}
                    <strong className="text-ink-900 tabular-nums">
                      {formatPercent(locale, academic.overall)}
                    </strong>
                  </span>
                ) : null
              }
            />
            {academic.subjects.length === 0 ? (
              <EmptyState title={t("student.noGrades")} />
            ) : (
              <ul className="divide-y divide-ink-100">
                {academic.subjects.map((subject) => (
                  <li
                    key={subject.subjectId}
                    className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink-800">
                      {pickName(locale, subject.name, subject.nameKm)}
                    </span>
                    <span className="w-24 shrink-0">
                      <span
                        className="block h-1.5 rounded-full bg-ink-200"
                        aria-hidden="true"
                      >
                        <span
                          className="block h-1.5 rounded-full bg-brand-600"
                          style={{ width: `${Math.round((subject.average ?? 0) * 100)}%` }}
                        />
                      </span>
                    </span>
                    <span className="w-14 shrink-0 text-end font-medium tabular-nums text-ink-900">
                      {subject.average === null
                        ? "—"
                        : formatPercent(locale, subject.average)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-4 p-4 sm:p-5">
              <Avatar photoKey={student.photoKey} name={name} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{name}</p>
                {student.englishName ? (
                  <p className="truncate text-sm text-ink-500">
                    {student.englishName}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-ink-500">
                  {t(`student.status.${student.status}` as MessageKey)}
                </p>
              </div>
            </div>
            <dl className="grid gap-3 border-t border-ink-200 p-4 sm:p-5">
              <Detail
                label={t("student.dob")}
                value={
                  student.dateOfBirth ? (
                    <>
                      {formatDate(t, fromDbDate(student.dateOfBirth))}
                      <span className="ms-2 text-sm text-ink-500">
                        {t("student.age", {
                          count: ageOn(fromDbDate(student.dateOfBirth), today()),
                        })}
                      </span>
                    </>
                  ) : null
                }
              />
              <Detail
                label={t("student.gender")}
                value={
                  student.gender ? t(`gender.${student.gender}` as MessageKey) : null
                }
              />
              <Detail
                label={t("student.enrollmentDate")}
                value={formatDate(t, fromDbDate(student.enrollmentDate))}
              />
              <Detail label={t("common.address")} value={student.address} />
              <Detail label={t("common.phone")} value={student.phone} />
              <Detail
                label={t("student.emergencyNote")}
                value={student.emergencyNote}
              />
              <Detail label={t("student.medicalNote")} value={student.medicalNote} />
              <Detail label={t("common.notes")} value={student.notes} />
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title={t("student.guardians")} />
            {student.guardians.length === 0 ? (
              <EmptyState title={t("student.noGuardians")} />
            ) : (
              <ul className="divide-y divide-ink-100">
                {student.guardians.map((link) => (
                  <li key={link.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        href={`/${locale}/parents/${link.guardian.id}` as Route}
                        className="min-w-0 truncate font-medium text-ink-900 hover:text-brand-700"
                      >
                        {pickName(locale, link.guardian.name, link.guardian.nameKm)}
                      </Link>
                      <span className="shrink-0 text-sm text-ink-500">
                        {t(`relationship.${link.relationship}` as MessageKey)}
                      </span>
                    </div>
                    <a
                      href={`tel:${link.guardian.phone}`}
                      className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-700"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {link.guardian.phone}
                    </a>
                    {link.isPrimary || link.isEmergencyContact ? (
                      <p className="mt-1 text-xs text-ink-400">
                        {[
                          link.isPrimary ? t("guardian.isPrimary") : null,
                          link.isEmergencyContact ? t("guardian.isEmergency") : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {editable ? (
            <form action={archiveStudent.bind(null, student.id, locale)}>
              <Button type="submit" variant="secondary" block>
                {student.archivedAt ? t("student.restore") : t("student.archive")}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </PageBody>
  );
}
