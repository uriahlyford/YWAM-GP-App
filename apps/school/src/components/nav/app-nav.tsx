"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { NavIcon } from "./icon";
import type { NavItem } from "./items";

/**
 * Two presentations of the same list. On a phone the three things a teacher
 * actually opens sit in a thumb-reachable bottom bar and everything else lives
 * behind More; on a wide screen it is an ordinary sidebar.
 */

function useIsActive() {
  const pathname = usePathname();
  // Strip `/en` or `/km`.
  const path = "/" + pathname.split("/").slice(2).join("/");
  return (href: string) => path === href || path.startsWith(`${href}/`);
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const t = useT();
  const isActive = useIsActive();

  return (
    <nav className="hidden w-60 shrink-0 border-r border-ink-200 bg-white p-3 lg:block">
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={`/${t.locale}${item.href}`}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium transition-colors",
                isActive(item.href)
                  ? "bg-brand-50 text-brand-800"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
              <span className="truncate">{t(item.label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const t = useT();
  const isActive = useIsActive();
  const [open, setOpen] = useState(false);

  const primary = items.filter((i) => i.primary);
  const rest = items.filter((i) => !i.primary);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t("nav.close")}
            className="absolute inset-0 bg-ink-900/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl">
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
              <span className="font-semibold text-ink-900">{t("nav.menu")}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("nav.close")}
                className="tap-target grid place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-1 p-3">
              {rest.map((item) => (
                <li key={item.href}>
                  <Link
                    href={`/${t.locale}${item.href}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-[0.9375rem] font-medium",
                      isActive(item.href)
                        ? "bg-brand-50 text-brand-800"
                        : "text-ink-700 hover:bg-ink-100",
                    )}
                  >
                    <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
                    <span className="truncate">{t(item.label)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="flex">
          {primary.map((item) => (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={`/${t.locale}${item.href}`}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-xs font-medium",
                  isActive(item.href) ? "text-brand-700" : "text-ink-500",
                )}
              >
                <NavIcon name={item.icon} className="h-6 w-6 shrink-0" />
                <span className="w-full truncate text-center">
                  {t(item.shortLabel ?? item.label)}
                </span>
              </Link>
            </li>
          ))}
          {rest.length > 0 ? (
            <li className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full flex-col items-center gap-1 px-1 py-2.5 text-xs font-medium text-ink-500"
              >
                <Menu className="h-6 w-6" strokeWidth={1.75} />
                <span>{t("nav.menu")}</span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>
    </>
  );
}
