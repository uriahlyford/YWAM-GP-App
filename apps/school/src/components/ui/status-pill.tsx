"use client";

import { AttendanceStatus } from "@/generated/prisma/enums";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/cn";

/**
 * The five attendance statuses, coloured consistently everywhere they appear.
 *
 * A teacher reads the colour before the word, so these five must stay distinct
 * at a glance and must never be reused for anything else in the interface. The
 * label is always present too: colour alone fails for a colour-blind reader and
 * in the printed reports.
 */
const TONES: Record<AttendanceStatus, string> = {
  PRESENT: "bg-present-50 text-present-700 ring-present-500/25",
  ABSENT: "bg-absent-50 text-absent-700 ring-absent-500/25",
  LATE: "bg-late-50 text-late-700 ring-late-500/25",
  EXCUSED: "bg-excused-50 text-excused-700 ring-excused-500/25",
  LEFT_EARLY: "bg-early-50 text-early-700 ring-early-500/25",
};

export function StatusPill({
  status,
  minutesLate,
  className,
}: {
  status: AttendanceStatus;
  minutesLate?: number | null;
  className?: string;
}) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset",
        TONES[status],
        className,
      )}
    >
      {t(`attendance.status.${status}` as MessageKey)}
      {status === AttendanceStatus.LATE && minutesLate
        ? ` · ${minutesLate}′`
        : null}
    </span>
  );
}

export { TONES as ATTENDANCE_TONES };
