import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import {
  createTranslator,
  formatNumber,
  isLocale,
  pickName,
  studentName,
  DEFAULT_LOCALE,
  type MessageKey,
} from "@/lib/i18n";
import { StudentStatus } from "@/generated/prisma/enums";
import { STUDENT_PAGE_SIZE, listStudents } from "@/features/students/queries";
import { StudentFilters } from "@/features/students/filters";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Card, EmptyState } from "@/components/ui/surface";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";

export default async function StudentsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/students">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("students.read");
  const query = await searchParams;

  const q = typeof query.q === "string" ? query.q : undefined;
  const classId = typeof query.class === "string" ? query.class : undefined;
  const statusParam = typeof query.status === "string" ? query.status : undefined;
  const status =
    statusParam && statusParam in StudentStatus
      ? (statusParam as StudentStatus)
      : undefined;
  const page = Math.max(1, Number(query.page) || 1);

  const [{ students, total }, classes] = await Promise.all([
    listStudents(auth, { q, classId, status, page }),
    prisma.class.findMany({
      where: { schoolId: auth.schoolId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameKm: true },
    }),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / STUDENT_PAGE_SIZE));

  function pageHref(target: number): Route {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (classId) next.set("class", classId);
    if (status) next.set("status", status);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/${locale}/students${qs ? `?${qs}` : ""}` as Route;
  }

  return (
    <PageBody>
      <PageHeader
        title={t("students.title")}
        description={t.plural("students.count", total)}
        action={
          can(auth, "students.write") ? (
            <Link
              href={`/${locale}/students/new`}
              className={buttonStyles({ size: "md" })}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("students.add")}
            </Link>
          ) : null
        }
      />

      <StudentFilters classes={classes} />

      <Card className="mt-4 overflow-hidden">
        {students.length === 0 ? (
          <EmptyState title={t("students.none")} body={t("students.none.body")} />
        ) : (
          <ul className="divide-y divide-ink-200">
            {students.map((student) => {
              const name = studentName(locale, student);
              const klass = student.enrollments[0]?.class;
              return (
                <li key={student.id}>
                  <Link
                    href={`/${locale}/students/${student.id}` as Route}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50 sm:px-5"
                  >
                    <Avatar photoKey={student.photoKey} name={name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-900">
                        {name}
                        {student.englishName ? (
                          <span className="ms-1.5 font-normal text-ink-500">
                            ({student.englishName})
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-sm text-ink-500">
                        {student.studentCode}
                        {" · "}
                        {klass
                          ? pickName(locale, klass.name, klass.nameKm)
                          : t("students.noClass")}
                        {student.status !== StudentStatus.ACTIVE
                          ? ` · ${t(`student.status.${student.status}` as MessageKey)}`
                          : ""}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-ink-300 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {lastPage > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-500">
            {formatNumber(locale, page)} / {formatNumber(locale, lastPage)}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className={buttonStyles({ variant: "secondary", size: "md" })}
              >
                {t("action.previous")}
              </Link>
            ) : null}
            {page < lastPage ? (
              <Link
                href={pageHref(page + 1)}
                className={buttonStyles({ variant: "secondary", size: "md" })}
              >
                {t("action.next")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageBody>
  );
}
