"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import { useT } from "@/lib/i18n/client";
import { studentName, type MessageKey } from "@/lib/i18n";
import { EMPTY_STATE, type ActionState } from "@/lib/form";
import { GuardianRelationship, Locale } from "@/generated/prisma/enums";
import { linkStudentToGuardian, saveGuardian } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card, CardHeader } from "@/components/ui/surface";
import { DisclosureForm } from "@/components/ui/disclosure-form";

export type GuardianFormValues = {
  id?: string;
  name: string;
  nameKm: string | null;
  phone: string;
  phone2: string | null;
  email: string | null;
  occupation: string | null;
  address: string | null;
  preferredLocale: Locale;
  notes: string | null;
};

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? t("action.saving") : t("action.save")}
    </Button>
  );
}

export function GuardianForm({ guardian }: { guardian: GuardianFormValues }) {
  const t = useT();
  const [state, action] = useActionState<ActionState, FormData>(
    saveGuardian,
    EMPTY_STATE,
  );

  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? t(key) : undefined;
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={t.locale} />
      {guardian.id ? <input type="hidden" name="id" value={guardian.id} /> : null}
      {state.error ? <Alert>{t(state.error)}</Alert> : null}

      <Card className="overflow-hidden">
        <CardHeader title={t("guardian.edit")} />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.name")} error={err("name")} required>
              <Input name="name" defaultValue={guardian.name} required />
            </Field>
            <Field label={t("common.nameKm")} error={err("nameKm")}>
              <Input name="nameKm" defaultValue={guardian.nameKm ?? ""} lang="km" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.phone")} error={err("phone")} required>
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={guardian.phone}
                placeholder="012 345 678"
                required
              />
            </Field>
            <Field label={t("guardian.phone2")} error={err("phone2")}>
              <Input
                name="phone2"
                type="tel"
                inputMode="tel"
                defaultValue={guardian.phone2 ?? ""}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.email")} error={err("email")}>
              <Input name="email" type="email" defaultValue={guardian.email ?? ""} />
            </Field>
            <Field label={t("guardian.occupation")} error={err("occupation")}>
              <Input name="occupation" defaultValue={guardian.occupation ?? ""} />
            </Field>
          </div>

          <Field label={t("common.address")} error={err("address")}>
            <Input name="address" defaultValue={guardian.address ?? ""} />
          </Field>

          {/* Not the same thing as the interface language: this is the language a
              parent will be *written to* in, and most parents never sign in. */}
          <Field
            label={t("guardian.preferredLocale")}
            hint={t("guardian.preferredLocale.hint")}
            error={err("preferredLocale")}
          >
            <Select name="preferredLocale" defaultValue={guardian.preferredLocale}>
              <option value={Locale.KM}>ខ្មែរ</option>
              <option value={Locale.EN}>English</option>
            </Select>
          </Field>

          <Field label={t("common.notes")} error={err("notes")}>
            <Textarea name="notes" rows={3} defaultValue={guardian.notes ?? ""} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Submit />
        <Link
          href={
            (guardian.id
              ? `/${t.locale}/parents/${guardian.id}`
              : `/${t.locale}/parents`) as Route
          }
          className="inline-flex h-13 items-center rounded-xl px-5 font-medium text-ink-600 hover:bg-ink-100"
        >
          {t("action.cancel")}
        </Link>
      </div>
    </form>
  );
}

export function LinkStudentForm({
  guardianId,
  students,
}: {
  guardianId: string;
  students: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    firstNameKm: string | null;
    lastNameKm: string | null;
  }[];
}) {
  const t = useT();

  return (
    <DisclosureForm
      summary={t("guardian.link")}
      action={linkStudentToGuardian}
      tone="add"
      submitLabel={t("action.add")}
    >
      {({ fieldError }) => (
        <>
          <input type="hidden" name="guardianId" value={guardianId} />
          <input type="hidden" name="locale" value={t.locale} />

          <Field label={t("students.title")} error={fieldError("studentId")} required>
            <Select name="studentId" required defaultValue="">
              <option value="" disabled>
                {t("action.search")}…
              </option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {studentName(t.locale, student)} · {student.studentCode}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t("guardian.relationship")}
            error={fieldError("relationship")}
            required
          >
            <Select name="relationship" defaultValue={GuardianRelationship.MOTHER}>
              {Object.values(GuardianRelationship).map((value) => (
                <option key={value} value={value}>
                  {t(`relationship.${value}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="space-y-2.5">
            {(
              [
                ["isPrimary", "guardian.isPrimary", false],
                ["isEmergencyContact", "guardian.isEmergency", true],
                ["canPickUp", "guardian.canPickUp", true],
              ] as const
            ).map(([name, label, checked]) => (
              <label key={name} className="flex items-center gap-2.5 text-sm text-ink-700">
                <input
                  type="checkbox"
                  name={name}
                  defaultChecked={checked}
                  className="h-5 w-5 rounded border-ink-300 text-brand-700"
                />
                {t(label)}
              </label>
            ))}
          </div>
        </>
      )}
    </DisclosureForm>
  );
}
