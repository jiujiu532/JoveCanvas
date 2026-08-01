import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/auth/store";

describe("default JoveCanvas brand assets", () => {
    it("uses the built-in JoveCanvas logo for every default brand entry", () => {
        expect(DEFAULT_SITE_SETTINGS.logoUrl).toBe("/logo.svg");
        expect(DEFAULT_SITE_SETTINGS.iconUrl).toBe("/icon.svg");
    });

    it("keeps web logo and docs logo identical with planet design", async () => {
        const [logo, icon, docsLogo] = await Promise.all([readFile(resolve(process.cwd(), "public/logo.svg"), "utf8"), readFile(resolve(process.cwd(), "public/icon.svg"), "utf8"), readFile(resolve(process.cwd(), "../docs/public/logo.svg"), "utf8")]);

        // Logo and docs logo must be identical
        expect(logo).toBe(docsLogo);
        // All must contain JoveCanvas brand elements (planet gradient)
        expect(logo).toContain("jc-planet");
        expect(icon).toContain("jc-planet");
        expect(logo).toContain("JoveCanvas");
        expect(icon).toContain("JoveCanvas");
        // No triangle primitives
        expect(logo).not.toMatch(/<(?:polygon|polyline)\b|triangle/i);
    });
});
