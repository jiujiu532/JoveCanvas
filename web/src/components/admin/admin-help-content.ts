import { createTranslator } from "next-intl";

import type { AdminSectionKey } from "@/components/admin/admin-sections";
import adminMessages from "../../../messages/zh/admin.json";

import { buildAdminHelpGuidance, type AdminHelpGuidance } from "./admin-help-guidance";

export const ADMIN_HELP_ARTICLE_IDS = ["getting-started", "operations", "commerce", "finance", "models", "system", "storage", "content", "maintenance"] as const;

export type AdminHelpArticleId = (typeof ADMIN_HELP_ARTICLE_IDS)[number];

export type AdminHelpStep = {
    title: string;
    description: string;
    checks?: string[];
};

export type AdminHelpLink = { label: string; description: string; section: AdminSectionKey; href?: never } | { label: string; description: string; href: string; section?: never };

export type AdminHelpArticle = {
    id: AdminHelpArticleId;
    category: string;
    title: string;
    summary: string;
    keywords: string[];
    purpose: string;
    steps: AdminHelpStep[];
    checks: string[];
    warnings?: string[];
    links: AdminHelpLink[];
};

/** 仅结构：链接目标（section / href），文案由字典填充 */
export type AdminHelpLinkTarget = { section: AdminSectionKey; href?: never } | { href: string; section?: never };

type AdminHelpArticleStructure = {
    id: AdminHelpArticleId;
    stepCount: number;
    stepCheckCounts: number[];
    checkCount: number;
    warningCount: number;
    links: AdminHelpLinkTarget[];
};

/** next-intl 翻译函数的最小契约（useTranslations / createTranslator 均满足） */
export type AdminHelpTranslate = {
    (key: string): string;
    raw: (key: string) => unknown;
};

export const ADMIN_HELP_ARTICLE_STRUCTURE: AdminHelpArticleStructure[] = [
    {
        id: "getting-started",
        stepCount: 4,
        stepCheckCounts: [3, 3, 3, 3],
        checkCount: 3,
        warningCount: 2,
        links: [{ href: "/admin/setup" }, { section: "site" }, { section: "channels" }, { section: "products" }, { section: "payments" }, { section: "backup" }],
    },
    {
        id: "operations",
        stepCount: 4,
        stepCheckCounts: [3, 3, 3, 3],
        checkCount: 3,
        warningCount: 2,
        links: [{ section: "overview" }, { section: "users" }, { section: "logs" }, { section: "generationOperations" }],
    },
    {
        id: "commerce",
        stepCount: 5,
        stepCheckCounts: [3, 3, 3, 3, 3],
        checkCount: 4,
        warningCount: 3,
        links: [{ section: "products" }, { section: "promotions" }, { section: "coupons" }, { section: "referrals" }, { section: "orders" }],
    },
    {
        id: "finance",
        stepCount: 4,
        stepCheckCounts: [3, 3, 3, 3],
        checkCount: 3,
        warningCount: 2,
        links: [{ section: "points" }, { section: "payments" }, { section: "cdk" }, { section: "wallet" }],
    },
    {
        id: "models",
        stepCount: 4,
        stepCheckCounts: [5, 3, 3, 3],
        checkCount: 3,
        warningCount: 3,
        links: [{ section: "channels" }, { section: "skills" }, { section: "points" }, { section: "logs" }],
    },
    {
        id: "system",
        stepCount: 4,
        stepCheckCounts: [3, 3, 3, 3],
        checkCount: 3,
        warningCount: 2,
        links: [{ section: "site" }, { section: "settings" }, { section: "accountDeletion" }, { section: "updates" }],
    },
    {
        id: "storage",
        stepCount: 4,
        stepCheckCounts: [3, 3, 3, 3],
        checkCount: 3,
        warningCount: 2,
        links: [{ section: "mediaStorage" }, { section: "externalStorage" }, { section: "backup" }],
    },
    {
        id: "content",
        stepCount: 3,
        stepCheckCounts: [3, 3, 3],
        checkCount: 3,
        warningCount: 2,
        links: [{ section: "announcements" }, { section: "prompts" }],
    },
    {
        id: "maintenance",
        stepCount: 4,
        stepCheckCounts: [3, 3, 3, 3],
        checkCount: 3,
        warningCount: 2,
        links: [{ section: "overview" }, { section: "generationOperations" }, { section: "logs" }, { section: "wallet" }, { section: "backup" }],
    },
];

function readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}

function readString(t: AdminHelpTranslate, key: string): string {
    try {
        return t(key);
    } catch {
        return key;
    }
}

function buildStep(t: AdminHelpTranslate, articleId: AdminHelpArticleId, stepIndex: number, checkCount: number): AdminHelpStep {
    const base = `articles.${articleId}.steps.${stepIndex}`;
    const checks = checkCount > 0 ? Array.from({ length: checkCount }, (_, checkIndex) => readString(t, `${base}.checks.${checkIndex}`)) : undefined;
    return {
        title: readString(t, `${base}.title`),
        description: readString(t, `${base}.description`),
        ...(checks?.length ? { checks } : {}),
    };
}

function buildLink(t: AdminHelpTranslate, articleId: AdminHelpArticleId, linkIndex: number, target: AdminHelpLinkTarget): AdminHelpLink {
    const base = `articles.${articleId}.links.${linkIndex}`;
    const label = readString(t, `${base}.label`);
    const description = readString(t, `${base}.description`);
    if ("href" in target) {
        return { label, description, href: target.href ?? "/admin" };
    }
    return { label, description, section: target.section };
}

/** 按当前语言字典组装管理员帮助文章（结构固定，文案全部来自 admin.help） */
export function buildAdminHelpArticles(t: AdminHelpTranslate): AdminHelpArticle[] {
    return ADMIN_HELP_ARTICLE_STRUCTURE.map((structure) => {
        const id = structure.id;
        const root = `articles.${id}`;
        const keywords = readStringArray(t.raw(`${root}.keywords`));
        const checks = Array.from({ length: structure.checkCount }, (_, index) => readString(t, `${root}.checks.${index}`));
        const warnings =
            structure.warningCount > 0
                ? Array.from({ length: structure.warningCount }, (_, index) => readString(t, `${root}.warnings.${index}`))
                : undefined;

        return {
            id,
            category: readString(t, `${root}.category`),
            title: readString(t, `${root}.title`),
            summary: readString(t, `${root}.summary`),
            keywords,
            purpose: readString(t, `${root}.purpose`),
            steps: structure.stepCheckCounts.map((checkCount, stepIndex) => buildStep(t, id, stepIndex, checkCount)),
            checks,
            ...(warnings?.length ? { warnings } : {}),
            links: structure.links.map((target, linkIndex) => buildLink(t, id, linkIndex, target)),
        };
    });
}

export function findAdminHelpArticle(articlesOrValue: AdminHelpArticle[] | string | null | undefined, value?: string | null) {
    const articles = Array.isArray(articlesOrValue) ? articlesOrValue : adminHelpArticles;
    const target = Array.isArray(articlesOrValue) ? value : articlesOrValue;
    return articles.find((article) => article.id === target);
}

export function searchAdminHelpArticles(query: string, articles: AdminHelpArticle[] = adminHelpArticles, guidance: Record<AdminHelpArticleId, AdminHelpGuidance> = adminHelpGuidance) {
    const terms = normalizeSearchText(query).split(" ").filter(Boolean);
    if (!terms.length) return articles;

    return articles.filter((article) => {
        const articleGuidance = guidance[article.id];
        const haystack = normalizeSearchText(
            [
                article.category,
                article.title,
                article.summary,
                article.purpose,
                ...article.keywords,
                ...article.steps.flatMap((step) => [step.title, step.description, ...(step.checks || [])]),
                ...articleGuidance.stepActions.flat(),
                ...articleGuidance.troubleshooting.flatMap((item) => [item.symptom, item.cause, ...item.actions, item.caution || ""]),
                ...article.checks,
                ...(article.warnings || []),
                ...article.links.flatMap((link) => [link.label, link.description]),
            ].join(" "),
        );
        return terms.every((term) => haystack.includes(term));
    });
}

const defaultHelpTranslator = createTranslator({ locale: "zh", messages: adminMessages, namespace: "help" }) as unknown as AdminHelpTranslate;
export const adminHelpArticles = buildAdminHelpArticles(defaultHelpTranslator);
export const adminHelpGuidance = buildAdminHelpGuidance(defaultHelpTranslator);
function normalizeSearchText(value: string) {
    return value.trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
}
