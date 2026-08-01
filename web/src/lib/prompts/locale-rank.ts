export type PromptLocale = "zh" | "en" | "mixed";
export type PreferLocale = "zh" | "en";

export function isPromptLocale(value: string | undefined | null): value is PromptLocale {
    return value === "zh" || value === "en" || value === "mixed";
}

export function isPreferLocale(value: string | undefined | null): value is PreferLocale {
    return value === "zh" || value === "en";
}

/** query.preferLocale > cookie NEXT_LOCALE > zh */
export function resolvePreferLocale(queryValue: string | null | undefined, cookieValue: string | null | undefined): PreferLocale {
    if (isPreferLocale(queryValue)) return queryValue;
    if (isPreferLocale(cookieValue)) return cookieValue;
    return "zh";
}

/** Lower rank = higher list priority for preferLocale. */
export function localeRank(locale: string | undefined | null, prefer: PreferLocale): number {
    if (locale === prefer) return 0;
    if (locale === "mixed") return 1;
    if (!locale) return 2;
    return 3;
}

export function comparePromptsByPreferLocale(a: { locale?: string | null; updatedAt: string }, b: { locale?: string | null; updatedAt: string }, prefer: PreferLocale): number {
    const byLocale = localeRank(a.locale, prefer) - localeRank(b.locale, prefer);
    if (byLocale !== 0) return byLocale;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

/** Heuristic from title+prompt body (Phase1 seed backfill). */
export function guessPromptLocale(title: string, prompt: string): PromptLocale {
    const text = `${title || ""}\n${prompt || ""}`;
    if (!text.trim()) return "mixed";
    const cjk = (text.match(/[一-鿿]/g) || []).length;
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    const ratio = cjk / Math.max(1, text.length);
    if (ratio >= 0.08) return "zh";
    if (ratio <= 0.005 && latin > 0) return "en";
    return "mixed";
}

export function normalizePromptLocale(value: unknown): PromptLocale | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim().toLowerCase();
    return isPromptLocale(trimmed) ? trimmed : undefined;
}
