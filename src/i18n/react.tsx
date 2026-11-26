import { createContext, useContext, type ReactNode } from "react";
import { defaultLocale, type Locale } from "./index";

const LangContext = createContext<Locale>(defaultLocale);

export function LangProvider({ lang, children }: { lang: Locale; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Locale {
  return useContext(LangContext);
}

/**
 * Per-component strings. Declare `const messages = { en: {...}, ko: {...} }`
 * next to the component; `ko` must have the same shape as `en`.
 */
export function useMessages<T>(messages: { en: T; ko: T }): T {
  return messages[useLang()];
}
