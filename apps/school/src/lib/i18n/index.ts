import { en, type MessageKey, type Messages } from "./messages/en";
import { km } from "./messages/km";
import type { DateOnly } from "@/lib/date";

export const LOCALES = ["en", "km"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "sala_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  km: "ខ្មែរ",
};

const CATALOGUES: Record<Locale, Messages> = { en, km };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getMessages(locale: Locale): Messages {
  return CATALOGUES[locale];
}

export type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * The base of any key that has an `.other` form — so `t.plural` can only be
 * called with a key that actually has plural variants defined.
 */
type BaseOfOther<K> = K extends `${infer Base}.other` ? Base : never;
export type PluralKey = BaseOfOther<MessageKey>;

export type Translator = {
  (key: MessageKey, vars?: Vars): string;
  /**
   * Plural form of `<key>`, looked up as `<key>.one` / `<key>.other` and given
   * `{count}`. English needs the distinction; Khmer has no grammatical plural,
   * so both its forms are the same string — which is exactly why this goes
   * through Intl.PluralRules rather than an `n === 1` check written into a
   * component.
   */
  plural: (key: PluralKey, count: number, vars?: Vars) => string;
  locale: Locale;
};

export function createTranslator(
  locale: Locale,
  messages: Messages = CATALOGUES[locale],
): Translator {
  const t = ((key: MessageKey, vars?: Vars) =>
    interpolate(messages[key] ?? en[key] ?? key, vars)) as Translator;

  const rules = new Intl.PluralRules(locale === "km" ? "km-KH" : "en-US");

  t.plural = (key, count, vars) => {
    const category = rules.select(count);
    const specific = `${key}.${category}` as MessageKey;
    const fallback = `${key}.other` as MessageKey;
    const template =
      messages[specific] ?? messages[fallback] ?? en[specific] ?? en[fallback] ?? key;
    return interpolate(template, { count, ...vars });
  };

  t.locale = locale;
  return t;
}

// --- Bilingual value helpers -------------------------------------------------

/**
 * Pick the Khmer form when the reader is in Khmer and one exists, otherwise the
 * Latin one. Used for every name and label that is stored as a pair — students,
 * guardians, subjects, grade levels, classes.
 */
export function pickName(
  locale: Locale,
  latin: string | null | undefined,
  khmer: string | null | undefined,
): string {
  if (locale === "km") return khmer?.trim() || latin?.trim() || "";
  return latin?.trim() || khmer?.trim() || "";
}

/** A student's display name in the reader's language. */
export function studentName(
  locale: Locale,
  student: {
    firstName: string;
    lastName: string;
    firstNameKm?: string | null;
    lastNameKm?: string | null;
  },
): string {
  if (locale === "km" && student.lastNameKm && student.firstNameKm) {
    // Khmer name order is family name first, with no comma.
    return `${student.lastNameKm} ${student.firstNameKm}`;
  }
  return `${student.lastName} ${student.firstName}`;
}

// --- Dates -------------------------------------------------------------------

/** `14 August 2026` / `១៤ សីហា ២០២៦`-style, but with Arabic numerals. */
export function formatDate(t: Translator, date: DateOnly): string {
  const [y, m, d] = date.split("-");
  const month = t(`month.${Number(m)}` as MessageKey);
  return t.locale === "km"
    ? `${Number(d)} ${month} ${y}`
    : `${Number(d)} ${month} ${y}`;
}

/** `Thu 14 August 2026`, used where the day of the week matters (attendance). */
export function formatDateWithWeekday(t: Translator, date: DateOnly): string {
  const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const weekday = t(`weekday.${dow}` as MessageKey);
  return `${weekday}, ${formatDate(t, date)}`;
}

/**
 * Numbers stay in Arabic numerals in both languages, but grouping separators
 * still come from the locale.
 */
export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale === "km" ? "km-KH" : "en-US", {
    numberingSystem: "latn",
  }).format(value);
}

export function formatPercent(locale: Locale, value: number, digits = 0): string {
  return new Intl.NumberFormat(locale === "km" ? "km-KH" : "en-US", {
    numberingSystem: "latn",
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export type { MessageKey, Messages };
