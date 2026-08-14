import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { Card, CardHeader } from "@/components/ui/surface";
import { SchoolForm } from "@/features/school/forms";

export default async function SchoolSettingsPage({
  params,
}: PageProps<"/[locale]/settings">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("school.write");
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: auth.schoolId },
    select: {
      name: true,
      nameKm: true,
      address: true,
      addressKm: true,
      phone: true,
      email: true,
      timezone: true,
    },
  });

  return (
    <Card>
      <CardHeader
        title={t("school.details")}
        description={t("school.details.hint")}
      />
      <div className="p-4 sm:p-5">
        <SchoolForm school={school} />
      </div>
    </Card>
  );
}
