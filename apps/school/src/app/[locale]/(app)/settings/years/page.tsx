import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { fromDbDate } from "@/lib/date";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { AddTerm, AddYear, TermRow, YearRow } from "@/features/school/forms";

export default async function AcademicYearsPage({
  params,
}: PageProps<"/[locale]/settings/years">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("school.write");

  const years = await prisma.academicYear.findMany({
    where: { schoolId: auth.schoolId },
    orderBy: { startDate: "desc" },
    include: { terms: { orderBy: { ordinal: "asc" } } },
  });

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader title={t("year.title")} description={t("year.subtitle")} />
        {years.length === 0 ? (
          <EmptyState title={t("common.empty")} />
        ) : (
          <div className="divide-y divide-ink-200">
            {years.map((year) => (
              <YearRow
                key={year.id}
                year={{
                  id: year.id,
                  name: year.name,
                  nameKm: year.nameKm,
                  startDate: fromDbDate(year.startDate),
                  endDate: fromDbDate(year.endDate),
                  isCurrent: year.isCurrent,
                }}
              >
                <div className="border-t border-ink-100 bg-ink-50/60 ps-6">
                  <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-ink-400 sm:px-5">
                    {t("year.terms")}
                  </p>
                  {year.terms.length === 0 ? (
                    <p className="px-4 py-2 text-sm text-ink-500 sm:px-5">
                      {t("year.noTerms")}
                    </p>
                  ) : (
                    <div className="divide-y divide-ink-200">
                      {year.terms.map((term) => (
                        <TermRow
                          key={term.id}
                          academicYearId={year.id}
                          term={{
                            id: term.id,
                            name: term.name,
                            nameKm: term.nameKm,
                            ordinal: term.ordinal,
                            startDate: fromDbDate(term.startDate),
                            endDate: fromDbDate(term.endDate),
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="pb-3">
                    <AddTerm academicYearId={year.id} />
                  </div>
                </div>
              </YearRow>
            ))}
          </div>
        )}
      </Card>

      <AddYear />
    </div>
  );
}
