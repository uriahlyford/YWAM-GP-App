import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { CalendarCheck, Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  can,
  requireClassAccess,
  requirePermission,
  scoped,
  visibleClassWhere,
} from "@/lib/auth/context";
import {
  createTranslator,
  isLocale,
  pickName,
  studentName,
  DEFAULT_LOCALE,
  type MessageKey,
} from "@/lib/i18n";
import { removeTeacher, unenrollStudent } from "@/features/classes/actions";
import {
  AssignTeacherForm,
  EnrollStudentForm,
  PromoteForm,
} from "@/features/classes/forms";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonStyles } from "@/components/ui/button";

export default async function ClassPage({
  params,
}: PageProps<"/[locale]/classes/[id]">) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("classes.read");
  const scope = await visibleClassWhere(auth);

  const klass = await prisma.class.findFirst({
    where: scoped(scope, { id }),
    include: {
      academicYear: {
        select: { id: true, name: true, isCurrent: true, startDate: true },
      },
      gradeLevel: { select: { name: true, nameKm: true } },
      teachers: {
        include: {
          teacher: {
            select: {
              id: true,
              user: { select: { displayName: true, displayNameKm: true } },
            },
          },
        },
      },
      enrollments: {
        where: { status: "ENROLLED" },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              firstName: true,
              lastName: true,
              firstNameKm: true,
              lastNameKm: true,
              photoKey: true,
            },
          },
        },
      },
    },
  });
  if (!klass) notFound();

  // Belt and braces: the scoped query already excludes another teacher's class,
  // but this is the page that lists children by name.
  await requireClassAccess(auth, klass.id);

  const manageable = can(auth, "classes.write");

  const [assignableTeachers, enrollableStudents, promotionTargets] = manageable
    ? await Promise.all([
        prisma.teacherProfile.findMany({
          where: {
            schoolId: auth.schoolId,
            user: { isActive: true },
            classAssignments: { none: { classId: klass.id } },
          },
          orderBy: { user: { displayName: "asc" } },
          select: {
            id: true,
            user: { select: { displayName: true, displayNameKm: true } },
          },
        }),
        prisma.student.findMany({
          where: {
            schoolId: auth.schoolId,
            archivedAt: null,
            status: "ACTIVE",
            enrollments: { none: { classId: klass.id, status: "ENROLLED" } },
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          take: 500,
          select: {
            id: true,
            studentCode: true,
            firstName: true,
            lastName: true,
            firstNameKm: true,
            lastNameKm: true,
          },
        }),
        // Promotion moves a class forward, so only later academic years are
        // offered — the point of the operation is that the children advance.
        prisma.class.findMany({
          where: {
            schoolId: auth.schoolId,
            isActive: true,
            NOT: { id: klass.id },
            academicYear: { startDate: { gt: klass.academicYear.startDate } },
          },
          orderBy: [
            { academicYear: { startDate: "asc" } },
            { gradeLevel: { ordinal: "asc" } },
          ],
          select: {
            id: true,
            name: true,
            nameKm: true,
            academicYear: { select: { name: true } },
          },
        }),
      ])
    : [[], [], []];

  return (
    <PageBody>
      <PageHeader
        title={pickName(locale, klass.name, klass.nameKm)}
        description={[
          klass.academicYear.name,
          pickName(locale, klass.gradeLevel.name, klass.gradeLevel.nameKm),
          klass.room,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${locale}/attendance/${klass.id}` as Route}
              className={buttonStyles()}
            >
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              {t("class.takeAttendance")}
            </Link>
            {manageable ? (
              <Link
                href={`/${locale}/classes/${klass.id}/edit` as Route}
                className={buttonStyles({ variant: "secondary" })}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {t("action.edit")}
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader
              title={t("class.roster")}
              description={t.plural("students.count", klass.enrollments.length)}
            />
            {klass.enrollments.length === 0 ? (
              <EmptyState title={t("class.emptyRoster")} />
            ) : (
              <ul className="divide-y divide-ink-100">
                {klass.enrollments.map((enrollment) => {
                  const name = studentName(locale, enrollment.student);
                  return (
                    <li
                      key={enrollment.id}
                      className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
                    >
                      <Avatar
                        photoKey={enrollment.student.photoKey}
                        name={name}
                        size="sm"
                      />
                      <Link
                        href={`/${locale}/students/${enrollment.student.id}` as Route}
                        className="min-w-0 flex-1"
                      >
                        <span className="block truncate font-medium text-ink-900">
                          {name}
                        </span>
                        <span className="block truncate text-sm text-ink-500">
                          {enrollment.student.studentCode}
                        </span>
                      </Link>
                      {manageable ? (
                        <form action={unenrollStudent.bind(null, enrollment.id, locale)}>
                          <Button type="submit" variant="ghost" size="sm">
                            {t("class.unenroll")}
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {manageable ? (
            <EnrollStudentForm classId={klass.id} students={enrollableStudents} />
          ) : null}

          {manageable ? (
            <PromoteForm
              fromClassId={klass.id}
              targets={promotionTargets.map((target) => ({
                id: target.id,
                label: `${pickName(locale, target.name, target.nameKm)} · ${target.academicYear.name}`,
              }))}
            />
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader title={t("class.teachers")} />
            {klass.teachers.length === 0 ? (
              <EmptyState title={t("class.noTeachers")} />
            ) : (
              <ul className="divide-y divide-ink-100">
                {klass.teachers.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex items-center gap-3 px-4 py-3 sm:px-5"
                  >
                    <Link
                      href={`/${locale}/teachers/${assignment.teacher.id}` as Route}
                      className="min-w-0 flex-1"
                    >
                      <span className="block truncate font-medium text-ink-900">
                        {pickName(
                          locale,
                          assignment.teacher.user.displayName,
                          assignment.teacher.user.displayNameKm,
                        )}
                      </span>
                      <span className="block text-sm text-ink-500">
                        {t(`classTeacher.${assignment.role}` as MessageKey)}
                      </span>
                    </Link>
                    {manageable ? (
                      <form action={removeTeacher.bind(null, assignment.id, locale)}>
                        <Button type="submit" variant="ghost" size="sm">
                          {t("class.removeTeacher")}
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {manageable ? (
            <AssignTeacherForm
              classId={klass.id}
              teachers={assignableTeachers.map((teacher) => ({
                id: teacher.id,
                name: teacher.user.displayName,
                nameKm: teacher.user.displayNameKm,
              }))}
            />
          ) : null}
        </div>
      </div>
    </PageBody>
  );
}
