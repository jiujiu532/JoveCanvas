import { getAuthSettings } from "@/lib/auth/store";
import { isQingyanProvider } from "@/lib/provider-compatibility";
import { resolveGlobalAiOpcPreset } from "@/lib/globalaiopc-catalog";
import { type ImageTaskConfig } from "@/lib/server/image-task-store";
import { IMAGE_RESPONSE_FORMATS } from "./image-task-types";

export async function preferredImageResponseFormat(config: ImageTaskConfig): Promise<(typeof IMAGE_RESPONSE_FORMATS)[number]> {
    const apiBase = await resolveConfiguredApiBaseUrl(config.baseUrl).catch(() => config.baseUrl);
    return isQingyanProvider({ baseUrl: apiBase, model: config.model, protocol: config.advancedConfig?.protocol }) ? "b64_json" : "url";
}

export function globalAiOpcImagePreset(config: ImageTaskConfig) {
    const preset = resolveGlobalAiOpcPreset(config.advancedConfig, config.model);
    return preset?.capability === "image" ? preset : undefined;
}

export async function resolveConfiguredApiBaseUrl(baseUrl: string) {
    const systemChannelId = readSystemChannelId(baseUrl);
    if (!systemChannelId) return baseUrl;
    const settings = await getAuthSettings();
    return settings.systemChannels.find((channel) => channel.id === systemChannelId)?.baseUrl || baseUrl;
}

export function readSystemChannelId(baseUrl: string) {
    try {
        const parsed = new URL(baseUrl, "http://localhost");
        const match = parsed.pathname.match(/^\/api\/ai\/system\/([^/]+)/);
        return match?.[1] ? decodeURIComponent(match[1]) : "";
    } catch {
        return "";
    }
}

export function shouldUseSub2ApiImageEdit(config: ImageTaskConfig, apiBase: string) {
    if (config.advancedConfig?.protocol === "sub2api") return true;
    if (isCode2AlitaApiBase(apiBase)) return true;
    const advanced = config.advancedConfig;
    const requestTemplate = (advanced?.requestTemplate || "").toLowerCase();
    const referenceRule = (advanced?.referenceRule || "").toLowerCase();
    if (/\bsub2api\b/i.test(`${requestTemplate}\n${referenceRule}`)) return true;
    return /\bimage_urls\b|images\[\]\.image_url|"images"\s*:\s*\[\s*\{\s*"image_url"|images\s*:\s*\[\s*\{\s*image_url/i.test(requestTemplate);
}

export function isCode2AlitaApiBase(baseUrl: string) {
    return matchesApiHost(baseUrl, "code2alita.com");
}

export function matchesApiHost(baseUrl: string, hostname: string) {
    try {
        const host = new URL(baseUrl).hostname.toLowerCase();
        const target = hostname.toLowerCase();
        return host === target || host.endsWith(`.${target}`);
    } catch {
        return false;
    }
}
