import { buildImageReferencePromptText } from "@/lib/image-reference-prompt";
import { resolveChannelModelConfig } from "@/lib/channel-protocol-registry";
import { isQingyanProvider } from "@/lib/provider-compatibility";
import { type ImageTask, type ImageTaskConfig, type ImageTaskReference } from "@/lib/server/image-task-store";
import { maintenanceWorkerContextHeaders } from "@/lib/server/maintenance-auth";
import { IMAGE_OUTPUT_FORMAT, IMAGE_RESPONSE_FORMATS, INLINE_IMAGE_TIMEOUT_MS, MAX_INLINE_IMAGE_BYTES, type ImageEditReferenceMode } from "./image-task-types";
import { rawReferenceRequestUrlCandidates } from "./image-task-reference-urls";
import { isRemoteMediaUrl, withSystemPrompt } from "./image-task-config";
import { globalAiOpcImagePreset, resolveConfiguredApiBaseUrl, shouldUseSub2ApiImageEdit } from "./image-task-preset";

export async function shouldUseJsonImageEdit(config: ImageTaskConfig) {
    if (globalAiOpcImagePreset(config)) return true;
    const apiBase = await resolveConfiguredApiBaseUrl(config.baseUrl).catch(() => config.baseUrl);
    const referenceMode = configuredImageEditReferenceMode(config);
    if (shouldUseSub2ApiImageEdit(config, apiBase)) return true;
    if (referenceMode === "json" || referenceMode === "public-url") return true;
    if (referenceMode === "multipart") return false;
    return isQingyanProvider({ baseUrl: apiBase, model: config.model, protocol: config.advancedConfig?.protocol });
}

export function configuredImageEditReferenceMode(config: ImageTaskConfig): ImageEditReferenceMode {
    const rule = (config.advancedConfig?.referenceRule || "").trim().toLowerCase();
    if (!rule) return "auto";
    if (/\bmultipart\b|form-?data|file upload|\u6587\u4ef6\u4e0a\u4f20|\u4e0a\u4f20\u6587\u4ef6/i.test(rule)) return "multipart";
    if (/\u516c\u7f51|public|next_public_site_url|localhost|must.*\burl\b|\burl\b.*only|\u5fc5\u987b.*\burl\b|\u4ec5.*\burl\b|\u53ea.*\burl\b/i.test(rule)) return "public-url";
    if (/\bjson\b|base64.*json|json.*base64|data:image|inline|ref_assets|input_image|image\/images/i.test(rule)) return "json";
    return "auto";
}

export function shouldFallbackToJsonImageEdit(status: number, message: string) {
    if (status === 404 || status === 405 || status === 415) return true;
    if (status !== 400 && status !== 422) return false;
    return (
        /multipart|form-?data|file upload|prompt.*required|required.*prompt|image url|image file|input image|reference image|invalid image|images\[\]|unsupported|not supported|failed to parse request body|parse request body|invalid request body|request body.*(?:parse|invalid)|body.*(?:parse|invalid)|cannot parse/i.test(
            message,
        ) || isPydanticDictionaryError(message)
    );
}

export function shouldTryNextImageResponseFormat(responseFormat: (typeof IMAGE_RESPONSE_FORMATS)[number], status: number, message: string) {
    if (status !== 400 && status !== 422) return false;
    if (responseFormat === "url") return /response[_ -]?format|url|unsupported|not supported|invalid/i.test(message);
    if (responseFormat === "b64_json") return /response[_ -]?format|b64|base64|unsupported|not supported|invalid/i.test(message);
    return false;
}

/** Explicit admin presets own one request shape; only legacy auto/compatible channels may probe alternatives. */
export function allowsImageProtocolFallback(config: ImageTaskConfig) {
    // A model-level protocol is authoritative even when the parent channel is legacy auto/compatible.
    const protocol = resolveChannelModelConfig(config.advancedConfig, config.model)?.protocol || config.advancedConfig?.protocol;
    return !protocol || protocol === "auto" || protocol === "compatible";
}

export function shouldRetryJsonImageEditPayload(status: number, message: string) {
    if (status !== 400 && status !== 422) return false;
    return (
        /image|images|image_url|input_image|reference|invalid type|unmarshal|deserialize|field|failed to parse request body|parse request body|invalid request body|request body.*(?:parse|invalid)|body.*(?:parse|invalid)|cannot parse/i.test(message) ||
        isPydanticDictionaryError(message)
    );
}

export function isPydanticDictionaryError(message: string) {
    return /valid dictionary|dictionary or object|extract fields/i.test(message);
}

export function shouldFallbackToResponsesImage(status: number, message: string) {
    if (status === 401 || status === 403 || status === 429) return false;
    if (status === 404 || status === 405 || status === 415) return true;
    if (status === 400 || status === 422) return /images\/generations|images\/edits|endpoint|route|not found|not implemented|no such|cannot post|unsupported|not supported/i.test(message);
    return false;
}

export async function buildImageEditFormData(task: ImageTask, quality: string | undefined, requestSize: string | undefined, origin: string, cookie: string, responseFormat: (typeof IMAGE_RESPONSE_FORMATS)[number], includeCompatibilityFields = true) {
    const formData = new FormData();
    formData.set("model", task.config.model);
    formData.set("prompt", withSystemPrompt(task.config, buildImageReferencePromptText(task.prompt, task.references)));
    formData.set("n", "1");
    if (includeCompatibilityFields) {
        formData.set("response_format", responseFormat);
        formData.set("output_format", IMAGE_OUTPUT_FORMAT);
    }
    if (quality) formData.set("quality", quality);
    if (requestSize) formData.set("size", requestSize);
    const referenceFiles = await Promise.all(task.references.map((reference, index) => imageReferenceToFile(reference, reference.name || `reference-${index + 1}.png`, origin, cookie)));
    referenceFiles.forEach((file) => formData.append("image", file));
    if (task.mask) formData.set("mask", await imageReferenceToFile(task.mask, task.mask.name || "mask.png", origin, cookie));
    return formData;
}

export async function imageReferenceToFile(reference: ImageTaskReference, name: string, origin: string, cookie: string) {
    let lastError: unknown;
    for (const value of rawReferenceRequestUrlCandidates(reference)) {
        try {
            if (/^data:image\//i.test(value)) return dataUrlToFile(value, name, reference.type);
            if (/^blob:/i.test(value)) throw new Error("参考图已失效，请重新上传");
            const fetchUrl = value.startsWith("/") ? `${origin}${value}` : value;
            if (!isRemoteMediaUrl(fetchUrl)) throw new Error("参考图地址无效，请重新上传参考图");
            const workerHeaders = maintenanceWorkerContextHeaders(cookie);
            const response = await fetch(fetchUrl, {
                headers: value.startsWith("/") ? workerHeaders || (cookie ? { cookie } : undefined) : undefined,
                cache: "no-store",
                signal: AbortSignal.timeout(INLINE_IMAGE_TIMEOUT_MS),
            });
            if (!response.ok || !response.body) throw new Error("参考图读取失败");
            const contentLength = Number(response.headers.get("content-length") || 0);
            if (contentLength > MAX_INLINE_IMAGE_BYTES) throw new Error("参考图过大，请压缩后重试");
            const bytes = Buffer.from(await response.arrayBuffer());
            if (!bytes.length) throw new Error("参考图读取失败");
            if (bytes.length > MAX_INLINE_IMAGE_BYTES) throw new Error("参考图过大，请压缩后重试");
            const mimeType = response.headers.get("content-type")?.split(";", 1)[0] || reference.type || "image/png";
            if (!mimeType.startsWith("image/")) throw new Error("参考图不是有效图片");
            return new File([bytes], name, { type: mimeType });
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error("参考图读取失败");
}

export function dataUrlToFile(dataUrl: string, name: string, fallbackType?: string) {
    const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) throw new Error("参考图不是有效 base64 图片");
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length) throw new Error("参考图读取失败");
    return new File([bytes], name, { type: fallbackType || match[1] || "image/png" });
}
