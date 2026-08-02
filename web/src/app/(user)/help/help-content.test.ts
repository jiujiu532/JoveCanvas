import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import workspaceMessages from "../../../../messages/zh/workspace.json";
import enWorkspaceMessages from "../../../../messages/en/workspace.json";
import { HELP_ARTICLE_IDS, buildHelpArticles, findHelpArticle, searchHelpArticles, type HelpTranslate } from "./help-content";

function createHelpTranslator(locale: "zh" | "en") {
    const messages = locale === "en" ? enWorkspaceMessages : workspaceMessages;
    return createTranslator({ locale, messages: { workspace: messages }, namespace: "workspace.help" }) as unknown as HelpTranslate;
}

describe("help center content", () => {
    it("covers every user workspace with complete flows and tutorials", () => {
        const t = createHelpTranslator("zh");
        const articles = buildHelpArticles(t);
        expect(articles.map((article) => article.id)).toEqual([...HELP_ARTICLE_IDS]);
        for (const article of articles) {
            expect(article.flow.length).toBeGreaterThanOrEqual(4);
            expect(article.steps.length).toBeGreaterThanOrEqual(3);
            expect(article.faqs.length).toBeGreaterThanOrEqual(2);
            expect(article.outcomes).toHaveLength(3);
            if (article.route) expect(article.route.href).toMatch(/^\//);
        }
    });

    it("resolves deep links and searches detailed instructions", () => {
        const t = createHelpTranslator("zh");
        const articles = buildHelpArticles(t);
        expect(findHelpArticle(articles, "canvas")?.title).toContain("节点");
        expect(searchHelpArticles("全景", articles).map((article) => article.id)).toContain("canvas");
        expect(searchHelpArticles("订单", articles).map((article) => article.id)).toContain("account");
        expect(searchHelpArticles("不存在的功能关键词", articles)).toEqual([]);
    });

    it("switches article titles when locale is English", () => {
        const tEn = createHelpTranslator("en");
        const articles = buildHelpArticles(tEn);
        expect(findHelpArticle(articles, "start")?.title.toLowerCase()).toMatch(/start|idea|creat/);
        expect(findHelpArticle(articles, "canvas")?.label.toLowerCase()).toMatch(/canvas/);
    });
});
