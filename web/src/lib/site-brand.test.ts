import { describe, expect, it } from "vitest";

import { resolveBrandProductName, resolveCanvasProjectPrefix, resolveMailBrandName } from "./site-brand";

describe("site brand fallbacks", () => {
    it("falls back to the site title when the field is empty", () => {
        const site = { title: "自定义站点", brandProductName: "", canvasProjectPrefix: "", mailBrandName: "" };

        expect(resolveBrandProductName(site)).toBe("自定义站点");
        expect(resolveCanvasProjectPrefix(site)).toBe("自定义站点");
        expect(resolveMailBrandName(site)).toBe("自定义站点");
    });

    it("prefers the explicitly configured value over the site title", () => {
        const site = { title: "自定义站点", brandProductName: "MY PASS", canvasProjectPrefix: "示例画布", mailBrandName: "示例邮件品牌" };

        expect(resolveBrandProductName(site)).toBe("MY PASS");
        expect(resolveCanvasProjectPrefix(site)).toBe("示例画布");
        expect(resolveMailBrandName(site)).toBe("示例邮件品牌");
    });
});
