import { isAgnesApiBaseUrl } from "@/lib/agnes-model-catalog";
import { buildGlobalAiOpcVideoRequest, type GlobalAiOpcPreset } from "@/lib/globalaiopc-catalog";
import { isSeedanceVideoModelName } from "@/lib/model-capability";
import { isQingyanProvider } from "@/lib/provider-compatibility";
import { isProviderBusinessError } from "@/lib/server/provider-task-config";
import { apiUrl, errorMessage, failed, findStringByKeys, HEALTH_REQUEST_TIMEOUT_MS, jsonHeaders, pointsInfo, readPayload, VIDEO_HEALTH_REFERENCE_IMAGE, type HealthResult } from "./channel-health-helpers";

const GLOBAL_AIOPC_VIDEO_CREATE_PATH = "/videos/videos";
const SEEDANCE_VIDEO_CREATE_PATH = "/contents/generations/tasks";
const VIDEO_HEALTH_PATHS = [GLOBAL_AIOPC_VIDEO_CREATE_PATH, "/videos", "/video/generations", "/videos/generations", SEEDANCE_VIDEO_CREATE_PATH];

export async function testVideo(baseUrl: string, apiKey: string, model: string, globalPreset?: GlobalAiOpcPreset): Promise<HealthResult> {
    if (globalPreset?.capability === "video") return testGlobalAiOpcVideo(baseUrl, apiKey, model, globalPreset);
    const basePayload = {
        model,
        prompt: "A calm 5 second shot of a blue circle logo on a white background.",
        n: 1,
        size: "1280x720",
        width: 1280,
        height: 720,
        response_format: "url",
        ratio: "16:9",
        aspect_ratio: "16:9",
        resolution: "480p",
        quality: "480p",
        async: true,
        generate_audio: false,
        watermark: false,
    };
    return testVideoPayloads(baseUrl, apiKey, model, buildVideoHealthPayloads(basePayload), false);
}

export async function testGlobalAiOpcVideo(baseUrl: string, apiKey: string, model: string, preset: GlobalAiOpcPreset): Promise<HealthResult> {
    const response = await fetch(apiUrl(baseUrl, preset.createPath), {
        method: "POST",
        headers: jsonHeaders(apiKey),
        body: JSON.stringify(
            buildGlobalAiOpcVideoRequest(preset, { model, prompt: "A calm 5 second shot of a blue circle logo on a white background.", duration: 5, ratio: "16:9", resolution: "480p", images: [], videos: [], audios: [], generateAudio: false }),
        ),
        cache: "no-store",
        signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
    });
    const payload = await readPayload(response);
    if (!response.ok || isProviderBusinessError(payload)) return failed("video", model, response.status, payload, apiKey);
    return {
        ok: true,
        kind: "video",
        model,
        status: response.status,
        protocolKey: "globalaiopc",
        protocol: preset.label,
        createPath: preset.createPath,
        queryPath: preset.queryPath,
        resultField: "video_url / media_url / result_url / url",
        statusField: "status / state",
        durationRange: preset.durationRange,
        referenceRule: "参考素材使用可被上游访问的公网 URL。",
        supportsReferenceImage: preset.supportsReferenceImage,
        supportsReferenceVideo: preset.supportsReferenceVideo,
        supportsReferenceAudio: preset.supportsReferenceAudio,
        taskId: findStringByKeys(payload, ["task_id", "taskId", "id", "job_id", "jobId"]),
        remoteUrl: findStringByKeys(payload, ["video_url", "videoUrl", "media_url", "mediaUrl", "result_url", "resultUrl", "url"]),
        ...pointsInfo(response.headers),
    };
}

export async function testVideoPayloads(baseUrl: string, apiKey: string, model: string, payloads: Array<Record<string, unknown>>, allowReferenceRetry: boolean): Promise<HealthResult> {
    for (const path of videoHealthPaths(baseUrl, model)) {
        for (const payload of videoHealthPayloadsForPath(path, payloads)) {
            const response = await fetch(apiUrl(baseUrl, path), {
                method: "POST",
                headers: jsonHeaders(apiKey),
                body: JSON.stringify(payload),
                cache: "no-store",
                signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
            });
            const data = await readPayload(response);
            if (response.ok && !isProviderBusinessError(data)) {
                const config = videoHealthConfig(baseUrl, model, path);
                return {
                    ok: true,
                    kind: "video",
                    model,
                    status: response.status,
                    ...config,
                    referenceHint: config.referenceRule,
                    ...pointsInfo(response.headers),
                    taskId: findStringByKeys(data, ["task_id", "taskId", "id", "job_id", "jobId", "request_id", "requestId", "uuid", "task_uuid", "taskUuid"]),
                    remoteUrl: findStringByKeys(data, [
                        "video_url",
                        "videoUrl",
                        "media_url",
                        "mediaUrl",
                        "play_url",
                        "playUrl",
                        "stream_url",
                        "streamUrl",
                        "source_url",
                        "sourceUrl",
                        "content_url",
                        "contentUrl",
                        "url",
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
                };
            }
            const message = errorMessage(data, `视频测试失败，状态码 ${response.status}`);
            if (/not found|not implemented|route|endpoint|unsupported|no such|cannot post|invalid url|404/i.test(message)) break;
            if (shouldRetryVideoHealthPayload(response.status, message)) continue;
            if (path !== GLOBAL_AIOPC_VIDEO_CREATE_PATH && path !== SEEDANCE_VIDEO_CREATE_PATH && !allowReferenceRetry && shouldRetryVideoHealthWithReference(message)) {
                return testVideoPayloads(baseUrl, apiKey, model, buildVideoHealthPayloads(payload, true), true);
            }
            return failed("video", model, response.status, data, apiKey);
        }
    }
    return { ok: false, kind: "video", model, status: 0, error: "视频测试失败：所有兼容路径都不可用" };
}

function videoHealthPaths(baseUrl: string, model: string) {
    if (isSeedanceVideoHealthTarget(baseUrl, model)) return uniquePaths([SEEDANCE_VIDEO_CREATE_PATH, "/video/generations", "/videos/generations", "/videos", GLOBAL_AIOPC_VIDEO_CREATE_PATH]);
    if (isGlobalAiOpcVideoHealthTarget(baseUrl, model)) return uniquePaths([GLOBAL_AIOPC_VIDEO_CREATE_PATH, "/videos", "/video/generations", "/videos/generations", SEEDANCE_VIDEO_CREATE_PATH]);
    if (isQingyanVideoHealthTarget(baseUrl, model)) return uniquePaths(["/video/generations", "/videos/generations", "/videos", GLOBAL_AIOPC_VIDEO_CREATE_PATH, SEEDANCE_VIDEO_CREATE_PATH]);
    return VIDEO_HEALTH_PATHS;
}

function videoHealthPayloadsForPath(path: string, payloads: Array<Record<string, unknown>>) {
    if (path === GLOBAL_AIOPC_VIDEO_CREATE_PATH) {
        return payloads.map((payload) => ({
            model: String(payload.model || ""),
            prompt: String(payload.prompt || "A calm 5 second shot of a blue circle logo on a white background."),
            duration: normalizeGlobalAiOpcHealthDuration(payload.duration || payload.seconds),
            ratio: "16:9",
            resolution: "480p",
            autoFace: false,
        }));
    }
    if (path === SEEDANCE_VIDEO_CREATE_PATH) {
        return payloads.map((payload) => ({
            model: String(payload.model || ""),
            content: [{ type: "text", text: String(payload.prompt || "A calm 5 second shot of a blue circle logo on a white background.") }],
            duration: normalizeSeedanceHealthDuration(payload.duration || payload.seconds),
            ratio: "16:9",
            resolution: "480p",
            generate_audio: false,
            watermark: false,
        }));
    }
    return payloads;
}

function videoHealthConfig(baseUrl: string, model: string, path: string): Partial<HealthResult> {
    if (path === GLOBAL_AIOPC_VIDEO_CREATE_PATH) {
        return {
            protocolKey: "globalaiopc",
            protocol: "GlobalAiOpc Videos",
            createPath: GLOBAL_AIOPC_VIDEO_CREATE_PATH,
            queryPath: "/result/:task_id",
            requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","duration":"{{duration}}","ratio":"{{ratio}}","resolution":"{{resolution}}","referenceImages":"{{images}}","referenceVideos":"{{videos}}","referenceAudios":"{{audios}}"}',
            resultField: "video_url / media_url / result_url / url",
            statusField: "status / state",
            durationRange: "4-15 秒",
            referenceRule: "参考图、参考视频和参考音频由服务器生成可访问地址后提交，上游必须能够访问当前站点。",
            supportsReferenceImage: true,
            supportsReferenceVideo: true,
            supportsReferenceAudio: true,
        };
    }
    if (path === SEEDANCE_VIDEO_CREATE_PATH) {
        return {
            protocolKey: "seedance",
            protocol: "Seedance / Ark Plan",
            createPath: SEEDANCE_VIDEO_CREATE_PATH,
            queryPath: "/contents/generations/tasks/:task_id",
            requestTemplate: '{"model":"{{model}}","content":[{"type":"text","text":"{{prompt}}"}],"duration":"{{duration}}","ratio":"{{ratio}}","resolution":"{{resolution}}"}',
            resultField: "content.video_url",
            statusField: "status",
            durationRange: "按模型限制，常用 5/10 秒",
            referenceRule: "支持图片、视频、音频参考素材；参考视频和音频有大小与时长限制，建议使用公网 URL。",
            supportsReferenceImage: true,
            supportsReferenceVideo: true,
            supportsReferenceAudio: true,
        };
    }
    if (path === "/videos") {
        return {
            protocolKey: "openai",
            protocol: "OpenAI Videos",
            createPath: "/videos",
            queryPath: isAgnesApiBaseUrl(baseUrl) ? "/agnesapi?video_id=:task_id" : "/videos/:task_id",
            requestTemplate: "multipart/form-data: model、prompt、seconds、size、input_reference",
            resultField: "/videos/:task_id/content",
            statusField: "status",
            durationRange: "按上游模型限制",
            referenceRule: "参考图使用 multipart 文件上传，由 JoveCanvas 自动组装。",
            supportsReferenceImage: true,
            supportsReferenceVideo: false,
            supportsReferenceAudio: false,
        };
    }
    if (isQingyanVideoHealthTarget(baseUrl, model) || path === "/video/generations") {
        return {
            protocolKey: isQingyanVideoHealthTarget(baseUrl, model) ? "qingyan" : "compatible",
            protocol: isQingyanVideoHealthTarget(baseUrl, model) ? "青衍视频任务" : "兼容视频任务",
            createPath: path,
            queryPath: `${path}/:task_id`,
            requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","duration":"{{duration}}","ratio":"{{ratio}}","image":"{{image}}","images":"{{images}}"}',
            resultField: "result.data[0].url / video_url / media_url / output_url / url",
            statusField: "status / state / task_status",
            durationRange: isQingyanVideoHealthTarget(baseUrl, model) ? "上游可能重写参数；实测 5 秒/480p 返回 10 秒/1080p" : "5、10、15 秒或按上游限制",
            referenceRule: isQingyanVideoHealthTarget(baseUrl, model) ? "图生视频按文档使用公网图片 URL；单图字段 image，多图字段 images，避免提交 base64。" : "参考图会按 base64、URL 和常见兼容字段自动尝试。",
            supportsReferenceImage: true,
            supportsReferenceVideo: false,
            supportsReferenceAudio: false,
        };
    }
    return {
        protocolKey: "compatible",
        protocol: "兼容视频任务",
        createPath: path,
        queryPath: `${path}/:task_id`,
        requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","duration":"{{duration}}","ratio":"{{ratio}}"}',
        resultField: "video_url / media_url / output_url / url",
        statusField: "status / state / task_status",
        durationRange: "5、10、15 秒或按上游限制",
        referenceRule: "参考图会按 base64、URL 和常见兼容字段自动尝试。",
        supportsReferenceImage: true,
        supportsReferenceVideo: false,
        supportsReferenceAudio: false,
    };
}

function isGlobalAiOpcVideoHealthTarget(baseUrl: string, model: string) {
    const url = baseUrl.toLowerCase();
    const modelName = model.trim().toLowerCase();
    return url.includes("globalaiopc.com") || url.includes("aizfw.cn") || url.includes("kyyreactapiserver") || ["videos", "videos_stable", "videos_stable_fast"].includes(modelName);
}

function isSeedanceVideoHealthTarget(baseUrl: string, model: string) {
    const url = baseUrl.toLowerCase();
    return url.includes("volces.com") || url.includes("/api/plan/v3") || isSeedanceVideoModelName(model);
}

function isQingyanVideoHealthTarget(baseUrl: string, model: string) {
    return isQingyanProvider({ baseUrl, model });
}

function normalizeGlobalAiOpcHealthDuration(value: unknown) {
    const seconds = Math.floor(Number(value) || 5);
    return Math.max(4, Math.min(15, seconds));
}

function normalizeSeedanceHealthDuration(value: unknown) {
    const seconds = Math.floor(Number(value) || 5);
    return seconds <= 5 ? 5 : 10;
}

function uniquePaths(paths: string[]) {
    return Array.from(new Set(paths));
}

function buildVideoHealthPayloads(basePayload: Record<string, unknown>, withReference = false) {
    const { seconds: _seconds, duration: _duration, ...cleanBasePayload } = basePayload;
    const mediaPayloads: Array<Record<string, unknown>> = withReference
        ? [
              { input_image: { url: VIDEO_HEALTH_REFERENCE_IMAGE } },
              { image_url: { url: VIDEO_HEALTH_REFERENCE_IMAGE } },
              { image: VIDEO_HEALTH_REFERENCE_IMAGE },
              { image: VIDEO_HEALTH_REFERENCE_IMAGE, images: [VIDEO_HEALTH_REFERENCE_IMAGE], ref_assets: [VIDEO_HEALTH_REFERENCE_IMAGE] },
              { image: { url: VIDEO_HEALTH_REFERENCE_IMAGE }, images: [{ url: VIDEO_HEALTH_REFERENCE_IMAGE }], ref_assets: [{ url: VIDEO_HEALTH_REFERENCE_IMAGE }] },
          ]
        : [{}];
    return mediaPayloads.flatMap((mediaPayload) => [
        { ...cleanBasePayload, ...mediaPayload, seconds: "5" },
        { ...cleanBasePayload, ...mediaPayload, duration: 5 },
        { ...cleanBasePayload, ...mediaPayload, seconds: "5", duration: 5 },
    ]);
}

function shouldRetryVideoHealthPayload(status: number, message: string) {
    if (status !== 400 && status !== 422) return false;
    return /duration|seconds|duplicate field|unmarshal|invalid type|resolution|quality|size|field|image|images|input_image|ref_assets/i.test(message);
}

function shouldRetryVideoHealthWithReference(message: string) {
    return /text-to-video|image-to-video|input image|reference image|image is required|requires image|not supported for this model/i.test(message);
}
