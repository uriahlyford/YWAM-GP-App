import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/context";
import { createTranslator, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { fromDbDate } from "@/lib/date";
import { TeacherForm } from "@/features/teachers/forms";
import { PageBody, PageHeader } from "@/components/ui/page";

export default async function EditTeacherPage({
  params,
}: PageProps<"/[locale]/teachers/[id]/edit">) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("teachers.write");
  const teacher = await prisma.teacherProfile.findFirst({
    where: { id, schoolId: auth.schoolId },
    include: { user: true },
  });
  if (!teacher) notFound();

  return (
    <PageBody>
      <PageHeader title={t("teacher.edit")} />
      <TeacherForm
        teacher={{
          id: teacher.id,
          username: teacher.user.username,
          displayName: teacher.user.displayName,
          displayNameKm: teacher.user.displayNameKm,
          email: teacher.user.email,
          locale: teacher.user.locale,
          staffCode: teacher.staffCode,
          phone: teacher.phone,
          hireDate: teacher.hireDate ? fromDbDate(teacher.hireDate) : null,
          notes: teacher.notes,
          isActive: teacher.user.isActive,
        }}
      />
    </PageBody>
  );
}
