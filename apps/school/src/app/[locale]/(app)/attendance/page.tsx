import Link from "next/link";
import type { Route } from "next";
import { Check, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/context";
import {
  createTranslator,
  formatDateWithWeekday,
  isLocale,
  pickName,
  DEFAULT_LOCALE,
} from "@/lib/i18n";
import { isDateOnly, isWeekend, today, type DateOnly } from "@/lib/date";
import { classesForDate } from "@/features/attendance/queries";
import { DatePicker } from "@/features/attendance/date-picker";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Alert, Card, EmptyState } from "@/components/ui/surface";

export default async function AttendancePage({
  params,
  searchParams,
}: PageProps<"/[locale]/attendance">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("attendance.read");
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: auth.schoolId },
    select: { timezone: true },
  });

  // The school's own day, not the server's. At UTC+7 a register taken at 06:45
  // would otherwise be filed against yesterday.
  const currentDay = today(school.timezone);
  const query = await searchParams;
  const requested = typeof query.date === "string" ? query.date : undefined;
  const date: DateOnly =
    requested && isDateOnly(requested) ? requested : currentDay;

  const classes = await classesForDate(auth, date);
  const remaining = classes.filter((klass) => !klass.session).length;

  return (
    <PageBody>
      <PageHeader
        title={t("attendance.title")}
        description={formatDateWithWeekday(t, date)}
      />

      <DatePicker date={date} today={currentDay} basePath={`/${locale}/attendance`} />

      {date > currentDay ? (
        <Alert tone="warning" className="mt-4">
          {t("attendance.future")}
        </Alert>
      ) : null}
      {isWeekend(date) ? (
        <Alert tone="info" className="mt-4">
          {t("attendance.weekend")}
        </Alert>
      ) : null}

      <Card className="mt-4 overflow-hidden">
        {classes.length === 0 ? (
          <EmptyState title={t("attendance.noClasses")} />
        ) : (
          <ul className="divide-y divide-ink-200">
            {classes.map((klass) => (
              <li key={klass.id}>
                <Link
                  href={
                    `/${locale}/attendance/${klass.id}${
                      date === currentDay ? "" : `?date=${date}`
                    }` as Route
                  }
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-ink-50 sm:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink-900">
                      {pickName(locale, klass.name, klass.nameKm)}
                    </span>
                    <span className="block truncate text-sm text-ink-500">
                      {klass.session
                        ? t("attendance.summaryLine", klass.counts)
                        : t.plural("students.count", klass._count.enrollments)}
                    </span>
                  </span>

                  {klass.session ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-present-50 px-2.5 py-1 text-sm font-medium text-present-700">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("attendance.taken")}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-sm font-medium text-ink-500">
                      {t("attendance.notTaken")}
                    </span>
                  )}

                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-ink-300 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {classes.length > 0 ? (
        <p className="mt-3 text-sm text-ink-500">
          {remaining === 0
            ? t("attendance.allDone")
            : t.plural("attendance.classesRemaining", remaining)}
        </p>
      ) : null}
    </PageBody>
  );
}
