"use client";

import { useT } from "@/lib/i18n/client";
import { pickName } from "@/lib/i18n";
import { DisclosureForm } from "@/components/ui/disclosure-form";
import { Field, Input, Select } from "@/components/ui/field";
import { saveAssessment } from "./actions";

type Named = { id: string; name: string; nameKm: string | null };

export function AssessmentForm({
  classId,
  termId,
  subjects,
  subjectId,
  defaultDate,
  assessment,
}: {
  classId: string;
  termId: string;
  subjects: Named[];
  subjectId?: string;
  defaultDate: string;
  assessment?: {
    id: string;
    title: string;
    titleKm: string | null;
    date: string;
    maxScore: number;
    weight: number;
    subjectId: string;
  };
}) {
  const t = useT();
  const editing = Boolean(assessment);

  return (
    <DisclosureForm
      summary={editing ? t("grades.editAssessment") : t("grades.addAssessment")}
      action={saveAssessment}
      tone={editing ? "row" : "add"}
      defaultOpen={editing}
    >
      {({ fieldError }) => (
        <>
          <input type="hidden" name="locale" value={t.locale} />
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="termId" value={termId} />
          {assessment ? (
            <input type="hidden" name="id" value={assessment.id} />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("grades.assessmentTitle")}
              hint={t("grades.assessmentTitle.hint")}
              error={fieldError("title")}
              required
            >
              <Input name="title" defaultValue={assessment?.title ?? ""} required />
            </Field>
            <Field label={t("common.nameKm")} error={fieldError("titleKm")}>
              <Input
                name="titleKm"
                defaultValue={assessment?.titleKm ?? ""}
                lang="km"
              />
            </Field>
          </div>

          <Field
            label={t("grades.pickSubject")}
            error={fieldError("subjectId")}
            required
          >
            <Select
              name="subjectId"
              defaultValue={assessment?.subjectId ?? subjectId ?? ""}
              required
            >
              <option value="" disabled>
                {t("grades.pickSubject")}
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {pickName(t.locale, subject.name, subject.nameKm)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t("grades.assessmentDate")}
              error={fieldError("date")}
              required
            >
              <Input
                name="date"
                type="date"
                defaultValue={assessment?.date ?? defaultDate}
                required
              />
            </Field>
            <Field label={t("grades.maxScore")} error={fieldError("maxScore")} required>
              <Input
                name="maxScore"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                defaultValue={assessment?.maxScore ?? 10}
                required
              />
            </Field>
            <Field
              label={t("grades.weight")}
              hint={t("grades.weight.hint")}
              error={fieldError("weight")}
            >
              <Input
                name="weight"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0.5}
                max={20}
                defaultValue={assessment?.weight ?? 1}
              />
            </Field>
          </div>
        </>
      )}
    </DisclosureForm>
  );
}
