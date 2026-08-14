import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { Pencil, Phone } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/context";
import {
  createTranslator,
  isLocale,
  pickName,
  studentName,
  DEFAULT_LOCALE,
  type MessageKey,
} from "@/lib/i18n";
import { getGuardian, linkableStudents } from "@/features/guardians/queries";
import { unlinkStudentFromGuardian } from "@/features/guardians/actions";
import { LinkStudentForm } from "@/features/guardians/forms";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonStyles } from "@/components/ui/button";

export default async function GuardianProfilePage({
  params,
}: PageProps<"/[locale]/parents/[id]">) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("guardians.read");
  const guardian = await getGuardian(auth, id);
  if (!guardian) notFound();

  const editable = can(auth, "guardians.write");
  const available = editable ? await linkableStudents(auth, guardian.id) : [];

  return (
    <PageBody>
      <PageHeader
        title={pickName(locale, guardian.name, guardian.nameKm)}
        description={guardian.occupation ?? undefined}
        action={
          editable ? (
            <Link
              href={`/${locale}/parents/${guardian.id}/edit` as Route}
              className={buttonStyles({ variant: "secondary" })}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("action.edit")}
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("common.actions")} />
          <dl className="grid gap-3 p-4 sm:p-5">
            <div>
              <dt className="text-sm text-ink-500">{t("common.phone")}</dt>
              <dd className="mt-0.5">
                <a
                  href={`tel:${guardian.phone}`}
                  className="inline-flex items-center gap-1.5 text-brand-700"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {guardian.phone}
                </a>
                {guardian.phone2 ? (
                  <a
                    href={`tel:${guardian.phone2}`}
                    className="ms-4 inline-flex items-center gap-1.5 text-brand-700"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {guardian.phone2}
                  </a>
                ) : null}
              </dd>
            </div>
            {guardian.email ? (
              <div>
                <dt className="text-sm text-ink-500">{t("common.email")}</dt>
                <dd className="mt-0.5 text-ink-900">{guardian.email}</dd>
              </div>
            ) : null}
            {guardian.address ? (
              <div>
                <dt className="text-sm text-ink-500">{t("common.address")}</dt>
                <dd className="mt-0.5 text-ink-900">{guardian.address}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm text-ink-500">
                {t("guardian.preferredLocale")}
              </dt>
              <dd className="mt-0.5 text-ink-900">
                {guardian.preferredLocale === "KM" ? "ខ្មែរ" : "English"}
              </dd>
            </div>
            {guardian.notes ? (
              <div>
                <dt className="text-sm text-ink-500">{t("common.notes")}</dt>
                <dd className="mt-0.5 text-ink-900">{guardian.notes}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader title={t("guardian.children")} />
            {guardian.students.length === 0 ? (
              <EmptyState title={t("guardian.noChildren")} />
            ) : (
              <ul className="divide-y divide-ink-100">
                {guardian.students.map((link) => {
                  const name = studentName(locale, link.student);
                  const klass = link.student.enrollments[0]?.class;
                  return (
                    <li
                      key={link.id}
                      className="flex items-center gap-3 px-4 py-3 sm:px-5"
                    >
                      <Avatar photoKey={link.student.photoKey} name={name} size="sm" />
                      <Link
                        href={`/${locale}/students/${link.student.id}` as Route}
                        className="min-w-0 flex-1"
                      >
                        <span className="block truncate font-medium text-ink-900">
                          {name}
                        </span>
                        <span className="block truncate text-sm text-ink-500">
                          {t(`relationship.${link.relationship}` as MessageKey)}
                          {klass
                            ? ` · ${pickName(locale, klass.name, klass.nameKm)}`
                            : ""}
                        </span>
                      </Link>
                      {editable ? (
                        <form
                          action={unlinkStudentFromGuardian.bind(null, link.id, locale)}
                        >
                          <Button type="submit" variant="ghost" size="sm">
                            {t("guardian.unlink")}
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {editable ? (
            <LinkStudentForm guardianId={guardian.id} students={available} />
          ) : null}
        </div>
      </div>
    </PageBody>
  );
}
