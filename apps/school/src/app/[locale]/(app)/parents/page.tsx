import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/context";
import {
  createTranslator,
  formatNumber,
  isLocale,
  pickName,
  DEFAULT_LOCALE,
} from "@/lib/i18n";
import { GUARDIAN_PAGE_SIZE, listGuardians } from "@/features/guardians/queries";
import { SearchBox } from "@/components/ui/search-box";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Card, EmptyState } from "@/components/ui/surface";
import { buttonStyles } from "@/components/ui/button";

export default async function ParentsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/parents">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("guardians.read");
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : undefined;
  const page = Math.max(1, Number(query.page) || 1);

  const { guardians, total } = await listGuardians(auth, { q, page });
  const lastPage = Math.max(1, Math.ceil(total / GUARDIAN_PAGE_SIZE));

  function pageHref(target: number): Route {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/${locale}/parents${qs ? `?${qs}` : ""}` as Route;
  }

  return (
    <PageBody>
      <PageHeader
        title={t("parents.title")}
        description={t.plural("parents.count", total)}
        action={
          can(auth, "guardians.write") ? (
            <Link href={`/${locale}/parents/new`} className={buttonStyles()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("parents.add")}
            </Link>
          ) : null
        }
      />

      <SearchBox placeholder={t("parents.search")} />

      <Card className="mt-4 overflow-hidden">
        {guardians.length === 0 ? (
          <EmptyState title={t("parents.none")} />
        ) : (
          <ul className="divide-y divide-ink-200">
            {guardians.map((guardian) => (
              <li key={guardian.id}>
                <Link
                  href={`/${locale}/parents/${guardian.id}` as Route}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-ink-50 sm:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink-900">
                      {pickName(locale, guardian.name, guardian.nameKm)}
                    </span>
                    <span className="block truncate text-sm text-ink-500">
                      {guardian.phone} ·{" "}
                      {t.plural("guardian.childCount", guardian._count.students)}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-ink-300 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {lastPage > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-500">
            {formatNumber(locale, page)} / {formatNumber(locale, lastPage)}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={buttonStyles({ variant: "secondary" })}>
                {t("action.previous")}
              </Link>
            ) : null}
            {page < lastPage ? (
              <Link href={pageHref(page + 1)} className={buttonStyles({ variant: "secondary" })}>
                {t("action.next")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageBody>
  );
}
