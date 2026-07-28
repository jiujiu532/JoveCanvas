/** Bump when bundled brand SVGs change so img/favicon caches refresh. */
export const BRAND_ASSET_VERSION = "20260728b";

export const DEFAULT_BRAND_LOGO_PATH = "/logo.svg";
export const DEFAULT_BRAND_ICON_PATH = "/icon.svg";

export function withBrandAssetVersion(url: string) {
    const value = (url || "").trim();
    if (!value) return `${DEFAULT_BRAND_LOGO_PATH}?v=${BRAND_ASSET_VERSION}`;
    // Only version first-party static brand files; leave CDN/custom URLs alone.
    if (value === DEFAULT_BRAND_LOGO_PATH || value.startsWith(`${DEFAULT_BRAND_LOGO_PATH}?`)) {
        return `${DEFAULT_BRAND_LOGO_PATH}?v=${BRAND_ASSET_VERSION}`;
    }
    if (value === DEFAULT_BRAND_ICON_PATH || value.startsWith(`${DEFAULT_BRAND_ICON_PATH}?`)) {
        return `${DEFAULT_BRAND_ICON_PATH}?v=${BRAND_ASSET_VERSION}`;
    }
    if (value === "/favicon.ico" || value.startsWith("/favicon.ico?")) {
        return `/favicon.ico?v=${BRAND_ASSET_VERSION}`;
    }
    return value;
}
