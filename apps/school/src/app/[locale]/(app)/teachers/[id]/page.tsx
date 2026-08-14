import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { Pencil, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/auth/context";
import {
  createTranslator,
  formatDate,
  isLocale,
  pickName,
  DEFAULT_LOCALE,
  type MessageKey,
} from "@/lib/i18n";
import { fromDbDate } from "@/lib/date";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Alert, Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { buttonStyles } from "@/components/ui/button";

export default async function TeacherProfilePage({
  params,
}: PageProps<"/[locale]/teachers/[id]">) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("teachers.read");
  const teacher = await prisma.teacherProfile.findFirst({
    where: { id, schoolId: auth.schoolId },
    include: {
      user: true,
      classAssignments: {
        include: {
          class: {
            select: {
              id: true,
              name: true,
              nameKm: true,
              academicYear: { select: { name: true, isCurrent: true } },
              _count: { select: { enrollments: true } },
            },
          },
        },
      },
    },
  });
  if (!teacher) notFound();

  const name = pickName(locale, teacher.user.displayName, teacher.user.displayNameKm);

  return (
    <PageBody>
      <PageHeader
        title={name}
        description={teacher.staffCode ?? undefined}
        action={
          can(auth, "teachers.write") ? (
            <Link
              href={`/${locale}/teachers/${teacher.id}/edit` as Route}
              className={buttonStyles({ variant: "secondary" })}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("action.edit")}
            </Link>
          ) : null
        }
      />

      {!teacher.user.isActive ? (
        <Alert tone="warning" className="mb-4">
          {t("auth.accountInactive")}
        </Alert>
      ) : null}

      {teacher.user.mustChangePassword ? (
        <Alert tone="info" className="mb-4">
          {t("auth.mustChangePassword.body")}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("student.section.contact")} />
          <dl className="grid gap-3 p-4 sm:p-5">
            <div>
              <dt className="text-sm text-ink-500">{t("teacher.username")}</dt>
              <dd className="mt-0.5 font-mono text-ink-900">
                {teacher.user.username}
              </dd>
            </div>
            {teacher.phone ? (
              <div>
                <dt className="text-sm text-ink-500">{t("common.phone")}</dt>
                <dd className="mt-0.5">
                  <a
                    href={`tel:${teacher.phone}`}
                    className="inline-flex items-center gap-1.5 text-brand-700"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {teacher.phone}
                  </a>
                </dd>
              </div>
            ) : null}
            {teacher.user.email ? (
              <div>
                <dt className="text-sm text-ink-500">{t("common.email")}</dt>
                <dd className="mt-0.5 text-ink-900">{teacher.user.email}</dd>
              </div>
            ) : null}
            {teacher.hireDate ? (
              <div>
                <dt className="text-sm text-ink-500">{t("teacher.hireDate")}</dt>
                <dd className="mt-0.5 text-ink-900">
                  {formatDate(t, fromDbDate(teacher.hireDate))}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm text-ink-500">{t("common.language")}</dt>
              <dd className="mt-0.5 text-ink-900">
                {teacher.user.locale === "KM" ? "ខ្មែរ" : "English"}
              </dd>
            </div>
            {teacher.notes ? (
              <div>
                <dt className="text-sm text-ink-500">{t("common.notes")}</dt>
                <dd className="mt-0.5 text-ink-900">{teacher.notes}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={t("teacher.classes")} />
          {teacher.classAssignments.length === 0 ? (
            <EmptyState title={t("teacher.noClasses")} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {teacher.classAssignments.map((assignment) => (
                <li key={assignment.id} className="px-4 py-3 sm:px-5">
                  <Link
                    href={`/${locale}/classes/${assignment.class.id}` as Route}
                    className="block"
                  >
                    <span className="block font-medium text-ink-900">
                      {pickName(locale, assignment.class.name, assignment.class.nameKm)}
                    </span>
                    <span className="block text-sm text-ink-500">
                      {assignment.class.academicYear.name} ·{" "}
                      {t.plural(
                        "students.count",
                        assignment.class._count.enrollments,
                      )}{" "}
                      · {t(`classTeacher.${assignment.role}` as MessageKey)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageBody>
  );
}
