import { redirect } from "next/navigation";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { getAuth } from "@/lib/auth/context";
import { LoginForm } from "@/features/auth/login-form";
import { LocaleSwitch } from "@/components/locale-switch";
import { Card } from "@/components/ui/surface";
import { SchoolMark } from "@/components/school-mark";

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await getAuth();
  if (auth) redirect(`/${locale}/dashboard`);

  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <header className="flex justify-end p-4">
        <LocaleSwitch />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center sm:pb-24">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <SchoolMark className="h-12 w-12 text-brand-700" />
            <h1 className="mt-3 text-xl font-semibold text-ink-900">
              {t("auth.signIn.title")}
            </h1>
            <p className="mt-1 text-sm text-ink-500">{t("auth.signIn.subtitle")}</p>
          </div>

          <Card className="p-5">
            <LoginForm next={nextPath} />
          </Card>
        </div>
      </main>
    </div>
  );
}
