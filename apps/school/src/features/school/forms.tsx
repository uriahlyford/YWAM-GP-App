"use client";

import { useT } from "@/lib/i18n/client";
import { Field, Input, Select } from "@/components/ui/field";
import { DisclosureForm, SimpleForm } from "@/components/ui/disclosure-form";
import {
  saveAcademicYear,
  saveGradeLevel,
  saveSchool,
  saveSubject,
  saveTerm,
} from "./actions";

/**
 * Every record here carries a Latin and a Khmer name, side by side in the same
 * form. Keeping them adjacent is deliberate: a school that fills in only one
 * ends up with a half-translated interface, and the empty box next to the full
 * one is the clearest possible reminder.
 */
function NamePair({
  latin,
  khmer,
  labelLatin,
  labelKhmer,
  hint,
  fieldError,
  required = true,
}: {
  latin?: string | null;
  khmer?: string | null;
  labelLatin: string;
  labelKhmer: string;
  hint?: string;
  fieldError: (name: string) => string | undefined;
  required?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={labelLatin} hint={hint} error={fieldError("name")} required={required}>
        <Input name="name" defaultValue={latin ?? ""} required={required} />
      </Field>
      <Field label={labelKhmer} error={fieldError("nameKm")}>
        <Input name="nameKm" defaultValue={khmer ?? ""} lang="km" />
      </Field>
    </div>
  );
}

// --- School ------------------------------------------------------------------

export function SchoolForm({
  school,
}: {
  school: {
    name: string;
    nameKm: string | null;
    address: string | null;
    addressKm: string | null;
    phone: string | null;
    email: string | null;
    timezone: string;
  };
}) {
  const t = useT();

  return (
    <SimpleForm action={saveSchool}>
      {({ fieldError }) => (
        <>
          <NamePair
            latin={school.name}
            khmer={school.nameKm}
            labelLatin={t("common.name")}
            labelKhmer={t("common.nameKm")}
            fieldError={fieldError}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.address")} error={fieldError("address")}>
              <Input name="address" defaultValue={school.address ?? ""} />
            </Field>
            <Field label={`${t("common.address")} (ខ្មែរ)`} error={fieldError("addressKm")}>
              <Input name="addressKm" defaultValue={school.addressKm ?? ""} lang="km" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.phone")} error={fieldError("phone")}>
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={school.phone ?? ""}
                placeholder="012 345 678"
              />
            </Field>
            <Field label={t("common.email")} error={fieldError("email")}>
              <Input name="email" type="email" defaultValue={school.email ?? ""} />
            </Field>
          </div>

          <Field
            label={t("school.timezone")}
            hint={t("school.timezone.hint")}
            error={fieldError("timezone")}
            required
          >
            <Select name="timezone" defaultValue={school.timezone}>
              <option value="Asia/Phnom_Penh">Asia/Phnom_Penh (UTC+7)</option>
              <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
              <option value="UTC">UTC</option>
            </Select>
          </Field>
        </>
      )}
    </SimpleForm>
  );
}

// --- Academic years ----------------------------------------------------------

type YearRecord = {
  id: string;
  name: string;
  nameKm: string | null;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

function YearFields({
  year,
  fieldError,
}: {
  year?: YearRecord;
  fieldError: (name: string) => string | undefined;
}) {
  const t = useT();
  return (
    <>
      {year ? <input type="hidden" name="id" value={year.id} /> : null}
      <NamePair
        latin={year?.name}
        khmer={year?.nameKm}
        labelLatin={t("year.name")}
        labelKhmer={t("common.nameKm")}
        hint={t("year.name.hint")}
        fieldError={fieldError}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("year.start")} error={fieldError("startDate")} required>
          <Input name="startDate" type="date" defaultValue={year?.startDate} required />
        </Field>
        <Field label={t("year.end")} error={fieldError("endDate")} required>
          <Input name="endDate" type="date" defaultValue={year?.endDate} required />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 text-sm text-ink-700">
        <input
          type="checkbox"
          name="isCurrent"
          defaultChecked={year?.isCurrent}
          className="h-5 w-5 rounded border-ink-300 text-brand-700"
        />
        {t("year.current")}
      </label>
    </>
  );
}

export function YearRow({ year, children }: { year: YearRecord; children?: React.ReactNode }) {
  const t = useT();
  return (
    <>
      <DisclosureForm
        summary={year.name}
        detail={`${year.startDate} → ${year.endDate}`}
        badge={
          year.isCurrent ? (
            <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800">
              {t("year.currentBadge")}
            </span>
          ) : null
        }
        action={saveAcademicYear}
      >
        {({ fieldError }) => <YearFields year={year} fieldError={fieldError} />}
      </DisclosureForm>
      {children}
    </>
  );
}

export function AddYear() {
  const t = useT();
  return (
    <DisclosureForm summary={t("year.add")} action={saveAcademicYear} tone="add">
      {({ fieldError }) => <YearFields fieldError={fieldError} />}
    </DisclosureForm>
  );
}

// --- Terms -------------------------------------------------------------------

type TermRecord = {
  id: string;
  name: string;
  nameKm: string | null;
  ordinal: number;
  startDate: string;
  endDate: string;
};

function TermFields({
  academicYearId,
  term,
  fieldError,
}: {
  academicYearId: string;
  term?: TermRecord;
  fieldError: (name: string) => string | undefined;
}) {
  const t = useT();
  return (
    <>
      <input type="hidden" name="academicYearId" value={academicYearId} />
      {term ? <input type="hidden" name="id" value={term.id} /> : null}
      <NamePair
        latin={term?.name}
        khmer={term?.nameKm}
        labelLatin={t("term.name")}
        labelKhmer={t("common.nameKm")}
        hint={t("term.name.hint")}
        fieldError={fieldError}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("term.ordinal")} error={fieldError("ordinal")} required>
          <Input
            name="ordinal"
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            defaultValue={term?.ordinal ?? 1}
            required
          />
        </Field>
        <Field label={t("year.start")} error={fieldError("startDate")} required>
          <Input name="startDate" type="date" defaultValue={term?.startDate} required />
        </Field>
        <Field label={t("year.end")} error={fieldError("endDate")} required>
          <Input name="endDate" type="date" defaultValue={term?.endDate} required />
        </Field>
      </div>
    </>
  );
}

export function TermRow({
  academicYearId,
  term,
}: {
  academicYearId: string;
  term: TermRecord;
}) {
  return (
    <DisclosureForm
      summary={term.name}
      detail={`${term.startDate} → ${term.endDate}`}
      action={saveTerm}
    >
      {({ fieldError }) => (
        <TermFields academicYearId={academicYearId} term={term} fieldError={fieldError} />
      )}
    </DisclosureForm>
  );
}

export function AddTerm({ academicYearId }: { academicYearId: string }) {
  const t = useT();
  return (
    <DisclosureForm summary={t("term.add")} action={saveTerm} tone="add">
      {({ fieldError }) => (
        <TermFields academicYearId={academicYearId} fieldError={fieldError} />
      )}
    </DisclosureForm>
  );
}

// --- Grade levels ------------------------------------------------------------

type GradeLevelRecord = {
  id: string;
  name: string;
  nameKm: string | null;
  ordinal: number;
  isActive: boolean;
};

function GradeLevelFields({
  level,
  fieldError,
}: {
  level?: GradeLevelRecord;
  fieldError: (name: string) => string | undefined;
}) {
  const t = useT();
  return (
    <>
      {level ? <input type="hidden" name="id" value={level.id} /> : null}
      <NamePair
        latin={level?.name}
        khmer={level?.nameKm}
        labelLatin={t("common.name")}
        labelKhmer={t("common.nameKm")}
        fieldError={fieldError}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("gradeLevel.ordinal")} error={fieldError("ordinal")} required>
          <Input
            name="ordinal"
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            defaultValue={level?.ordinal ?? 0}
            required
          />
        </Field>
        <label className="flex items-end gap-2.5 pb-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={level?.isActive ?? true}
            className="h-5 w-5 rounded border-ink-300 text-brand-700"
          />
          {t("field.active")}
        </label>
      </div>
    </>
  );
}

export function GradeLevelRow({
  level,
  classCount,
}: {
  level: GradeLevelRecord;
  classCount: number;
}) {
  const t = useT();
  return (
    <DisclosureForm
      summary={level.name}
      detail={level.nameKm ?? undefined}
      badge={
        <span className="shrink-0 text-sm text-ink-400">
          {t.plural("gradeLevel.inUse", classCount)}
        </span>
      }
      action={saveGradeLevel}
    >
      {({ fieldError }) => <GradeLevelFields level={level} fieldError={fieldError} />}
    </DisclosureForm>
  );
}

export function AddGradeLevel({ nextOrdinal }: { nextOrdinal: number }) {
  const t = useT();
  return (
    <DisclosureForm summary={t("gradeLevel.add")} action={saveGradeLevel} tone="add">
      {({ fieldError }) => (
        <GradeLevelFields
          level={{
            id: "",
            name: "",
            nameKm: "",
            ordinal: nextOrdinal,
            isActive: true,
          }}
          fieldError={fieldError}
        />
      )}
    </DisclosureForm>
  );
}

// --- Subjects ----------------------------------------------------------------

type SubjectRecord = {
  id: string;
  code: string;
  name: string;
  nameKm: string | null;
  ordinal: number;
  isActive: boolean;
};

function SubjectFields({
  subject,
  fieldError,
}: {
  subject?: SubjectRecord;
  fieldError: (name: string) => string | undefined;
}) {
  const t = useT();
  return (
    <>
      {subject?.id ? <input type="hidden" name="id" value={subject.id} /> : null}
      <NamePair
        latin={subject?.name}
        khmer={subject?.nameKm}
        labelLatin={t("common.name")}
        labelKhmer={t("common.nameKm")}
        fieldError={fieldError}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label={t("subject.code")}
          hint={t("subject.code.hint")}
          error={fieldError("code")}
          required
        >
          <Input
            name="code"
            defaultValue={subject?.code ?? ""}
            maxLength={12}
            autoCapitalize="characters"
            required
          />
        </Field>
        <Field label={t("subject.ordinal")} error={fieldError("ordinal")}>
          <Input
            name="ordinal"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            defaultValue={subject?.ordinal ?? 0}
          />
        </Field>
        <label className="flex items-end gap-2.5 pb-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={subject?.isActive ?? true}
            className="h-5 w-5 rounded border-ink-300 text-brand-700"
          />
          {t("field.active")}
        </label>
      </div>
    </>
  );
}

export function SubjectRow({ subject }: { subject: SubjectRecord }) {
  const t = useT();
  return (
    <DisclosureForm
      summary={subject.name}
      detail={subject.nameKm ?? undefined}
      badge={
        <span className="shrink-0 rounded-md bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-600">
          {subject.isActive ? subject.code : t("field.inactive")}
        </span>
      }
      action={saveSubject}
    >
      {({ fieldError }) => <SubjectFields subject={subject} fieldError={fieldError} />}
    </DisclosureForm>
  );
}

export function AddSubject({ nextOrdinal }: { nextOrdinal: number }) {
  const t = useT();
  return (
    <DisclosureForm summary={t("subject.add")} action={saveSubject} tone="add">
      {({ fieldError }) => (
        <SubjectFields
          subject={{
            id: "",
            code: "",
            name: "",
            nameKm: "",
            ordinal: nextOrdinal,
            isActive: true,
          }}
          fieldError={fieldError}
        />
      )}
    </DisclosureForm>
  );
}
