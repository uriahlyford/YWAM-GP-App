"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type AuthFormState } from "./actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";

function SubmitButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block disabled={pending}>
      {pending ? t("auth.signingIn") : t("action.signIn")}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const t = useT();
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={t.locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? <Alert>{t(state.error)}</Alert> : null}

      <Field label={t("auth.username")} htmlFor="username" required>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          // Focus on desktop only: an autofocused field on a phone opens the
          // keyboard over the form before the teacher has seen it.
          autoFocus={false}
        />
      </Field>

      <Field label={t("auth.password")} htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
