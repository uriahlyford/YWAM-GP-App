"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditAction, auditedWrite } from "@/lib/audit";
import { ForbiddenError, requirePermission } from "@/lib/auth/context";
import { destroyAllSessions } from "@/lib/auth/session";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { toDbDate } from "@/lib/date";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import {
  cambodianPhone,
  checkbox,
  dateOnlyField,
  invalid,
  optionalText,
  value,
  type ActionState,
} from "@/lib/form";
import { Locale, Role } from "@/generated/prisma/enums";

/**
 * A teacher is a `User` who can sign in, a `Membership` that says which campus
 * and role, and a `TeacherProfile` carrying the staff details. All three are
 * written in one transaction — a User with no Membership can authenticate but
 * has nowhere to go, which is the worst of the three possible half-states.
 */

const teacherSchema = z.object({
  id: z.string().optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9._-]+$/i, { error: "invalidUsername" })
    .transform((v) => v.toLowerCase()),
  displayName: z.string().trim().min(1).max(160),
  displayNameKm: optionalText,
  email: z.email({ error: "invalidEmail" }).optional(),
  locale: z.enum(Locale),
  staffCode: optionalText,
  phone: cambodianPhone.optional(),
  hireDate: dateOnlyField.optional(),
  notes: optionalText,
  isActive: z.boolean(),
  temporaryPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, { error: "passwordTooShort" })
    .max(500)
    .optional(),
});

export async function saveTeacher(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requirePermission("teachers.write");

  const parsed = teacherSchema.safeParse({
    id: value(formData, "id"),
    username: value(formData, "username"),
    displayName: value(formData, "displayName"),
    displayNameKm: value(formData, "displayNameKm"),
    email: value(formData, "email"),
    locale: value(formData, "userLocale") ?? Locale.KM,
    staffCode: value(formData, "staffCode"),
    phone: value(formData, "phone"),
    hireDate: value(formData, "hireDate"),
    notes: value(formData, "notes"),
    isActive: checkbox(formData, "isActive"),
    temporaryPassword: value(formData, "temporaryPassword"),
  });

  if (!parsed.success) {
    const errors = invalid(parsed.error);
    // The password rule has its own wording; the generic "required" is unhelpful
    // when the real problem is the length.
    if (parsed.error.issues.some((i) => i.message === "passwordTooShort")) {
      return { fieldErrors: { ...errors.fieldErrors, temporaryPassword: "auth.passwordTooShort" } };
    }
    return errors;
  }

  const {
    id,
    username,
    displayName,
    displayNameKm,
    email,
    locale: userLocale,
    isActive,
    temporaryPassword,
    hireDate,
    ...profile
  } = parsed.data;

  const existing = id
    ? await prisma.teacherProfile.findUniqueOrThrow({
        where: { id },
        include: { user: true },
      })
    : null;
  if (existing && existing.schoolId !== auth.schoolId) throw new ForbiddenError();

  // A new teacher needs a password to sign in with at all.
  if (!existing && !temporaryPassword) {
    return { fieldErrors: { temporaryPassword: "error.required" } };
  }

  const usernameClash = await prisma.user.findFirst({
    where: {
      username,
      ...(existing ? { NOT: { id: existing.userId } } : {}),
    },
    select: { id: true },
  });
  if (usernameClash) return { fieldErrors: { username: "error.duplicateUsername" } };

  const teacher = await auditedWrite(
    {
      auth,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "TeacherProfile",
      before: existing
        ? { ...existing, user: undefined, ...userFields(existing.user) }
        : null,
      summary: displayName,
    },
    async (tx) => {
      const userData = {
        username,
        displayName,
        displayNameKm,
        email: email ?? null,
        locale: userLocale,
        isActive,
        ...(temporaryPassword
          ? {
              passwordHash: await hashPassword(temporaryPassword),
              // Set by an administrator, so the teacher must replace it. Nobody
              // else should know a working password for their account.
              mustChangePassword: true,
              failedLoginCount: 0,
              lastFailedLoginAt: null,
              lockedUntil: null,
            }
          : {}),
      };

      const profileData = {
        ...profile,
        schoolId: auth.schoolId,
        hireDate: hireDate ? toDbDate(hireDate) : null,
      };

      if (existing) {
        await tx.user.update({ where: { id: existing.userId }, data: userData });
        const entity = await tx.teacherProfile.update({
          where: { id: existing.id },
          data: profileData,
        });
        return { entity, after: { ...entity, ...userFields({ ...userData }) } };
      }

      const user = await tx.user.create({
        data: {
          ...userData,
          passwordHash: userData.passwordHash!,
          memberships: {
            create: { schoolId: auth.schoolId, role: Role.TEACHER },
          },
        },
      });

      const entity = await tx.teacherProfile.create({
        data: { ...profileData, userId: user.id },
      });

      return { entity, after: { ...entity, ...userFields(user) } };
    },
  );

  // A new password, or a deactivated account, must not leave live sessions
  // behind — that is the whole point of doing either.
  if (existing && (temporaryPassword || !isActive)) {
    await destroyAllSessions(existing.userId);
  }

  const pageLocale = isLocale(value(formData, "locale"))
    ? value(formData, "locale")!
    : DEFAULT_LOCALE;

  revalidatePath(`/${pageLocale}/teachers`);
  redirect(`/${pageLocale}/teachers/${teacher.id}` as Route);
}

/** The user columns worth showing in an audit entry. Never the password hash. */
function userFields(user: {
  username?: string;
  displayName?: string;
  displayNameKm?: string | null;
  email?: string | null;
  locale?: Locale;
  isActive?: boolean;
}) {
  return {
    username: user.username,
    displayName: user.displayName,
    displayNameKm: user.displayNameKm ?? null,
    email: user.email ?? null,
    locale: user.locale,
    isActive: user.isActive,
  };
}
