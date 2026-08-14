"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import { useT } from "@/lib/i18n/client";
import { EMPTY_STATE, type ActionState } from "@/lib/form";
import { Locale } from "@/generated/prisma/enums";
import { saveTeacher } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card, CardHeader } from "@/components/ui/surface";

export type TeacherFormValues = {
  id?: string;
  username: string;
  displayName: string;
  displayNameKm: string | null;
  email: string | null;
  locale: Locale;
  staffCode: string | null;
  phone: string | null;
  hireDate: string | null;
  notes: string | null;
  isActive: boolean;
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

export function TeacherForm({ teacher }: { teacher: TeacherFormValues }) {
  const t = useT();
  const [state, action] = useActionState<ActionState, FormData>(
    saveTeacher,
    EMPTY_STATE,
  );
  const isNew = !teacher.id;

  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? t(key) : undefined;
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={t.locale} />
      {teacher.id ? <input type="hidden" name="id" value={teacher.id} /> : null}
      {state.error ? <Alert>{t(state.error)}</Alert> : null}

      <Card className="overflow-hidden">
        <CardHeader title={isNew ? t("teacher.new") : t("teacher.edit")} />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.name")} error={err("displayName")} required>
              <Input name="displayName" defaultValue={teacher.displayName} required />
            </Field>
            <Field label={t("common.nameKm")} error={err("displayNameKm")}>
              <Input
                name="displayNameKm"
                defaultValue={teacher.displayNameKm ?? ""}
                lang="km"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("teacher.staffCode")} error={err("staffCode")}>
              <Input name="staffCode" defaultValue={teacher.staffCode ?? ""} />
            </Field>
            <Field label={t("teacher.hireDate")} error={err("hireDate")}>
              <Input name="hireDate" type="date" defaultValue={teacher.hireDate ?? ""} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.phone")} error={err("phone")}>
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={teacher.phone ?? ""}
                placeholder="012 345 678"
              />
            </Field>
            <Field label={t("common.email")} error={err("email")}>
              <Input name="email" type="email" defaultValue={teacher.email ?? ""} />
            </Field>
          </div>

          <Field label={t("common.notes")} error={err("notes")}>
            <Textarea name="notes" rows={2} defaultValue={teacher.notes ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={t("action.signIn")} />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("teacher.username")}
              hint={t("teacher.username.hint")}
              error={err("username")}
              required
            >
              <Input
                name="username"
                defaultValue={teacher.username}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </Field>
            <Field label={t("common.language")} error={err("locale")}>
              <Select name="userLocale" defaultValue={teacher.locale}>
                <option value={Locale.KM}>ខ្មែរ</option>
                <option value={Locale.EN}>English</option>
              </Select>
            </Field>
          </div>

          {/* Setting a password here always forces the teacher to replace it on
              first use, so an administrator never keeps a working password for
              somebody else's account. Leaving it blank on an edit keeps the
              existing one. */}
          <Field
            label={t("teacher.temporaryPassword")}
            hint={t("teacher.temporaryPassword.hint")}
            error={err("temporaryPassword")}
            required={isNew}
          >
            <Input
              name="temporaryPassword"
              type="text"
              autoComplete="off"
              minLength={10}
              required={isNew}
            />
          </Field>

          <label className="flex items-center gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={teacher.isActive}
              className="h-5 w-5 rounded border-ink-300 text-brand-700"
            />
            {t("teacher.accountActive")}
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Submit />
        <Link
          href={
            (teacher.id
              ? `/${t.locale}/teachers/${teacher.id}`
              : `/${t.locale}/teachers`) as Route
          }
          className="inline-flex h-13 items-center rounded-xl px-5 font-medium text-ink-600 hover:bg-ink-100"
        >
          {t("action.cancel")}
        </Link>
      </div>
    </form>
  );
}
