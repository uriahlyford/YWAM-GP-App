import { createTranslator, DEFAULT_LOCALE } from "@/lib/i18n";

/**
 * No `params` are available in a not-found boundary, so this renders in the
 * default language. Rare enough not to be worth a cookie read.
 */
export default function NotFound() {
  const t = createTranslator(DEFAULT_LOCALE);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-50 p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-ink-900">
          {t("error.notFound")}
        </h1>
        <p className="mt-2 text-ink-600">{t("error.notFound.body")}</p>
      </div>
    </div>
  );
}
