export const SEEDANCE_SPECIAL_MODELS = [
    ["sd_2.0_special_720p", "标准版 720p"],
    ["sd_2.0_special_1080p", "标准版 1080p"],
    ["sd_2.0_special_2k", "标准版 2K"],
    ["sd_2.0_special_4k", "标准版 4K"],
    ["sd_2.0_special_720p_with_video_ref", "标准版 720p + 视频参考"],
    ["sd_2.0_special_1080p_with_video_ref", "标准版 1080p + 视频参考"],
    ["sd_2.0_special_2k_with_video_ref", "标准版 2K + 视频参考"],
    ["sd_2.0_special_4k_with_video_ref", "标准版 4K + 视频参考"],
    ["sd_2.0_fast_special_720p", "快速版 720p"],
    ["sd_2.0_fast_special_720p_with_video_ref", "快速版 720p + 视频参考"],
] as const;

export const SEEDANCE_SPECIAL_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"] as const;

type SeedanceSpecialReferences = {
    images?: string[];
    videos?: string[];
    audios?: string[];
};

type SeedanceReferenceKind = "images" | "videos" | "audios";

type LocalizableThrow = Error & {
    messageKey?: string;
    messageParams?: Record<string, string | number>;
};

/**
 * 抛出可被 route 层 localizeErrorMessage 识别的错误。
 * 默认 message 保持中文（兼容既有测试与未接线路径）；messageKey 供英文 cookie 路径转译。
 * 本模块可被客户端 import，禁止依赖 next-intl / server-messages。
 */
function fail(message: string, messageKey: string, messageParams?: Record<string, string | number>): never {
    const error = new Error(message) as LocalizableThrow;
    error.messageKey = messageKey;
    if (messageParams) error.messageParams = messageParams;
    throw error;
}

const REFERENCE_LIMIT_KEYS: Record<SeedanceReferenceKind, string> = {
    images: "tasks.seedance.refImagesLimit",
    videos: "tasks.seedance.refVideosLimit",
    audios: "tasks.seedance.refAudiosLimit",
};

const REFERENCE_URL_ONLY_KEYS: Record<SeedanceReferenceKind, string> = {
    images: "tasks.seedance.refImagesUrlOnly",
    videos: "tasks.seedance.refVideosUrlOnly",
    audios: "tasks.seedance.refAudiosUrlOnly",
};

const REFERENCE_LABELS_ZH: Record<SeedanceReferenceKind, string> = {
    images: "参考图片",
    videos: "参考视频",
    audios: "参考音频",
};

export function buildSeedanceSpecialRequest(input: { model: string; prompt: string; ratio: string; duration: number; generateAudio?: boolean; returnLastFrame?: boolean; seed?: number; references?: SeedanceSpecialReferences }) {
    const model = input.model.trim();
    if (!SEEDANCE_SPECIAL_MODELS.some(([id]) => id === model)) {
        fail("Seedance 2.0 特价版模型不在接口文档允许列表中", "tasks.seedance.modelNotAllowed");
    }

    const prompt = input.prompt.trim();
    assertSeedanceSpecialPrompt(prompt);
    const ratio = input.ratio.trim();
    if (!SEEDANCE_SPECIAL_RATIOS.includes(ratio as (typeof SEEDANCE_SPECIAL_RATIOS)[number])) {
        const ratioLabel = ratio || "空";
        fail(`Seedance 2.0 特价版不支持画幅 ${ratioLabel}`, "tasks.seedance.unsupportedRatio", { ratio: ratioLabel });
    }
    if (!Number.isInteger(input.duration) || input.duration < 4 || input.duration > 15) {
        fail("Seedance 2.0 特价版时长必须是 4-15 秒整数", "tasks.seedance.durationRange");
    }

    const images = uniqueReferences(input.references?.images, 9, "images");
    const videos = uniqueReferences(input.references?.videos, 3, "videos");
    const audios = uniqueReferences(input.references?.audios, 3, "audios");
    if (audios.length && !images.length && !videos.length) {
        fail("Seedance 参考音频不能单独使用，请同时添加参考图片或参考视频", "tasks.seedance.audioNeedsVisual");
    }
    const videoModel = model.endsWith("_with_video_ref");
    if (videoModel && !videos.length) {
        fail("当前 Seedance 模型要求至少一个参考视频", "tasks.seedance.videoRefRequired");
    }
    if (!videoModel && videos.length) {
        fail("使用参考视频时必须选择名称以 _with_video_ref 结尾的 Seedance 模型", "tasks.seedance.videoRefModelRequired");
    }

    return {
        model,
        ratio,
        duration: input.duration,
        generate_audio: input.generateAudio ?? true,
        return_last_frame: input.returnLastFrame ?? false,
        seed: Number.isInteger(input.seed) ? input.seed : -1,
        content: [
            { type: "text", text: prompt },
            ...images.map((url) => ({ type: "image_url", role: "reference_image", image_url: { url } })),
            ...videos.map((url) => ({ type: "video_url", role: "reference_video", video_url: { url } })),
            ...audios.map((url) => ({ type: "audio_url", role: "reference_audio", audio_url: { url } })),
        ],
    };
}

function assertSeedanceSpecialPrompt(prompt: string) {
    if (!prompt) fail("Seedance 2.0 特价版必须填写文本提示词", "tasks.seedance.promptRequired");
    if (/\p{Script=Han}/u.test(prompt)) {
        if (Array.from(prompt).length > 500) fail("Seedance 中文提示词不能超过 500 字", "tasks.seedance.zhPromptTooLong");
        return;
    }
    if (prompt.split(/\s+/).filter(Boolean).length > 1_000) {
        fail("Seedance 英文提示词不能超过 1000 词", "tasks.seedance.enPromptTooLong");
    }
}

function uniqueReferences(values: string[] | undefined, limit: number, kind: SeedanceReferenceKind) {
    const references = Array.from(new Set((values || []).map((value) => value.trim()).filter(Boolean)));
    const label = REFERENCE_LABELS_ZH[kind];
    if (references.length > limit) {
        fail(`${label}最多 ${limit} 个`, REFERENCE_LIMIT_KEYS[kind], { limit });
    }
    references.forEach((value) => {
        if (!isSeedanceSpecialMediaReference(value)) {
            fail(`${label}只能使用公网 URL 或 assetId:// 素材，不能使用 base64`, REFERENCE_URL_ONLY_KEYS[kind]);
        }
    });
    return references;
}

export function isSeedanceSpecialMediaReference(value: string) {
    if (/^assetId:\/\/[a-zA-Z0-9._:-]+$/i.test(value)) return true;
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}
