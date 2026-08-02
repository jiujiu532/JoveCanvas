import { NextResponse } from "next/server";

import { AGNES_RECOMMENDED_CONFIG, isAgnesApiBaseUrl } from "@/lib/agnes-model-catalog";
import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings } from "@/lib/auth/store";
import { buildGlobalAiOpcSelection, getGlobalAiOpcPresetForModel, isGlobalAiOpcBaseUrl, resolveGlobalAiOpcCatalogPresets } from "@/lib/globalaiopc-catalog";
import { inferModelCapability, normalizeModelId } from "@/lib/model-capability";
import { isProviderTimeoutError, resolveAdminChannelCredentials, sanitizeProviderMessage } from "@/lib/server/admin-channel-config";
import {
    buildModelCatalogUrls,
    configuredModelCatalog,
    isModelCatalogUnsupported,
    mergeModelCatalogEntries,
    mergeModelConfigs,
    modelConfigsFromOperations,
    modelCapabilitiesRecord,
    nextModelsPageUrl,
    normalizeModelConfigs,
    officialModelCatalog,
    officialModelConfigs,
    parseModelCatalog,
    parseModelConfigs,
} from "@/lib/server/admin-model-catalog";
import { isProviderBusinessError, readProviderError } from "@/lib/server/provider-task-config";
import { configureServerProxyDispatcher } from "@/lib/server/proxy-dispatcher";
import { isSafeOutboundUrl } from "@/lib/server/security";
import { channelProtocolDefinition, protocolAuthHeaders, protocolModelConfig, resolveChannelAuthMode } from "@/lib/channel-protocol-registry";
import type { SystemChannelAdvancedConfig, SystemChannelProtocol } from "@/lib/auth/store";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

configureServerProxyDispatcher();

type ModelsPayload = {
    channelId?: unknown;
    baseUrl?: unknown;
    apiKey?: unknown;
    apiFormat?: unknown;
    protocol?: unknown;
    authMode?: unknown;
    authHeader?: unknown;
    authPrefix?: unknown;
    globalAiOpcPreset?: unknown;
    globalAiOpcPresets?: unknown;
    createPath?: unknown;
    modelCatalogPaths?: unknown;
    configuredModels?: unknown;
    modelCapabilities?: unknown;
    modelConfigs?: unknown;
    operationConfigs?: unknown;
};

type ModelsResponse = Record<string, unknown> & {
    error?: { message?: string };
    msg?: string;
};

const MODEL_FETCH_COOLDOWN_MS = 30_000;
const MODEL_FETCH_TIMEOUT_MS = 60_000;
const MODEL_FETCH_MAX_PAGES = 20;
const globalCooldownStore = globalThis as typeof globalThis & { __vozebProModelFetchCooldowns?: Map<string, number> };
const modelFetchCooldowns = (globalCooldownStore.__vozebProModelFetchCooldowns ??= new Map<string, number>());

export async function POST(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    const [body, settings] = await Promise.all([readJsonBody<ModelsPayload>(request), getAuthSettings()]);
    const { baseUrl, apiKey, apiFormat, savedChannel } = resolveAdminChannelCredentials(settings, body);
    if (!baseUrl) return NextResponse.json({ error: await serverMessage("admin.fillBaseUrlAndKey") }, { status: 400 });

    const advancedConfig = {
        ...(savedChannel?.advancedConfig || {}),
        ...(body.protocol !== undefined ? { protocol: body.protocol } : {}),
        ...(body.authMode !== undefined ? { authMode: body.authMode } : {}),
        ...(body.authHeader !== undefined ? { authHeader: body.authHeader } : {}),
        ...(body.authPrefix !== undefined ? { authPrefix: body.authPrefix } : {}),
        ...(body.globalAiOpcPreset !== undefined ? { globalAiOpcPreset: body.globalAiOpcPreset } : {}),
        ...(body.globalAiOpcPresets !== undefined ? { globalAiOpcPresets: body.globalAiOpcPresets } : {}),
        ...(body.createPath !== undefined ? { createPath: body.createPath } : {}),
    } as SystemChannelAdvancedConfig;
    const configuredModels = body.configuredModels !== undefined ? body.configuredModels : savedChannel?.models;
    const configuredCapabilities = body.modelCapabilities !== undefined ? body.modelCapabilities : savedChannel?.advancedConfig?.modelCapabilities;
    const configuredCatalog = configuredModelCatalog(configuredModels, configuredCapabilities);
    const configuredConfigs = normalizeModelConfigs(body.modelConfigs !== undefined ? body.modelConfigs : savedChannel?.advancedConfig?.modelConfigs);
    const operationConfigs = body.operationConfigs !== undefined ? body.operationConfigs : savedChannel?.advancedConfig?.operationConfigs;
    const protocol = (typeof body.protocol === "string" ? body.protocol : advancedConfig.protocol || "auto") as SystemChannelProtocol;
    const protocolDefinition = channelProtocolDefinition(protocol);
    advancedConfig.protocol = protocolDefinition.id;
    advancedConfig.authMode = resolveChannelAuthMode(advancedConfig);
    if (!apiKey && advancedConfig.authMode !== "none") return NextResponse.json({ error: await serverMessage("admin.fillBaseUrlAndKey") }, { status: 400 });

    if (protocolDefinition.builtInModels?.length) {
        const builtInCatalog = protocolDefinition.builtInModels.map(({ id, capability }) => ({ id, capability, source: "official" as const }));
        const merged = mergeModelCatalogEntries(configuredCatalog, builtInCatalog);
        const builtInConfigs = Object.fromEntries(
            protocolDefinition.builtInModels.flatMap(({ id, capability }) => {
                const config = protocolModelConfig(protocol, capability);
                return config ? [[normalizeModelId(id), config] as const] : [];
            }),
        );
        const modelConfigs = mergeModelConfigs(merged, configuredConfigs, modelConfigsFromOperations(merged, operationConfigs), builtInConfigs);
        return NextResponse.json({
            models: merged.map((entry) => entry.id),
            modelCapabilities: modelCapabilitiesRecord(merged, modelConfigs),
            modelConfigs,
            discoveredCount: builtInCatalog.length,
            totalCount: merged.length,
            catalogSupported: false,
            provider: protocol,
        });
    }

    const globalAiOpcPresets = resolveGlobalAiOpcCatalogPresets(baseUrl, advancedConfig);
    if (globalAiOpcPresets.length) {
        const selection = buildGlobalAiOpcSelection(globalAiOpcPresets.map((preset) => preset.id));
        const discovered = selection.models.map((id) => ({ id, capability: getGlobalAiOpcPresetForModel(id)?.capability || inferModelCapability(id), source: "official" as const }));
        const merged = mergeModelCatalogEntries(configuredCatalog, discovered);
        const modelConfigs = mergeModelConfigs(merged, configuredConfigs, modelConfigsFromOperations(merged, operationConfigs));
        return NextResponse.json({
            models: merged.map((entry) => entry.id),
            modelCapabilities: modelCapabilitiesRecord(merged, modelConfigs),
            modelConfigs,
            discoveredCount: discovered.length,
            totalCount: merged.length,
            globalAiOpcPresets: selection.presetIds,
        });
    }
    if (advancedConfig.protocol === "globalaiopc" || isGlobalAiOpcBaseUrl(baseUrl)) return NextResponse.json({ error: await serverMessage("admin.globalAiOpcScopeUnrecognized") }, { status: 400 });

    const modelCatalogUrls = buildModelCatalogUrls(baseUrl, apiFormat, body.modelCatalogPaths ?? savedChannel?.advancedConfig?.modelCatalogPaths ?? protocolDefinition.modelCatalogPaths);
    if (!modelCatalogUrls.length || !(await Promise.all(modelCatalogUrls.map((url) => isSafeOutboundUrl(url)))).every(Boolean)) return NextResponse.json({ error: await serverMessage("admin.modelCatalogUrlBlocked") }, { status: 400 });

    const cooldownKey = `${currentUser.id}:${baseUrl.toLowerCase()}`;
    const waitMs = (modelFetchCooldowns.get(cooldownKey) || 0) - Date.now();
    if (waitMs > 0) return NextResponse.json({ error: await serverMessage("common.rateLimitedWithSeconds", { feature: await serverMessage("features.pullModels"), seconds: Math.ceil(waitMs / 1000) }) }, { status: 429 });
    modelFetchCooldowns.set(cooldownKey, Date.now() + MODEL_FETCH_COOLDOWN_MS);

    try {
        const providerCatalog = [] as ReturnType<typeof parseModelCatalog>;
        let providerConfigs = {} as ReturnType<typeof parseModelConfigs>;
        let catalogSucceeded = false;
        const visited = new Set<string>();

        for (const catalogUrl of modelCatalogUrls) {
            let nextUrl = catalogUrl;
            for (let page = 0; nextUrl && page < MODEL_FETCH_MAX_PAGES && !visited.has(nextUrl); page += 1) {
                visited.add(nextUrl);
                if (!(await isSafeOutboundUrl(nextUrl))) throw new Error("模型分页地址不允许访问内网或保留地址");
                const response = await fetch(nextUrl, {
                    headers: protocolAuthHeaders(apiKey, advancedConfig, apiFormat),
                    cache: "no-store",
                    signal: AbortSignal.timeout(MODEL_FETCH_TIMEOUT_MS),
                });
                const payload = (await response.json().catch(() => ({}))) as ModelsResponse;
                if (!response.ok || isProviderBusinessError(payload)) {
                    if (isModelCatalogUnsupported(response.status, payload) || [404, 405, 501].includes(response.status)) break;
                    modelFetchCooldowns.delete(cooldownKey);
                    const providerMessage = readProviderError(payload) || payload.msg || payload.error?.message || (await serverMessage("admin.pullModelsFailed"));
                    return NextResponse.json({ error: sanitizeProviderMessage(providerMessage, [apiKey]) }, { status: 502 });
                }
                catalogSucceeded = true;
                const pageCatalog = parseModelCatalog(payload);
                providerCatalog.splice(0, providerCatalog.length, ...mergeModelCatalogEntries(providerCatalog, pageCatalog));
                providerConfigs = { ...providerConfigs, ...parseModelConfigs(payload) };
                nextUrl = nextModelsPageUrl(nextUrl, payload, apiFormat, pageCatalog.at(-1)?.id || providerCatalog.at(-1)?.id || "");
            }
        }

        const officialCatalog = officialModelCatalog(baseUrl);
        const discovered = mergeModelCatalogEntries(providerCatalog, officialCatalog);
        const merged = mergeModelCatalogEntries(configuredCatalog, providerCatalog, officialCatalog);
        if (!merged.length) {
            modelFetchCooldowns.delete(cooldownKey);
            if (!catalogSucceeded) return NextResponse.json({ error: await serverMessage("admin.noModelListEndpointKeepManual") }, { status: 422 });
            return NextResponse.json({ error: await serverMessage("admin.modelListEmpty") }, { status: 502 });
        }

        const agnes = isAgnesApiBaseUrl(baseUrl);
        const strictConfigs = Object.fromEntries(
            merged.flatMap((entry) => {
                if (!protocolDefinition.strict) return [];
                const configuredProtocol = configuredConfigs[normalizeModelId(entry.id)]?.protocol;
                if (configuredProtocol && configuredProtocol !== protocol) return [];
                const config = protocolModelConfig(protocol, entry.capability);
                return config ? [[normalizeModelId(entry.id), config] as const] : [];
            }),
        );
        const modelConfigs = mergeModelConfigs(merged, configuredConfigs, modelConfigsFromOperations(merged, operationConfigs), providerConfigs, officialModelConfigs(baseUrl), strictConfigs);
        return NextResponse.json({
            models: merged.map((entry) => entry.id),
            modelCapabilities: modelCapabilitiesRecord(merged, modelConfigs),
            modelConfigs,
            discoveredCount: discovered.length,
            totalCount: merged.length,
            catalogSupported: catalogSucceeded,
            ...(!catalogSucceeded ? { warning: await serverMessage("admin.modelCatalogNotPublic") } : {}),
            ...(agnes ? { provider: "agnes", recommendedConfig: AGNES_RECOMMENDED_CONFIG } : {}),
        });
    } catch (error) {
        modelFetchCooldowns.delete(cooldownKey);
        console.error("Admin model fetch failed", sanitizeProviderMessage(error, [apiKey]));
        return NextResponse.json(
            {
                error: isProviderTimeoutError(error) ? await serverMessage("admin.pullModelsTimeout") : await serverMessage("admin.pullModelsFailed"),
            },
            { status: 502 },
        );
    }
}
