import { isQingyanProvider } from "@/lib/provider-compatibility";
import { sanitizeProviderMessage } from "@/lib/server/admin-channel-config";
import type { SystemChannelAdvancedConfig } from "@/lib/auth/store";
import { literalChannelHealthUrl, type ChannelHealthKind as HealthKind, type ChannelHealthResult as HealthResult } from "@/lib/server/channel-health-declarative";
import type { ResolvedTextProtocol } from "@/lib/server/text-protocol-resolver";

export type { HealthKind, HealthResult };

export const HEALTH_REQUEST_TIMEOUT_MS = 60_000;
export const VIDEO_HEALTH_REFERENCE_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

export function failed(kind: HealthKind, model: string, status: number, payload: unknown, apiKey: string): HealthResult {
    return { ok: false, kind, model, status, error: sanitizeProviderMessage(errorMessage(payload, `接口测试失败，状态码 ${status}`), [apiKey]) };
}

export function pointsInfo(headers: Headers) {
    const pointsCost = numericHeader(headers, "x-vozeb-pro-points-cost");
    const pointsRemaining = numericHeader(headers, "x-vozeb-pro-points-remaining");
    return {
        ...(pointsCost !== undefined ? { pointsCost } : {}),
        ...(pointsRemaining !== undefined ? { pointsRemaining } : {}),
    };
}

export function numericHeader(headers: Headers, key: string) {
    const value = Number(headers.get(key));
    return Number.isFinite(value) ? Number(value.toFixed(2)) : undefined;
}

export function jsonHeaders(apiKey: string) {
    return { authorization: `Bearer ${apiKey}`, "content-type": "application/json" };
}

export function apiUrl(baseUrl: string, path: string) {
    const normalized = normalizeHealthBaseUrl(baseUrl.trim().replace(/\/+$/, ""));
    const lower = normalized.toLowerCase();
    const apiBase = lower.endsWith("/v1") || lower.endsWith("/api/v3") || lower.endsWith("/api/plan/v3") ? normalized : `${normalized}/v1`;
    return `${apiBase}${path}`;
}

export function textProtocolUrl(baseUrl: string, protocol: ResolvedTextProtocol, advanced: SystemChannelAdvancedConfig) {
    const literal = advanced.protocol === "custom" || protocol.kind === "custom" || advanced.protocol === "stable-diffusion" || advanced.protocol === "seedance-special";
    if (literal) return literalChannelHealthUrl(baseUrl, protocol.path);
    return apiUrl(baseUrl, protocol.path);
}

export function normalizeHealthBaseUrl(baseUrl: string) {
    try {
        const url = new URL(baseUrl);
        const path = url.pathname.replace(/\/+$/, "");
        const lowerPath = path.toLowerCase();
        const arkPlanIndex = lowerPath.indexOf("/api/plan/v3");
        if (arkPlanIndex < 0) return baseUrl;
        const end = arkPlanIndex + "/api/plan/v3".length;
        if (lowerPath.length !== end && lowerPath[end] !== "/") return baseUrl;
        url.pathname = path.slice(0, end);
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/+$/, "");
    } catch {
        return baseUrl;
    }
}

export async function readPayload(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return { message: text.slice(0, 500) };
    }
}

export function errorMessage(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== "object") return fallback;
    const record = payload as Record<string, unknown>;
    const direct = stringValue(record.message) || stringValue(record.msg) || stringValue(record.detail);
    if (direct) return direct;
    const error = record.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") return stringValue((error as Record<string, unknown>).message) || stringValue((error as Record<string, unknown>).msg) || fallback;
    return fallback;
}

export function findStringByKeys(value: unknown, keys: string[], depth = 0): string {
    if (!value || depth > 5) return "";
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findStringByKeys(item, keys, depth + 1);
            if (found) return found;
        }
        return "";
    }
    if (typeof value !== "object") return "";
    const record = value as Record<string, unknown>;
    for (const key of keys) {
        const found = stringValue(record[key]);
        if (found) return found;
    }
    for (const item of Object.values(record)) {
        const found = findStringByKeys(item, keys, depth + 1);
        if (found) return found;
    }
    return "";
}

export function stringValue(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export function isQingyanHealthTarget(baseUrl: string) {
    return isQingyanProvider({ baseUrl });
}

export function isSub2ApiHealthTarget(baseUrl: string) {
    try {
        const url = new URL(baseUrl);
        const host = url.hostname.toLowerCase();
        const source = `${host}${url.pathname}`.toLowerCase();
        return host === "code2alita.com" || host.endsWith(".code2alita.com") || source.includes("sub2api");
    } catch {
        const source = baseUrl.toLowerCase();
        return source.includes("code2alita.com") || source.includes("sub2api");
    }
}
