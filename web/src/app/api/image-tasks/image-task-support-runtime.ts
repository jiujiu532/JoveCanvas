import { getAuthSettings, refundUserPoints } from "@/lib/auth/store";
import { fetchInternalApi, isInternalApiBaseUrl } from "@/lib/server/internal-origin";
import { resolveGeneratedMediaUrl } from "@/lib/media-url";
import { closestImageAspectRatio, parseImageDimensions } from "@/lib/image-size";
import { generationModelId } from "@/lib/server/generation-channel";
import { type ImageTask, type ImageTaskConfig } from "@/lib/server/image-task-store";
import { resolveModelPollingAttempts, resolveModelRequestTimeoutMs } from "@/lib/server/model-request-policy";
import { systemAiBillingHeaders } from "@/lib/server/system-ai-billing";
import { maintenanceWorkerContextHeaders } from "@/lib/server/maintenance-auth";
import { GenerationSubmissionSafeFailure, GenerationSubmissionUncertainError, generationSubmissionResponseError, generationSubmissionUncertainError } from "@/lib/server/generation-submission-error";
import {
    type ImageApiResponse,
    type ImageTaskResult,
    type GeminiPart,
    type GeminiPayload,
    QUALITY_BASE,
    QUALITY_ALIASES,
    DEFAULT_IMAGE_SHORT_SIDE,
    IMAGE_SIZE_STEP,
    IMAGE_MIN_PIXELS,
    IMAGE_TASK_POLL_INTERVAL_MS,
    IMAGE_TASK_POLL_ATTEMPTS,
    MAX_INLINE_IMAGE_BYTES,
    INLINE_IMAGE_TIMEOUT_MS,
    IMAGE_URL_KEYS,
    IMAGE_BASE64_KEYS,
    IMAGE_CONTAINER_KEYS,
    IMAGE_TASK_ID_KEYS,
    IMAGE_STATUS_KEYS,
    IMAGE_POLL_URL_KEYS,
} from "./image-task-types";
import { isRemoteMediaUrl } from "./image-task-config";
import { globalAiOpcImagePreset } from "./image-task-preset";
import { normalizeApiBaseUrl, taskUrl } from "./image-task-path";

export function taskHeaders(config: ImageTaskConfig, cookie: string, pointsIdempotencyKey?: string) {
    const headers = new Headers();
    const internal = config.baseUrl.startsWith("/");
    const workerHeaders = maintenanceWorkerContextHeaders(cookie);
    if (internal && workerHeaders) Object.entries(workerHeaders).forEach(([key, value]) => headers.set(key, value));
    else if (internal && cookie) headers.set("cookie", cookie);
    if (internal) Object.entries(systemAiBillingHeaders(generationModelId(config), pointsIdempotencyKey, config.model)).forEach(([key, value]) => headers.set(key, value));
    if (pointsIdempotencyKey?.trim()) {
        headers.set("Idempotency-Key", pointsIdempotencyKey.trim());
        headers.set("X-Client-Request-Id", pointsIdempotencyKey.trim());
    }
    if (!internal && config.apiFormat === "gemini") headers.set("x-goog-api-key", config.apiKey);
    else if (!internal) headers.set("authorization", `Bearer ${config.apiKey}`);
    return headers;
}

export function taskFetch(config: ImageTaskConfig, url: string, init: RequestInit) {
    const nextInit = {
        ...init,
        signal: init.signal || AbortSignal.timeout(imageTaskRequestTimeoutMs(config)),
    };
    if (!isInternalApiBaseUrl(config.baseUrl)) return fetch(url, nextInit);
    if (typeof FormData !== "undefined" && nextInit.body instanceof FormData) return fetch(url, nextInit);
    return fetchInternalApi(url, nextInit);
}

export async function imageSubmissionFetch(config: ImageTaskConfig, url: string, init: RequestInit) {
    try {
        return await taskFetch(config, url, init);
    } catch (error) {
        throw generationSubmissionUncertainError(error, "图片任务创建结果未知");
    }
}

export function imageSubmissionResponseError(status: number, message: string) {
    return generationSubmissionResponseError(status, message);
}

export async function parseImageSubmissionJson<T>(response: Response): Promise<T> {
    try {
        return (await response.json()) as T;
    } catch {
        throw new GenerationSubmissionUncertainError("图片接口返回了无效 JSON，创建结果待确认");
    }
}

export function imageTaskRequestTimeoutMs(config: ImageTaskConfig) {
    return resolveModelRequestTimeoutMs(config, "image");
}

export function imageTaskPollAttempts(config: ImageTaskConfig) {
    return resolveModelPollingAttempts(config, "image", IMAGE_TASK_POLL_INTERVAL_MS, IMAGE_TASK_POLL_ATTEMPTS);
}

export class ImageUpstreamTerminalError extends Error {}

export function geminiHeaders(config: ImageTaskConfig, cookie: string, pointsIdempotencyKey?: string) {
    const headers = taskHeaders(config, cookie, pointsIdempotencyKey);
    headers.set("content-type", "application/json");
    return headers;
}

export function imagePointsIdempotencyKey(task: Pick<ImageTask, "id" | "attemptNo">) {
    return `image-task:${task.id}:attempt:${task.attemptNo || 1}`;
}

export function geminiApiUrl(config: ImageTaskConfig, action: "generateContent", origin: string) {
    const baseUrl = normalizeApiBaseUrl(config.baseUrl, "gemini", origin);
    return `${baseUrl}/models/${encodeURIComponent(config.model.replace(/^models\//, ""))}:${action}`;
}

export async function parseImagePayloadOrPoll(config: ImageTaskConfig, payload: ImageApiResponse, mediaBaseUrl: string, cookie: string, pollBaseUrl = mediaBaseUrl, singleStep = false): Promise<ImageTaskResult> {
    const payloadError = readImagePayloadError(payload);
    if (payloadError) throw new GenerationSubmissionSafeFailure(payloadError);
    const image = findImageResult(payload, mediaBaseUrl, config);
    if (image) return image;

    const taskId = readImageTaskId(payload);
    if (!taskId) throw new GenerationSubmissionUncertainError("图片接口没有返回图片或任务 ID，创建结果待确认");
    const explicitPollUrl = readImagePollUrl(config, payload, mediaBaseUrl, pollBaseUrl);
    if (singleStep) return { dataUrl: "", pending: { id: taskId, mediaBaseUrl, pollBaseUrl, explicitPollUrl: explicitPollUrl || undefined } };
    return pollOpenAiImageTask(config, taskId, mediaBaseUrl, pollBaseUrl, cookie, explicitPollUrl);
}

export async function pollOpenAiImageTask(config: ImageTaskConfig, taskId: string, mediaBaseUrl: string, pollBaseUrl: string, cookie: string, explicitPollUrl = "", singleStep = false): Promise<ImageTaskResult> {
    const pollUrls = imageTaskPollUrls(config, pollBaseUrl, taskId, explicitPollUrl);
    let lastError = "";
    for (let attempt = 0; attempt < (singleStep ? 1 : imageTaskPollAttempts(config)); attempt += 1) {
        for (const pollUrl of pollUrls) {
            const response = await taskFetch(config, pollUrl, { method: "GET", headers: taskHeaders(config, cookie), cache: "no-store", signal: AbortSignal.timeout(Math.min(imageTaskRequestTimeoutMs(config), 60_000)) });
            if (!response.ok) {
                const message = await readFetchError(response, "图片任务查询失败");
                lastError = message;
                if (response.status === 404 || response.status === 405) continue;
                throw new Error(message);
            }
            const payload = (await response.json()) as ImageApiResponse;
            const baseUrl = response.headers.get("x-vozeb-pro-upstream-url") || mediaBaseUrl || pollUrl;
            const image = parseImagePayloadCompat(payload, baseUrl, config);
            if (image) return image;
            const error = readImagePayloadError(payload);
            if (error) throw new ImageUpstreamTerminalError(error);
            payload.status = readImageTaskStatus(payload) || payload.status;
            if (!isPendingImageStatus(payload.status)) throw new ImageUpstreamTerminalError("图片任务完成但没有返回图片");
        }
        if (!singleStep) await delay(IMAGE_TASK_POLL_INTERVAL_MS);
    }
    if (singleStep) return { dataUrl: "", pending: { id: taskId, mediaBaseUrl, pollBaseUrl, explicitPollUrl: explicitPollUrl || undefined } };
    throw new Error(lastError || "图片生成超时，请稍后重试");
}

export function parseImagePayloadCompat(payload: ImageApiResponse, baseUrl: string, config: ImageTaskConfig): ImageTaskResult | null {
    const error = readImagePayloadError(payload);
    if (error) throw new Error(error);
    return findImageResult(payload, baseUrl, config);
}

export function findImageResult(value: unknown, baseUrl: string, config: ImageTaskConfig, depth = 0): ImageTaskResult | null {
    if (!value || depth > 6) return null;
    if (typeof value === "string") {
        const url = resolveImageUrlLike(value, baseUrl, config, false);
        if (url) return url;
        const dataUrl = resolveImageBase64Like(value);
        return dataUrl ? { dataUrl } : null;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const image = findImageResult(item, baseUrl, config, depth + 1);
            if (image) return image;
        }
        return null;
    }
    if (typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    for (const key of IMAGE_BASE64_KEYS) {
        const dataUrl = resolveImageBase64Like(stringField(record, key));
        if (dataUrl) return { dataUrl };
    }
    for (const key of IMAGE_URL_KEYS) {
        const image = resolveImageUrlLike(stringField(record, key), baseUrl, config, true);
        if (image) return image;
    }
    for (const key of IMAGE_CONTAINER_KEYS) {
        const image = findImageResult(record[key], baseUrl, config, depth + 1);
        if (image) return image;
    }
    return null;
}

export function resolveImageUrlLike(value: string, baseUrl: string, config: ImageTaskConfig, fromNamedField: boolean) {
    const mediaUrl = value.trim();
    if (!mediaUrl) return null;
    if (/^data:image\//i.test(mediaUrl) || /^blob:/i.test(mediaUrl)) return { dataUrl: mediaUrl };
    if (fromNamedField || isLikelyImageUrl(mediaUrl)) {
        const dataUrl = resolveTaskMediaUrl(config, mediaUrl, baseUrl);
        const remoteUrl = resolveGeneratedMediaUrl(mediaUrl, baseUrl);
        return { dataUrl, remoteUrl: isRemoteMediaUrl(remoteUrl) ? remoteUrl : undefined };
    }
    return null;
}

export function resolveImageBase64Like(value: string) {
    const base64 = value.trim();
    if (!base64) return "";
    if (/^data:image\//i.test(base64)) return base64;
    if (base64.length < 64 || !/^[a-z0-9+/=_-]+$/i.test(base64.replace(/\s/g, ""))) return "";
    return `data:image/png;base64,${base64.replace(/\s/g, "")}`;
}

export function isLikelyImageUrl(value: string) {
    return /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(value);
}

export function readImagePayloadError(payload: ImageApiResponse) {
    if (typeof payload.code === "number" && payload.code !== 0) return payload.msg || "图片生成失败";
    if (payload.error?.message) return payload.error.message;
    const status = (payload.status || "").toLowerCase();
    if (["failed", "failure", "error", "cancelled", "canceled", "expired"].includes(status)) return payload.msg || "图片生成失败";
    return "";
}

export function readImageTaskId(payload: ImageApiResponse) {
    return findStringByKeys(payload, IMAGE_TASK_ID_KEYS);
}

export function readImageTaskStatus(payload: ImageApiResponse) {
    return findStringByKeys(payload, IMAGE_STATUS_KEYS).toLowerCase();
}

export function readImagePollUrl(config: ImageTaskConfig, payload: ImageApiResponse, mediaBaseUrl: string, pollBaseUrl: string) {
    const value = findStringByKeys(payload, IMAGE_POLL_URL_KEYS);
    if (!value || config.baseUrl.startsWith("/api/ai/system/")) return "";
    return resolveGeneratedMediaUrl(value, mediaBaseUrl || pollBaseUrl);
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
        const found = stringField(record, key);
        if (found) return found;
    }
    for (const key of IMAGE_CONTAINER_KEYS) {
        const found = findStringByKeys(record[key], keys, depth + 1);
        if (found) return found;
    }
    return "";
}

export function isPendingImageStatus(status?: string) {
    const value = (status || "").toLowerCase();
    return !value || ["pending", "queued", "running", "processing", "in_progress", "created"].includes(value);
}

export function imageTaskPollUrls(config: ImageTaskConfig, requestUrl: string, taskId: string, explicitPollUrl = "") {
    const cleanUrl = requestUrl.split("?")[0].replace(/\/+$/, "");
    const encodedTaskId = encodeURIComponent(taskId);
    const pollUrls = [configuredImageTaskPollUrl(config, taskId, requestUrl), explicitPollUrl, `${cleanUrl}/${encodedTaskId}`];
    const generationsUrl = cleanUrl.replace(/\/images\/(?:generations|edits)$/i, "/images/generations");
    if (generationsUrl !== cleanUrl) pollUrls.push(`${generationsUrl}/${encodedTaskId}`);
    return Array.from(new Set(pollUrls.filter(Boolean)));
}

export function configuredImageTaskPollUrl(config: ImageTaskConfig, taskId: string, requestUrl: string) {
    const queryPath = (globalAiOpcImagePreset(config)?.queryPath || config.advancedConfig?.queryPath || "").trim();
    if (!queryPath) return "";
    let origin = "";
    try {
        origin = new URL(requestUrl).origin;
    } catch {
        return "";
    }
    const rendered = queryPath.replace(/\{\{\s*(?:taskId|task_id|id)\s*\}\}|\{(?:taskId|task_id|id)\}|:(?:taskId|task_id|id)\b/gi, encodeURIComponent(taskId));
    return taskUrl(config, rendered === queryPath ? `${queryPath.replace(/\/+$/, "")}/${encodeURIComponent(taskId)}` : rendered, origin);
}

export function resolveTaskMediaUrl(config: ImageTaskConfig, value: string, baseUrl: string) {
    if (/^(data|blob):/i.test(value)) return value;
    const remoteUrl = resolveGeneratedMediaUrl(value, baseUrl);
    if (!config.baseUrl.startsWith("/api/ai/system/")) return remoteUrl;
    const proxyBase = config.baseUrl.trim().replace(/\/+$/, "");
    return `${proxyBase}/_media?url=${encodeURIComponent(remoteUrl)}`;
}

export function shouldRetryInternalImageUrlAsBase64(result: ImageTaskResult) {
    return isInternalGeneratedImageUrl(result.remoteUrl || "") || isInternalGeneratedImageUrl(result.dataUrl || "");
}

export function isInternalGeneratedImageUrl(value: string) {
    const url = value.trim();
    if (!/^https?:\/\//i.test(url)) return false;
    try {
        const host = new URL(url).hostname.toLowerCase();
        return !host.includes(".") || host.endsWith(".internal") || host.endsWith(".local");
    } catch {
        return false;
    }
}

export async function inlineRemoteImageResult(value: string, origin: string, cookie: string, remoteFallback?: string) {
    const url = (value || "").trim();
    if (!url || url.startsWith("data:")) return { dataUrl: url, remoteUrl: remoteFallback };
    const mediaSource = resolveProxiedMediaSource(url, origin);
    const remoteUrl = mediaSource.remoteUrl || remoteFallback || (isRemoteMediaUrl(url) && !mediaSource.proxyUrl ? url : undefined);
    const fallbackUrl = remoteUrl || mediaSource.proxyUrl;
    const fetchUrl = url.startsWith("/") ? `${origin}${url}` : url;
    if (!isRemoteMediaUrl(fetchUrl)) return { dataUrl: url, remoteUrl: fallbackUrl };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INLINE_IMAGE_TIMEOUT_MS);
    try {
        const workerHeaders = maintenanceWorkerContextHeaders(cookie);
        const response = await fetch(fetchUrl, {
            headers: url.startsWith("/") ? workerHeaders || (cookie ? { cookie } : undefined) : undefined,
            cache: "no-store",
            signal: controller.signal,
        });
        if (!response.ok || !response.body) return { dataUrl: url, remoteUrl: fallbackUrl };
        const contentLength = Number(response.headers.get("content-length") || 0);
        if (contentLength > MAX_INLINE_IMAGE_BYTES) return { dataUrl: url, remoteUrl: fallbackUrl };
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > MAX_INLINE_IMAGE_BYTES) return { dataUrl: url, remoteUrl: fallbackUrl };
        const mimeType = response.headers.get("content-type")?.split(";", 1)[0] || "image/png";
        if (!mimeType.startsWith("image/")) return { dataUrl: url, remoteUrl: fallbackUrl };
        return { dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`, remoteUrl: fallbackUrl };
    } catch {
        return { dataUrl: url, remoteUrl: fallbackUrl };
    } finally {
        clearTimeout(timer);
    }
}

export function directRemoteImageResult(remoteUrl?: string) {
    const fallback = (remoteUrl || "").trim();
    if (!isRemoteMediaUrl(fallback) || isInternalGeneratedImageUrl(fallback)) return null;
    return { dataUrl: fallback, remoteUrl: fallback };
}

export function resolveProxiedMediaSource(value: string, origin: string) {
    const trimmed = value.trim();
    const absolute = trimmed.startsWith("/") ? `${origin}${trimmed}` : trimmed;
    try {
        const parsed = new URL(absolute);
        const isSameOrigin = parsed.origin === origin;
        const isProxyPath = parsed.pathname === "/api/media-proxy" || /^\/api\/ai\/system\/[^/]+\/_media$/.test(parsed.pathname);
        if (!isProxyPath) return {};
        const sourceUrl = parsed.searchParams.get("url") || "";
        const proxyUrl = trimmed.startsWith("/") || isSameOrigin ? `${parsed.pathname}${parsed.search}` : trimmed;
        return {
            remoteUrl: isRemoteMediaUrl(sourceUrl) ? sourceUrl : undefined,
            proxyUrl,
        };
    } catch {
        return {};
    }
}

export function stringField(record: Record<string, unknown>, key: string) {
    const value = record[key];
    return typeof value === "string" ? value.trim() : "";
}

export function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseGeminiImagePayload(payload: GeminiPayload) {
    if (payload.error?.message) throw new Error(payload.error.message);
    if (payload.promptFeedback?.blockReason) throw new Error(`Gemini 拒绝了本次请求：${payload.promptFeedback.blockReason}`);
    const image = payload.candidates
        ?.flatMap((candidate) => candidate.content?.parts || [])
        .map((part) => {
            const inlineData = part.inlineData || (part.inline_data ? { mimeType: part.inline_data.mimeType || part.inline_data.mime_type, data: part.inline_data.data } : undefined);
            if (inlineData?.data) return `data:${inlineData.mimeType || "image/png"};base64,${inlineData.data}`;
            return part.fileData?.fileUri || "";
        })
        .find(Boolean);
    if (!image) throw new Error("Gemini 接口没有返回图片");
    return image;
}

export function toGeminiImagePart(dataUrl: string, fallbackType?: string): GeminiPart {
    const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
    if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
    return { fileData: { fileUri: dataUrl, mimeType: fallbackType || "image/png" } };
}

export async function readFetchError(response: Response, fallback: string) {
    const text = await response.text();
    const statusText = `${fallback}，状态码 ${response.status}`;
    if (!text) return statusText;
    if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(text)) {
        const upstreamUrl = response.headers.get("x-vozeb-pro-upstream-url") || "";
        const contentType = response.headers.get("content-type") || "";
        const details = [upstreamUrl ? `地址 ${upstreamUrl}` : "", contentType ? `类型 ${contentType}` : ""].filter(Boolean).join("，");
        return `${fallback}，上游返回了网页错误（HTTP ${response.status}${details ? `，${details}` : ""}），请检查接口路径、鉴权、参考图提交方式或网关状态`;
    }
    try {
        const payload = JSON.parse(text) as { error?: { message?: string }; message?: string; msg?: string };
        return payload.msg || payload.message || payload.error?.message || statusText;
    } catch {
        return text.slice(0, 300) || statusText;
    }
}

export function readPointsRemaining(headers: Headers) {
    const value = headers.get("x-vozeb-pro-points-remaining");
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function readBilling(headers: Headers) {
    const rawCost = headers.get("x-vozeb-pro-points-cost");
    const pointsCost = rawCost === null ? undefined : Number(rawCost);
    return {
        pointsRemaining: readPointsRemaining(headers),
        pointsCost: pointsCost !== undefined && Number.isFinite(pointsCost) && pointsCost >= 0 ? pointsCost : undefined,
        pointsRecordId: headers.get("x-vozeb-pro-points-record-id") || undefined,
    };
}

export async function parseChargedImageResponse(task: ImageTask, response: Response, parse: () => Promise<ImageTaskResult>) {
    try {
        return { ...(await parse()), ...readBilling(response.headers) };
    } catch (error) {
        await refundChargedImageResponse(task, response.headers);
        throw error;
    }
}

export async function refundChargedImageResponse(task: ImageTask, headers: Headers) {
    const { pointsCost, pointsRecordId } = readBilling(headers);
    if (pointsCost === undefined || !pointsRecordId) return;
    const settings = await getAuthSettings();
    await refundUserPoints(task.userId, generationModelId(task.config), pointsCost, "image", imageUnits(task.config.quality, settings.generationPointMultipliers.imageQuality), undefined, pointsRecordId);
}

export function imageUnits(quality: string | undefined, multipliers: Record<string, number>) {
    const key = QUALITY_ALIASES[String(quality || "").toLowerCase()] || String(quality || "auto").toLowerCase();
    return multipliers[key] || 1;
}

export function normalizeQuality(quality: string) {
    const value = quality.trim().toLowerCase();
    const normalized = QUALITY_ALIASES[value] || value;
    return QUALITY_BASE[normalized] ? normalized : undefined;
}

export function resolveRequestSize(quality: string | undefined, size: string) {
    try {
        const value = size.trim();
        if (!value || value.toLowerCase() === "auto") return undefined;
        const dimensions = parseImageDimensions(value);
        if (dimensions) {
            validateImageTargetSize(dimensions.width, dimensions.height);
            return upstreamImageSize(dimensions.width, dimensions.height);
        }
        if (value.includes(":")) return resolveSize(quality, value);
        throw new Error("图片尺寸格式不支持，请使用 auto、9:16 或 1024x1024");
    } catch (error) {
        if (error instanceof GenerationSubmissionSafeFailure) throw error;
        throw new GenerationSubmissionSafeFailure(error instanceof Error ? error.message : "图片尺寸参数无效");
    }
}

export function imageRequestAspectRatio(size: string) {
    const value = size.trim();
    if (/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value)) return value;
    const dimensions = parseImageDimensions(value);
    return (dimensions && closestImageAspectRatio(dimensions.width, dimensions.height)) || "1:1";
}

export function resolveSize(quality: string | undefined, ratio: string): string {
    const parsedRatio = parseImageRatio(ratio);
    const basePixels = quality ? QUALITY_BASE[quality] : undefined;
    const isLandscape = parsedRatio.width >= parsedRatio.height;
    const longRatio = isLandscape ? parsedRatio.width / parsedRatio.height : parsedRatio.height / parsedRatio.width;
    let longSide: number;
    let shortSide: number;
    if (basePixels) {
        const targetPixels = basePixels * basePixels;
        const longSideRaw = Math.sqrt(targetPixels * longRatio);
        longSide = Math.floor(longSideRaw / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
        shortSide = Math.round(longSide / longRatio / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    } else {
        shortSide = DEFAULT_IMAGE_SHORT_SIDE;
        longSide = Math.round((shortSide * longRatio) / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    }
    const width = isLandscape ? longSide : shortSide;
    const height = isLandscape ? shortSide : longSide;
    validateImageSize(width, height);
    return `${width}x${height}`;
}

export function parseImageRatio(value: string) {
    const parts = value.split(":");
    if (parts.length !== 2) throw new Error("图片尺寸格式不支持，请使用 auto、9:16 或 1024x1024");
    const width = Number(parts[0]);
    const height = Number(parts[1]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("图片比例必须是正数，例如 9:16");
    return { width, height };
}

export { parseImageDimensions };

export function validateImageSize(width: number, height: number) {
    validateImageDimensions(width, height);
}

function validateImageTargetSize(width: number, height: number) {
    validateImageDimensions(width, height);
}

function validateImageDimensions(width: number, height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error("图片尺寸必须是正整数，例如 1024x1024");
}

function upstreamImageSize(width: number, height: number) {
    if (width * height >= IMAGE_MIN_PIXELS) return `${width}x${height}`;
    const scale = Math.sqrt(IMAGE_MIN_PIXELS / (width * height));
    const align = (value: number) => Math.ceil(value / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    const shortSide = align(Math.min(width, height) * scale);
    const upstreamWidth = width <= height ? shortSide : align(shortSide * (width / height));
    const upstreamHeight = height <= width ? shortSide : align(shortSide * (height / width));
    validateImageSize(upstreamWidth, upstreamHeight);
    return `${upstreamWidth}x${upstreamHeight}`;
}
