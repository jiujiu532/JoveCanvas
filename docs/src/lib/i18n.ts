import { defineI18n } from "fumadocs-core/i18n";

/**
 * Docs site i18n (Fumadocs built-in).
 * - zh is default and unprefixed (`hideLocale: default-locale`)
 * - en is served under `/en/...`
 * Independent from web `NEXT_LOCALE` cookie.
 */
export const i18n = defineI18n({
  defaultLanguage: "zh",
  languages: ["zh", "en"],
  hideLocale: "default-locale",
  parser: "dot",
  fallbackLanguage: "zh",
});

export type AppLocale = (typeof i18n.languages)[number];

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "zh" || value === "en";
}

export function normalizeLocale(value: string | undefined | null): AppLocale {
  return isAppLocale(value) ? value : i18n.defaultLanguage;
}

/** Prefix a site-absolute path for the given locale (zh stays unprefixed). */
export function localePath(locale: string | undefined | null, path = "/"): string {
  const lang = normalizeLocale(locale);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (lang === i18n.defaultLanguage) return normalized === "" ? "/" : normalized;
  if (normalized === "/") return `/${lang}`;
  return `/${lang}${normalized}`;
}
