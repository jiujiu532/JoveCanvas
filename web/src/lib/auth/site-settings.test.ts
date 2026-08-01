import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "./store-foundation";
import { DEFAULT_SITE_FRIEND_LINKS } from "./store-types";
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

    it("defaults public contacts with empty email and seeds friend links when unset", () => {
        const settings = normalizeSiteSettings({});

        expect(settings.socials.email).toMatchObject({ enabled: true, url: "" });
        expect(settings.socials.telegram).toMatchObject({ enabled: false, url: "" });
        expect(settings.socials.x).toMatchObject({ enabled: false, url: "" });
        expect(settings.socials.instagram).toMatchObject({ enabled: false, url: "" });
        expect(settings.friendLinks).toEqual(DEFAULT_SITE_FRIEND_LINKS);
    });
});
