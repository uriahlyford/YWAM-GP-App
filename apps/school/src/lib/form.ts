import { z } from "zod";
import type { MessageKey } from "@/lib/i18n";

/**
 * The shape every server action returns to `useActionState`.
 *
 * Errors travel as message *keys* rather than rendered text, because the action
 * runs on the server and doesn't know which language the reader is in — the
 * form renders `t(state.error)` on the client instead.
 */
export type ActionState = {
  ok?: boolean;
  error?: MessageKey;
  fieldErrors?: Partial<Record<string, MessageKey>>;
  /** Set after a successful create, so the form can link to what it made. */
  createdId?: string;
};

export const EMPTY_STATE: ActionState = {};

/**
 * `FormData.get` returns null for an absent field, and zod's `.optional()`
 * rejects null. Reading through here keeps that from silently failing a whole
 * parse — a bug that cost an afternoon once already.
 */
export function value(formData: FormData, name: string): string | undefined {
  const raw = formData.get(name);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function values(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((v): v is string => typeof v === "string");
}

export function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) !== null;
}

/** Optional text that should be stored as null rather than an empty string. */
export const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => v ?? null);

/**
 * Cambodian mobile numbers are written 0XX XXX XXX locally and +855 XX XXX XXX
 * internationally. Both are accepted and stored as +855…, so a notification
 * provider later gets one consistent format.
 */
export const cambodianPhone = z
  .string()
  .trim()
  .transform((raw) => raw.replace(/[\s\-().]/g, ""))
  .refine(
    (v) => /^(?:\+?855|0)\d{8,9}$/.test(v),
    { error: "invalidPhone" },
  )
  .transform((v) => {
    const digits = v.replace(/^\+?855/, "").replace(/^0/, "");
    return `+855${digits}`;
  });

export const dateOnlyField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "invalidDate" });

const ISSUE_MESSAGES: Record<string, MessageKey> = {
  invalidPhone: "error.invalidPhone",
  invalidEmail: "error.invalidEmail",
  invalidDate: "error.invalidDate",
};

/** Turn zod issues into per-field message keys the form can render. */
export function fieldErrorsOf(error: z.ZodError): Record<string, MessageKey> {
  const out: Record<string, MessageKey> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "_form";
    if (out[field]) continue;
    out[field] =
      ISSUE_MESSAGES[issue.message] ??
      (issue.code === "too_small" ? "error.required" : "error.generic");
  }
  return out;
}

export function invalid(error: z.ZodError): ActionState {
  return { fieldErrors: fieldErrorsOf(error) };
}
