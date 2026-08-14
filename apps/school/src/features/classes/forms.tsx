"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import { useT } from "@/lib/i18n/client";
import { pickName, studentName, type MessageKey } from "@/lib/i18n";
import { EMPTY_STATE, type ActionState } from "@/lib/form";
import { ClassTeacherRole } from "@/generated/prisma/enums";
import { assignTeacher, enrollStudent, promoteClass, saveClass } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert, Card, CardHeader } from "@/components/ui/surface";
import { DisclosureForm } from "@/components/ui/disclosure-form";

export type ClassFormValues = {
  id?: string;
  academicYearId: string;
  gradeLevelId: string;
  name: string;
  nameKm: string | null;
  room: string | null;
  homeroomTeacherId: string | null;
  isActive: boolean;
};

type Named = { id: string; name: string; nameKm: string | null };

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? t("action.saving") : t("action.save")}
    </Button>
  );
}

export function ClassForm({
  klass,
  years,
  gradeLevels,
  teachers,
}: {
  klass: ClassFormValues;
  years: { id: string; name: string; isCurrent: boolean }[];
  gradeLevels: Named[];
  teachers: { id: string; name: string; nameKm: string | null }[];
}) {
  const t = useT();
  const [state, action] = useActionState<ActionState, FormData>(
    saveClass,
    EMPTY_STATE,
  );

  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? t(key) : undefined;
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={t.locale} />
      {klass.id ? <input type="hidden" name="id" value={klass.id} /> : null}
      {state.error ? <Alert>{t(state.error)}</Alert> : null}

      <Card className="overflow-hidden">
        <CardHeader title={klass.id ? t("class.edit") : t("class.new")} />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("class.name")}
              hint={t("class.name.hint")}
              error={err("name")}
              required
            >
              <Input name="name" defaultValue={klass.name} required />
            </Field>
            <Field label={t("common.nameKm")} error={err("nameKm")}>
              <Input name="nameKm" defaultValue={klass.nameKm ?? ""} lang="km" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("class.academicYear")}
              error={err("academicYearId")}
              required
            >
              <Select name="academicYearId" defaultValue={klass.academicYearId}>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                    {year.isCurrent ? ` · ${t("year.currentBadge")}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("class.gradeLevel")} error={err("gradeLevelId")} required>
              <Select name="gradeLevelId" defaultValue={klass.gradeLevelId}>
                {gradeLevels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {pickName(t.locale, level.name, level.nameKm)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("class.room")} error={err("room")}>
              <Input name="room" defaultValue={klass.room ?? ""} />
            </Field>
            <Field
              label={t("class.homeroomTeacher")}
              error={err("homeroomTeacherId")}
            >
              <Select
                name="homeroomTeacherId"
                defaultValue={klass.homeroomTeacherId ?? ""}
              >
                <option value="">{t("class.noHomeroomTeacher")}</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {pickName(t.locale, teacher.name, teacher.nameKm)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={klass.isActive}
              className="h-5 w-5 rounded border-ink-300 text-brand-700"
            />
            {t("class.active")}
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Submit />
        <Link
          href={
            (klass.id ? `/${t.locale}/classes/${klass.id}` : `/${t.locale}/classes`) as Route
          }
          className="inline-flex h-13 items-center rounded-xl px-5 font-medium text-ink-600 hover:bg-ink-100"
        >
          {t("action.cancel")}
        </Link>
      </div>
    </form>
  );
}

export function AssignTeacherForm({
  classId,
  teachers,
}: {
  classId: string;
  teachers: { id: string; name: string; nameKm: string | null }[];
}) {
  const t = useT();
  return (
    <DisclosureForm
      summary={t("class.assignTeacher")}
      action={assignTeacher}
      tone="add"
      submitLabel={t("action.add")}
    >
      {({ fieldError }) => (
        <>
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="locale" value={t.locale} />
          <Field label={t("teachers.title")} error={fieldError("teacherId")} required>
            <Select name="teacherId" required defaultValue="">
              <option value="" disabled>
                {t("action.search")}…
              </option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {pickName(t.locale, teacher.name, teacher.nameKm)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("class.role")} error={fieldError("role")}>
            <Select name="role" defaultValue={ClassTeacherRole.SUBJECT}>
              {Object.values(ClassTeacherRole).map((role) => (
                <option key={role} value={role}>
                  {t(`classTeacher.${role}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}
    </DisclosureForm>
  );
}

export function EnrollStudentForm({
  classId,
  students,
}: {
  classId: string;
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
      summary={t("class.enroll")}
      action={enrollStudent}
      tone="add"
      submitLabel={t("action.add")}
    >
      {({ fieldError }) => (
        <>
          <input type="hidden" name="classId" value={classId} />
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
        </>
      )}
    </DisclosureForm>
  );
}

export function PromoteForm({
  fromClassId,
  targets,
}: {
  fromClassId: string;
  targets: { id: string; label: string }[];
}) {
  const t = useT();
  const [state, action] = useActionState<ActionState, FormData>(
    promoteClass,
    EMPTY_STATE,
  );

  if (targets.length === 0) {
    return (
      <Alert tone="info">{t("class.promote.noTarget")}</Alert>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title={t("class.promote")} description={t("class.promote.hint")} />
      <form action={action} className="space-y-4 p-4 sm:p-5">
        <input type="hidden" name="fromClassId" value={fromClassId} />
        <input type="hidden" name="locale" value={t.locale} />

        {state.ok && state.createdId ? (
          <Alert tone="success">
            {t("class.promote.done", { count: state.createdId })}
          </Alert>
        ) : null}
        {state.fieldErrors?.toClassId ? (
          <Alert>{t(state.fieldErrors.toClassId)}</Alert>
        ) : null}

        <Field label={t("class.promote.target")} required>
          <Select name="toClassId" required defaultValue="">
            <option value="" disabled>
              {t("action.search")}…
            </option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" variant="secondary">
          {t("class.promote")}
        </Button>
      </form>
    </Card>
  );
}
