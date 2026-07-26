import type { SiteSettings } from "@/lib/auth/store-types";

// 品牌进阶字段的回落纯函数：留空即跟随站点标题，浏览器端与服务端均可直接 import
// 入参放宽为可选字段，便于客户端 PublicSiteSettings（字段可缺省）直接传入
type BrandSource<K extends keyof SiteSettings> = Pick<SiteSettings, "title"> & Partial<Pick<SiteSettings, K>>;

export function resolveBrandProductName(site: BrandSource<"brandProductName">) {
    return site.brandProductName || site.title;
}

export function resolveCanvasProjectPrefix(site: BrandSource<"canvasProjectPrefix">) {
    return site.canvasProjectPrefix || site.title;
}

export function resolveMailBrandName(site: BrandSource<"mailBrandName">) {
    return site.mailBrandName || site.title;
}

// 站点标题转文件名安全 slug：仅保留英数字，非英数字替换为 "-"；纯中文/无法转换时退化为固定英文前缀 "site"
export function siteFileSlug(title: string) {
    const ascii = title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return ascii || "site";
}
