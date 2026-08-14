import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { AddSubject, SubjectRow } from "@/features/school/forms";

export default async function SubjectsPage({
  params,
}: PageProps<"/[locale]/settings/subjects">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("school.write");

  const subjects = await prisma.subject.findMany({
    where: { schoolId: auth.schoolId },
    orderBy: [{ ordinal: "asc" }, { name: "asc" }],
  });

  const nextOrdinal = subjects.length
    ? Math.max(...subjects.map((s) => s.ordinal)) + 1
    : 0;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader title={t("subject.title")} description={t("subject.subtitle")} />
        {subjects.length === 0 ? (
          <EmptyState title={t("common.empty")} />
        ) : (
          <div className="divide-y divide-ink-200">
            {subjects.map((subject) => (
              <SubjectRow key={subject.id} subject={subject} />
            ))}
          </div>
        )}
      </Card>

      <AddSubject nextOrdinal={nextOrdinal} />
    </div>
  );
}
