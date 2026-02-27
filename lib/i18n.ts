import { ko, type LocaleKeys } from "@/locales/ko";
import { en } from "@/locales/en";

export type Locale = "ko" | "en";

const translations: Record<Locale, LocaleKeys> = { ko, en: en as unknown as LocaleKeys };

/** Current display locale. Change to "en" when rolling out English. */
export const defaultLocale: Locale = "ko";

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Get the full translations object for a locale (for use with t() or direct access).
 */
export function getTranslations(locale: Locale = defaultLocale): LocaleKeys {
  return translations[locale] ?? ko;
}

/**
 * Translate a key (dot-notation, e.g. "nav.profile"). Returns Korean by default.
 */
export function t(key: string, locale: Locale = defaultLocale): string {
  const obj = translations[locale] ?? ko;
  const value = getNested(obj as Record<string, unknown>, key);
  return value ?? key;
}

/**
 * Display label for event type. Value stays in English in code (e.g. "Lightning").
 */
export function eventTypeLabel(
  value: "Lightning" | "Regular" | "Special",
  locale: Locale = defaultLocale
): string {
  const labels = (translations[locale] ?? ko).eventType;
  return labels[value] ?? value;
}

/**
 * Display label for privacy. Value stays in English in code (e.g. "public").
 */
export function privacyLabel(
  value: "public" | "private" | "exclusive",
  locale: Locale = defaultLocale
): string {
  const labels = (translations[locale] ?? ko).privacy;
  return labels[value] ?? value;
}
