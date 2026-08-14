"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { EMPTY_STATE, type ActionState } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { cn } from "@/lib/cn";

/**
 * A form that lives inside a `<details>` disclosure.
 *
 * Settings screens are lists of small records — grade levels, subjects, terms —
 * where the edit form belongs next to the row it edits. A disclosure gives that
 * for free, works before JavaScript arrives, and on a phone pushes the page
 * down rather than trapping focus in a modal over a soft keyboard.
 */

function SubmitButton({ label }: { label?: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("action.saving") : (label ?? t("action.save"))}
    </Button>
  );
}

export type FormRenderProps = {
  fieldError: (name: string) => string | undefined;
};

export function DisclosureForm({
  summary,
  detail,
  badge,
  action,
  children,
  submitLabel,
  defaultOpen,
  tone = "row",
}: {
  summary: React.ReactNode;
  detail?: React.ReactNode;
  badge?: React.ReactNode;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: (props: FormRenderProps) => React.ReactNode;
  submitLabel?: string;
  defaultOpen?: boolean;
  /** `row` sits inside a list; `add` is the standalone "add one" affordance. */
  tone?: "row" | "add";
}) {
  const t = useT();
  const [state, formAction] = useActionState(action, EMPTY_STATE);
  const details = useRef<HTMLDetailsElement>(null);

  // Close on a successful save so the list reads as a list again. A failed save
  // stays open with its errors visible.
  useEffect(() => {
    if (state.ok && details.current) details.current.open = false;
  }, [state.ok]);

  const fieldError = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? t(key) : undefined;
  };

  return (
    <details
      ref={details}
      open={defaultOpen}
      className={cn("group", tone === "add" && "rounded-card border border-dashed border-ink-300 bg-white")}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5",
          "hover:bg-ink-50 [&::-webkit-details-marker]:hidden",
          tone === "add" && "text-brand-700",
        )}
      >
        <ChevronDown
          className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink-900 group-[.tone-add]:text-brand-700">
            {summary}
          </span>
          {detail ? (
            <span className="block truncate text-sm text-ink-500">{detail}</span>
          ) : null}
        </span>
        {badge}
      </summary>

      <form action={formAction} className="space-y-4 border-t border-ink-200 px-4 py-4 sm:px-5">
        {state.error ? <Alert>{t(state.error)}</Alert> : null}
        {children({ fieldError })}
        <div className="flex gap-2">
          <SubmitButton label={submitLabel} />
        </div>
      </form>
    </details>
  );
}

/** A plain always-visible form, for a single record like the school itself. */
export function SimpleForm({
  action,
  children,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: (props: FormRenderProps) => React.ReactNode;
  submitLabel?: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState(action, EMPTY_STATE);

  const fieldError = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? t(key) : undefined;
  };

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{t(state.error)}</Alert> : null}
      {state.ok ? <Alert tone="success">{t("action.saved")}</Alert> : null}
      {children({ fieldError })}
      <SubmitButton label={submitLabel} />
    </form>
  );
}
