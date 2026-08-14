import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { today } from "@/lib/date";
import { prisma } from "@/lib/db";
import { enrollableClasses, suggestStudentCode } from "@/features/students/queries";
import { StudentForm } from "@/features/students/form";
import { PageBody, PageHeader } from "@/components/ui/page";
import { StudentStatus } from "@/generated/prisma/enums";

export default async function NewStudentPage({
  params,
}: PageProps<"/[locale]/students/new">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("students.write");

  const [classes, studentCode, school] = await Promise.all([
    enrollableClasses(auth),
    suggestStudentCode(auth),
    prisma.school.findUniqueOrThrow({
      where: { id: auth.schoolId },
      select: { timezone: true },
    }),
  ]);

  const currentClass = classes.find((c) => c.academicYear.isCurrent);

  return (
    <PageBody>
      <PageHeader title={t("student.new")} />
      <StudentForm
        classes={classes}
        student={{
          studentCode,
          firstName: "",
          lastName: "",
          firstNameKm: null,
          lastNameKm: null,
          englishName: null,
          dateOfBirth: null,
          gender: null,
          status: StudentStatus.ACTIVE,
          // Today in the school's own zone, not the server's.
          enrollmentDate: today(school.timezone),
          address: null,
          phone: null,
          emergencyNote: null,
          medicalNote: null,
          notes: null,
          photoKey: null,
          classId: currentClass?.id ?? null,
        }}
      />
    </PageBody>
  );
}
