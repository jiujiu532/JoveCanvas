import { ALL_PROMPTS_OPTION } from "@/services/api/prompts";

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

/** Storage values stay Chinese (API/filter contract); labels are localized for UI. */
const PROMPT_CATEGORY_LABEL_KEYS: Record<string, string> = {
    [ALL_PROMPTS_OPTION]: "filterAll",
    广告创意: "categories.adCreative",
    角色设计: "categories.characterDesign",
    对比评测: "categories.comparison",
    电商商品: "categories.ecommerce",
    人像摄影: "categories.portrait",
    海报设计: "categories.poster",
    "UI 与社交媒体": "categories.uiSocial",
    UI与社交媒体: "categories.uiSocial",
};

export function promptCategoryLabel(value: string, t: Translate) {
    const key = PROMPT_CATEGORY_LABEL_KEYS[value];
    return key ? t(key) : value;
}

export function promptCategoryOptions(values: string[], t: Translate): Array<{ value: string; label: string }> {
    return values.map((value) => ({ value, label: promptCategoryLabel(value, t) }));
}
