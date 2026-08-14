"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import { useT } from "@/lib/i18n/client";
import { pickName, type MessageKey } from "@/lib/i18n";
import { EMPTY_STATE, type ActionState } from "@/lib/form";
import { Gender, StudentStatus } from "@/generated/prisma/enums";
import { saveStudent } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card, CardHeader } from "@/components/ui/surface";
import { Avatar } from "@/components/ui/avatar";

export type StudentFormValues = {
  id?: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  firstNameKm: string | null;
  lastNameKm: string | null;
  englishName: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  status: StudentStatus;
  enrollmentDate: string;
  address: string | null;
  phone: string | null;
  emergencyNote: string | null;
  medicalNote: string | null;
  notes: string | null;
  photoKey: string | null;
  classId: string | null;
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} />
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </Card>
  );
}

export function StudentForm({
  student,
  classes,
}: {
  student: StudentFormValues;
  classes: {
    id: string;
    name: string;
    nameKm: string | null;
    academicYear: { name: string; isCurrent: boolean };
  }[];
}) {
  const t = useT();
  const [state, action] = useActionState<ActionState, FormData>(
    saveStudent,
    EMPTY_STATE,
  );

  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? t(key) : undefined;
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={t.locale} />
      {student.id ? <input type="hidden" name="id" value={student.id} /> : null}

      {state.error ? <Alert>{t(state.error)}</Alert> : null}

      <Section title={t("student.section.names")}>
        {/* Khmer and Latin names are both authoritative and sit together, so a
            half-filled record is visible while it is being typed rather than
            discovered later on a report card. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("student.lastName")} error={err("lastName")} required>
            <Input name="lastName" defaultValue={student.lastName} required />
          </Field>
          <Field label={t("student.lastNameKm")} error={err("lastNameKm")}>
            <Input name="lastNameKm" defaultValue={student.lastNameKm ?? ""} lang="km" />
          </Field>
          <Field label={t("student.firstName")} error={err("firstName")} required>
            <Input name="firstName" defaultValue={student.firstName} required />
          </Field>
          <Field label={t("student.firstNameKm")} error={err("firstNameKm")}>
            <Input
              name="firstNameKm"
              defaultValue={student.firstNameKm ?? ""}
              lang="km"
            />
          </Field>
        </div>
        <Field
          label={t("student.englishName")}
          hint={t("student.englishName.hint")}
          error={err("englishName")}
        >
          <Input name="englishName" defaultValue={student.englishName ?? ""} />
        </Field>
      </Section>

      <Section title={t("student.section.about")}>
        <div className="flex items-start gap-4">
          <Avatar
            photoKey={student.photoKey}
            name={student.lastName || "?"}
            size="lg"
          />
          <Field
            label={t("student.photo")}
            hint={t("student.photo.hint")}
            error={err("photo")}
            className="flex-1"
          >
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              // `capture` is deliberately absent: an office computer should get
              // a file picker, and a phone still offers the camera in the sheet.
              className="w-full text-sm text-ink-600 file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("student.dob")} error={err("dateOfBirth")}>
            <Input
              name="dateOfBirth"
              type="date"
              defaultValue={student.dateOfBirth ?? ""}
            />
          </Field>
          <Field label={t("student.gender")} error={err("gender")}>
            <Select name="gender" defaultValue={student.gender ?? ""}>
              <option value="">{t("common.none")}</option>
              {Object.values(Gender).map((value) => (
                <option key={value} value={value}>
                  {t(`gender.${value}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title={t("student.section.school")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("student.code")} error={err("studentCode")} required>
            <Input name="studentCode" defaultValue={student.studentCode} required />
          </Field>
          <Field label={t("common.status")} error={err("status")} required>
            <Select name="status" defaultValue={student.status}>
              {Object.values(StudentStatus).map((value) => (
                <option key={value} value={value}>
                  {t(`student.status.${value}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("student.enrollmentDate")}
            error={err("enrollmentDate")}
            required
          >
            <Input
              name="enrollmentDate"
              type="date"
              defaultValue={student.enrollmentDate}
              required
            />
          </Field>
          <Field label={t("student.class")} error={err("classId")}>
            <Select name="classId" defaultValue={student.classId ?? ""}>
              <option value="">{t("students.noClass")}</option>
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {pickName(t.locale, klass.name, klass.nameKm)} ·{" "}
                  {klass.academicYear.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title={t("student.section.contact")}>
        <Field label={t("common.address")} error={err("address")}>
          <Input name="address" defaultValue={student.address ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("common.phone")} error={err("phone")}>
            <Input
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={student.phone ?? ""}
              placeholder="012 345 678"
            />
          </Field>
          <Field
            label={t("student.emergencyNote")}
            hint={t("student.emergencyNote.hint")}
            error={err("emergencyNote")}
          >
            <Input name="emergencyNote" defaultValue={student.emergencyNote ?? ""} />
          </Field>
        </div>
      </Section>

      <Section title={t("student.section.notes")}>
        <Field label={t("student.medicalNote")} error={err("medicalNote")}>
          <Textarea name="medicalNote" rows={2} defaultValue={student.medicalNote ?? ""} />
        </Field>
        <Field label={t("common.notes")} error={err("notes")}>
          <Textarea name="notes" rows={3} defaultValue={student.notes ?? ""} />
        </Field>
      </Section>

      <div className="flex flex-wrap gap-3">
        <Submit />
        <Link
          href={
            (student.id
              ? `/${t.locale}/students/${student.id}`
              : `/${t.locale}/students`) as Route
          }
          className="inline-flex h-13 items-center rounded-xl px-5 font-medium text-ink-600 hover:bg-ink-100"
        >
          {t("action.cancel")}
        </Link>
      </div>
    </form>
  );
}
