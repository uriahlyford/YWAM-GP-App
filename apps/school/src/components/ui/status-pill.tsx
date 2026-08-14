"use client";

import { Check, Clock, FileText, LogOut, X } from "lucide-react";
import { AttendanceStatus } from "@/generated/prisma/enums";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/cn";

/**
 * The five attendance statuses, presented the same way everywhere.
 *
 * Each one is a tint, an ink, an icon and a word — never colour alone. That is
 * not belt-and-braces: a colourblind-separation check showed that five saturated
 * hues cannot all be told apart, and blue against violet failed even for full
 * colour vision. Present / absent / late carry the at-a-glance colour channel;
 * excused and left-early are distinguished by their icon.
 *
 * Text wears the ink token, which clears 4.5:1 on its tint. The colour of the
 * status lives in the icon beside the word, not in the word itself.
 */
const TONES: Record<AttendanceStatus, string> = {
  PRESENT: "bg-present-50 text-present-700 ring-present-500/25",
  ABSENT: "bg-absent-50 text-absent-700 ring-absent-500/25",
  LATE: "bg-late-50 text-late-700 ring-late-500/25",
  EXCUSED: "bg-excused-50 text-excused-700 ring-excused-500/25",
  LEFT_EARLY: "bg-early-50 text-early-700 ring-early-500/25",
};

const ICON_TINT: Record<AttendanceStatus, string> = {
  PRESENT: "text-present-500",
  ABSENT: "text-absent-500",
  LATE: "text-late-500",
  EXCUSED: "text-excused-500",
  LEFT_EARLY: "text-early-500",
};

const ICONS = {
  PRESENT: Check,
  ABSENT: X,
  LATE: Clock,
  EXCUSED: FileText,
  LEFT_EARLY: LogOut,
} as const satisfies Record<AttendanceStatus, unknown>;

export function StatusIcon({
  status,
  className,
}: {
  status: AttendanceStatus;
  className?: string;
}) {
  const Icon = ICONS[status];
  return (
    <Icon
      className={cn("h-3.5 w-3.5 shrink-0", ICON_TINT[status], className)}
      strokeWidth={2.5}
      aria-hidden="true"
    />
  );
}

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
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset",
        TONES[status],
        className,
      )}
    >
      <StatusIcon status={status} />
      {t(`attendance.status.${status}` as MessageKey)}
      {status === AttendanceStatus.LATE && minutesLate
        ? ` · ${minutesLate}′`
        : null}
    </span>
  );
}

export { TONES as ATTENDANCE_TONES, ICON_TINT as ATTENDANCE_ICON_TINT };
