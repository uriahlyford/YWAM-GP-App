import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { requireAuth } from "@/lib/auth/context";
import { PasswordForm } from "@/features/auth/password-form";
import { LocaleSwitch } from "@/components/locale-switch";
import { Alert, Card } from "@/components/ui/surface";

/**
 * Deliberately outside the (app) shell: a user with `mustChangePassword` is
 * redirected here by that layout, so rendering the shell around it would loop.
 */
export default async function ChangePasswordPage({
  params,
}: PageProps<"/[locale]/account/password">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requireAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <header className="flex justify-end p-4">
        <LocaleSwitch />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-xl font-semibold text-ink-900">
            {t("auth.mustChangePassword")}
          </h1>
          <p className="mb-5 text-sm text-ink-500">{auth.user.username}</p>

          {auth.user.mustChangePassword ? (
            <Alert tone="warning" className="mb-4">
              {t("auth.mustChangePassword.body")}
            </Alert>
          ) : null}

          <Card className="p-5">
            <PasswordForm />
          </Card>
        </div>
      </main>
    </div>
  );
}
