/**
 * The report catalogue, in a module with no server dependencies.
 *
 * Deliberately separate from `queries.ts`: that file is `server-only` and imports
 * Prisma, so a client component importing this list from there pulled the whole
 * database client — and the `pg` driver's Node built-ins — into the browser
 * bundle. It failed the build, which is what `server-only` is for, though in dev
 * it surfaced only as a missing route manifest.
 */
export const REPORT_KINDS = [
  "daily-attendance",
  "class-attendance",
  "monthly-attendance",
  "student-attendance",
  "student-report",
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export function isReportKind(value: unknown): value is ReportKind {
  return (
    typeof value === "string" && (REPORT_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Which parameters each report actually uses. Shown to the reader and used to
 * decide what to send — offering a student picker for a whole-school summary
 * invites someone to fill in a field that will be ignored.
 */
export const REPORT_PARAMS = {
  "daily-attendance": ["date", "class"],
  "class-attendance": ["class", "from", "to"],
  "monthly-attendance": ["month", "class"],
  "student-attendance": ["student", "from", "to"],
  "student-report": ["student"],
} as const satisfies Record<ReportKind, readonly string[]>;

export const REPORTS_NEEDING_STUDENT: ReportKind[] = [
  "student-attendance",
  "student-report",
];

export const REPORTS_NEEDING_CLASS: ReportKind[] = ["class-attendance"];
