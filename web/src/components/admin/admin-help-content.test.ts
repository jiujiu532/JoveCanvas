import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import adminMessages from "../../../messages/zh/admin.json";
import enAdminMessages from "../../../messages/en/admin.json";
import { ADMIN_HELP_ARTICLE_IDS, buildAdminHelpArticles, findAdminHelpArticle, searchAdminHelpArticles, type AdminHelpTranslate } from "./admin-help-content";
import { buildAdminHelpGuidance } from "./admin-help-guidance";

function createHelpTranslator(locale: "zh" | "en") {
    const messages = locale === "en" ? enAdminMessages : adminMessages;
    return createTranslator({ locale, messages: { admin: messages }, namespace: "admin.help" }) as unknown as AdminHelpTranslate;
}

describe("admin help center content", () => {
    it("keeps a complete and unique administrator article set", () => {
        const t = createHelpTranslator("zh");
        const articles = buildAdminHelpArticles(t);
        const guidance = buildAdminHelpGuidance(t);

        expect(articles.map((article) => article.id)).toEqual([...ADMIN_HELP_ARTICLE_IDS]);
        expect(new Set(articles.map((article) => article.id)).size).toBe(articles.length);

        for (const article of articles) {
            const articleGuidance = guidance[article.id];
            expect(article.steps.length).toBeGreaterThanOrEqual(3);
            expect(articleGuidance.stepActions).toHaveLength(article.steps.length);
            expect(articleGuidance.stepActions.every((actions) => actions.length >= 2)).toBe(true);
            expect(articleGuidance.troubleshooting.length).toBeGreaterThanOrEqual(3);
            expect(article.checks.length).toBeGreaterThanOrEqual(3);
            expect(article.links.length).toBeGreaterThanOrEqual(2);
            for (const link of article.links) {
                if (link.href) expect(link.href).toMatch(/^\/admin(?:\/|\?|$)/);
                if (link.section) expect(link.section).not.toBe("adminHelp");
            }
        }
    });

    it("finds administrator-only instructions without using user help content", () => {
        const t = createHelpTranslator("zh");
        const articles = buildAdminHelpArticles(t);
        const guidance = buildAdminHelpGuidance(t);

        expect(findAdminHelpArticle(articles, "commerce")?.title).toContain("优惠券");
        expect(searchAdminHelpArticles("API Key", articles, guidance).map((article) => article.id)).toContain("models");
        expect(searchAdminHelpArticles("删除线", articles, guidance).map((article) => article.id)).toContain("commerce");
        expect(searchAdminHelpArticles("邀请 冷静期", articles, guidance).map((article) => article.id)).toContain("commerce");
        expect(searchAdminHelpArticles("媒体 引用", articles, guidance).map((article) => article.id)).toContain("storage");
        expect(searchAdminHelpArticles("页面没有变化", articles, guidance).map((article) => article.id)).toContain("maintenance");
        expect(searchAdminHelpArticles("三角形", articles, guidance).map((article) => article.id)).toContain("system");
        expect(searchAdminHelpArticles("不存在的后台配置", articles, guidance)).toEqual([]);
        expect(searchAdminHelpArticles("", articles, guidance)).toHaveLength(articles.length);
    });

    it("switches article titles when locale is English", () => {
        const tEn = createHelpTranslator("en");
        const articles = buildAdminHelpArticles(tEn);
        expect(findAdminHelpArticle(articles, "commerce")?.title.toLowerCase()).toMatch(/coupon|promotion|plan|order/);
        expect(findAdminHelpArticle(articles, "getting-started")?.category.toLowerCase()).toMatch(/start|getting/);
    });
});
