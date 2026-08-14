import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Inter, Noto_Sans_Khmer } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { isLocale } from "@/lib/i18n";
import "../globals.css";

/**
 * Fonts are downloaded at build time and served from this application's own
 * origin. The previous app in this repository loaded Khmer from Google's CDN;
 * that request is exactly the one that hangs on provincial mobile data, and when
 * it fails Khmer falls back to a face that may not shape subscript consonants
 * correctly.
 */
const latin = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

const khmer = Noto_Sans_Khmer({
  subsets: ["khmer"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-khmer-family",
  display: "swap",
  // Khmer is the primary reading language for most of this school's staff, so
  // it is preloaded rather than fetched on demand.
  preload: true,
});

export const metadata: Metadata = {
  title: { default: "Sala", template: "%s · Sala" },
  description: "School management for Cambodian primary schools",
  // Student data must never be indexed, and this application should never be
  // reachable through a search engine.
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Sala" },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  // Zoom stays available: pinching a class list is a reasonable thing to do.
  maximumScale: 5,
};

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} className={`${latin.variable} ${khmer.variable}`}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
