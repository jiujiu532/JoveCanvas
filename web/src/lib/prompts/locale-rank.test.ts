import { describe, expect, it } from "vitest";

import { comparePromptsByPreferLocale, guessPromptLocale, localeRank, normalizePromptLocale, resolvePreferLocale } from "./locale-rank";

describe("resolvePreferLocale", () => {
    it("prefers query over cookie over default zh", () => {
        expect(resolvePreferLocale("en", "zh")).toBe("en");
        expect(resolvePreferLocale(null, "en")).toBe("en");
        expect(resolvePreferLocale("fr", "en")).toBe("en");
        expect(resolvePreferLocale(undefined, undefined)).toBe("zh");
        expect(resolvePreferLocale("", "")).toBe("zh");
    });
});

describe("localeRank", () => {
    it("ranks prefer first then mixed then empty then other", () => {
        expect(localeRank("zh", "zh")).toBe(0);
        expect(localeRank("mixed", "zh")).toBe(1);
        expect(localeRank(undefined, "zh")).toBe(2);
        expect(localeRank("", "zh")).toBe(2);
        expect(localeRank("en", "zh")).toBe(3);
    });
});

describe("comparePromptsByPreferLocale", () => {
    it("sorts by locale rank then updatedAt desc", () => {
        const items = [
            { locale: "en", updatedAt: "2026-01-02T00:00:00.000Z" },
            { locale: "zh", updatedAt: "2026-01-01T00:00:00.000Z" },
            { locale: "mixed", updatedAt: "2026-01-03T00:00:00.000Z" },
            { locale: undefined, updatedAt: "2026-01-04T00:00:00.000Z" },
            { locale: "zh", updatedAt: "2026-01-05T00:00:00.000Z" },
        ];
        const sorted = [...items].sort((a, b) => comparePromptsByPreferLocale(a, b, "zh"));
        expect(sorted.map((item) => item.locale)).toEqual(["zh", "zh", "mixed", undefined, "en"]);
        expect(sorted[0].updatedAt).toBe("2026-01-05T00:00:00.000Z");
    });

    it("prefers en when preferLocale is en without filtering others", () => {
        const items = [
            { locale: "zh", updatedAt: "2026-01-05T00:00:00.000Z" },
            { locale: "en", updatedAt: "2026-01-01T00:00:00.000Z" },
            { locale: "mixed", updatedAt: "2026-01-04T00:00:00.000Z" },
        ];
        const sorted = [...items].sort((a, b) => comparePromptsByPreferLocale(a, b, "en"));
        expect(sorted.map((item) => item.locale)).toEqual(["en", "mixed", "zh"]);
        expect(sorted).toHaveLength(items.length);
    });
});

describe("guessPromptLocale", () => {
    it("detects zh en mixed", () => {
        expect(guessPromptLocale("人像摄影", "使用自然光拍摄东亚女性肖像，柔和阴影。")).toBe("zh");
        expect(guessPromptLocale("Portrait", "A cinematic portrait of a woman in soft window light, 85mm lens.")).toBe("en");
        expect(guessPromptLocale("UI 界面", "Create a modern dashboard UI with sidebar navigation and cards.")).toBe("mixed");
    });
});

describe("normalizePromptLocale", () => {
    it("accepts only zh en mixed", () => {
        expect(normalizePromptLocale("zh")).toBe("zh");
        expect(normalizePromptLocale("EN")).toBe("en");
        expect(normalizePromptLocale("fr")).toBeUndefined();
        expect(normalizePromptLocale(1)).toBeUndefined();
    });
});
