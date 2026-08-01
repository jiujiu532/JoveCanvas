import { randomUUID } from "node:crypto";

import { isPostgresDatabaseEnabled } from "@/lib/server/database";

import { AuthInputError } from "./store-foundation";
import { isAnnouncementVisible, normalizeAnnouncement, normalizeSettings } from "./store-normalizers";
import { mutateAuthDb, readAuthDb, readPostgresAnnouncementsPage, readPostgresAuthSettings } from "./store-repository";
import { type AnnouncementPage, type AnnouncementPageInput, type AuthSettings, type PublicAnnouncement, type SystemChannelHealthSnapshot } from "./store-types";

const AUTH_SETTINGS_CACHE_TTL_MS = 1000;
let postgresAuthSettingsCache: { value: AuthSettings; expiresAt: number } | null = null;
let postgresAuthSettingsRequest: Promise<AuthSettings> | null = null;
let postgresAuthSettingsVersion = 0;

export async function getAuthSettings() {
    if (isPostgresDatabaseEnabled()) {
        const now = Date.now();
        if (postgresAuthSettingsCache && postgresAuthSettingsCache.expiresAt > now) return postgresAuthSettingsCache.value;
        if (postgresAuthSettingsRequest) return postgresAuthSettingsRequest;
        const requestVersion = postgresAuthSettingsVersion;
        const request = readPostgresAuthSettings().then((settings) => {
            if (requestVersion === postgresAuthSettingsVersion) postgresAuthSettingsCache = { value: settings, expiresAt: Date.now() + AUTH_SETTINGS_CACHE_TTL_MS };
            return settings;
        });
        postgresAuthSettingsRequest = request;
        void request.then(
            () => {
                if (postgresAuthSettingsRequest === request) postgresAuthSettingsRequest = null;
            },
            () => {
                if (postgresAuthSettingsRequest === request) postgresAuthSettingsRequest = null;
            },
        );
        return request;
    }
    return (await readAuthDb()).settings;
}

export async function setAuthSettings(patch: Partial<AuthSettings>) {
    const settings = await mutateAuthDb((db) => {
        db.settings = normalizeSettings({ ...db.settings, ...patch });
        return db.settings;
    });
    if (isPostgresDatabaseEnabled()) {
        postgresAuthSettingsVersion += 1;
        postgresAuthSettingsCache = { value: settings, expiresAt: Date.now() + AUTH_SETTINGS_CACHE_TTL_MS };
    }
    return settings;
}

export async function setSystemChannelHealthResult(channelId: string, result: SystemChannelHealthSnapshot) {
    const settings = await mutateAuthDb((db) => {
        db.settings = normalizeSettings({
            ...db.settings,
            systemChannels: db.settings.systemChannels.map((channel) =>
                channel.id === channelId
                    ? {
                          ...channel,
                          healthResults: { ...(channel.healthResults || {}), [result.kind]: result },
                      }
                    : channel,
            ),
        });
        return db.settings;
    });
    if (isPostgresDatabaseEnabled()) {
        postgresAuthSettingsVersion += 1;
        postgresAuthSettingsCache = { value: settings, expiresAt: Date.now() + AUTH_SETTINGS_CACHE_TTL_MS };
    }
    return settings;
}

export async function listAnnouncements(includeDisabled = false) {
    return (await listAnnouncementsPage(includeDisabled, { page: 1, pageSize: 100 })).items;
}

export async function listAnnouncementsPage(includeDisabled = false, input: AnnouncementPageInput = {}): Promise<AnnouncementPage> {
    const requestedPage = Number(input.page);
    const requestedPageSize = Number(input.pageSize);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0 ? Math.min(100, requestedPageSize) : 20;
    if (isPostgresDatabaseEnabled()) return readPostgresAnnouncementsPage({ includeDisabled, page, pageSize });

    const announcements = (await readAuthDb()).announcements.filter((announcement) => includeDisabled || isAnnouncementVisible(announcement)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
    return {
        items: announcements.slice((page - 1) * pageSize, page * pageSize),
        total: announcements.length,
        page,
        pageSize,
    };
}

export async function createAnnouncement(input: Partial<PublicAnnouncement>) {
    return mutateAuthDb((db) => {
        const now = new Date().toISOString();
        const announcement = normalizeAnnouncement({
            id: randomUUID(),
            title: input.title || "",
            content: input.content || "",
            enabled: input.enabled !== false,
            popupHome: input.popupHome === true,
            popupAfterLogin: input.popupAfterLogin === true,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            createdAt: now,
            updatedAt: now,
        });
        if (!announcement.title || !announcement.content) throw new AuthInputError("请填写公告标题和内容");
        db.announcements.push(announcement);
        return announcement;
    });
}

export async function updateAnnouncement(id: string, patch: Partial<PublicAnnouncement>) {
    return mutateAuthDb((db) => {
        const index = db.announcements.findIndex((announcement) => announcement.id === id);
        if (index < 0) throw new AuthInputError("公告不存在");
        const next = normalizeAnnouncement({
            ...db.announcements[index],
            ...patch,
            id,
            updatedAt: new Date().toISOString(),
        });
        if (!next.title || !next.content) throw new AuthInputError("请填写公告标题和内容");
        db.announcements[index] = next;
        return next;
    });
}

export async function deleteAnnouncement(id: string) {
    return mutateAuthDb((db) => {
        const before = db.announcements.length;
        db.announcements = db.announcements.filter((announcement) => announcement.id !== id);
        if (before === db.announcements.length) throw new AuthInputError("公告不存在");
        return { ok: true };
    });
}
