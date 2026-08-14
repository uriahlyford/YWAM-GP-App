"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { studentName, type MessageKey } from "@/lib/i18n";
import { AttendanceStatus } from "@/generated/prisma/enums";
import { saveRegister } from "./actions";
import type { Register, RegisterStudent } from "./queries";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/surface";
import { Input } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

/**
 * The register.
 *
 * The one screen a teacher opens every morning, so every decision here is about
 * how few actions it takes to finish:
 *
 *  - Everyone starts Present. A class of thirty with two absences is two taps
 *    and a save, not thirty decisions.
 *  - A row is one large tap target. Tapping it opens the five statuses in place,
 *    rather than a dialog over the soft keyboard.
 *  - Nothing is written until Save, and Save sends the whole register in one
 *    request — so a patchy connection either records the class or doesn't, never
 *    half of it.
 *
 * Unsaved marks live in memory only. They are deliberately *not* kept in
 * localStorage: a draft register is data about named children, and the browser
 * is not the place for it.
 */

const STATUS_ORDER: AttendanceStatus[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.ABSENT,
  AttendanceStatus.LATE,
  AttendanceStatus.EXCUSED,
  AttendanceStatus.LEFT_EARLY,
];

const SWATCH: Record<AttendanceStatus, string> = {
  PRESENT: "bg-present-500",
  ABSENT: "bg-absent-500",
  LATE: "bg-late-500",
  EXCUSED: "bg-excused-500",
  LEFT_EARLY: "bg-early-500",
};

const ROW_TINT: Record<AttendanceStatus, string> = {
  PRESENT: "bg-white",
  ABSENT: "bg-absent-50",
  LATE: "bg-late-50",
  EXCUSED: "bg-excused-50",
  LEFT_EARLY: "bg-early-50",
};

const CHIP: Record<AttendanceStatus, string> = {
  PRESENT: "bg-present-500 text-white",
  ABSENT: "bg-absent-500 text-white",
  LATE: "bg-late-500 text-white",
  EXCUSED: "bg-excused-500 text-white",
  LEFT_EARLY: "bg-early-500 text-white",
};

type Marks = Record<
  string,
  { status: AttendanceStatus; minutesLate: number | null; note: string | null }
>;

function initialMarks(students: RegisterStudent[]): Marks {
  return Object.fromEntries(
    students.map((student) => [
      student.studentId,
      {
        status: student.status,
        minutesLate: student.minutesLate,
        note: student.note,
      },
    ]),
  );
}

export function AttendanceRegister({ register }: { register: Register }) {
  const t = useT();
  const [marks, setMarks] = useState<Marks>(() => initialMarks(register.students));
  const [open, setOpen] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [result, setResult] = useState<
    { ok: true; changed: number } | { ok: false } | null
  >(null);

  const saved = useMemo(() => initialMarks(register.students), [register.students]);

  const rows = useRef(new Map<string, HTMLLIElement>());

  /**
   * Bring a newly expanded row fully into view. This runs after render, not in
   * the click handler, because the panel with the note field does not exist yet
   * at click time — and it is the bottom of that panel, not the row's header,
   * that the pinned save bar would otherwise cover. `scroll-mb-40` on the row
   * reserves the bar's height.
   */
  useEffect(() => {
    if (!open) return;
    rows.current.get(open)?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [open]);

  const dirty = useMemo(
    () =>
      Object.keys(marks).some((id) => {
        const a = marks[id];
        const b = saved[id];
        return (
          !b ||
          a.status !== b.status ||
          a.minutesLate !== b.minutesLate ||
          (a.note ?? null) !== (b.note ?? null)
        );
      }),
    [marks, saved],
  );

  const counts = useMemo(() => {
    const tally = { present: 0, absent: 0, late: 0 };
    for (const mark of Object.values(marks)) {
      if (mark.status === AttendanceStatus.ABSENT) tally.absent += 1;
      else if (mark.status === AttendanceStatus.LATE) tally.late += 1;
      else tally.present += 1;
    }
    return tally;
  }, [marks]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setMarks((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        status,
        // Lateness only means something for a late arrival.
        minutesLate: status === AttendanceStatus.LATE ? current[studentId].minutesLate : null,
      },
    }));
    setResult(null);
    // Collapse unless the choice needs a follow-up detail.
    if (status !== AttendanceStatus.LATE) setOpen(null);
  }

  function markAllPresent() {
    setMarks((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, mark]) => [
          id,
          { ...mark, status: AttendanceStatus.PRESENT, minutesLate: null },
        ]),
      ),
    );
    setOpen(null);
    setResult(null);
  }

  function save() {
    startSaving(async () => {
      const response = await saveRegister({
        classId: register.classId,
        date: register.date,
        locale: t.locale,
        entries: register.students.map((student) => ({
          studentId: student.studentId,
          status: marks[student.studentId].status,
          minutesLate: marks[student.studentId].minutesLate,
          note: marks[student.studentId].note,
        })),
      });

      setResult(
        response.ok ? { ok: true, changed: response.changed ?? 0 } : { ok: false },
      );
    });
  }

  if (register.students.length === 0) {
    return (
      <Card>
        <p className="px-6 py-12 text-center text-ink-500">
          {t("attendance.emptyClass")}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          {t("attendance.summaryLine", counts)}
        </p>
        <Button variant="secondary" size="sm" onClick={markAllPresent}>
          <Check className="h-4 w-4" aria-hidden="true" />
          {t("attendance.markAllPresent")}
        </Button>
      </div>

      {result?.ok ? (
        <Alert tone="success">
          {t("attendance.saved")}
          {result.changed > 0
            ? ` — ${t.plural("attendance.changedCount", result.changed)}`
            : ""}
        </Alert>
      ) : null}
      {result && !result.ok ? <Alert>{t("attendance.saveFailed")}</Alert> : null}

      <Card className="overflow-hidden">
        {/* Labelled, so a screen reader announces what this list is and so the
            register is addressable separately from the change history below. */}
        <ul aria-label={t("class.roster")} className="divide-y divide-ink-200">
          {register.students.map((student) => {
            const mark = marks[student.studentId];
            const name = studentName(t.locale, student);
            const expanded = open === student.studentId;

            return (
              <li
                key={student.studentId}
                ref={(node) => {
                  if (node) rows.current.set(student.studentId, node);
                  else rows.current.delete(student.studentId);
                }}
                className={cn(
                  "scroll-mb-40 transition-colors",
                  ROW_TINT[mark.status],
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : student.studentId)}
                  aria-expanded={expanded}
                  aria-label={t("attendance.changeStatus", { name })}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-start sm:px-4"
                >
                  <Avatar photoKey={student.photoKey} name={name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink-900">
                      {name}
                    </span>
                    {student.englishName ? (
                      <span className="block truncate text-sm text-ink-500">
                        {student.englishName}
                      </span>
                    ) : null}
                  </span>

                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
                      CHIP[mark.status],
                    )}
                  >
                    {t(`attendance.status.${mark.status}` as MessageKey)}
                    {mark.status === AttendanceStatus.LATE && mark.minutesLate
                      ? ` ${mark.minutesLate}′`
                      : null}
                  </span>

                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-ink-400 transition-transform",
                      expanded && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>

                {expanded ? (
                  <div className="space-y-3 border-t border-ink-200/70 px-3 pb-4 pt-3 sm:px-4">
                    {/* Full width, one row per status on a phone, so each is a
                        comfortable target rather than a cramped segment. */}
                    <div
                      role="radiogroup"
                      aria-label={t("attendance.changeStatus", { name })}
                      className="grid grid-cols-2 gap-2 sm:grid-cols-5"
                    >
                      {STATUS_ORDER.map((status) => {
                        const active = mark.status === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setStatus(student.studentId, status)}
                            className={cn(
                              "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-medium transition-colors",
                              active
                                ? "border-transparent " + CHIP[status]
                                : "border-ink-300 bg-white text-ink-700 hover:bg-ink-100",
                            )}
                          >
                            <span
                              className={cn(
                                "h-2.5 w-2.5 shrink-0 rounded-full",
                                active ? "bg-white/80" : SWATCH[status],
                              )}
                              aria-hidden="true"
                            />
                            {t(`attendance.status.${status}` as MessageKey)}
                          </button>
                        );
                      })}
                    </div>

                    {mark.status === AttendanceStatus.LATE ? (
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-ink-700">
                          {t("attendance.minutesLate")}
                        </span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={600}
                          value={mark.minutesLate ?? ""}
                          onChange={(event) => {
                            const raw = event.target.value;
                            setMarks((current) => ({
                              ...current,
                              [student.studentId]: {
                                ...current[student.studentId],
                                minutesLate: raw === "" ? null : Number(raw),
                              },
                            }));
                            setResult(null);
                          }}
                          className="max-w-32"
                        />
                      </label>
                    ) : null}

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-ink-700">
                        {t("attendance.note")}
                      </span>
                      <Input
                        value={mark.note ?? ""}
                        placeholder={t("attendance.notePlaceholder")}
                        onChange={(event) => {
                          const raw = event.target.value;
                          setMarks((current) => ({
                            ...current,
                            [student.studentId]: {
                              ...current[student.studentId],
                              note: raw === "" ? null : raw,
                            },
                          }));
                          setResult(null);
                        }}
                      />
                    </label>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Sticky, because a register of thirty is longer than a phone screen and
          the teacher should never have to scroll back to finish. */}
      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <div className="rounded-xl border border-ink-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <Button size="lg" block onClick={save} disabled={saving}>
            {saving ? t("action.saving") : t("attendance.save")}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-500" aria-live="polite">
            {saving
              ? t("action.saving")
              : dirty
                ? t("attendance.unsaved")
                : register.takenAt
                  ? t("attendance.saved")
                  : t("attendance.notTaken")}
          </p>
        </div>
      </div>
    </div>
  );
}
