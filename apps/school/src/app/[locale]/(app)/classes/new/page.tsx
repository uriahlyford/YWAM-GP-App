import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { ClassForm } from "@/features/classes/forms";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Alert } from "@/components/ui/surface";

export default async function NewClassPage({
  params,
}: PageProps<"/[locale]/classes/new">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("classes.write");

  const [years, gradeLevels, teachers] = await Promise.all([
    prisma.academicYear.findMany({
      where: { schoolId: auth.schoolId },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, isCurrent: true },
    }),
    prisma.gradeLevel.findMany({
      where: { schoolId: auth.schoolId, isActive: true },
      orderBy: { ordinal: "asc" },
      select: { id: true, name: true, nameKm: true },
    }),
    prisma.teacherProfile.findMany({
      where: { schoolId: auth.schoolId, user: { isActive: true } },
      orderBy: { user: { displayName: "asc" } },
      select: { id: true, user: { select: { displayName: true, displayNameKm: true } } },
    }),
  ]);

  // A class can't exist without a year and a level to hang it on.
  if (years.length === 0 || gradeLevels.length === 0) {
    return (
      <PageBody>
        <PageHeader title={t("class.new")} />
        <Alert tone="info">{t("common.empty")}</Alert>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader title={t("class.new")} />
      <ClassForm
        years={years}
        gradeLevels={gradeLevels}
        teachers={teachers.map((teacher) => ({
          id: teacher.id,
          name: teacher.user.displayName,
          nameKm: teacher.user.displayNameKm,
        }))}
        klass={{
          academicYearId: years.find((y) => y.isCurrent)?.id ?? years[0].id,
          gradeLevelId: gradeLevels[0].id,
          name: "",
          nameKm: null,
          room: null,
          homeroomTeacherId: null,
          isActive: true,
        }}
      />
    </PageBody>
  );
}
