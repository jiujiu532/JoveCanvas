import { isProviderBusinessError } from "@/lib/server/provider-task-config";
import { apiUrl, errorMessage, failed, findStringByKeys, HEALTH_REQUEST_TIMEOUT_MS, jsonHeaders, pointsInfo, readPayload, type HealthResult } from "./channel-health-helpers";

export async function testAudio(baseUrl: string, apiKey: string, model: string): Promise<HealthResult> {
    const response = await fetch(apiUrl(baseUrl, "/audio/speech"), {
        method: "POST",
        headers: jsonHeaders(apiKey),
        body: JSON.stringify({ model, input: "VOZEB PRO audio health check.", voice: "alloy", response_format: "mp3" }),
        cache: "no-store",
        signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return failed("audio", model, response.status, await readPayload(response), apiKey);

    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    let payload: unknown = {};
    let hasAudioBytes = false;
    if (contentType.includes("json")) payload = await readPayload(response);
    else hasAudioBytes = (await response.arrayBuffer()).byteLength > 0;
    const taskId = findStringByKeys(payload, ["task_id", "taskId", "id", "job_id", "jobId", "request_id", "requestId", "uuid", "task_uuid", "taskUuid"]);
    const remoteUrl = findStringByKeys(payload, ["audio_url", "audioUrl", "media_url", "mediaUrl", "output_url", "outputUrl", "result_url", "resultUrl", "url", "uri"]);
    if (isProviderBusinessError(payload) || (!hasAudioBytes && !taskId && !remoteUrl)) return { ok: false, kind: "audio", model, status: response.status, error: errorMessage(payload, "音频接口未返回音频、结果地址或任务 ID") };
    return {
        ok: true,
        kind: "audio",
        model,
        status: response.status,
        protocolKey: "openai",
        protocol: taskId ? "OpenAI 音频异步任务" : "OpenAI 音频兼容",
        createPath: "/audio/speech",
        ...(taskId ? { queryPath: "/audio/speech/:task_id" } : {}),
        requestTemplate: '{"model":"{{model}}","input":"{{prompt}}","voice":"alloy","response_format":"mp3"}',
        resultField: taskId ? "audio_url / result_url / task_id" : "binary audio / audio_url / result_url",
        taskId,
        remoteUrl,
        ...pointsInfo(response.headers),
    };
}
