import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "./store-foundation";
import { normalizeSiteSettings } from "./store-normalizers";

describe("site settings", () => {
    it("uses the bundled browser icon when older settings have no icon URL", () => {
        expect(normalizeSiteSettings({ logoUrl: "/custom-logo.svg" }).iconUrl).toBe(DEFAULT_SITE_SETTINGS.iconUrl);
    });

    it("accepts a configured browser icon independently from the logo", () => {
        const settings = normalizeSiteSettings({ logoUrl: "/brand.svg", iconUrl: "https://cdn.example.com/favicon.ico" });

        expect(settings.logoUrl).toBe("/brand.svg");
        expect(settings.iconUrl).toBe("https://cdn.example.com/favicon.ico");
    });

    it("defaults public contacts to the VOZEB email and QQ group", () => {
        const settings = normalizeSiteSettings({});

        expect(settings.socials.email).toMatchObject({ enabled: true, url: "mailto:csyqlz@gmail.com" });
        expect(settings.socials.telegram).toMatchObject({ enabled: false, url: "" });
        expect(settings.socials.x).toMatchObject({ enabled: false, url: "" });
        expect(settings.socials.instagram).toMatchObject({ enabled: false, url: "" });
        expect(settings.friendLinks).toContainEqual(expect.objectContaining({ id: "qq-vozeb-open-source", url: "https://qm.qq.com/q/9MVLTxuRd6", enabled: true }));
    });
});

describe("brand advanced fields", () => {
    it("normalizes optional brand text fields to an empty string without baking in the site title", () => {
        const settings = normalizeSiteSettings({ title: "自定义站点" });

        expect(settings.brandProductName).toBe("");
        expect(settings.canvasProjectPrefix).toBe("");
        expect(settings.mailBrandName).toBe("");
    });

    it("keeps an explicitly configured brand text value independent from the site title", () => {
        const settings = normalizeSiteSettings({ title: "自定义站点", brandProductName: "MY PASS", canvasProjectPrefix: "示例画布", mailBrandName: "示例邮件品牌" });

        expect(settings.brandProductName).toBe("MY PASS");
        expect(settings.canvasProjectPrefix).toBe("示例画布");
        expect(settings.mailBrandName).toBe("示例邮件品牌");
    });

    it("truncates brand text fields at 40 characters", () => {
        const settings = normalizeSiteSettings({ brandProductName: "x".repeat(60) });

        expect(settings.brandProductName).toHaveLength(40);
    });

    it("falls back the repository and version-check URLs to defaults when the field is unset", () => {
        const settings = normalizeSiteSettings({});

        expect(settings.repositoryUrl).toBe(DEFAULT_SITE_SETTINGS.repositoryUrl);
        expect(settings.versionCheckUrl).toBe(DEFAULT_SITE_SETTINGS.versionCheckUrl);
    });

    it("keeps an explicitly cleared repository/version-check URL empty instead of falling back", () => {
        const settings = normalizeSiteSettings({ repositoryUrl: "", versionCheckUrl: "" });

        expect(settings.repositoryUrl).toBe("");
        expect(settings.versionCheckUrl).toBe("");
    });

    it("rejects an illegal protocol for repositoryUrl/versionCheckUrl and falls back to the default", () => {
        const settings = normalizeSiteSettings({ repositoryUrl: "/not-a-real-repo", versionCheckUrl: "javascript:alert(1)" });

        expect(settings.repositoryUrl).toBe(DEFAULT_SITE_SETTINGS.repositoryUrl);
        expect(settings.versionCheckUrl).toBe(DEFAULT_SITE_SETTINGS.versionCheckUrl);
    });

    it("accepts a custom repository/version-check URL and truncates at 2000 characters", () => {
        const settings = normalizeSiteSettings({ repositoryUrl: "https://github.com/example/fork", versionCheckUrl: "https://raw.githubusercontent.com/example/fork/main" });

        expect(settings.repositoryUrl).toBe("https://github.com/example/fork");
        expect(settings.versionCheckUrl).toBe("https://raw.githubusercontent.com/example/fork/main");
    });
});
