import type { SystemChannelAdvancedConfig, SystemChannelProtocol } from "@/lib/auth/store";
import { channelProtocolDefinition, protocolAuthHeaders } from "@/lib/channel-protocol-registry";
import { buildProviderRequest, isProviderBusinessError, readProviderString } from "@/lib/server/provider-task-config";
import type { ResolvedTextProtocol } from "@/lib/server/text-protocol-resolver";
import { failed, HEALTH_REQUEST_TIMEOUT_MS, pointsInfo, readPayload, textProtocolUrl, type HealthResult } from "./channel-health-helpers";
import { serverMessage } from "@/lib/server/server-messages";

export async function testText(baseUrl: string, apiKey: string, model: string, channelProtocol: SystemChannelProtocol, advanced: SystemChannelAdvancedConfig, protocol: ResolvedTextProtocol): Promise<HealthResult> {
    const prompt = "Reply exactly OK.";
    const messages = [{ role: "user", content: prompt }];
    const values = { model, prompt, input: prompt, text: prompt, messages };
    const body =
        protocol.kind === "gemini"
            ? { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 8 } }
            : protocol.kind === "claude"
              ? { model, max_tokens: 8, messages }
              : protocol.kind === "responses"
                ? { model, input: prompt }
                : protocol.kind === "custom"
                  ? buildProviderRequest(protocol.requestTemplate!, values, values)
                  : { model, messages, max_tokens: 8 };
    const response = await fetch(textProtocolUrl(baseUrl, protocol, advanced), {
        method: "POST",
        headers: { ...protocolAuthHeaders(apiKey, advanced, protocol.providerKind === "gemini" ? "gemini" : "openai"), "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
    });
    const payload = await readPayload(response);
    if (!response.ok || isProviderBusinessError(payload)) return failed("text", model, response.status, payload, apiKey);
    const resultField =
        protocol.kind === "gemini" ? "candidates[0].content.parts[0].text" : protocol.kind === "claude" ? "content[0].text" : protocol.kind === "responses" ? "output_text" : protocol.kind === "custom" ? protocol.resultField : "choices[0].message.content";
    const content = readProviderString(payload, resultField, ["output_text", "text", "content", "response", "result"]);
    const taskId = readProviderString(payload, undefined, ["task_id", "taskId", "id", "job_id", "jobId", "request_id", "requestId"]);
    if (!content && !taskId) return { ok: false, kind: "text", model, status: response.status, protocolKey: channelProtocol, error: await serverMessage("admin.textSuccessNoContentOrTaskId", { field: resultField || "配置结果字段" }) };
    const definition = channelProtocolDefinition(channelProtocol);
    return {
        ok: true,
        kind: "text",
        model,
        status: response.status,
        protocolKey: channelProtocol,
        protocol: definition.label,
        createPath: protocol.providerPath,
        requestTemplate:
            protocol.kind === "gemini"
                ? '{"contents":[{"role":"user","parts":[{"text":"{{prompt}}"}]}]}'
                : protocol.kind === "claude"
                  ? '{"model":"{{model}}","max_tokens":1024,"messages":[{"role":"user","content":"{{prompt}}"}]}'
                  : protocol.kind === "responses"
                    ? '{"model":"{{model}}","input":"{{prompt}}"}'
                    : protocol.kind === "custom"
                      ? protocol.requestTemplate
                      : '{"model":"{{model}}","messages":[{"role":"user","content":"{{prompt}}"}]}',
        resultField,
        taskId: taskId || undefined,
        ...pointsInfo(response.headers),
    };
}
