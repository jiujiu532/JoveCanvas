import { randomUUID } from "node:crypto";

import { DEFAULT_MAIL_SETTINGS, DEFAULT_SITE_SETTINGS } from "./store-foundation";
import { normalizeLinkUrl, normalizeLogoUrl, normalizeSiteIconUrl, normalizeSecretText, normalizeText, normalizeOptionalIsoDate } from "./store-normalizers-shared";
import { DEFAULT_SITE_FRIEND_LINKS, DEFAULT_SITE_SOCIALS, type MailSettings, type PublicAnnouncement, type SiteFriendLink, type SiteSettings, type SiteShowcaseItem, type SiteSocialKey, type SiteSocialSettings } from "./store-types";

export function normalizeSiteSettings(settings: Partial<SiteSettings> | undefined): SiteSettings {
    const title = normalizeText(settings?.title, DEFAULT_SITE_SETTINGS.title, 40);
    const seoTitle = normalizeText(settings?.seoTitle, title, 72);
    return {
        title,
        logoUrl: normalizeLogoUrl(settings?.logoUrl),
        iconUrl: normalizeSiteIconUrl(settings?.iconUrl),
        seoTitle,
        seoDescription: normalizeText(settings?.seoDescription, DEFAULT_SITE_SETTINGS.seoDescription, 180),
        seoKeywords: normalizeText(settings?.seoKeywords, DEFAULT_SITE_SETTINGS.seoKeywords, 240),
        footerCopyright: normalizeText(settings?.footerCopyright, DEFAULT_SITE_SETTINGS.footerCopyright, 120),
        termsUrl: normalizeLinkUrl(settings?.termsUrl, DEFAULT_SITE_SETTINGS.termsUrl),
        privacyUrl: normalizeLinkUrl(settings?.privacyUrl, DEFAULT_SITE_SETTINGS.privacyUrl),
        homeShowcaseMode: settings?.homeShowcaseMode === "custom" ? "custom" : "random",
        homeShowcaseItems: normalizeSiteShowcaseItems(settings?.homeShowcaseItems),
        friendLinks: normalizeSiteFriendLinks(settings?.friendLinks),
        socials: normalizeSiteSocials(settings?.socials),
    };
}

export function normalizeSiteShowcaseItems(settings: unknown): SiteShowcaseItem[] {
    if (!Array.isArray(settings)) return [];
    return settings
        .map((item, index) => {
            const value = item as Partial<SiteShowcaseItem>;
            const title = normalizeText(value.title, "", 80);
            const prompt = normalizeText(value.prompt, "", 3000);
            if (!title || !prompt) return null;
            return {
                id: normalizeText(value.id, `showcase-${index + 1}`, 80),
                title,
                coverUrl: normalizeLinkUrl(value.coverUrl, ""),
                prompt,
                tags: normalizeShowcaseTags(value.tags),
                category: normalizeText(value.category, "精选展示", 40),
            };
        })
        .filter((item): item is SiteShowcaseItem => Boolean(item))
        .slice(0, 8);
}

export function normalizeShowcaseTags(value: unknown): string[] {
    const raw = Array.isArray(value) ? value : String(value || "").split(/[,，\n]/);
    return Array.from(new Set(raw.map((tag) => String(tag || "").trim()).filter(Boolean))).slice(0, 4);
}

export function normalizeSiteFriendLinks(settings: unknown): SiteFriendLink[] {
    const links = Array.isArray(settings) ? settings : DEFAULT_SITE_FRIEND_LINKS;
    const normalized = links
        .map((link, index) => {
            const value = link as Partial<SiteFriendLink>;
            return {
                id: normalizeText(value.id, `friend-${index + 1}`, 80),
                label: normalizeText(value.url?.replace(/\/$/, "") === "https://www.vozeb.com" ? "JoveCanvas" : value.label, "友情链接", 32),
                url: normalizeLinkUrl(value.url, ""),
                enabled: value.enabled !== false,
            };
        })
        .filter((link) => link.url)
        .slice(0, 12);
    for (const link of DEFAULT_SITE_FRIEND_LINKS) {
        if (normalized.some((item) => item.id === link.id || item.url.replace(/\/$/, "") === link.url.replace(/\/$/, ""))) continue;
        normalized.push(link);
    }
    const defaultOrdered = DEFAULT_SITE_FRIEND_LINKS.flatMap((link) => {
        const normalizedUrl = link.url.replace(/\/$/, "");
        const matched = normalized.find((item) => item.id === link.id || item.url.replace(/\/$/, "") === normalizedUrl);
        return matched ? [matched] : [];
    });
    const defaultKeys = new Set(DEFAULT_SITE_FRIEND_LINKS.flatMap((link) => [link.id, link.url.replace(/\/$/, "")]));
    const others = normalized.filter((link) => !defaultKeys.has(link.id) && !defaultKeys.has(link.url.replace(/\/$/, "")));
    return [...defaultOrdered, ...others].slice(0, 12);
}

export function normalizeSiteSocials(settings: Partial<SiteSocialSettings> | undefined): SiteSocialSettings {
    return {
        email: normalizeSiteSocial("email", settings?.email),
        telegram: normalizeSiteSocial("telegram", settings?.telegram),
        x: normalizeSiteSocial("x", settings?.x),
        instagram: normalizeSiteSocial("instagram", settings?.instagram),
    };
}

export function normalizeSiteSocial(key: SiteSocialKey, setting: Partial<SiteSocialSettings[SiteSocialKey]> | undefined) {
    const fallback = DEFAULT_SITE_SOCIALS[key];
    return {
        enabled: typeof setting?.enabled === "boolean" ? setting.enabled : fallback.enabled,
        label: normalizeText(setting?.label, fallback.label, 32),
        url: normalizeLinkUrl(setting?.url, fallback.url),
    };
}

export function normalizeMailSettings(settings: Partial<MailSettings> | undefined): MailSettings {
    const port = Math.max(1, Math.min(65535, Math.floor(Number(settings?.port) || DEFAULT_MAIL_SETTINGS.port)));
    return {
        provider: normalizeText(settings?.provider, DEFAULT_MAIL_SETTINGS.provider, 40),
        host: normalizeText(settings?.host, DEFAULT_MAIL_SETTINGS.host, 120),
        port,
        secure: settings?.secure !== false,
        username: normalizeText(settings?.username, DEFAULT_MAIL_SETTINGS.username, 160),
        password: normalizeSecretText(settings?.password, DEFAULT_MAIL_SETTINGS.password, 512),
        fromEmail: normalizeText(settings?.fromEmail, DEFAULT_MAIL_SETTINGS.fromEmail, 160),
        fromName: normalizeText(settings?.fromName, DEFAULT_MAIL_SETTINGS.fromName, 60),
    };
}

export function normalizeAnnouncement(value: Partial<PublicAnnouncement>): PublicAnnouncement {
    const now = new Date().toISOString();
    const startsAt = normalizeOptionalIsoDate(value.startsAt);
    const endsAt = normalizeOptionalIsoDate(value.endsAt);
    return {
        id: value.id || randomUUID(),
        title: normalizeText(value.title, "", 80),
        content: normalizeText(value.content, "", 3000),
        enabled: value.enabled !== false,
        popupHome: value.popupHome === true,
        popupAfterLogin: value.popupAfterLogin === true,
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        createdAt: value.createdAt || now,
        updatedAt: value.updatedAt || value.createdAt || now,
    };
}

export function isAnnouncementVisible(announcement: PublicAnnouncement) {
    if (!announcement.enabled) return false;
    const now = Date.now();
    if (announcement.startsAt && Date.parse(announcement.startsAt) > now) return false;
    if (announcement.endsAt && Date.parse(announcement.endsAt) <= now) return false;
    return true;
}
