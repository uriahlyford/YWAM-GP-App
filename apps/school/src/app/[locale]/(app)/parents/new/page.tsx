import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { Locale } from "@/generated/prisma/enums";
import { GuardianForm } from "@/features/guardians/forms";
import { PageBody, PageHeader } from "@/components/ui/page";

export default async function NewGuardianPage({
  params,
}: PageProps<"/[locale]/parents/new">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  await requirePermission("guardians.write");

  return (
    <PageBody>
      <PageHeader title={t("guardian.new")} />
      <GuardianForm
        guardian={{
          name: "",
          nameKm: null,
          phone: "",
          phone2: null,
          email: null,
          occupation: null,
          address: null,
          // Khmer by default: most parents at a Cambodian primary school read it.
          preferredLocale: Locale.KM,
          notes: null,
        }}
      />
    </PageBody>
  );
}
