"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Route } from "next";
import { Search, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { pickName, type MessageKey } from "@/lib/i18n";
import { StudentStatus } from "@/generated/prisma/enums";
import { Select } from "@/components/ui/field";

/**
 * Search and filters, kept in the URL so a filtered list can be bookmarked or
 * sent to a colleague.
 *
 * The search box debounces before navigating. A Khmer keyboard commits a
 * cluster at a time and a teacher on provincial mobile data should not be
 * firing a query per keystroke.
 */
export function StudentFilters({
  classes,
}: {
  classes: { id: string; name: string; nameKm: string | null }[];
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [, startTransition] = useTransition();

  const committed = search.get("q") ?? "";
  const [term, setTerm] = useState(committed);

  const classId = search.get("class") ?? "";
  const status = search.get("status") ?? "";

  function push(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}` as Route);
    });
  }

  function withCurrent(): URLSearchParams {
    const next = new URLSearchParams();
    if (classId) next.set("class", classId);
    if (status) next.set("status", status);
    return next;
  }

  useEffect(() => {
    // Guarded by comparing against the URL, not by a "first render" ref. A ref
    // is cleared by StrictMode's first effect pass, so the second pass fires a
    // redundant replace that cancels a row tap the reader had just made.
    if (term.trim() === committed) return;

    const handle = setTimeout(() => {
      const next = withCurrent();
      if (term.trim()) next.set("q", term.trim());
      push(next);
    }, 300);

    return () => clearTimeout(handle);
    // `push` and `withCurrent` close over the current URL, which is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, committed]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t("students.search")}
          aria-label={t("action.search")}
          className="h-12 w-full rounded-xl border border-ink-300 bg-white ps-11 pe-10 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-2 focus:outline-brand-600"
        />
        {term ? (
          <button
            type="button"
            onClick={() => setTerm("")}
            aria-label={t("action.cancel")}
            className="absolute end-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-400 hover:bg-ink-100"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="min-w-40 flex-1 sm:max-w-64">
          <span className="sr-only">{t("students.filter.class")}</span>
          <Select
            value={classId}
            onChange={(event) => {
              const next = new URLSearchParams();
              if (event.target.value) next.set("class", event.target.value);
              if (status) next.set("status", status);
              if (term.trim()) next.set("q", term.trim());
              push(next);
            }}
          >
            <option value="">{t("students.filter.class")}</option>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {pickName(t.locale, klass.name, klass.nameKm)}
              </option>
            ))}
          </Select>
        </label>

        <label className="min-w-40 flex-1 sm:max-w-56">
          <span className="sr-only">{t("students.filter.status")}</span>
          <Select
            value={status}
            onChange={(event) => {
              const next = new URLSearchParams();
              if (classId) next.set("class", classId);
              if (event.target.value) next.set("status", event.target.value);
              if (term.trim()) next.set("q", term.trim());
              push(next);
            }}
          >
            <option value="">{t("students.filter.status")}</option>
            {Object.values(StudentStatus).map((value) => (
              <option key={value} value={value}>
                {t(`student.status.${value}` as MessageKey)}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </div>
  );
}
