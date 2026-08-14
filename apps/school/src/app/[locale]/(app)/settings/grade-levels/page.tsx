import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { AddGradeLevel, GradeLevelRow } from "@/features/school/forms";

export default async function GradeLevelsPage({
  params,
}: PageProps<"/[locale]/settings/grade-levels">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("school.write");

  const levels = await prisma.gradeLevel.findMany({
    where: { schoolId: auth.schoolId },
    orderBy: { ordinal: "asc" },
    include: { _count: { select: { classes: true } } },
  });

  const nextOrdinal = levels.length
    ? Math.max(...levels.map((l) => l.ordinal)) + 1
    : 0;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title={t("gradeLevel.title")}
          description={t("gradeLevel.subtitle")}
        />
        {levels.length === 0 ? (
          <EmptyState title={t("common.empty")} />
        ) : (
          <div className="divide-y divide-ink-200">
            {levels.map((level) => (
              <GradeLevelRow
                key={level.id}
                level={{
                  id: level.id,
                  name: level.name,
                  nameKm: level.nameKm,
                  ordinal: level.ordinal,
                  isActive: level.isActive,
                }}
                classCount={level._count.classes}
              />
            ))}
          </div>
        )}
      </Card>

      <AddGradeLevel nextOrdinal={nextOrdinal} />
    </div>
  );
}
