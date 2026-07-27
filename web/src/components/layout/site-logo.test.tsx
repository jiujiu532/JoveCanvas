import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND_ASSET_VERSION } from "@/lib/brand-assets";

import { SiteLogo } from "./site-logo";

describe("SiteLogo", () => {
    it("renders the configured backend logo without leaking the current page referrer", () => {
        const markup = renderToStaticMarkup(<SiteLogo logoUrl="https://cdn.example.com/brand.svg" className="size-8" />);

        expect(markup).toContain('src="https://cdn.example.com/brand.svg"');
        expect(markup).toContain('referrerPolicy="no-referrer"');
        expect(markup).toContain("object-contain");
        expect(markup).not.toContain("url(/logo.svg)");
        expect(markup).not.toContain("mask");
    });

    it("renders the bundled multicolor mark as a plain image instead of a monochrome mask", () => {
        const markup = renderToStaticMarkup(<SiteLogo logoUrl="/logo.svg" className="size-8" />);

        expect(markup).toContain(`src="/logo.svg?v=${BRAND_ASSET_VERSION}"`);
        expect(markup).toContain('referrerPolicy="no-referrer"');
        expect(markup).toContain("object-contain");
        expect(markup).not.toContain("url(/logo.svg)");
        expect(markup).not.toContain("mask");
        expect(markup).not.toContain('aria-hidden="true"');
    });

    it("falls back to the bundled mark when logoUrl is empty", () => {
        const markup = renderToStaticMarkup(<SiteLogo logoUrl="" className="size-8" />);

        expect(markup).toContain(`src="/logo.svg?v=${BRAND_ASSET_VERSION}"`);
        expect(markup).toContain("object-contain");
    });
});
