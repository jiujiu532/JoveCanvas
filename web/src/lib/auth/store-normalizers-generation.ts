import { randomUUID } from "node:crypto";

import { deriveLogicalModelsConfig, normalizeLogicalModelsConfig } from "@/lib/model-routing-config";

import { normalizeSystemChannelAdvancedConfig, normalizeSystemChannelHealthResults } from "./store-normalizers-channel";
import { allowedText, normalizeSecretText, normalizeText, repairKnownMojibakeText } from "./store-normalizers-shared";
import { DEFAULT_SETTINGS } from "./store-foundation";
import type { GenerationConcurrencySettings, GenerationDefaultSettings, LogicalModel, SystemModelChannel } from "./store-types";

export function normalizeLogicalModels(models: LogicalModel[] | undefined, channels: SystemModelChannel[]): LogicalModel[] {
    return normalizeLogicalModelsConfig(models, channels);
}

export function deriveLogicalModels(channels: SystemModelChannel[]): LogicalModel[] {
    return deriveLogicalModelsConfig(channels);
}

export function normalizeGenerationDefaults(settings: Partial<GenerationDefaultSettings> | undefined): GenerationDefaultSettings {
    return {
        canvasImageCount: Math.max(1, Math.min(10, Math.floor(Number(settings?.canvasImageCount) || DEFAULT_SETTINGS.generationDefaults.canvasImageCount))),
        imageSize: allowedText(settings?.imageSize, ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"], DEFAULT_SETTINGS.generationDefaults.imageSize),
        imageQuality: allowedText(settings?.imageQuality, ["auto", "low", "medium", "high"], DEFAULT_SETTINGS.generationDefaults.imageQuality),
        imageCount: Math.max(1, Math.min(10, Math.floor(Number(settings?.imageCount) || DEFAULT_SETTINGS.generationDefaults.imageCount))),
        videoQuality: allowedText(settings?.videoQuality, ["480", "720", "1080"], DEFAULT_SETTINGS.generationDefaults.videoQuality),
        videoSeconds: Math.max(1, Math.min(20, Math.floor(Number(settings?.videoSeconds) || DEFAULT_SETTINGS.generationDefaults.videoSeconds))),
        audioVoice: normalizeText(settings?.audioVoice, DEFAULT_SETTINGS.generationDefaults.audioVoice, 80),
        audioFormat: allowedText(settings?.audioFormat, ["mp3", "wav", "opus", "aac", "flac"], DEFAULT_SETTINGS.generationDefaults.audioFormat),
        workbenchSmartPlanning: {
            image: settings?.workbenchSmartPlanning?.image !== false,
            video: settings?.workbenchSmartPlanning?.video !== false,
        },
    };
}

export function normalizeGenerationConcurrency(settings: Partial<GenerationConcurrencySettings> | undefined): GenerationConcurrencySettings {
    return {
        agent: Math.max(1, Math.min(10, Math.floor(Number(settings?.agent) || DEFAULT_SETTINGS.generationConcurrency.agent))),
        image: Math.max(1, Math.min(10, Math.floor(Number(settings?.image) || DEFAULT_SETTINGS.generationConcurrency.image))),
        video: Math.max(1, Math.min(5, Math.floor(Number(settings?.video) || DEFAULT_SETTINGS.generationConcurrency.video))),
        audio: Math.max(1, Math.min(10, Math.floor(Number(settings?.audio) || DEFAULT_SETTINGS.generationConcurrency.audio))),
        text: Math.max(1, Math.min(20, Math.floor(Number(settings?.text) || DEFAULT_SETTINGS.generationConcurrency.text))),
        render: Math.max(1, Math.min(5, Math.floor(Number(settings?.render) || DEFAULT_SETTINGS.generationConcurrency.render))),
    };
}

export function normalizeSystemChannel(channel: Partial<SystemModelChannel>): SystemModelChannel {
    const healthResults = normalizeSystemChannelHealthResults(channel.healthResults);
    return {
        id: channel.id?.trim() || randomUUID(),
        name: repairKnownMojibakeText(channel.name?.trim() || "") || "通用接口",
        baseUrl: channel.baseUrl?.trim() || "",
        apiKey: normalizeSecretText(channel.apiKey, "", 4000),
        apiFormat: channel.apiFormat === "gemini" ? "gemini" : "openai",
        models: Array.from(new Set((channel.models || []).map((model) => model.trim()).filter(Boolean))),
        enabled: channel.enabled !== false,
        advancedConfig: normalizeSystemChannelAdvancedConfig(channel.advancedConfig),
        ...(Object.keys(healthResults).length ? { healthResults } : {}),
    };
}
