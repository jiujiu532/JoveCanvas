import { ALL_PROMPTS_OPTION } from "@/services/api/prompts";

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * Storage values stay as returned by API (Chinese taxonomy, English imports, free-form tags).
 * Only known taxonomy strings get localized UI labels; unknown values pass through.
 */
const PROMPT_TAXONOMY_LABEL_KEYS: Record<string, string> = {
    [ALL_PROMPTS_OPTION]: "filterAll",
    // Chinese seed categories
    广告创意: "categories.adCreative",
    角色设计: "categories.characterDesign",
    对比评测: "categories.comparison",
    电商商品: "categories.ecommerce",
    人像摄影: "categories.portrait",
    海报设计: "categories.poster",
    "UI 与社交媒体": "categories.uiSocial",
    UI与社交媒体: "categories.uiSocial",
    // Case/spacing variants that appear as tags
    "ui 与社交媒体": "categories.uiSocial",
    // English import categories / overlapping tags
    product: "categories.product",
    poster: "categories.poster",
    portrait: "categories.portrait",
    ui: "categories.uiSocial",
    infographic: "categories.infographic",
    other: "categories.other",
    others: "categories.other",
    storyboard: "categories.storyboard",
    game: "categories.game",
    illustration: "categories.illustration",
    "3d": "categories.threeD",
    photo: "categories.photo",
    logo: "categories.logo",
};

export function promptCategoryLabel(value: string, t: Translate) {
    const key = PROMPT_TAXONOMY_LABEL_KEYS[value] || PROMPT_TAXONOMY_LABEL_KEYS[value.trim().toLowerCase()];
    return key ? t(key) : value;
}

export function promptCategoryOptions(values: string[], t: Translate): Array<{ value: string; label: string }> {
    return values.map((value) => ({ value, label: promptCategoryLabel(value, t) }));
}

/** Tags reuse the same taxonomy map when a tag is actually a known category name. */
export function promptTagLabel(value: string, t: Translate) {
    return promptCategoryLabel(value, t);
}

export function promptTagOptions(values: string[], t: Translate): Array<{ value: string; label: string }> {
    return values.map((value) => ({ value, label: promptTagLabel(value, t) }));
}
