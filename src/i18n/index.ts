import { en } from "./en";
import { ko } from "./ko";

export type Locale = "en" | "ko";
export const locales: Locale[] = ["en", "ko"];
export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, { short: string; long: string }> = {
  en: { short: "EN", long: "English" },
  ko: { short: "KO", long: "한국어" },
};

export const translations = { en, ko } as const;

export function t(lang: Locale) {
  return translations[lang] ?? translations.en;
}

/** "/tools/" → "/tools/" (en) or "/ko/tools/" (ko). */
export function localePath(path: string, lang: Locale): string {
  if (lang === defaultLocale) return path;
  return `/${lang}${path}`;
}

/** The current pathname with any locale prefix removed. */
export function unlocalizedPath(url: URL): string {
  const seg = url.pathname.split("/")[1];
  const hasPrefix = (locales as string[]).includes(seg) && seg !== defaultLocale;
  return hasPrefix ? url.pathname.slice(seg.length + 1) || "/" : url.pathname;
}

/** Same page in another locale. */
export function switchLocalePath(url: URL, targetLang: Locale): string {
  return localePath(unlocalizedPath(url), targetLang);
}

interface LocalizableEntry {
  data: {
    title: string;
    description: string;
    localizations?: Record<string, { title?: string; description?: string }>;
  };
}

/** Title and description of a tool/game entry in the given locale, falling back to English. */
export function localize(entry: LocalizableEntry, lang: Locale) {
  const l10n = entry.data.localizations?.[lang];
  return {
    title: l10n?.title ?? entry.data.title,
    description: l10n?.description ?? entry.data.description,
  };
}
