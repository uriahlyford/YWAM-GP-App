import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { getGuardian } from "@/features/guardians/queries";
import { GuardianForm } from "@/features/guardians/forms";
import { PageBody, PageHeader } from "@/components/ui/page";

export default async function EditGuardianPage({
  params,
}: PageProps<"/[locale]/parents/[id]/edit">) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("guardians.write");
  const guardian = await getGuardian(auth, id);
  if (!guardian) notFound();

  return (
    <PageBody>
      <PageHeader title={t("guardian.edit")} />
      <GuardianForm
        guardian={{
          id: guardian.id,
          name: guardian.name,
          nameKm: guardian.nameKm,
          phone: guardian.phone,
          phone2: guardian.phone2,
          email: guardian.email,
          occupation: guardian.occupation,
          address: guardian.address,
          preferredLocale: guardian.preferredLocale,
          notes: guardian.notes,
        }}
      />
    </PageBody>
  );
}
