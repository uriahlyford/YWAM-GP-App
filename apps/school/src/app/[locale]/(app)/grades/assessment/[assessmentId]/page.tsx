import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/auth/context";
import {
  createTranslator,
  formatDate,
  isLocale,
  pickName,
  DEFAULT_LOCALE,
} from "@/lib/i18n";
import { markSheet } from "@/features/grades/queries";
import { MarkSheetForm } from "@/features/grades/mark-sheet";
import { AssessmentForm } from "@/features/grades/assessment-form";
import { PageBody, PageHeader } from "@/components/ui/page";

export default async function AssessmentPage({
  params,
}: PageProps<"/[locale]/grades/assessment/[assessmentId]">) {
  const { locale: raw, assessmentId } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("grades.read");
  const sheet = await markSheet(auth, assessmentId);
  if (!sheet) notFound();

  const editable = can(auth, "grades.write");

  const subjects = editable
    ? await prisma.subject.findMany({
        where: { schoolId: auth.schoolId, isActive: true },
        orderBy: [{ ordinal: "asc" }, { name: "asc" }],
        select: { id: true, name: true, nameKm: true },
      })
    : [];

  const { assessment } = sheet;

  return (
    <PageBody>
      <PageHeader
        title={pickName(locale, assessment.title, assessment.titleKm)}
        description={[
          pickName(locale, assessment.className, assessment.classNameKm),
          pickName(locale, assessment.subjectName, assessment.subjectNameKm),
          formatDate(t, assessment.date),
          t("grades.outOf", { max: assessment.maxScore }),
        ].join(" · ")}
        action={
          <Link
            href={
              `/${locale}/grades?class=${assessment.classId}&term=${assessment.termId}&subject=${assessment.subjectId}` as Route
            }
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            {t("action.back")}
          </Link>
        }
      />

      {editable ? <MarkSheetForm sheet={sheet} /> : null}

      {!editable ? (
        <p className="text-ink-500">{t("error.forbidden.body")}</p>
      ) : null}

      {editable ? (
        <div className="mt-6">
          <AssessmentForm
            classId={assessment.classId}
            termId={assessment.termId}
            subjects={subjects}
            defaultDate={assessment.date}
            assessment={{
              id: assessment.id,
              title: assessment.title,
              titleKm: assessment.titleKm,
              date: assessment.date,
              maxScore: assessment.maxScore,
              weight: assessment.weight,
              subjectId: assessment.subjectId,
            }}
          />
        </div>
      ) : null}
    </PageBody>
  );
}
