import {
  createTranslator,
  formatDateWithWeekday,
  isLocale,
  DEFAULT_LOCALE,
} from "@/lib/i18n";
import { today } from "@/lib/date";

export default async function DashboardPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const t = createTranslator(isLocale(locale) ? locale : DEFAULT_LOCALE);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold text-ink-900">{t("nav.dashboard")}</h1>
      <p className="mt-2 text-ink-600">{formatDateWithWeekday(t, today())}</p>
    </main>
  );
}
