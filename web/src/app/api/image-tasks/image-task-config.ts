import { getAuthSettings } from "@/lib/auth/store";
import { generationModelId, toSystemGenerationChannel } from "@/lib/server/generation-channel";
import { resolveLogicalModelCandidates } from "@/lib/server/logical-model-router";
import { type ImageTask, type ImageTaskConfig } from "@/lib/server/image-task-store";
import { resolveImageTaskOptions } from "@/lib/server/image-task-config";

export function publicTask(task: ImageTask) {
    return {
        id: task.id,
        kind: task.kind,
        status: task.status,
        model: generationModelId(task.config),
    };
}

export function sanitizeConfigs(config: ImageTaskConfig | undefined, settings: Awaited<ReturnType<typeof getAuthSettings>>): ImageTaskConfig[] {
    const requestedModel = config?.model || settings.defaultModels.imageModel;
    return resolveLogicalModelCandidates(settings, "image", requestedModel).map((resolved) => {
        const channel = toSystemGenerationChannel(resolved);
        return {
            ...channel,
            channelId: resolved.channelId,
            ...resolveImageTaskOptions(config || {}, settings.generationDefaults),
            systemPrompt: "",
            advancedConfig: sanitizeAdvancedConfig(channel.advancedConfig),
        };
    });
}

export function sanitizeAdvancedConfig(config?: ImageTaskConfig["advancedConfig"]) {
    if (!config || typeof config !== "object") return undefined;
    return {
        protocol: config.protocol || "auto",
        globalAiOpcPreset: config.globalAiOpcPreset,
        globalAiOpcPresets: config.globalAiOpcPresets,
        textModel: textOrEmpty(config.textModel),
        imageModel: textOrEmpty(config.imageModel),
        videoModel: textOrEmpty(config.videoModel),
        createPath: textOrEmpty(config.createPath),
        editPath: textOrEmpty(config.editPath),
        queryPath: textOrEmpty(config.queryPath),
        requestTemplate: textOrEmpty(config.requestTemplate),
        resultField: textOrEmpty(config.resultField),
        statusField: textOrEmpty(config.statusField),
        durationRange: textOrEmpty(config.durationRange),
        referenceRule: textOrEmpty(config.referenceRule),
        supportsReferenceImage: Boolean(config.supportsReferenceImage),
        supportsReferenceVideo: Boolean(config.supportsReferenceVideo),
        supportsReferenceAudio: Boolean(config.supportsReferenceAudio),
    };
}

export function textOrEmpty(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export function withSystemPrompt(config: ImageTaskConfig, prompt: string) {
    const systemPrompt = (config.systemPrompt || "").trim();
    return systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
}

export function isRemoteMediaUrl(value: string) {
    return /^https?:\/\//i.test(value);
}
