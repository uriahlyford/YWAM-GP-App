import type { MessageKey } from "@/lib/i18n";
import type { Permission } from "@/lib/auth/context";

export type NavItem = {
  /** Path relative to the locale segment, e.g. `/students`. */
  href: string;
  label: MessageKey;
  permission: Permission;
  /** Shown in the phone's bottom bar rather than behind "More". */
  primary?: boolean;
  icon: IconName;
};

export type IconName =
  | "dashboard"
  | "students"
  | "attendance"
  | "grades"
  | "classes"
  | "teachers"
  | "parents"
  | "reports"
  | "notifications"
  | "settings"
  | "audit";

/**
 * The order here is the order a teacher's day runs in, not alphabetical:
 * attendance sits second because it is the thing opened every single morning.
 * Items the current user has no permission for are never rendered — an empty
 * page they can't use is worse than no link.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "nav.dashboard",
    permission: "school.read",
    primary: true,
    icon: "dashboard",
  },
  {
    href: "/attendance",
    label: "nav.attendance",
    permission: "attendance.read",
    primary: true,
    icon: "attendance",
  },
  {
    href: "/students",
    label: "nav.students",
    permission: "students.read",
    primary: true,
    icon: "students",
  },
  {
    href: "/grades",
    label: "nav.grades",
    permission: "grades.read",
    icon: "grades",
  },
  {
    href: "/classes",
    label: "nav.classes",
    permission: "classes.read",
    icon: "classes",
  },
  {
    href: "/teachers",
    label: "nav.teachers",
    permission: "teachers.read",
    icon: "teachers",
  },
  {
    href: "/parents",
    label: "nav.parents",
    permission: "guardians.read",
    icon: "parents",
  },
  {
    href: "/reports",
    label: "nav.reports",
    permission: "reports.read",
    icon: "reports",
  },
  {
    href: "/audit",
    label: "nav.audit",
    permission: "audit.read",
    icon: "audit",
  },
  {
    href: "/settings",
    label: "nav.settings",
    permission: "school.write",
    icon: "settings",
  },
];
