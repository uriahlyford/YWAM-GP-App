import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { Locale } from "@/generated/prisma/enums";
import { TeacherForm } from "@/features/teachers/forms";
import { PageBody, PageHeader } from "@/components/ui/page";

export default async function NewTeacherPage({
  params,
}: PageProps<"/[locale]/teachers/new">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  await requirePermission("teachers.write");

  return (
    <PageBody>
      <PageHeader title={t("teacher.new")} />
      <TeacherForm
        teacher={{
          username: "",
          displayName: "",
          displayNameKm: null,
          email: null,
          locale: Locale.KM,
          staffCode: null,
          phone: null,
          hireDate: null,
          notes: null,
          isActive: true,
        }}
      />
    </PageBody>
  );
}
