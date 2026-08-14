"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Route } from "next";
import { Search, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/**
 * A search box that keeps its term in the URL.
 *
 * Debounced before navigating: a Khmer keyboard commits a cluster at a time, and
 * a teacher on provincial mobile data should not fire a query per keystroke.
 */
export function SearchBox({
  placeholder,
  paramName = "q",
}: {
  placeholder: string;
  paramName?: string;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [, startTransition] = useTransition();

  const committed = search.get(paramName) ?? "";
  const [term, setTerm] = useState(committed);

  useEffect(() => {
    // Compare against what the URL already holds rather than tracking "is this
    // the first render" in a ref. A ref guard looks equivalent but breaks under
    // StrictMode's double-invoked effects, where the second pass sees the flag
    // already cleared and fires a redundant replace — which cancels whatever
    // navigation the reader had just started by tapping a row.
    if (term.trim() === committed) return;

    const handle = setTimeout(() => {
      const next = new URLSearchParams();
      if (term.trim()) next.set(paramName, term.trim());
      const qs = next.toString();
      startTransition(() => {
        router.replace(`${pathname}${qs ? `?${qs}` : ""}` as Route);
      });
    }, 300);

    return () => clearTimeout(handle);
  }, [term, committed, paramName, pathname, router]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={placeholder}
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
  );
}
