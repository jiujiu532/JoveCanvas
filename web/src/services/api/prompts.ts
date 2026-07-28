import { resolveClientStoreLocale } from "@/lib/client-store-locale";
import { ALL_PROMPTS_OPTION, isAllPromptsOption } from "@/lib/prompts/facet-labels";
import { compactApiParams, serializeApiParams } from "@/services/api/request";

export type Prompt = {
    id: string;
    scope?: "library" | "user";
    ownerUserId?: string;
    title: string;
    coverUrl: string;
    prompt: string;
    tags: string[];
    category: string;
    locale?: "zh" | "en" | "mixed";
    githubUrl?: string;
    preview: string;
    createdAt: string;
    updatedAt: string;
};

export { ALL_PROMPTS_OPTION, isAllPromptsOption };

export type PromptListResponse = {
    items: Prompt[];
    tags: string[];
    categories: string[];
    total: number;
};

export async function fetchPrompts({
    keyword = "",
    tag = [],
    category = ALL_PROMPTS_OPTION,
    page,
    pageSize,
    random = false,
    preferLocale,
}: {
    keyword?: string;
    tag?: string[];
    category?: string;
    page?: number;
    pageSize?: number;
    random?: boolean;
    preferLocale?: "zh" | "en";
} = {}) {
    const params = serializeApiParams(
        compactApiParams({
            ...(keyword ? { keyword } : {}),
            ...(tag.length ? { tag } : {}),
            ...(!isAllPromptsOption(category) ? { category } : {}),
            ...(random ? { random: "1" } : {}),
            ...(page ? { page } : {}),
            ...(pageSize ? { pageSize } : {}),
            // random 首页预览不强制语言序：不传 preferLocale
            ...(!random && preferLocale ? { preferLocale } : {}),
        }),
    );
    const response = await fetch(`/api/prompts${params.size ? `?${params}` : ""}`);
    if (!response.ok) throw new Error("获取提示词失败");
    return (await response.json()) as PromptListResponse;
}

export function formatPromptDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    // 跟当前 UI locale：en → en-US，其余默认 zh-CN（避免英文界面仍显示中文日期）
    const locale = resolveClientStoreLocale() === "en" ? "en-US" : "zh-CN";
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
