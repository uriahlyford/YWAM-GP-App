/**
 * Calendar dates, done once, correctly.
 *
 * Cambodia is UTC+7. A calendar date derived from a UTC timestamp — the
 * `new Date().toISOString().slice(0, 10)` habit — is wrong there for the first
 * seven hours of every local day. A teacher taking the register at 06:45 would
 * silently file it against yesterday, and nothing in the UI would look wrong.
 *
 * So a calendar date is a `DateOnly` string (`YYYY-MM-DD`) everywhere in this
 * application. A string cannot carry a hidden timezone, cannot drift when it
 * crosses a serialisation boundary, and compares correctly with `===`. It is
 * converted to a `Date` only at the Prisma boundary, where `@db.Date` columns
 * expect a Date whose *UTC* components are the calendar date.
 */

export const DEFAULT_TIMEZONE = "Asia/Phnom_Penh";

/** A calendar date with no time and no zone, formatted `YYYY-MM-DD`. */
export type DateOnly = string;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string" || !DATE_ONLY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Rejects 2026-02-30 and friends.
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

function partsInZone(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Intl renders midnight as "24" in some ICU versions; normalise it.
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** The calendar date it is *right now* in the given zone. */
export function today(timeZone: string = DEFAULT_TIMEZONE): DateOnly {
  return dateOnlyOf(new Date(), timeZone);
}

/** The calendar date an instant falls on, as seen from the given zone. */
export function dateOnlyOf(
  instant: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): DateOnly {
  const { year, month, day } = partsInZone(instant, timeZone);
  return `${year}-${month}-${day}`;
}

/**
 * Convert to the value Prisma writes into a `@db.Date` column. Prisma reads the
 * *UTC* components of the Date, so midnight UTC is the only safe construction.
 */
export function toDbDate(date: DateOnly): Date {
  if (!isDateOnly(date)) throw new Error(`Not a calendar date: ${date}`);
  return new Date(`${date}T00:00:00.000Z`);
}

/** Read a `@db.Date` column back out as a calendar date. */
export function fromDbDate(value: Date): DateOnly {
  return value.toISOString().slice(0, 10);
}

/** Shift a calendar date by whole days, staying in calendar space. */
export function addDays(date: DateOnly, days: number): DateOnly {
  const d = toDbDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** First calendar day of the month a date falls in. */
export function startOfMonth(date: DateOnly): DateOnly {
  return `${date.slice(0, 7)}-01`;
}

/** Last calendar day of the month a date falls in. */
export function endOfMonth(date: DateOnly): DateOnly {
  const [y, m] = date.split("-").map(Number);
  return fromDbDate(new Date(Date.UTC(y, m, 0)));
}

/** 0 = Sunday … 6 = Saturday. Calendar-space, no zone involved. */
export function dayOfWeek(date: DateOnly): number {
  return toDbDate(date).getUTCDay();
}

export function isWeekend(date: DateOnly): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

/** Inclusive list of calendar dates. */
export function eachDay(from: DateOnly, to: DateOnly): DateOnly[] {
  const out: DateOnly[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Clock time of an instant in the school's zone, e.g. `07:31`. */
export function timeOfDay(
  instant: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const { hour, minute } = partsInZone(instant, timeZone);
  return `${hour}:${minute}`;
}

/**
 * Whole years between a date of birth and a reference date, in calendar space.
 * Used for a student's age on their profile.
 */
export function ageOn(birth: DateOnly, on: DateOnly): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [oy, om, od] = on.split("-").map(Number);
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age -= 1;
  return age;
}
