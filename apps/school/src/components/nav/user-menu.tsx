"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { signOut } from "@/features/auth/actions";
import type { Role } from "@/generated/prisma/enums";
import type { MessageKey } from "@/lib/i18n";

export function UserMenu({
  displayName,
  role,
}: {
  displayName: string;
  role: Role;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        // On a phone the name is hidden and only the initial shows, which would
        // leave this button announced as a single letter.
        aria-label={displayName}
        className="flex max-w-[10rem] items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-ink-100 sm:max-w-none"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
          {displayName.trim().charAt(0).toUpperCase()}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-medium text-ink-800">
            {displayName}
          </span>
          <span className="block truncate text-xs text-ink-500">
            {t(`role.${role}` as MessageKey)}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute end-0 z-50 mt-1 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg"
          >
            <div className="border-b border-ink-200 px-3 py-2 sm:hidden">
              <p className="truncate text-sm font-medium text-ink-800">
                {displayName}
              </p>
              <p className="text-xs text-ink-500">
                {t(`role.${role}` as MessageKey)}
              </p>
            </div>

            <Link
              href={`/${t.locale}/account/password`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink-700 hover:bg-ink-100"
            >
              <KeyRound className="h-4 w-4 text-ink-400" />
              {t("auth.mustChangePassword")}
            </Link>

            <form action={signOut.bind(null, t.locale)}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-ink-700 hover:bg-ink-100"
              >
                <LogOut className="h-4 w-4 text-ink-400" />
                {t("action.signOut")}
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
