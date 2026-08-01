import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings, setSystemChannelHealthResult } from "@/lib/auth/store";
import { channelHealthSnapshot } from "@/lib/channel-health-result";
import { isProviderTimeoutError, resolveAdminChannelCredentials, sanitizeProviderMessage } from "@/lib/server/admin-channel-config";
import { configureServerProxyDispatcher } from "@/lib/server/proxy-dispatcher";
import { isSafeOutboundUrl } from "@/lib/server/security";
import { resolveGlobalAiOpcCatalogPresets, resolveGlobalAiOpcPreset } from "@/lib/globalaiopc-catalog";
import { normalizeModelId } from "@/lib/model-capability";
import type { SystemChannelAdvancedConfig, SystemChannelProtocol } from "@/lib/auth/store";
import { channelProtocolDefinition, protocolModelConfig, resolveChannelAuthMode, resolveChannelModelAdvancedConfig } from "@/lib/channel-protocol-registry";
import { resolveTextProtocol, type ResolvedTextProtocol } from "@/lib/server/text-protocol-resolver";
import { applySelectedProtocolLabel, channelHealthModelConfig, isDeclarativeHealthProtocol, literalChannelHealthUrl, testDeclarativeChannelProtocol, type ChannelHealthResult as HealthResult } from "@/lib/server/channel-health-declarative";
import { apiUrl, textProtocolUrl } from "./channel-health-helpers";
import { testText } from "./channel-health-text";
import { testImage } from "./channel-health-image";
import { testAudio } from "./channel-health-audio";
import { testVideo } from "./channel-health-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

configureServerProxyDispatcher();

type HealthPayload = {
    channelId?: unknown;
    baseUrl?: unknown;
    apiKey?: unknown;
    apiFormat?: unknown;
    model?: unknown;
    kind?: unknown;
    protocol?: unknown;
    globalAiOpcPreset?: unknown;
    globalAiOpcPresets?: unknown;
    createPath?: unknown;
    editPath?: unknown;
    imageToVideoPath?: unknown;
    queryPath?: unknown;
    requestTemplate?: unknown;
    resultField?: unknown;
    statusField?: unknown;
    durationRange?: unknown;
    referenceRule?: unknown;
    supportsReferenceImage?: unknown;
    supportsReferenceVideo?: unknown;
    supportsReferenceAudio?: unknown;
    authMode?: unknown;
    authHeader?: unknown;
    authPrefix?: unknown;
    modelConfig?: unknown;
};

const HEALTH_COOLDOWN_MS = 20_000;
const globalCooldownStore = globalThis as typeof globalThis & { __vozebProChannelHealthCooldowns?: Map<string, number> };
const healthCooldowns = (globalCooldownStore.__vozebProChannelHealthCooldowns ??= new Map<string, number>());

export async function POST(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });

    const [body, settings] = await Promise.all([readJsonBody<HealthPayload>(request), getAuthSettings()]);
    const { baseUrl, apiKey, savedChannel } = resolveAdminChannelCredentials(settings, body);
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const kind = body.kind === "image" || body.kind === "video" || body.kind === "audio" || body.kind === "text" ? body.kind : "";
    if (!baseUrl || !model || !kind) return NextResponse.json({ error: "请填写 Base URL、API Key，并选择要测试的模型" }, { status: 400 });
    const channelAdvanced = {
        ...(savedChannel?.advancedConfig || {}),
        ...(body.protocol !== undefined ? { protocol: body.protocol } : {}),
        ...(body.globalAiOpcPreset !== undefined ? { globalAiOpcPreset: body.globalAiOpcPreset } : {}),
        ...(body.globalAiOpcPresets !== undefined ? { globalAiOpcPresets: body.globalAiOpcPresets } : {}),
        ...(body.createPath !== undefined ? { createPath: body.createPath } : {}),
        ...(body.editPath !== undefined ? { editPath: body.editPath } : {}),
        ...(body.imageToVideoPath !== undefined ? { imageToVideoPath: body.imageToVideoPath } : {}),
        ...(body.queryPath !== undefined ? { queryPath: body.queryPath } : {}),
        ...(body.requestTemplate !== undefined ? { requestTemplate: body.requestTemplate } : {}),
        ...(body.resultField !== undefined ? { resultField: body.resultField } : {}),
        ...(body.statusField !== undefined ? { statusField: body.statusField } : {}),
        ...(body.durationRange !== undefined ? { durationRange: body.durationRange } : {}),
        ...(body.referenceRule !== undefined ? { referenceRule: body.referenceRule } : {}),
        ...(body.supportsReferenceImage !== undefined ? { supportsReferenceImage: body.supportsReferenceImage } : {}),
        ...(body.supportsReferenceVideo !== undefined ? { supportsReferenceVideo: body.supportsReferenceVideo } : {}),
        ...(body.supportsReferenceAudio !== undefined ? { supportsReferenceAudio: body.supportsReferenceAudio } : {}),
        ...(body.authMode !== undefined ? { authMode: body.authMode } : {}),
        ...(body.authHeader !== undefined ? { authHeader: body.authHeader } : {}),
        ...(body.authPrefix !== undefined ? { authPrefix: body.authPrefix } : {}),
    } as SystemChannelAdvancedConfig;
    const requestedModelConfig = channelHealthModelConfig(body.modelConfig) || savedChannel?.advancedConfig?.modelConfigs?.[normalizeModelId(model)] || savedChannel?.advancedConfig?.operationConfigs?.[kind];
    const apiFormat = requestedModelConfig?.apiFormat || (body.apiFormat === "gemini" ? "gemini" : savedChannel?.apiFormat === "gemini" ? "gemini" : "openai");
    const definition = channelProtocolDefinition((requestedModelConfig?.protocol || channelAdvanced.protocol || "auto") as SystemChannelProtocol);
    const requestedProtocol = definition.id;
    channelAdvanced.protocol = requestedProtocol;
    const strictModelConfig = definition.strict ? protocolModelConfig(requestedProtocol, kind) : undefined;
    const modelConfig = strictModelConfig || requestedModelConfig;
    const advancedConfig = resolveChannelModelAdvancedConfig(
        {
            ...channelAdvanced,
            ...(modelConfig
                ? {
                      modelConfigs: { ...(channelAdvanced.modelConfigs || {}), [normalizeModelId(model)]: modelConfig },
                  }
                : {}),
        },
        model,
    )!;
    const protocol = advancedConfig.protocol || requestedProtocol;
    advancedConfig.authMode = resolveChannelAuthMode(advancedConfig);
    if (!apiKey && advancedConfig.authMode !== "none") return NextResponse.json({ error: "请填写 Base URL、API Key，并选择要测试的模型" }, { status: 400 });
    const catalogPresets = resolveGlobalAiOpcCatalogPresets(baseUrl, advancedConfig);
    const globalPreset = resolveGlobalAiOpcPreset({ protocol: "globalaiopc", globalAiOpcPresets: catalogPresets.map((preset) => preset.id) }, model);
    const providerBaseUrl = globalPreset?.baseUrl || baseUrl;
    let textProtocol: ResolvedTextProtocol | undefined;
    try {
        textProtocol = kind === "text" ? resolveTextProtocol({ model, apiFormat, advancedConfig, throughSystemProxy: false }) : undefined;
    } catch (error) {
        const result = { ok: false, kind, model, status: 0, error: error instanceof Error ? error.message : "文本协议配置无效" } satisfies HealthResult;
        await persistHealthResult(savedChannel?.id, result);
        return NextResponse.json({ result });
    }
    const healthUrl = textProtocol
        ? textProtocolUrl(providerBaseUrl, textProtocol, advancedConfig)
        : isDeclarativeHealthProtocol(protocol) && advancedConfig.createPath
          ? literalChannelHealthUrl(providerBaseUrl, advancedConfig.createPath)
          : apiUrl(providerBaseUrl, "/models");
    if (!(await isSafeOutboundUrl(healthUrl))) {
        const result = { ok: false, kind, model, status: 0, error: "Base URL 不允许访问内网或保留地址" } satisfies HealthResult;
        await persistHealthResult(savedChannel?.id, result);
        return NextResponse.json({ result }, { status: 200 });
    }

    const cooldownKey = `${currentUser.id}:${baseUrl.toLowerCase()}:${kind}`;
    const waitMs = (healthCooldowns.get(cooldownKey) || 0) - Date.now();
    if (waitMs > 0) return NextResponse.json({ error: `接口测试过于频繁，请 ${Math.ceil(waitMs / 1000)} 秒后再试` }, { status: 429 });
    healthCooldowns.set(cooldownKey, Date.now() + HEALTH_COOLDOWN_MS);

    try {
        const result = applySelectedProtocolLabel(
            kind === "text"
                ? await testText(providerBaseUrl, apiKey, model, protocol, advancedConfig, textProtocol!)
                : isDeclarativeHealthProtocol(protocol)
                  ? await testDeclarativeChannelProtocol(providerBaseUrl, apiKey, model, kind, protocol, advancedConfig)
                  : kind === "image"
                    ? await testImage(providerBaseUrl, apiKey, model, globalPreset, protocol, advancedConfig)
                    : kind === "audio"
                      ? await testAudio(providerBaseUrl, apiKey, model)
                      : await testVideo(providerBaseUrl, apiKey, model, globalPreset),
            protocol,
        );
        await persistHealthResult(savedChannel?.id, result);
        return NextResponse.json({ result });
    } catch (error) {
        const message = isProviderTimeoutError(error) ? "上游接口请求超时" : sanitizeProviderMessage(error instanceof Error ? error.message : "接口测试失败", [apiKey]);
        const result = { ok: false, kind, model, status: 0, error: message } satisfies HealthResult;
        await persistHealthResult(savedChannel?.id, result);
        return NextResponse.json({ result }, { status: 200 });
    }
}

async function persistHealthResult(channelId: string | undefined, result: HealthResult) {
    if (!channelId) return;
    try {
        await setSystemChannelHealthResult(channelId, channelHealthSnapshot(result));
    } catch (error) {
        console.error("Persisting channel health result failed", { channelId, kind: result.kind, error });
    }
}
