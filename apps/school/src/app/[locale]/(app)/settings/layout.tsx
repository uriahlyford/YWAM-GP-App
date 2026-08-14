import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageBody, PageHeader } from "@/components/ui/page";
import { SettingsTabs } from "@/features/school/tabs";

export default async function SettingsLayout({
  children,
  params,
}: LayoutProps<"/[locale]/settings">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  await requirePermission("school.write");

  return (
    <PageBody>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.subtitle")}
      />
      <SettingsTabs />
      <div className="mt-5">{children}</div>
    </PageBody>
  );
}
