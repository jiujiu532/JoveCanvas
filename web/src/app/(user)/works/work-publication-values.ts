import type { WorkPublicationModerationStatus, WorkPublicationSourceType, WorkPublicationVisibility } from "@/services/api/work-publications";

export { WORK_CATEGORY_OPTIONS, WORK_CATEGORIES } from "@/lib/work-publication-options";

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

const STATUS_LABEL_KEYS: Record<WorkPublicationModerationStatus | "all", string> = {
    all: "statusAll",
    draft: "statusDraft",
    pending: "statusPending",
    approved: "statusApproved",
    rejected: "statusRejected",
    taken_down: "statusTakenDown",
};

const SOURCE_LABEL_KEYS: Record<WorkPublicationSourceType, string> = {
    media: "sourceMedia",
    canvas: "sourceCanvas",
    drama: "sourceDrama",
};

const VISIBILITY_LABEL_KEYS: Record<WorkPublicationVisibility, string> = {
    private: "visibilityPrivate",
    unlisted: "visibilityUnlisted",
    public: "visibilityPublic",
};

/** Category storage values stay Chinese (API/filter contract); labels are localized for UI. */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
    视觉设计: "categoryVisual",
    插画: "categoryIllustration",
    摄影: "categoryPhotography",
    品牌内容: "categoryBrand",
    视频: "categoryVideo",
    短剧: "categoryDrama",
    其他: "categoryOther",
};

export function workStatusOptions(t: Translate): Array<{ value: WorkPublicationModerationStatus | "all"; label: string }> {
    return (Object.keys(STATUS_LABEL_KEYS) as Array<WorkPublicationModerationStatus | "all">).map((value) => ({
        value,
        label: t(STATUS_LABEL_KEYS[value]),
    }));
}

export function sourceTypeLabels(t: Translate): Record<WorkPublicationSourceType, string> {
    return {
        media: t(SOURCE_LABEL_KEYS.media),
        canvas: t(SOURCE_LABEL_KEYS.canvas),
        drama: t(SOURCE_LABEL_KEYS.drama),
    };
}

export function visibilityLabels(t: Translate): Record<WorkPublicationVisibility, string> {
    return {
        private: t(VISIBILITY_LABEL_KEYS.private),
        unlisted: t(VISIBILITY_LABEL_KEYS.unlisted),
        public: t(VISIBILITY_LABEL_KEYS.public),
    };
}

export function workCategoryOptions(t: Translate): Array<{ value: string; label: string }> {
    return Object.entries(CATEGORY_LABEL_KEYS).map(([value, key]) => ({ value, label: t(key) }));
}

export function workStatusLabel(status: WorkPublicationModerationStatus, t: Translate) {
    return t(STATUS_LABEL_KEYS[status] || "statusDraft");
}

export function formatWorkTime(value: string | undefined, locale: string, t: Translate) {
    if (!value) return t("noTime");
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function workSharePath(slug: string) {
    return `/share/${encodeURIComponent(slug)}`;
}
