import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, requireAuth } from "@/lib/auth/context";
import { createTranslator, isLocale, pickName, DEFAULT_LOCALE } from "@/lib/i18n";
import { NAV_ITEMS } from "@/components/nav/items";
import { BottomNav, Sidebar } from "@/components/nav/app-nav";
import { UserMenu } from "@/components/nav/user-menu";
import { LocaleSwitch } from "@/components/locale-switch";
import { SchoolMark } from "@/components/school-mark";

/**
 * The authenticated shell. Every page beneath it has already been through
 * `requireAuth`, but each one still resolves its own permissions — this layout
 * is convenience, not the security boundary.
 */
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requireAuth();

  // A temporary password gets one destination until it is changed.
  if (auth.user.mustChangePassword) {
    redirect(`/${locale}/account/password`);
  }

  const school = await prisma.school.findUnique({
    where: { id: auth.schoolId },
    select: { name: true, nameKm: true },
  });

  const items = NAV_ITEMS.filter((item) => can(auth, item.permission));

  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
          <Link
            href={`/${locale}/dashboard`}
            className="flex min-w-0 items-center gap-2.5"
          >
            <SchoolMark className="h-8 w-8 shrink-0 text-brand-700" />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink-900">
                {pickName(locale, school?.name, school?.nameKm) || t("app.name")}
              </span>
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-2">
            <LocaleSwitch />
            <UserMenu
              displayName={pickName(
                locale,
                auth.user.displayName,
                auth.user.displayNameKm,
              )}
              role={auth.role}
            />
          </div>
        </div>
      </header>

      <div className="flex">
        <Sidebar items={items} />
        {/* Bottom padding clears the phone tab bar. */}
        <main className="min-w-0 flex-1 pb-24 lg:pb-8">{children}</main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}
