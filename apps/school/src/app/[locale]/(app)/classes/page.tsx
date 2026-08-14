import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission, visibleClassWhere } from "@/lib/auth/context";
import {
  createTranslator,
  isLocale,
  pickName,
  DEFAULT_LOCALE,
} from "@/lib/i18n";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { buttonStyles } from "@/components/ui/button";

export default async function ClassesPage({
  params,
}: PageProps<"/[locale]/classes">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("classes.read");
  const scope = await visibleClassWhere(auth);

  const classes = await prisma.class.findMany({
    where: scope,
    orderBy: [
      { academicYear: { startDate: "desc" } },
      { gradeLevel: { ordinal: "asc" } },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      nameKm: true,
      room: true,
      isActive: true,
      academicYear: { select: { id: true, name: true, isCurrent: true } },
      gradeLevel: { select: { name: true, nameKm: true } },
      homeroomTeacher: {
        select: { user: { select: { displayName: true, displayNameKm: true } } },
      },
      _count: { select: { enrollments: { where: { status: "ENROLLED" } } } },
    },
  });

  // Grouped by academic year, newest first — a school looking at classes is
  // almost always looking at one year at a time.
  const byYear = new Map<string, { name: string; isCurrent: boolean; classes: typeof classes }>();
  for (const klass of classes) {
    const entry = byYear.get(klass.academicYear.id) ?? {
      name: klass.academicYear.name,
      isCurrent: klass.academicYear.isCurrent,
      classes: [] as typeof classes,
    };
    entry.classes.push(klass);
    byYear.set(klass.academicYear.id, entry);
  }

  return (
    <PageBody>
      <PageHeader
        title={t("classes.title")}
        description={t("classes.subtitle")}
        action={
          can(auth, "classes.write") ? (
            <Link href={`/${locale}/classes/new`} className={buttonStyles()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("classes.add")}
            </Link>
          ) : null
        }
      />

      {classes.length === 0 ? (
        <Card>
          <EmptyState title={t("classes.none")} />
        </Card>
      ) : (
        <div className="space-y-4">
          {[...byYear.entries()].map(([yearId, group]) => (
            <Card key={yearId} className="overflow-hidden">
              <CardHeader
                title={group.name}
                description={t.plural("classes.count", group.classes.length)}
                action={
                  group.isCurrent ? (
                    <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800">
                      {t("year.currentBadge")}
                    </span>
                  ) : null
                }
              />
              <ul className="divide-y divide-ink-200">
                {group.classes.map((klass) => (
                  <li key={klass.id}>
                    <Link
                      href={`/${locale}/classes/${klass.id}` as Route}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-ink-50 sm:px-5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-900">
                          {pickName(locale, klass.name, klass.nameKm)}
                          {!klass.isActive ? (
                            <span className="ms-2 text-sm font-normal text-ink-400">
                              {t("class.inactive")}
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-sm text-ink-500">
                          {[
                            t.plural("students.count", klass._count.enrollments),
                            klass.homeroomTeacher
                              ? pickName(
                                  locale,
                                  klass.homeroomTeacher.user.displayName,
                                  klass.homeroomTeacher.user.displayNameKm,
                                )
                              : t("class.noHomeroomTeacher"),
                            klass.room,
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
            </Card>
          ))}
        </div>
      )}
    </PageBody>
  );
}
