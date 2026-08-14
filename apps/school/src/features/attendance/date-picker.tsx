"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Route } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { addDays, type DateOnly } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Day navigation for the register.
 *
 * Arrows rather than only a date field, because the common case is "yesterday, I
 * forgot" — one tap, not a calendar. The native date input is still there for
 * anything further back.
 *
 * Dates travel as `YYYY-MM-DD` strings and are compared as strings. The school's
 * own today is passed in from the server, computed in the school's timezone; the
 * browser's clock is never consulted, so a phone left on the wrong timezone
 * cannot file a register against the wrong day.
 */
export function DatePicker({
  date,
  today,
  basePath,
}: {
  date: DateOnly;
  today: DateOnly;
  basePath: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(target: DateOnly) {
    const href = target === today ? basePath : `${basePath}?date=${target}`;
    startTransition(() => router.replace(href as Route));
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", pending && "opacity-60")}
    >
      <Button
        variant="secondary"
        size="md"
        onClick={() => go(addDays(date, -1))}
        aria-label={t("attendance.previousDay")}
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </Button>

      <label className="flex-1 sm:flex-none">
        <span className="sr-only">{t("attendance.date")}</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(event) => {
            if (event.target.value) go(event.target.value as DateOnly);
          }}
          className="h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-base text-ink-900 focus:border-brand-600 focus:outline-2 focus:outline-brand-600 sm:w-auto"
        />
      </label>

      <Button
        variant="secondary"
        size="md"
        onClick={() => go(addDays(date, 1))}
        disabled={date >= today}
        aria-label={t("attendance.nextDay")}
      >
        <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </Button>

      {date !== today ? (
        <Button variant="ghost" size="md" onClick={() => go(today)}>
          {t("attendance.today")}
        </Button>
      ) : null}
    </div>
  );
}
