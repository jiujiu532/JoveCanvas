import { createTranslator } from "next-intl";

import workspaceMessages from "../../../../messages/zh/workspace.json";

export type HelpFlowStep = {
    title: string;
    detail: string;
};

export type HelpGuideStep = {
    title: string;
    description: string;
    checklist: string[];
    tip?: string;
};

export type HelpFaq = {
    question: string;
    answer: string;
};

export type HelpArticle = {
    id: HelpArticleId;
    label: string;
    title: string;
    summary: string;
    route?: { href: string; label: string };
    keywords: string[];
    outcomes: string[];
    flow: HelpFlowStep[];
    steps: HelpGuideStep[];
    faqs: HelpFaq[];
};

export const HELP_ARTICLE_IDS = ["start", "agent", "image", "video", "canvas", "drama", "assets", "prompts", "account", "troubleshooting"] as const;
export type HelpArticleId = (typeof HELP_ARTICLE_IDS)[number];

type HelpStepStructure = { checklistCount: number; hasTip: boolean };

type HelpArticleStructure = {
    id: HelpArticleId;
    routeHref: string | null;
    keywordCount: number;
    outcomeCount: number;
    flowCount: number;
    steps: HelpStepStructure[];
    faqCount: number;
};

/** next-intl 翻译函数的最小契约 */
export type HelpTranslate = {
    (key: string): string;
    raw: (key: string) => unknown;
};

export const HELP_ARTICLE_STRUCTURE: HelpArticleStructure[] = [
    { id: "start", routeHref: "/create", keywordCount: 6, outcomeCount: 3, flowCount: 4, steps: [{ checklistCount: 3, hasTip: true }, { checklistCount: 3, hasTip: false }, { checklistCount: 3, hasTip: false }, { checklistCount: 3, hasTip: false }], faqCount: 2 },
    { id: "agent", routeHref: "/create", keywordCount: 8, outcomeCount: 3, flowCount: 5, steps: [{ checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 3, hasTip: false }], faqCount: 2 },
    { id: "image", routeHref: "/image", keywordCount: 8, outcomeCount: 3, flowCount: 5, steps: [{ checklistCount: 3, hasTip: false }, { checklistCount: 3, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 3, hasTip: false }], faqCount: 2 },
    { id: "video", routeHref: "/video", keywordCount: 8, outcomeCount: 3, flowCount: 5, steps: [{ checklistCount: 3, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 3, hasTip: false }], faqCount: 2 },
    { id: "canvas", routeHref: "/canvas", keywordCount: 8, outcomeCount: 3, flowCount: 5, steps: [{ checklistCount: 4, hasTip: false }, { checklistCount: 3, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 3, hasTip: false }], faqCount: 2 },
    { id: "drama", routeHref: "/drama", keywordCount: 10, outcomeCount: 3, flowCount: 5, steps: [{ checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: true }, { checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }], faqCount: 2 },
    { id: "assets", routeHref: "/assets", keywordCount: 7, outcomeCount: 3, flowCount: 4, steps: [{ checklistCount: 4, hasTip: false }, { checklistCount: 3, hasTip: false }, { checklistCount: 3, hasTip: false }], faqCount: 2 },
    { id: "prompts", routeHref: "/prompts", keywordCount: 7, outcomeCount: 3, flowCount: 4, steps: [{ checklistCount: 3, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }], faqCount: 2 },
    { id: "account", routeHref: "/profile", keywordCount: 8, outcomeCount: 3, flowCount: 4, steps: [{ checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }], faqCount: 2 },
    { id: "troubleshooting", routeHref: null, keywordCount: 8, outcomeCount: 3, flowCount: 4, steps: [{ checklistCount: 4, hasTip: false }, { checklistCount: 3, hasTip: false }, { checklistCount: 4, hasTip: false }, { checklistCount: 4, hasTip: false }], faqCount: 2 },
];

function readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}

function readString(t: HelpTranslate, key: string): string {
    try {
        return t(key);
    } catch {
        return key;
    }
}

function buildStep(t: HelpTranslate, articleId: HelpArticleId, stepIndex: number, structure: HelpStepStructure): HelpGuideStep {
    const base = `articles.${articleId}.steps.${stepIndex}`;
    return {
        title: readString(t, `${base}.title`),
        description: readString(t, `${base}.description`),
        checklist: Array.from({ length: structure.checklistCount }, (_, index) => readString(t, `${base}.checklist.${index}`)),
        ...(structure.hasTip ? { tip: readString(t, `${base}.tip`) } : {}),
    };
}

/** 按当前语言字典组装用户帮助文章（结构固定，文案全部来自 workspace.help） */
export function buildHelpArticles(t: HelpTranslate): HelpArticle[] {
    return HELP_ARTICLE_STRUCTURE.map((structure) => {
        const id = structure.id;
        const root = `articles.${id}`;
        const routeLabel = structure.routeHref ? readString(t, `${root}.routeLabel`) : "";
        return {
            id,
            label: readString(t, `${root}.label`),
            title: readString(t, `${root}.title`),
            summary: readString(t, `${root}.summary`),
            ...(structure.routeHref ? { route: { href: structure.routeHref, label: routeLabel } } : {}),
            keywords: Array.from({ length: structure.keywordCount }, (_, index) => readString(t, `${root}.keywords.${index}`)),
            outcomes: Array.from({ length: structure.outcomeCount }, (_, index) => readString(t, `${root}.outcomes.${index}`)),
            flow: Array.from({ length: structure.flowCount }, (_, index) => ({
                title: readString(t, `${root}.flow.${index}.title`),
                detail: readString(t, `${root}.flow.${index}.detail`),
            })),
            steps: structure.steps.map((step, stepIndex) => buildStep(t, id, stepIndex, step)),
            faqs: Array.from({ length: structure.faqCount }, (_, index) => ({
                question: readString(t, `${root}.faqs.${index}.question`),
                answer: readString(t, `${root}.faqs.${index}.answer`),
            })),
        };
    });
}

export function findHelpArticle(articlesOrValue: HelpArticle[] | string | null | undefined, value?: string | null) {
    const articles = Array.isArray(articlesOrValue) ? articlesOrValue : helpArticles;
    const target = Array.isArray(articlesOrValue) ? value : articlesOrValue;
    return articles.find((article) => article.id === target);
}

export function searchHelpArticles(query: string, articles: HelpArticle[] = helpArticles) {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) return articles;
    return articles.filter((article) => articleSearchText(article).includes(normalized));
}

function articleSearchText(article: HelpArticle) {
    return [
        article.label,
        article.title,
        article.summary,
        ...article.keywords,
        ...article.outcomes,
        ...article.flow.flatMap((step) => [step.title, step.detail]),
        ...article.steps.flatMap((step) => [step.title, step.description, ...step.checklist, step.tip || ""]),
        ...article.faqs.flatMap((faq) => [faq.question, faq.answer]),
    ]
        .join(" ")
        .toLocaleLowerCase("zh-CN");
}

const defaultHelpTranslator = createTranslator({ locale: "zh", messages: workspaceMessages, namespace: "help" }) as unknown as HelpTranslate;
export const helpArticles = buildHelpArticles(defaultHelpTranslator);
