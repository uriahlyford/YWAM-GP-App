"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const TABS: { href: string; label: MessageKey }[] = [
  { href: "", label: "settings.tab.school" },
  { href: "/years", label: "settings.tab.years" },
  { href: "/grade-levels", label: "settings.tab.gradeLevels" },
  { href: "/subjects", label: "settings.tab.subjects" },
];

export function SettingsTabs() {
  const t = useT();
  const pathname = usePathname();
  const base = `/${t.locale}/settings`;

  return (
    // Scrolls sideways rather than wrapping: four tabs don't fit a narrow phone,
    // and a wrapped second row reads as a separate control.
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 border-b border-ink-200 pb-px">
        {TABS.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = pathname === href;
          return (
            <li key={tab.href}>
              <Link
                href={href as Route}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-sm font-medium",
                  active
                    ? "border-b-2 border-brand-700 text-brand-800"
                    : "text-ink-500 hover:text-ink-800",
                )}
              >
                {t(tab.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
