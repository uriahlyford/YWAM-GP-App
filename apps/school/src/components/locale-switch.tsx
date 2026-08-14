"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Route } from "next";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

/**
 * A year is right for this: a teacher picks Khmer once. Defined outside the
 * component because it writes to a browser global, which the React Compiler
 * rightly refuses to let a component body do.
 */
function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}

/**
 * Swaps the locale segment of the current URL and remembers the choice, so the
 * next visit — and the redirect from `/` — lands in the same language.
 */
export function LocaleSwitch({ className }: { className?: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  function switchTo(locale: Locale) {
    if (locale === t.locale) return;

    rememberLocale(locale);

    const segments = pathname.split("/");
    segments[1] = locale;
    const query = search.toString();

    startTransition(() => {
      router.replace(
        `${segments.join("/")}${query ? `?${query}` : ""}` as Route,
      );
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-ink-300 bg-white p-0.5",
        pending && "opacity-60",
        className,
      )}
      role="group"
      aria-label={t("common.language")}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => switchTo(locale)}
          aria-current={locale === t.locale}
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium leading-tight transition-colors",
            locale === t.locale
              ? "bg-brand-700 text-white"
              : "text-ink-600 hover:bg-ink-100",
          )}
          // The Khmer label must render in Khmer even while the page is English.
          lang={locale}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
