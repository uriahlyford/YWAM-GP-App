"use client";

import { createContext, useContext, useMemo } from "react";
import {
  createTranslator,
  DEFAULT_LOCALE,
  type Locale,
  type Translator,
} from ".";

/**
 * The catalogues are imported into the client bundle rather than passed down as
 * props. Both languages together gzip to a few kilobytes, and this way the
 * dictionary is cached by the browser once instead of riding along in the RSC
 * payload on every navigation — which matters on a phone on mobile data.
 */
const I18nContext = createContext<Translator>(createTranslator(DEFAULT_LOCALE));

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = useMemo(() => createTranslator(locale), [locale]);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

/** The translator for the current reader. Also carries `.locale`. */
export function useT(): Translator {
  return useContext(I18nContext);
}
