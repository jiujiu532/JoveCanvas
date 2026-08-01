import { isQingyanProvider } from "@/lib/provider-compatibility";
import { resolveChannelModelConfig } from "@/lib/channel-protocol-registry";
import { type ImageTask, type ImageTaskConfig } from "@/lib/server/image-task-store";
import { configuredImageEditReferenceMode } from "./image-task-edit";
import { globalAiOpcImagePreset, resolveConfiguredApiBaseUrl, shouldUseSub2ApiImageEdit } from "./image-task-preset";

export async function openAiImageTaskPath(config: ImageTaskConfig, kind: ImageTask["kind"]) {
    const configured = (config.advancedConfig?.createPath || "").trim();
    const configuredPath = configured ? normalizeImageTaskPath(configured) : "";
    if (kind !== "edit") return configuredPath || "/images/generations";
    const configuredEditPath = (config.advancedConfig?.editPath || "").trim();
    if (configuredEditPath) return normalizeImageTaskPath(configuredEditPath);
    const apiBase = await resolveConfiguredApiBaseUrl(config.baseUrl).catch(() => config.baseUrl);
    if (shouldUseSub2ApiImageEdit(config, apiBase)) return configuredPath || "/images/generations";

    const ruleEditPath = configuredImageEditPath(config);
    if (ruleEditPath) return ruleEditPath;
    if (!configuredPath) return isQingyanProvider({ baseUrl: apiBase, model: config.model, protocol: config.advancedConfig?.protocol }) ? "/images/generations" : "/images/edits";

    const referenceMode = configuredImageEditReferenceMode(config);
    if (referenceMode === "json" || referenceMode === "public-url" || globalAiOpcImagePreset(config) || isQingyanProvider({ baseUrl: apiBase, model: config.model, protocol: config.advancedConfig?.protocol })) return configuredPath;
    if (isStandardOpenAiImageGenerationPath(configuredPath)) return configuredPath.replace(/\/generations$/i, "/edits");
    return configuredPath;
}

export function configuredImageEditPath(config: ImageTaskConfig) {
    const rule = (config.advancedConfig?.referenceRule || "").trim();
    const match = rule.match(/\/(?:[a-z0-9._-]+\/)*images\/edits\b/i);
    return match?.[0] ? normalizeImageTaskPath(match[0]) : "";
}

export function normalizeImageTaskPath(path: string) {
    return path.startsWith("/") ? path : `/${path}`;
}

export function isStandardOpenAiImageGenerationPath(path: string) {
    return /^\/(?:v1\/)?images\/generations$/i.test(path);
}

export function taskUrl(config: ImageTaskConfig, path: string, origin: string) {
    const protocol = resolveChannelModelConfig(config.advancedConfig, config.model)?.protocol || config.advancedConfig?.protocol;
    const apiBase = protocol === "custom" || protocol === "stable-diffusion" ? absoluteApiBaseUrl(config.baseUrl, origin) : normalizeApiBaseUrl(config.baseUrl, config.apiFormat, origin);
    return `${apiBase}${path}`;
}

export function normalizeApiBaseUrl(baseUrl: string, apiFormat: "openai" | "gemini", origin: string) {
    const normalized = absoluteApiBaseUrl(baseUrl, origin);
    const lower = normalized.toLowerCase();
    if (isInternalSystemProxyBase(normalized)) return normalized;
    if (lower.endsWith("/v1") || lower.endsWith("/v1beta") || lower.endsWith("/api/v3") || lower.endsWith("/api/plan/v3")) return normalized;
    if (apiFormat === "gemini") return `${normalized}/v1beta`;
    return `${normalized}/v1`;
}

function absoluteApiBaseUrl(baseUrl: string, origin: string) {
    return (baseUrl.startsWith("/") ? `${origin}${baseUrl}` : baseUrl).trim().replace(/\/+$/, "");
}

export function isInternalSystemProxyBase(value: string) {
    try {
        return /^\/api\/ai\/system\/[^/]+$/i.test(new URL(value).pathname);
    } catch {
        return false;
    }
}
