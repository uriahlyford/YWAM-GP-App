import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/context";
import {
  createTranslator,
  formatDateWithWeekday,
  isLocale,
  pickName,
  DEFAULT_LOCALE,
} from "@/lib/i18n";
import { dateOnlyOf, isDateOnly, timeOfDay, today, type DateOnly } from "@/lib/date";
import { getRegister, registerHistory } from "@/features/attendance/queries";
import { AttendanceRegister } from "@/features/attendance/register";
import { DatePicker } from "@/features/attendance/date-picker";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/surface";

export default async function TakeAttendancePage({
  params,
  searchParams,
}: PageProps<"/[locale]/attendance/[classId]">) {
  const { locale: raw, classId } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("attendance.write");
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: auth.schoolId },
    select: { timezone: true },
  });

  const currentDay = today(school.timezone);
  const query = await searchParams;
  const requested = typeof query.date === "string" ? query.date : undefined;
  const date: DateOnly =
    requested && isDateOnly(requested) ? requested : currentDay;

  const register = await getRegister(auth, classId, date);
  if (!register) notFound();

  const history = await registerHistory(auth, classId, date);

  return (
    <PageBody>
      <PageHeader
        title={pickName(locale, register.className, register.classNameKm)}
        description={formatDateWithWeekday(t, date)}
        action={
          <Link
            href={`/${locale}/attendance` as Route}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            {t("action.back")}
          </Link>
        }
      />

      <div className="mb-4">
        <DatePicker
          date={date}
          today={currentDay}
          basePath={`/${locale}/attendance/${classId}`}
        />
      </div>

      {register.takenBy ? (
        <p className="mb-4 text-sm text-ink-500">
          {t("attendance.takenBy", {
            name: pickName(
              locale,
              register.takenBy.displayName,
              register.takenBy.displayNameKm,
            ),
          })}
          {register.takenAt
            ? ` · ${timeOfDay(register.takenAt, school.timezone)}`
            : ""}
        </p>
      ) : null}

      <AttendanceRegister register={register} />

      {/* The trail, on the same screen as the register it describes. An
          attendance change that nobody can see is not really accountable. */}
      {history.length > 0 ? (
        <Card className="mt-6 overflow-hidden">
          <CardHeader title={t("attendance.history")} />
          <ul className="divide-y divide-ink-100">
            {history.map((entry) => {
              const before = entry.before as { status?: string } | null;
              const after = entry.after as { status?: string } | null;
              return (
                <li key={entry.id} className="px-4 py-2.5 text-sm sm:px-5">
                  <span className="text-ink-700">{entry.summary}</span>
                  <span className="text-ink-500">
                    {" — "}
                    {before?.status ? `${before.status} → ` : ""}
                    {after?.status ?? ""}
                  </span>
                  <span className="ms-2 text-ink-400">
                    {entry.actor
                      ? pickName(
                          locale,
                          entry.actor.displayName,
                          entry.actor.displayNameKm,
                        )
                      : t("audit.system")}
                    {" · "}
                    {timeOfDay(entry.createdAt, school.timezone)}
                    {dateOnlyOf(entry.createdAt, school.timezone) !== date
                      ? ` · ${dateOnlyOf(entry.createdAt, school.timezone)}`
                      : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </PageBody>
  );
}
