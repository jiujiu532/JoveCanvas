import type { AdminHelpArticleId, AdminHelpTranslate } from "./admin-help-content";

export type AdminHelpTroubleshooting = {
    symptom: string;
    cause: string;
    actions: string[];
    caution?: string;
};

export type AdminHelpGuidance = {
    stepActions: string[][];
    troubleshooting: AdminHelpTroubleshooting[];
};

/** 各文章 guidance 的数组长度结构（与字典索引对齐） */
const ADMIN_HELP_GUIDANCE_STRUCTURE: Record<
    AdminHelpArticleId,
    {
        stepActionCounts: number[];
        troubleshooting: Array<{ actionCount: number; hasCaution: boolean }>;
    }
> = {
    "getting-started": {
        stepActionCounts: [2, 2, 2, 2],
        troubleshooting: [
            { actionCount: 2, hasCaution: true },
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
        ],
    },
    operations: {
        stepActionCounts: [2, 2, 2, 2],
        troubleshooting: [
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: true },
            { actionCount: 2, hasCaution: false },
        ],
    },
    commerce: {
        stepActionCounts: [2, 2, 2, 2, 2],
        troubleshooting: [
            { actionCount: 2, hasCaution: true },
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: true },
        ],
    },
    finance: {
        stepActionCounts: [2, 2, 2, 2],
        troubleshooting: [
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
        ],
    },
    models: {
        stepActionCounts: [2, 2, 2, 2],
        troubleshooting: [
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
        ],
    },
    system: {
        stepActionCounts: [2, 2, 2, 2],
        troubleshooting: [
            { actionCount: 2, hasCaution: true },
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
        ],
    },
    storage: {
        stepActionCounts: [2, 2, 2, 2],
        troubleshooting: [
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: true },
        ],
    },
    content: {
        stepActionCounts: [2, 2, 2],
        troubleshooting: [
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
        ],
    },
    maintenance: {
        stepActionCounts: [2, 2, 2, 2],
        troubleshooting: [
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
            { actionCount: 2, hasCaution: false },
        ],
    },
};

function readString(t: AdminHelpTranslate, key: string): string {
    try {
        return t(key);
    } catch {
        return key;
    }
}

/** 从 admin.help 字典组装 stepActions / troubleshooting 文案 */
export function buildAdminHelpGuidance(t: AdminHelpTranslate): Record<AdminHelpArticleId, AdminHelpGuidance> {
    const result = {} as Record<AdminHelpArticleId, AdminHelpGuidance>;

    for (const [articleId, structure] of Object.entries(ADMIN_HELP_GUIDANCE_STRUCTURE) as Array<
        [AdminHelpArticleId, (typeof ADMIN_HELP_GUIDANCE_STRUCTURE)[AdminHelpArticleId]]
    >) {
        const root = `articles.${articleId}`;
        result[articleId] = {
            stepActions: structure.stepActionCounts.map((actionCount, stepIndex) =>
                Array.from({ length: actionCount }, (_, actionIndex) => readString(t, `${root}.stepActions.${stepIndex}.${actionIndex}`)),
            ),
            troubleshooting: structure.troubleshooting.map((item, itemIndex) => {
                const base = `${root}.troubleshooting.${itemIndex}`;
                return {
                    symptom: readString(t, `${base}.symptom`),
                    cause: readString(t, `${base}.cause`),
                    actions: Array.from({ length: item.actionCount }, (_, actionIndex) => readString(t, `${base}.actions.${actionIndex}`)),
                    ...(item.hasCaution ? { caution: readString(t, `${base}.caution`) } : {}),
                };
            }),
        };
    }

    return result;
}
