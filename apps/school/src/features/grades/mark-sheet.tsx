"use client";

import { useMemo, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { formatNumber, formatPercent, studentName } from "@/lib/i18n";
import { saveMarks } from "./actions";
import type { MarkSheet } from "./queries";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/surface";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/**
 * Entering one assessment's marks.
 *
 * The mobile-fast shape is the same as the register: one row per child, one
 * field to fill, everything sent in a single save. A wide students × assessments
 * grid is the wrong tool on a phone — the class matrix on `/grades` is the place
 * to *read* across subjects, this is the place to *write* one column.
 *
 * An empty field means "not marked", which is a different thing from a zero and
 * is stored as null. Nothing is written until Save.
 */

type Marks = Record<string, { score: number | null; comment: string | null }>;

function initialMarks(sheet: MarkSheet): Marks {
  return Object.fromEntries(
    sheet.students.map((student) => [
      student.studentId,
      { score: student.score, comment: student.comment },
    ]),
  );
}

export function MarkSheetForm({ sheet }: { sheet: MarkSheet }) {
  const t = useT();
  const max = sheet.assessment.maxScore;

  const [marks, setMarks] = useState<Marks>(() => initialMarks(sheet));
  const [saving, startSaving] = useTransition();
  const [result, setResult] = useState<
    { ok: true; changed: number } | { ok: false; tooHigh?: boolean } | null
  >(null);

  const saved = useMemo(() => initialMarks(sheet), [sheet]);

  const dirty = useMemo(
    () =>
      Object.keys(marks).some((id) => {
        const a = marks[id];
        const b = saved[id];
        return !b || a.score !== b.score || (a.comment ?? null) !== (b.comment ?? null);
      }),
    [marks, saved],
  );

  const markedCount = Object.values(marks).filter(
    (mark) => mark.score !== null,
  ).length;

  const average = useMemo(() => {
    const scores = Object.values(marks)
      .map((mark) => mark.score)
      .filter((score): score is number => score !== null);
    if (scores.length === 0 || max <= 0) return null;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length / max;
  }, [marks, max]);

  const overMax = Object.values(marks).some(
    (mark) => mark.score !== null && mark.score > max,
  );

  function setScore(studentId: string, raw: string) {
    setMarks((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        // Empty is "not marked", not zero.
        score: raw.trim() === "" ? null : Number(raw),
      },
    }));
    setResult(null);
  }

  function save() {
    startSaving(async () => {
      const response = await saveMarks({
        assessmentId: sheet.assessment.id,
        locale: t.locale,
        entries: sheet.students.map((student) => ({
          studentId: student.studentId,
          score: marks[student.studentId].score,
          comment: marks[student.studentId].comment,
        })),
      });

      setResult(
        response.ok
          ? { ok: true, changed: response.changed ?? 0 }
          : { ok: false, tooHigh: response.error === "grades.tooHigh" },
      );
    });
  }

  if (sheet.students.length === 0) {
    return (
      <Card>
        <p className="px-6 py-12 text-center text-ink-500">
          {t("grades.noStudents")}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-600">
        <p>
          {t("grades.markedCount", {
            marked: formatNumber(t.locale, markedCount),
            total: formatNumber(t.locale, sheet.students.length),
          })}
        </p>
        {average !== null ? (
          <p>
            {t("grades.classAverage")}{" "}
            <strong className="tabular-nums text-ink-900">
              {formatPercent(t.locale, average)}
            </strong>
          </p>
        ) : null}
      </div>

      {result?.ok ? (
        <Alert tone="success">
          {t("grades.marksSaved")}
          {result.changed > 0
            ? ` — ${t.plural("grades.changedCount", result.changed)}`
            : ""}
        </Alert>
      ) : null}
      {result && !result.ok ? (
        <Alert>
          {result.tooHigh ? t("grades.tooHigh") : t("grades.marksSaveFailed")}
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <ul aria-label={t("grades.enterMarks")} className="divide-y divide-ink-200">
          {sheet.students.map((student) => {
            const mark = marks[student.studentId];
            const name = studentName(t.locale, student);
            const invalidScore = mark.score !== null && mark.score > max;
            const fieldId = `score-${student.studentId}`;

            return (
              <li
                key={student.studentId}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 sm:px-4",
                  mark.score === null && "bg-ink-50/60",
                )}
              >
                <label htmlFor={fieldId} className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink-900">
                    {name}
                  </span>
                  <span className="block truncate text-sm text-ink-500">
                    {student.studentCode}
                    {mark.score === null ? ` · ${t("grades.notMarked")}` : ""}
                  </span>
                </label>

                <Input
                  id={fieldId}
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min={0}
                  max={max}
                  value={mark.score ?? ""}
                  aria-invalid={invalidScore}
                  aria-describedby={`max-${student.studentId}`}
                  onChange={(event) => setScore(student.studentId, event.target.value)}
                  className={cn(
                    "w-24 shrink-0 text-center tabular-nums",
                    invalidScore && "border-absent-500",
                  )}
                />
                <span
                  id={`max-${student.studentId}`}
                  className="w-14 shrink-0 text-sm text-ink-400"
                >
                  / {formatNumber(t.locale, max)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <div className="rounded-xl border border-ink-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <Button size="lg" block onClick={save} disabled={saving || overMax}>
            {saving ? t("action.saving") : t("grades.saveMarks")}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-500" aria-live="polite">
            {overMax
              ? t("grades.tooHigh")
              : saving
                ? t("action.saving")
                : dirty
                  ? t("attendance.unsaved")
                  : t("action.saved")}
          </p>
        </div>
      </div>
    </div>
  );
}
