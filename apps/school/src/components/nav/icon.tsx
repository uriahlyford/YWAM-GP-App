import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  History,
  LayoutGrid,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import type { IconName } from "./items";

const ICONS = {
  dashboard: LayoutGrid,
  students: Users,
  attendance: CalendarCheck,
  grades: ClipboardList,
  classes: BookOpen,
  teachers: GraduationCap,
  parents: UsersRound,
  reports: BarChart3,
  notifications: Bell,
  settings: Settings,
  audit: History,
} as const satisfies Record<IconName, unknown>;

export function NavIcon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}
