"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import type { Route } from "next";
import { Download } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { pickName, studentName, type MessageKey } from "@/lib/i18n";
import { REPORT_KINDS, REPORT_PARAMS, type ReportKind } from "./kinds";
import { Select } from "@/components/ui/field";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Named = { id: string; name: string; nameKm: string | null };

/**
 * Report chooser and its parameters.
 *
 * One form whose next URL is read from its own FormData, for the same reason the
 * gradebook's pickers are — building it from `useSearchParams` lags a render and
 * two quick changes lose one of them.
 *
 * Which parameters are shown depends on the report, because offering a student
 * picker for the daily summary invites the reader to fill in something that will
 * be ignored.
 */
export function ReportControls({
  kind,
  classes,
  students,
  values,
  downloadQuery,
  canDownload,
}: {
  kind: ReportKind;
  classes: Named[];
  students: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    firstNameKm: string | null;
    lastNameKm: string | null;
  }[];
  values: {
    date?: string;
    from?: string;
    to?: string;
    month?: string;
    classId?: string;
    studentId?: string;
  };
  downloadQuery: string;
  canDownload: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  const needs = REPORT_PARAMS[kind] as readonly string[];

  function submit() {
    if (!form.current) return;
    const data = new FormData(form.current);
    const next = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (typeof value === "string" && value) next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}` as Route);
    });
  }

  return (
    <div className="space-y-3">
      <form
        ref={form}
        method="get"
        className={cn("flex flex-wrap items-end gap-3", pending && "opacity-60")}
      >
        <label className="min-w-48 flex-1 sm:max-w-64">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">
            {t("reports.pick")}
          </span>
          <Select name="kind" defaultValue={kind} onChange={submit}>
            {REPORT_KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`reports.kind.${value}` as MessageKey)}
              </option>
            ))}
          </Select>
        </label>

        {needs.includes("date") ? (
          <label className="min-w-40">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              {t("common.date")}
            </span>
            <input
              type="date"
              name="date"
              defaultValue={values.date}
              onChange={submit}
              className="h-11 rounded-xl border border-ink-300 bg-white px-3 text-base text-ink-900 focus:border-brand-600 focus:outline-2 focus:outline-brand-600"
            />
          </label>
        ) : null}

        {needs.includes("month") ? (
          <label className="min-w-40">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              {t("reports.month")}
            </span>
            <input
              type="month"
              name="month"
              defaultValue={values.month}
              onChange={submit}
              className="h-11 rounded-xl border border-ink-300 bg-white px-3 text-base text-ink-900 focus:border-brand-600 focus:outline-2 focus:outline-brand-600"
            />
          </label>
        ) : null}

        {needs.includes("from") ? (
          <label className="min-w-40">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              {t("reports.from")}
            </span>
            <input
              type="date"
              name="from"
              defaultValue={values.from}
              onChange={submit}
              className="h-11 rounded-xl border border-ink-300 bg-white px-3 text-base text-ink-900 focus:border-brand-600 focus:outline-2 focus:outline-brand-600"
            />
          </label>
        ) : null}

        {needs.includes("to") ? (
          <label className="min-w-40">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              {t("reports.to")}
            </span>
            <input
              type="date"
              name="to"
              defaultValue={values.to}
              onChange={submit}
              className="h-11 rounded-xl border border-ink-300 bg-white px-3 text-base text-ink-900 focus:border-brand-600 focus:outline-2 focus:outline-brand-600"
            />
          </label>
        ) : null}

        {needs.includes("class") ? (
          <label className="min-w-44 flex-1 sm:max-w-56">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              {t("class.name")}
            </span>
            <Select name="class" defaultValue={values.classId ?? ""} onChange={submit}>
              <option value="">
                {kind === "class-attendance" ? t("reports.needClass") : t("common.all")}
              </option>
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {pickName(t.locale, klass.name, klass.nameKm)}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        {needs.includes("student") ? (
          <label className="min-w-48 flex-1 sm:max-w-72">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              {t("reports.student")}
            </span>
            <Select
              name="student"
              defaultValue={values.studentId ?? ""}
              onChange={submit}
            >
              <option value="">{t("reports.pickStudent")}</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {studentName(t.locale, student)} · {student.studentCode}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        <noscript>
          <button type="submit" className={buttonStyles({ size: "md" })}>
            {t("action.search")}
          </button>
        </noscript>
      </form>

      {canDownload ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-500">
            <Download className="me-1 inline h-4 w-4" aria-hidden="true" />
            {t("reports.download")}
          </span>
          {(["csv", "xlsx", "pdf"] as const).map((format) => (
            <a
              key={format}
              href={`/api/reports/${kind}?${downloadQuery}&format=${format}`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
              // A download is a navigation the router should not intercept.
              download
            >
              {t(`reports.${format}` as MessageKey)}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
