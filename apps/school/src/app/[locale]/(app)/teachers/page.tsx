import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/auth/context";
import {
  createTranslator,
  isLocale,
  pickName,
  DEFAULT_LOCALE,
} from "@/lib/i18n";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Card, EmptyState } from "@/components/ui/surface";
import { buttonStyles } from "@/components/ui/button";

export default async function TeachersPage({
  params,
}: PageProps<"/[locale]/teachers">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("teachers.read");

  const teachers = await prisma.teacherProfile.findMany({
    where: { schoolId: auth.schoolId },
    orderBy: { user: { displayName: "asc" } },
    select: {
      id: true,
      staffCode: true,
      phone: true,
      user: {
        select: {
          displayName: true,
          displayNameKm: true,
          isActive: true,
          username: true,
        },
      },
      _count: { select: { classAssignments: true } },
    },
  });

  return (
    <PageBody>
      <PageHeader
        title={t("teachers.title")}
        description={t("teachers.subtitle")}
        action={
          can(auth, "teachers.write") ? (
            <Link href={`/${locale}/teachers/new`} className={buttonStyles()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("teachers.add")}
            </Link>
          ) : null
        }
      />

      <Card className="overflow-hidden">
        {teachers.length === 0 ? (
          <EmptyState title={t("teachers.none")} />
        ) : (
          <ul className="divide-y divide-ink-200">
            {teachers.map((teacher) => (
              <li key={teacher.id}>
                <Link
                  href={`/${locale}/teachers/${teacher.id}` as Route}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-ink-50 sm:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink-900">
                      {pickName(
                        locale,
                        teacher.user.displayName,
                        teacher.user.displayNameKm,
                      )}
                      {!teacher.user.isActive ? (
                        <span className="ms-2 text-sm font-normal text-ink-400">
                          {t("field.inactive")}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-sm text-ink-500">
                      {[
                        teacher.staffCode,
                        t.plural("teacher.classCount", teacher._count.classAssignments),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
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
    </PageBody>
  );
}
