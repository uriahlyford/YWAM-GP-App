import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { fromDbDate } from "@/lib/date";
import { enrollableClasses, getStudent } from "@/features/students/queries";
import { StudentForm } from "@/features/students/form";
import { PageBody, PageHeader } from "@/components/ui/page";

export default async function EditStudentPage({
  params,
}: PageProps<"/[locale]/students/[id]/edit">) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("students.write");
  const [student, classes] = await Promise.all([
    getStudent(auth, id),
    enrollableClasses(auth),
  ]);

  // Out of scope reads the same as non-existent, so the response can't be used
  // to discover that a child is enrolled somewhere the reader can't see.
  if (!student) notFound();

  const enrolled = student.enrollments.find((e) => e.status === "ENROLLED");

  return (
    <PageBody>
      <PageHeader title={t("student.edit")} />
      <StudentForm
        classes={classes}
        student={{
          id: student.id,
          studentCode: student.studentCode,
          firstName: student.firstName,
          lastName: student.lastName,
          firstNameKm: student.firstNameKm,
          lastNameKm: student.lastNameKm,
          englishName: student.englishName,
          dateOfBirth: student.dateOfBirth ? fromDbDate(student.dateOfBirth) : null,
          gender: student.gender,
          status: student.status,
          enrollmentDate: fromDbDate(student.enrollmentDate),
          address: student.address,
          phone: student.phone,
          emergencyNote: student.emergencyNote,
          medicalNote: student.medicalNote,
          notes: student.notes,
          photoKey: student.photoKey,
          classId: enrolled?.classId ?? null,
        }}
      />
    </PageBody>
  );
}
