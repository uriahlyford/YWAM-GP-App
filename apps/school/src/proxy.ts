import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, isLocale } from "@/lib/i18n";

/**
 * Locale routing only. Authorization is deliberately *not* done here — every
 * page and every mutation checks the session against the database on the server.
 * A proxy check would be a second, weaker copy of that rule, and the pattern of
 * trusting it has produced a long line of auth bypasses in Next.js applications.
 *
 * Named `proxy` rather than `middleware`: Next.js 16 renamed the convention.
 */
function preferredLocale(request: NextRequest) {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  const header = request.headers.get("accept-language") ?? "";
  // `km` anywhere in the header means this reader has asked for Khmer.
  for (const entry of header.split(",")) {
    const tag = entry.split(";")[0]?.trim().toLowerCase() ?? "";
    if (tag === "km" || tag.startsWith("km-")) return "km";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const locale = preferredLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except Next internals and files with an extension
    // (manifest.webmanifest, icons, the service worker).
    "/((?!_next|api|.*\\.).*)",
  ],
};
