import { NextResponse } from "next/server";

import { DEFAULT_BRAND_ICON_PATH, withBrandAssetVersion } from "@/lib/brand-assets";
import { browserIconHref, getPublicSiteSettings } from "@/lib/server/site-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const site = await getPublicSiteSettings();
    const raw = browserIconHref(site) || DEFAULT_BRAND_ICON_PATH;
    const target = safeIconHref(withBrandAssetVersion(raw), request.url) || withBrandAssetVersion(DEFAULT_BRAND_ICON_PATH);
    const response = new NextResponse(null, { status: 307, headers: { Location: target } });
    // Short cache: brand icons change during local iteration; long-lived caching hid updates in tabs.
    response.headers.set("Cache-Control", "public, max-age=0, s-maxage=60, must-revalidate");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
}

function safeIconHref(value: string, base: string) {
    try {
        const url = new URL(value, base);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        if (value.trim().startsWith("/")) return `${url.pathname}${url.search}${url.hash}`;
        return url.toString();
    } catch {
        return null;
    }
}
