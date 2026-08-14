/**
 * The source-of-truth message catalogue.
 *
 * Keys are flat and namespaced by dot. Flat rather than nested so that
 * `km.ts` can be typed as `Record<MessageKey, string>` — a missing Khmer
 * translation is then a build error, not a half-English screen discovered by a
 * teacher in Kampong Speu.
 *
 * Numbers, percentages and dates keep Arabic numerals in both languages. That is
 * standard practice in Cambodian government and school documents; Khmer numerals
 * would look archaic on a report card.
 */
export const en = {
  // --- Identity ---
  "app.name": "Sala",
  "app.tagline": "School management",

  // --- Navigation ---
  "nav.dashboard": "Dashboard",
  "nav.students": "Students",
  "nav.attendance": "Attendance",
  "nav.grades": "Grades",
  "nav.classes": "Classes",
  "nav.teachers": "Teachers",
  "nav.parents": "Parents",
  "nav.reports": "Reports",
  "nav.notifications": "Notifications",
  "nav.settings": "Settings",
  "nav.audit": "Activity log",
  "nav.menu": "Menu",
  "nav.close": "Close",

  // --- Common actions ---
  "action.save": "Save",
  "action.saving": "Saving…",
  "action.saved": "Saved",
  "action.cancel": "Cancel",
  "action.edit": "Edit",
  "action.delete": "Delete",
  "action.archive": "Archive",
  "action.restore": "Restore",
  "action.add": "Add",
  "action.create": "Create",
  "action.search": "Search",
  "action.back": "Back",
  "action.next": "Next",
  "action.previous": "Previous",
  "action.confirm": "Confirm",
  "action.retry": "Try again",
  "action.export": "Export",
  "action.viewAll": "View all",
  "action.signIn": "Sign in",
  "action.signOut": "Sign out",

  // --- Common words ---
  "common.name": "Name",
  "common.nameKm": "Name in Khmer",
  "common.optional": "Optional",
  "common.required": "Required",
  "common.yes": "Yes",
  "common.no": "No",
  "common.none": "None",
  "common.all": "All",
  "common.today": "Today",
  "common.date": "Date",
  "common.time": "Time",
  "common.status": "Status",
  "common.notes": "Notes",
  "common.phone": "Phone",
  "common.email": "Email",
  "common.address": "Address",
  "common.actions": "Actions",
  "common.loading": "Loading…",
  "common.empty": "Nothing here yet",
  "common.of": "of",
  "common.language": "Language",
  "common.total": "Total",

  // --- Errors ---
  "error.title": "Something went wrong",
  "error.generic": "Something went wrong. Please try again.",
  "error.notFound": "Not found",
  "error.notFound.body": "That page doesn't exist, or you don't have access to it.",
  "error.forbidden": "You don't have access to this",
  "error.forbidden.body":
    "Ask a school administrator if you think you should be able to see this.",
  "error.required": "This field is required",
  "error.invalidPhone": "Enter a valid Cambodian phone number",
  "error.invalidEmail": "Enter a valid email address",
  "error.invalidDate": "Enter a valid date",

  // --- Sign in ---
  "auth.signIn.title": "Sign in",
  "auth.signIn.subtitle": "Enter the details your school gave you.",
  "auth.username": "Username",
  "auth.password": "Password",
  "auth.signingIn": "Signing in…",
  "auth.invalidCredentials": "Wrong username or password.",
  "auth.accountLocked":
    "Too many attempts. Try again in a few minutes, or ask an administrator.",
  "auth.accountInactive": "This account has been deactivated.",
  "auth.signedOut": "You have been signed out.",
  "auth.sessionExpired": "Your session expired. Please sign in again.",
  "auth.mustChangePassword": "Choose a new password",
  "auth.mustChangePassword.body":
    "Your account is using a temporary password. Choose your own before continuing.",
  "auth.newPassword": "New password",
  "auth.confirmPassword": "Confirm new password",
  "auth.passwordMismatch": "The two passwords don't match.",
  "auth.passwordTooShort": "Use at least 10 characters.",
  "auth.passwordChanged": "Password changed.",

  // --- Roles ---
  "role.SUPER_ADMIN": "Super administrator",
  "role.SCHOOL_ADMIN": "School administrator",
  "role.TEACHER": "Teacher",
  "role.PARENT": "Parent",

  // --- Attendance vocabulary ---
  "attendance.status.PRESENT": "Present",
  "attendance.status.ABSENT": "Absent",
  "attendance.status.LATE": "Late",
  "attendance.status.EXCUSED": "Excused",
  "attendance.status.LEFT_EARLY": "Left early",

  // --- Student vocabulary ---
  "student.status.ACTIVE": "Active",
  "student.status.INACTIVE": "Inactive",
  "student.status.GRADUATED": "Graduated",
  "student.status.TRANSFERRED": "Transferred",
  "student.status.WITHDRAWN": "Withdrawn",
  "gender.MALE": "Male",
  "gender.FEMALE": "Female",
  "gender.OTHER": "Other",

  // --- Guardian relationships ---
  "relationship.MOTHER": "Mother",
  "relationship.FATHER": "Father",
  "relationship.GRANDMOTHER": "Grandmother",
  "relationship.GRANDFATHER": "Grandfather",
  "relationship.AUNT": "Aunt",
  "relationship.UNCLE": "Uncle",
  "relationship.SIBLING": "Sibling",
  "relationship.GUARDIAN": "Guardian",
  "relationship.OTHER": "Other",

  // --- Activity log ---
  "audit.title": "Activity log",
  "audit.subtitle": "Who changed what, and when.",
  "audit.empty": "No activity recorded yet",
  "audit.system": "System",
  "audit.changed": "Changed",
  "audit.from": "from",
  "audit.to": "to",
  "audit.noFieldChanges": "No field values changed",
  "audit.filter.action": "Action",
  "audit.filter.entity": "Record type",
  "audit.filter.all": "Everything",
  "audit.showing": "Showing {from}–{to} of {total}",
  "audit.blank": "(empty)",

  "audit.action.CREATE": "Created",
  "audit.action.UPDATE": "Updated",
  "audit.action.DELETE": "Deleted",
  "audit.action.ARCHIVE": "Archived",
  "audit.action.RESTORE": "Restored",
  "audit.action.LOGIN": "Signed in",
  "audit.action.LOGIN_FAILED": "Failed sign-in",
  "audit.action.LOGOUT": "Signed out",
  "audit.action.PASSWORD_CHANGE": "Changed password",
  "audit.action.EXPORT": "Exported",

  "audit.entity.User": "User",
  "audit.entity.Student": "Student",
  "audit.entity.Guardian": "Parent or guardian",
  "audit.entity.TeacherProfile": "Teacher",
  "audit.entity.Class": "Class",
  "audit.entity.Enrollment": "Enrollment",
  "audit.entity.AttendanceSession": "Attendance",
  "audit.entity.AttendanceRecord": "Attendance",
  "audit.entity.Assessment": "Assessment",
  "audit.entity.GradeRecord": "Grade",
  "audit.entity.AcademicYear": "Academic year",
  "audit.entity.Term": "Term",
  "audit.entity.GradeLevel": "Grade level",
  "audit.entity.Subject": "Subject",
  "audit.entity.School": "School",

  // --- Months, for bilingual date display ---
  "month.1": "January",
  "month.2": "February",
  "month.3": "March",
  "month.4": "April",
  "month.5": "May",
  "month.6": "June",
  "month.7": "July",
  "month.8": "August",
  "month.9": "September",
  "month.10": "October",
  "month.11": "November",
  "month.12": "December",

  // --- Weekdays ---
  "weekday.0": "Sunday",
  "weekday.1": "Monday",
  "weekday.2": "Tuesday",
  "weekday.3": "Wednesday",
  "weekday.4": "Thursday",
  "weekday.5": "Friday",
  "weekday.6": "Saturday",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
