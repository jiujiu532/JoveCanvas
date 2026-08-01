import type { SystemChannelAdvancedConfig, SystemChannelProtocol } from "@/lib/auth/store";
import { buildGlobalAiOpcImageRequest, type GlobalAiOpcPreset } from "@/lib/globalaiopc-catalog";
import { isProviderBusinessError } from "@/lib/server/provider-task-config";
import { sanitizeProviderMessage } from "@/lib/server/admin-channel-config";
import { apiUrl, errorMessage, failed, findStringByKeys, HEALTH_REQUEST_TIMEOUT_MS, isQingyanHealthTarget, isSub2ApiHealthTarget, jsonHeaders, pointsInfo, readPayload, VIDEO_HEALTH_REFERENCE_IMAGE, type HealthResult } from "./channel-health-helpers";

export async function testImage(baseUrl: string, apiKey: string, model: string, globalPreset: GlobalAiOpcPreset | undefined, protocol: SystemChannelProtocol, advanced: SystemChannelAdvancedConfig): Promise<HealthResult> {
    if (globalPreset?.capability === "image") {
        const result = await testGlobalAiOpcImage(baseUrl, apiKey, model, globalPreset);
        return withImageEditHealth(result, baseUrl, apiKey, protocol, advanced, globalPreset);
    }
    for (const responseFormat of ["url", "b64_json"] as const) {
        const response = await fetch(apiUrl(baseUrl, "/images/generations"), {
            method: "POST",
            headers: jsonHeaders(apiKey),
            body: JSON.stringify({
                model,
                prompt: "A single blue circle icon on a white background.",
                n: 1,
                size: "1024x1024",
                quality: "low",
                response_format: responseFormat,
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
        });
        const payload = await readPayload(response);
        if (response.ok && !isProviderBusinessError(payload)) {
            const result: HealthResult = {
                ok: true,
                kind: "image",
                model,
                status: response.status,
                protocolKey: "openai",
                protocol: responseFormat === "url" ? "OpenAI 图片 URL" : "OpenAI 图片 Base64",
                createPath: "/images/generations",
                editPath: "/images/edits",
                requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","size":"{{size}}","response_format":"url"}',
                resultField: "data[0].url / data[0].b64_json",
                referenceRule: "图生图使用 /images/edits；VOZEB PRO 会按 multipart、image、images、image_url、input_image 等常见字段自动兼容。",
                supportsReferenceImage: true,
                ...imageHealthReferenceConfig(baseUrl),
                remoteUrl: findStringByKeys(payload, [
                    "url",
                    "image_url",
                    "imageUrl",
                    "media_url",
                    "mediaUrl",
                    "source_url",
                    "sourceUrl",
                    "output_url",
                    "outputUrl",
                    "download_url",
                    "downloadUrl",
                    "file_url",
                    "fileUrl",
                    "asset_url",
                    "assetUrl",
                    "result_url",
                    "resultUrl",
                ]),
                ...pointsInfo(response.headers),
            };
            return withImageEditHealth(result, baseUrl, apiKey, protocol, advanced, globalPreset, imageHealthReference(payload));
        }
        const message = errorMessage(payload, `图片测试失败，状态码 ${response.status}`);
        if (responseFormat === "url" && /response[_ -]?format|url|unsupported|not supported|invalid|not implemented/i.test(message)) continue;
        return failed("image", model, response.status, payload, apiKey);
    }
    return { ok: false, kind: "image", model, status: 0, error: "图片测试失败" };
}

export async function withImageEditHealth(
    result: HealthResult,
    baseUrl: string,
    apiKey: string,
    protocol: SystemChannelProtocol,
    advanced: SystemChannelAdvancedConfig,
    globalPreset?: GlobalAiOpcPreset,
    referenceImage = result.remoteUrl || VIDEO_HEALTH_REFERENCE_IMAGE,
): Promise<HealthResult> {
    if (!result.ok || !result.supportsReferenceImage) return result;
    const referenceImageTest = await testImageEdit(baseUrl, apiKey, result.model, protocol, advanced, referenceImage, globalPreset);
    return { ...result, referenceImageTest };
}

export async function testImageEdit(
    baseUrl: string,
    apiKey: string,
    model: string,
    protocol: SystemChannelProtocol,
    advanced: SystemChannelAdvancedConfig,
    referenceImage: string,
    globalPreset?: GlobalAiOpcPreset,
): Promise<NonNullable<HealthResult["referenceImageTest"]>> {
    if (globalPreset?.capability === "image") {
        const response = await fetch(apiUrl(baseUrl, globalPreset.createPath), {
            method: "POST",
            headers: jsonHeaders(apiKey),
            body: JSON.stringify(buildGlobalAiOpcImageRequest(globalPreset, { model, prompt: "Keep the reference image composition and make the circle slightly darker.", quality: "low", ratio: "1:1", resolution: "1k", imageUrls: [referenceImage] })),
            cache: "no-store",
            signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
        });
        return imageEditHealthResult(response, await readPayload(response), apiKey);
    }

    if (protocol === "sub2api" || isSub2ApiHealthTarget(baseUrl) || isQingyanHealthTarget(baseUrl)) {
        const path = advanced.editPath || advanced.createPath || "/images/generations";
        const response = await fetch(apiUrl(baseUrl, path), {
            method: "POST",
            headers: jsonHeaders(apiKey),
            body: JSON.stringify({
                model,
                prompt: "Keep the reference image composition and make the circle slightly darker.",
                n: 1,
                size: "1024x1024",
                response_format: "url",
                image: referenceImage,
                images: [referenceImage],
                image_urls: [referenceImage],
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
        });
        return imageEditHealthResult(response, await readPayload(response), apiKey);
    }

    const formData = new FormData();
    formData.set("model", model);
    formData.set("prompt", "Keep the reference image composition and make the circle slightly darker.");
    formData.set("n", "1");
    formData.set("size", "1024x1024");
    formData.set("response_format", "url");
    formData.set("image", healthReferenceImageFile());
    const response = await fetch(apiUrl(baseUrl, advanced.editPath || "/images/edits"), {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        body: formData,
        cache: "no-store",
        signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
    });
    return imageEditHealthResult(response, await readPayload(response), apiKey);
}

export function imageEditHealthResult(response: Response, payload: unknown, apiKey: string): NonNullable<HealthResult["referenceImageTest"]> {
    if (!response.ok || isProviderBusinessError(payload)) return { ok: false, status: response.status, error: sanitizeProviderMessage(errorMessage(payload, `图生图测试失败，状态码 ${response.status}`), [apiKey]) };
    const taskId = findStringByKeys(payload, ["task_id", "taskId", "id", "job_id", "jobId", "request_id", "requestId"]);
    const remoteUrl = findStringByKeys(payload, ["url", "image_url", "imageUrl", "result_url", "resultUrl"]);
    const inlineImage = findStringByKeys(payload, ["b64_json", "base64"]);
    if (!taskId && !remoteUrl && !inlineImage) return { ok: false, status: response.status, error: "图生图接口成功，但没有返回图片或任务 ID" };
    return { ok: true, status: response.status, taskId: taskId || undefined, remoteUrl: remoteUrl || undefined };
}

export function imageHealthReference(payload: unknown) {
    const remoteUrl = findStringByKeys(payload, ["url", "image_url", "imageUrl", "result_url", "resultUrl"]);
    if (remoteUrl) return remoteUrl;
    const base64 = findStringByKeys(payload, ["b64_json", "base64"]);
    return base64 ? `data:image/png;base64,${base64}` : VIDEO_HEALTH_REFERENCE_IMAGE;
}

export function healthReferenceImageFile() {
    const base64 = VIDEO_HEALTH_REFERENCE_IMAGE.slice(VIDEO_HEALTH_REFERENCE_IMAGE.indexOf(",") + 1);
    return new File([Buffer.from(base64, "base64")], "health-reference.png", { type: "image/png" });
}

export function imageHealthReferenceConfig(baseUrl: string): Partial<HealthResult> {
    if (isQingyanHealthTarget(baseUrl)) {
        return {
            protocolKey: "qingyan",
            protocol: "青衍图片任务",
            requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","size":"{{size}}","response_format":"url"}',
            resultField: "result.data[0].url / data[0].url / url",
            referenceRule: "图生图使用 JSON 与公网图片 URL；单图字段 image，多图字段 images，避免提交 base64。",
            supportsReferenceImage: true,
        };
    }
    if (isSub2ApiHealthTarget(baseUrl)) {
        return {
            protocolKey: "sub2api",
            protocol: "sub2api 图片兼容",
            requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","size":"{{size}}","image_urls":["https://..."]}',
            referenceRule: "图生图使用 JSON 请求体；参考图字段为 image_urls 字符串数组，站内素材通过服务器媒体地址提供。",
            supportsReferenceImage: true,
        };
    }
    return {};
}

export async function testGlobalAiOpcImage(baseUrl: string, apiKey: string, model: string, preset: GlobalAiOpcPreset): Promise<HealthResult> {
    const response = await fetch(apiUrl(baseUrl, preset.createPath), {
        method: "POST",
        headers: jsonHeaders(apiKey),
        body: JSON.stringify(buildGlobalAiOpcImageRequest(preset, { model, prompt: "A single blue circle icon on a white background.", quality: "low", ratio: "1:1", resolution: "1k", imageUrls: [] })),
        cache: "no-store",
        signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
    });
    const payload = await readPayload(response);
    if (!response.ok || isProviderBusinessError(payload)) return failed("image", model, response.status, payload, apiKey);
    return {
        ok: true,
        kind: "image",
        model,
        status: response.status,
        protocolKey: "globalaiopc",
        protocol: preset.label,
        createPath: preset.createPath,
        queryPath: preset.queryPath,
        requestTemplate:
            preset.id === "image-gpt-image-2"
                ? '{"model":"{{model}}","prompt":"{{prompt}}","quality":"{{quality}}","ratio":"{{ratio}}","resolution":"2k","image_urls":"{{images}}"}'
                : '{"model":"{{model}}","prompt":"{{prompt}}","resolution":"2k","size":"{{ratio}}","image_urls":"{{images}}"}',
        resultField: "data[0].url / url / image_url",
        statusField: "status",
        referenceRule: "参考图使用 image_urls 公网 URL 数组。",
        supportsReferenceImage: true,
        taskId: findStringByKeys(payload, ["task_id", "taskId", "id", "job_id", "jobId"]),
        remoteUrl: findStringByKeys(payload, ["url", "image_url", "imageUrl", "result_url", "resultUrl"]),
        ...pointsInfo(response.headers),
    };
}
