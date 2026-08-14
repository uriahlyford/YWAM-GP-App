"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, type AuthFormState } from "./actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";

function SubmitButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block disabled={pending}>
      {pending ? t("action.saving") : t("action.save")}
    </Button>
  );
}

export function PasswordForm() {
  const t = useT();
  const [state, action] = useActionState<AuthFormState, FormData>(
    changePassword,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={t.locale} />

      {state.error ? <Alert>{t(state.error)}</Alert> : null}

      <Field label={t("auth.password")} htmlFor="currentPassword" required>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        label={t("auth.newPassword")}
        htmlFor="newPassword"
        hint={t("auth.passwordTooShort")}
        required
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </Field>

      <Field label={t("auth.confirmPassword")} htmlFor="confirmPassword" required>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
