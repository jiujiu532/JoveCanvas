import type { AppLocale } from "@/i18n/locale";

/** Stable client/API sentinel for "no category/tag filter". Display via labelAllPromptsOption. */
export const ALL_PROMPTS_OPTION = "__all__";

const LEGACY_ALL_OPTIONS = new Set(["全部", "all", "All", ALL_PROMPTS_OPTION]);

/** Scene slugs from Phase2 + common library categories. */
const CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
    portrait: { zh: "人像", en: "Portrait" },
    poster: { zh: "海报", en: "Poster" },
    product: { zh: "产品", en: "Product" },
    ui: { zh: "界面", en: "UI" },
    infographic: { zh: "信息图", en: "Infographic" },
    illustration: { zh: "插画", en: "Illustration" },
    photo: { zh: "摄影", en: "Photo" },
    "3d": { zh: "3D", en: "3D" },
    storyboard: { zh: "分镜", en: "Storyboard" },
    game: { zh: "游戏", en: "Game" },
    logo: { zh: "标志", en: "Logo" },
    other: { zh: "其他", en: "Other" },
    默认: { zh: "默认", en: "Default" },
    // original-author seed buckets (repo names used as category)
    "awesome-gpt-image": { zh: "GPT Image 精选", en: "Awesome GPT Image" },
    "awesome-gpt4o-image-prompts": { zh: "GPT-4o 图像", en: "Awesome GPT-4o Image" },
    "youmind-gpt-image-2": { zh: "YouMind GPT Image 2", en: "YouMind GPT Image 2" },
    "youmind-nano-banana-pro": { zh: "YouMind Nano Banana", en: "YouMind Nano Banana" },
    "davidwu-gpt-image2-prompts": { zh: "GPT Image2 合集", en: "GPT Image2 Collection" },
};

/** Source / pipeline tags: demote in chip lists; optional display rename. */
const SOURCE_TAG_LABELS: Record<string, { zh: string; en: string }> = {
    "youmind-skill": { zh: "来源·YouMind", en: "Source·YouMind" },
    gptimage2: { zh: "来源·GPT Image2", en: "Source·GPT Image2" },
    "gptimage2-json": { zh: "来源·GPT Image2 JSON", en: "Source·GPT Image2 JSON" },
    原创作者提示词库: { zh: "来源·原创库", en: "Source·Original" },
    "gpt-image-2": { zh: "来源·GPT Image 2", en: "Source·GPT Image 2" },
    "gpt-image": { zh: "来源·GPT Image", en: "Source·GPT Image" },
    gpt4o: { zh: "来源·GPT-4o", en: "Source·GPT-4o" },
    "nano-banana-pro": { zh: "来源·Nano Banana", en: "Source·Nano Banana" },
    freestylefly: { zh: "来源·Freestylefly", en: "Source·Freestylefly" },
    "open-design": { zh: "来源·Open Design", en: "Source·Open Design" },
    original: { zh: "来源·原创", en: "Source·Original" },
};

const SOURCE_TAG_KEYS = new Set(Object.keys(SOURCE_TAG_LABELS));

export function isAllPromptsOption(value?: string | null) {
    return !value || LEGACY_ALL_OPTIONS.has(value);
}

export function labelAllPromptsOption(locale: AppLocale | string) {
    return locale === "en" ? "All" : "全部";
}

export function labelPromptCategory(category: string, locale: AppLocale | string) {
    if (isAllPromptsOption(category)) return labelAllPromptsOption(locale);
    const entry = CATEGORY_LABELS[category] || CATEGORY_LABELS[category.toLowerCase()];
    if (!entry) return category;
    return locale === "en" ? entry.en : entry.zh;
}

export function labelPromptTag(tag: string, locale: AppLocale | string) {
    if (isAllPromptsOption(tag)) return labelAllPromptsOption(locale);
    const entry = SOURCE_TAG_LABELS[tag];
    if (entry) return locale === "en" ? entry.en : entry.zh;
    // Scene-like tags reuse category labels when they match.
    const asCategory = CATEGORY_LABELS[tag] || CATEGORY_LABELS[tag.toLowerCase()];
    if (asCategory) return locale === "en" ? asCategory.en : asCategory.zh;
    return tag;
}

export function isSourcePromptTag(tag: string) {
    return SOURCE_TAG_KEYS.has(tag);
}

/**
 * Build display labels for a facet list. When two different stable keys map to the
 * same short label under the current locale, both get ` · {rawKey}` so chips stay distinguishable.
 * Filtering still uses the original keys; freeform Chinese tags are never machine-translated.
 */
export function disambiguateFacetLabels(values: string[], locale: AppLocale | string, kind: "category" | "tag") {
    const labelOf = kind === "category" ? labelPromptCategory : labelPromptTag;
    const baseLabels = new Map<string, string>();
    for (const value of values) {
        baseLabels.set(value, labelOf(value, locale));
    }

    const labelToKeys = new Map<string, string[]>();
    for (const [value, label] of baseLabels) {
        if (isAllPromptsOption(value)) continue;
        const keys = labelToKeys.get(label);
        if (keys) keys.push(value);
        else labelToKeys.set(label, [value]);
    }

    const result = new Map<string, string>();
    for (const value of values) {
        const label = baseLabels.get(value) || value;
        if (isAllPromptsOption(value)) {
            result.set(value, label);
            continue;
        }
        const colliding = labelToKeys.get(label);
        result.set(value, colliding && colliding.length > 1 ? `${label} · ${value}` : label);
    }
    return result;
}

function hasCjk(value: string) {
    return /[一-鿿]/.test(value);
}

function hasLatin(value: string) {
    return /[A-Za-z]/.test(value);
}

/** Prefer locale-matching chips; demote source tags; keep "all" first. */
export function sortPromptFacetValues(values: string[], locale: AppLocale | string, kind: "category" | "tag") {
    const preferEn = locale === "en";
    const scored = values.map((value, index) => {
        if (isAllPromptsOption(value)) return { value, index, score: -1000 };
        let score = 0;
        if (kind === "tag" && isSourcePromptTag(value)) score += 100;
        const cjk = hasCjk(value);
        const latin = hasLatin(value);
        if (preferEn) {
            if (latin && !cjk) score -= 10;
            if (cjk && !latin) score += 10;
        } else {
            if (cjk) score -= 10;
            if (latin && !cjk) score += 5;
        }
        // Known categories slightly before free-form.
        if (kind === "category" && (CATEGORY_LABELS[value] || CATEGORY_LABELS[value.toLowerCase()])) score -= 3;
        return { value, index, score };
    });
    scored.sort((a, b) => a.score - b.score || a.index - b.index || a.value.localeCompare(b.value));
    return scored.map((item) => item.value);
}
