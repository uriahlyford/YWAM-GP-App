"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import type { Route } from "next";
import { useT } from "@/lib/i18n/client";
import { pickName } from "@/lib/i18n";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Named = { id: string; name: string; nameKm: string | null };

/**
 * Class / term / subject selection, kept in the URL so a gradebook view can be
 * bookmarked or handed to a colleague.
 *
 * The next URL is built from the form's own current values, read with FormData,
 * rather than from `useSearchParams` or from props. Those both lag by a render:
 * changing two selects before React caught up meant the second navigation was
 * computed from the pre-first-change URL and silently reverted it — which, while
 * writing the tests, looked exactly like an authorization bug.
 *
 * Changing the class clears the term and subject. Terms belong to the class's
 * academic year, so carrying one across shows an empty sheet for no visible
 * reason.
 */
export function GradePickers({
  classes,
  terms,
  subjects,
  classId,
  termId,
  subjectId,
}: {
  classes: (Named & { academicYear: { name: string } })[];
  terms: Named[];
  subjects?: Named[];
  classId?: string;
  termId?: string;
  subjectId?: string;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!form.current) return;
    const data = new FormData(form.current);
    const next = new URLSearchParams();
    for (const key of ["class", "term", "subject"]) {
      const value = data.get(key);
      if (typeof value === "string" && value) next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}` as Route);
    });
  }

  function onClassChange() {
    // Reset the dependent selects in the DOM before reading FormData, so the
    // navigation carries the cleared values rather than the old ones.
    if (form.current) {
      const elements = form.current.elements as unknown as Record<
        string,
        HTMLSelectElement | undefined
      >;
      if (elements.term) elements.term.value = "";
      if (elements.subject) elements.subject.value = "";
    }
    submit();
  }

  return (
    <form
      ref={form}
      // Navigation is handled in `submit`; this keeps the control usable if the
      // JavaScript hasn't arrived yet.
      method="get"
      className={cn("flex flex-wrap gap-3", pending && "opacity-60")}
    >
      <label className="min-w-44 flex-1 sm:max-w-64">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          {t("grades.pickClass")}
        </span>
        <Select name="class" defaultValue={classId ?? ""} onChange={onClassChange}>
          <option value="">{t("grades.pickClass")}</option>
          {classes.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {pickName(t.locale, klass.name, klass.nameKm)} ·{" "}
              {klass.academicYear.name}
            </option>
          ))}
        </Select>
      </label>

      <label className="min-w-36 flex-1 sm:max-w-48">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          {t("grades.pickTerm")}
        </span>
        <Select
          name="term"
          key={`term-${classId}`}
          defaultValue={termId ?? ""}
          disabled={terms.length === 0}
          onChange={submit}
        >
          <option value="">{t("grades.pickTerm")}</option>
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {pickName(t.locale, term.name, term.nameKm)}
            </option>
          ))}
        </Select>
      </label>

      {subjects ? (
        <label className="min-w-36 flex-1 sm:max-w-48">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">
            {t("grades.pickSubject")}
          </span>
          <Select
            name="subject"
            key={`subject-${classId}`}
            defaultValue={subjectId ?? ""}
            onChange={submit}
          >
            <option value="">{t("grades.pickSubject")}</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {pickName(t.locale, subject.name, subject.nameKm)}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      <noscript>
        <button
          type="submit"
          className="mt-6 h-11 rounded-xl bg-brand-700 px-4 font-medium text-white"
        >
          {t("action.search")}
        </button>
      </noscript>
    </form>
  );
}
