import { en } from "./en";
import { ko } from "./ko";

export type Locale = "en" | "ko";
export const locales: Locale[] = ["en", "ko"];
export const defaultLocale: Locale = "en";

export const translations = { en, ko } as const;

export function t(lang: Locale) {
  return translations[lang] ?? translations.en;
}

/** Derive locale from the request URL pathname. */
export function getLang(url: URL): Locale {
  const seg = url.pathname.split("/")[1];
  return (locales as string[]).includes(seg) ? (seg as Locale) : defaultLocale;
}

/** Build an absolute path for a given locale.
 *  English (default) has no prefix: /tools/
 *  Other locales:                  /ko/tools/
 */
export function localePath(path: string, lang: Locale): string {
  if (lang === defaultLocale) return path;
  return `/${lang}${path}`;
}

/** Given the current URL, return the same page in the target locale. */
export function switchLocalePath(url: URL, targetLang: Locale): string {
  const seg = url.pathname.split("/")[1];
  const isLocalePrefix = (locales as string[]).includes(seg) && seg !== defaultLocale;
  // Strip any existing locale prefix
  const withoutLang = isLocalePrefix
    ? url.pathname.slice(seg.length + 1) || "/"
    : url.pathname;
  return localePath(withoutLang, targetLang);
}

/** Get localized title/description from content entry data. */
export function getLocalizedField(
  data: Record<string, unknown>,
  field: string,
  lang: Locale
): string {
  const key = `${field}_${lang}`;
  return (data[key] as string | undefined) ?? (data[field] as string);
}
