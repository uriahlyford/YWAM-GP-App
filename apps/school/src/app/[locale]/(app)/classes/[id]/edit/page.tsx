import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { ClassForm } from "@/features/classes/forms";
import { PageBody, PageHeader } from "@/components/ui/page";

export default async function EditClassPage({
  params,
}: PageProps<"/[locale]/classes/[id]/edit">) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("classes.write");

  const [klass, years, gradeLevels, teachers] = await Promise.all([
    prisma.class.findFirst({ where: { id, schoolId: auth.schoolId } }),
    prisma.academicYear.findMany({
      where: { schoolId: auth.schoolId },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, isCurrent: true },
    }),
    prisma.gradeLevel.findMany({
      where: { schoolId: auth.schoolId },
      orderBy: { ordinal: "asc" },
      select: { id: true, name: true, nameKm: true },
    }),
    prisma.teacherProfile.findMany({
      where: { schoolId: auth.schoolId, user: { isActive: true } },
      orderBy: { user: { displayName: "asc" } },
      select: { id: true, user: { select: { displayName: true, displayNameKm: true } } },
    }),
  ]);
  if (!klass) notFound();

  return (
    <PageBody>
      <PageHeader title={t("class.edit")} />
      <ClassForm
        years={years}
        gradeLevels={gradeLevels}
        teachers={teachers.map((teacher) => ({
          id: teacher.id,
          name: teacher.user.displayName,
          nameKm: teacher.user.displayNameKm,
        }))}
        klass={{
          id: klass.id,
          academicYearId: klass.academicYearId,
          gradeLevelId: klass.gradeLevelId,
          name: klass.name,
          nameKm: klass.nameKm,
          room: klass.room,
          homeroomTeacherId: klass.homeroomTeacherId,
          isActive: klass.isActive,
        }}
      />
    </PageBody>
  );
}
