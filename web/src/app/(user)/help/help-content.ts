import zhWorkspace from "../../../../messages/zh/workspace.json";
import enWorkspace from "../../../../messages/en/workspace.json";

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

export type HelpArticleId = "start" | "agent" | "image" | "video" | "canvas" | "drama" | "assets" | "prompts" | "account" | "troubleshooting";

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

type HelpArticleMessage = {
    label: string;
    title: string;
    summary: string;
    routeLabel?: string;
    keywords: string[];
    outcomes: string[];
    flow: HelpFlowStep[];
    steps: HelpGuideStep[];
    faqs: HelpFaq[];
};

type AppLocale = "zh" | "en";

const HELP_ARTICLE_META: Array<{ id: HelpArticleId; href?: string }> = [
    { id: "start", href: "/create" },
    { id: "agent", href: "/create" },
    { id: "image", href: "/image" },
    { id: "video", href: "/video" },
    { id: "canvas", href: "/canvas" },
    { id: "drama", href: "/drama" },
    { id: "assets", href: "/assets" },
    { id: "prompts", href: "/prompts" },
    { id: "account", href: "/profile" },
    { id: "troubleshooting" },
];

function getArticleMessages(locale: AppLocale) {
    const source = locale === "en" ? enWorkspace : zhWorkspace;
    return (source as { help: { articles: Record<string, HelpArticleMessage> } }).help.articles;
}

function buildHelpArticle(id: HelpArticleId, locale: AppLocale): HelpArticle {
    const message = getArticleMessages(locale)[id];
    const meta = HELP_ARTICLE_META.find((item) => item.id === id)!;
    return {
        id,
        label: message.label,
        title: message.title,
        summary: message.summary,
        route: meta.href ? { href: meta.href, label: message.routeLabel || "" } : undefined,
        keywords: message.keywords,
        outcomes: message.outcomes,
        flow: message.flow,
        steps: message.steps.map((step) => ({
            title: step.title,
            description: step.description,
            checklist: step.checklist,
            ...(step.tip ? { tip: step.tip } : {}),
        })),
        faqs: message.faqs,
    };
}

export function getHelpArticles(locale: AppLocale = "zh"): HelpArticle[] {
    return HELP_ARTICLE_META.map((item) => buildHelpArticle(item.id, locale));
}

// Default Chinese catalog for tests and any non-locale callers.
export const helpArticles = getHelpArticles("zh");

export function findHelpArticle(id: string | null | undefined, locale: AppLocale = "zh") {
    return getHelpArticles(locale).find((article) => article.id === id);
}

export function searchHelpArticles(query: string, locale: AppLocale = "zh") {
    const articles = getHelpArticles(locale);
    const normalized = query.trim().toLocaleLowerCase(locale === "en" ? "en-US" : "zh-CN");
    if (!normalized) return articles;
    return articles.filter((article) => articleSearchText(article, locale).includes(normalized));
}

function articleSearchText(article: HelpArticle, locale: AppLocale) {
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
        .toLocaleLowerCase(locale === "en" ? "en-US" : "zh-CN");
}
