const MAX_READ_ANNOUNCEMENTS = 100;

export type AnnouncementTimeLabels = {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
};

/** 默认中文回落：测试与未注入 labels 的调用点仍得到中文相对时间 */
export const DEFAULT_ANNOUNCEMENT_TIME_LABELS: AnnouncementTimeLabels = {
    justNow: "刚刚",
    minutesAgo: "{count} 分钟前",
    hoursAgo: "{count} 小时前",
    daysAgo: "{count} 天前",
};

export function parseAnnouncementReadIds(raw: string | null) {
    if (!raw) return new Set<string>();
    try {
        const value = JSON.parse(raw);
        return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(-MAX_READ_ANNOUNCEMENTS) : []);
    } catch {
        return new Set<string>();
    }
}

export function mergeAnnouncementReadIds(current: ReadonlySet<string>, ids: Iterable<string>) {
    const merged = [...current];
    for (const id of ids) {
        if (!id || current.has(id) || merged.includes(id)) continue;
        merged.push(id);
    }
    return new Set(merged.slice(-MAX_READ_ANNOUNCEMENTS));
}

function fillCount(template: string, count: number) {
    return template.replace(/\{count\}/g, String(count));
}

export function formatAnnouncementTime(value: string, now = Date.now(), labels: AnnouncementTimeLabels = DEFAULT_ANNOUNCEMENT_TIME_LABELS, locale = "zh-CN") {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return labels.justNow;
    const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
    if (minutes < 1) return labels.justNow;
    if (minutes < 60) return fillCount(labels.minutesAgo, minutes);
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return fillCount(labels.hoursAgo, hours);
    const days = Math.floor(hours / 24);
    if (days < 7) return fillCount(labels.daysAgo, days);
    const dateLocale = locale === "en" || locale.startsWith("en") ? "en-US" : "zh-CN";
    return new Date(timestamp).toLocaleDateString(dateLocale, { month: "2-digit", day: "2-digit" });
}
