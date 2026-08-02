"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import { applyChannelProtocol, channelProtocolDefinition, normalizeStrictProtocolModelConfig } from "@/lib/channel-protocol-registry";

import { formatCreditAmount } from "@/constant/credits";
import { AdminAccountId } from "@/components/admin/admin-user-identity";
import { createDefaultChannelAdvancedConfig } from "@/components/admin/admin-system-channel-editor";
import type { ChannelHealthKind, ChannelHealthResult } from "@/components/admin/admin-system-channel-editor";
import { channelModelCapability } from "@/lib/model-routing-config";
import { normalizeModelId } from "@/lib/model-capability";
import { resolveGlobalAiOpcPreset } from "@/lib/globalaiopc-catalog";
import type { AuthSettings, CreatedCdkCode, PublicCdkCode, SystemChannelAdvancedConfig, SystemChannelModelConfig, SystemModelChannel } from "@/lib/auth/store";

export const settingsStatusToneClass = {
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-950/45 dark:text-cyan-200 dark:ring-cyan-900/40",
    blue: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/45 dark:text-blue-200 dark:ring-blue-900/40",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/45 dark:text-emerald-200 dark:ring-emerald-900/40",
    amber: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/45 dark:text-amber-200 dark:ring-amber-900/40",
};

export function SettingsStatusTile({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: keyof typeof settingsStatusToneClass }) {
    return (
        <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
            <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-medium text-stone-500 sm:text-xs dark:text-stone-400">{label}</div>
                    <div className="mt-1 truncate text-sm font-semibold text-stone-950 sm:mt-2 sm:text-base dark:text-stone-100">{value}</div>
                    <div className="mt-0.5 truncate text-[11px] text-stone-500 sm:mt-1 sm:text-xs dark:text-stone-400">{detail}</div>
                </div>
                <span className={"flex size-7 shrink-0 items-center justify-center rounded-md ring-1 [&>svg]:size-3.5 sm:size-9 sm:rounded-lg sm:[&>svg]:size-4 " + settingsStatusToneClass[tone]}>{icon}</span>
            </div>
        </div>
    );
}

export function SettingsAnchorItem({ href, icon, title, detail }: { href: string; icon: ReactNode; title: string; detail: string }) {
    return (
        <a
            href={href}
            className="group flex min-w-0 items-center gap-1 rounded-md px-2 py-2 text-left transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 sm:gap-3 sm:px-3 sm:py-2.5 dark:hover:bg-zinc-900"
        >
            <span className="flex size-5 shrink-0 items-center justify-center text-zinc-500 transition [&>svg]:size-3 sm:size-8 sm:[&>svg]:size-4 group-hover:text-zinc-950 dark:text-zinc-400 dark:group-hover:text-white">{icon}</span>
            <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-stone-900 sm:text-sm dark:text-stone-100">{title}</span>
                <span className="mt-0.5 hidden truncate text-xs text-stone-500 sm:block dark:text-stone-400">{detail}</span>
            </span>
        </a>
    );
}

export function FinanceFlowItem({ title, amount, description, icon }: { title: string; amount: string; description: string; icon: ReactNode }) {
    return (
        <div className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950 sm:p-4">
            <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div>
                    <div className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">{title}</div>
                    <div className="mt-1 text-lg font-semibold tracking-normal text-stone-950 sm:mt-2 sm:text-2xl dark:text-stone-100">{amount}</div>
                </div>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-700 [&>svg]:size-3.5 sm:size-9 sm:rounded-lg sm:[&>svg]:size-4 dark:bg-stone-900 dark:text-stone-200">{icon}</span>
            </div>
            <div className="mt-2 line-clamp-2 text-xs leading-5 text-stone-500 sm:mt-3 sm:line-clamp-none sm:text-sm sm:leading-6 dark:text-stone-400">{description}</div>
        </div>
    );
}

export function FinanceMiniRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-stone-500 dark:text-stone-400">{label}</span>
            <span className="font-semibold text-stone-950 dark:text-stone-100">{value}</span>
        </div>
    );
}

export function createSystemChannel(name = "新接口"): SystemModelChannel {
    return applyChannelProtocol({ id: nanoid(), name, baseUrl: "", apiKey: "", apiFormat: "openai", models: [], enabled: false, advancedConfig: createDefaultChannelAdvancedConfig() }, "openai");
}

export function suggestedChannelModels(channel: Pick<SystemModelChannel, "baseUrl" | "name">) {
    const source = `${channel.name} ${channel.baseUrl}`.toLowerCase();
    if (source.includes("globalaiopc")) return ["videos", "videos_stable", "videos_stable_fast"];
    if (source.includes("volces.com") || source.includes("/api/plan/v3") || source.includes("seedance")) return ["doubao-seedance-1-0-lite-t2v", "doubao-seedance-1-0-lite-i2v"];
    return [];
}

export function buildAdvancedConfigFromHealth(channel: SystemModelChannel, results: ChannelHealthResult[]): SystemChannelAdvancedConfig {
    const current = channel.advancedConfig || createDefaultChannelAdvancedConfig();
    const text = firstOkResult(results, "text");
    const image = firstOkResult(results, "image");
    const video = firstOkResult(results, "video");
    const protocol = video?.protocolKey || image?.protocolKey || text?.protocolKey || current.protocol || "auto";
    const modelCapabilities = { ...(current.modelCapabilities || {}) };
    const modelConfigs = { ...(current.modelConfigs || {}) };
    results.forEach((result) => {
        if (!result.ok || !result.model) return;
        const key = normalizeModelId(result.model);
        modelCapabilities[key] = result.kind;
        modelConfigs[key] = normalizeStrictProtocolModelConfig(healthModelConfig(result, modelConfigs[key]), protocol);
    });
    return {
        ...current,
        protocol,
        textModel: text?.model || current.textModel,
        imageModel: image?.model || current.imageModel,
        videoModel: video?.model || current.videoModel,
        createPath: video?.createPath || image?.createPath || text?.createPath || current.createPath,
        editPath: image?.editPath || current.editPath,
        imageToVideoPath: video?.imageToVideoPath || current.imageToVideoPath,
        queryPath: video?.queryPath || current.queryPath,
        cancelPath: video?.cancelPath || current.cancelPath,
        cancelMethod: video?.cancelMethod || current.cancelMethod,
        requestTemplate: video?.requestTemplate || image?.requestTemplate || text?.requestTemplate || current.requestTemplate,
        resultField: video?.resultField || image?.resultField || text?.resultField || current.resultField,
        statusField: video?.statusField || current.statusField,
        durationRange: video?.durationRange || current.durationRange,
        referenceRule: video?.referenceRule || video?.referenceHint || image?.referenceRule || image?.referenceHint || current.referenceRule,
        supportsReferenceImage: Boolean(video?.supportsReferenceImage || image?.supportsReferenceImage || current.supportsReferenceImage),
        supportsReferenceVideo: Boolean(video?.supportsReferenceVideo || current.supportsReferenceVideo),
        supportsReferenceAudio: Boolean(video?.supportsReferenceAudio || current.supportsReferenceAudio),
        modelCapabilities,
        modelConfigs,
    };
}

function healthModelConfig(result: ChannelHealthResult, current?: SystemChannelModelConfig): SystemChannelModelConfig {
    return {
        ...(current || {}),
        capability: result.kind,
        source: "health",
        ...(result.protocolKey ? { protocol: result.protocolKey } : {}),
        ...(result.createPath ? { createPath: result.createPath } : {}),
        ...(result.editPath ? { editPath: result.editPath } : {}),
        ...(result.imageToVideoPath ? { imageToVideoPath: result.imageToVideoPath } : {}),
        ...(result.queryPath ? { queryPath: result.queryPath } : {}),
        ...(result.cancelPath ? { cancelPath: result.cancelPath } : {}),
        ...(result.cancelMethod ? { cancelMethod: result.cancelMethod } : {}),
        ...(result.requestTemplate ? { requestTemplate: result.requestTemplate } : {}),
        ...(result.resultField ? { resultField: result.resultField } : {}),
        ...(result.statusField ? { statusField: result.statusField } : {}),
        ...(result.durationRange ? { durationRange: result.durationRange } : {}),
        ...(result.referenceRule || result.referenceHint ? { referenceRule: result.referenceRule || result.referenceHint } : {}),
        ...(typeof result.supportsReferenceImage === "boolean" ? { supportsReferenceImage: result.supportsReferenceImage } : {}),
        ...(typeof result.supportsReferenceVideo === "boolean" ? { supportsReferenceVideo: result.supportsReferenceVideo } : {}),
        ...(typeof result.supportsReferenceAudio === "boolean" ? { supportsReferenceAudio: result.supportsReferenceAudio } : {}),
    };
}

export function firstOkResult(results: ChannelHealthResult[], kind: ChannelHealthKind) {
    return results.find((result) => result.kind === kind && result.ok);
}

export type AdminModelsResult = {
    models: string[];
    modelCapabilities?: SystemChannelAdvancedConfig["modelCapabilities"];
    modelConfigs?: SystemChannelAdvancedConfig["modelConfigs"];
    recommendedConfig?: Partial<SystemChannelAdvancedConfig>;
    discoveredCount?: number;
    totalCount?: number;
    warning?: string;
    globalAiOpcPresets?: SystemChannelAdvancedConfig["globalAiOpcPresets"];
};

export async function requestAdminModels(channel: SystemModelChannel, fallbackError = "拉取模型失败"): Promise<AdminModelsResult> {
    const advanced = channel.advancedConfig;
    const response = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            channelId: channel.id,
            baseUrl: channel.baseUrl,
            apiKey: channel.apiKey,
            apiFormat: channel.apiFormat,
            protocol: advanced?.protocol,
            authMode: advanced?.authMode,
            authHeader: advanced?.authHeader,
            authPrefix: advanced?.authPrefix,
            globalAiOpcPreset: advanced?.globalAiOpcPreset,
            globalAiOpcPresets: advanced?.globalAiOpcPresets,
            createPath: advanced?.createPath,
            modelCatalogPaths: advanced?.modelCatalogPaths,
            configuredModels: channel.models,
            modelCapabilities: advanced?.modelCapabilities,
            modelConfigs: advanced?.modelConfigs,
            operationConfigs: advanced?.operationConfigs,
        }),
    });
    const payload = (await response.json()) as AdminModelsResult & { error?: string };
    if (!response.ok || !payload.models) throw new Error(payload.error || fallbackError);
    return payload;
}

export function selectChannelHealthModel(channel: SystemModelChannel, defaults: AuthSettings["defaultModels"], kind: ChannelHealthKind) {
    if (!channelProtocolDefinition(channel.advancedConfig?.protocol || "auto").capabilities.includes(kind)) return undefined;
    const models = channel.models;
    const configured = kind === "image" ? channel.advancedConfig?.imageModel : kind === "video" ? channel.advancedConfig?.videoModel : kind === "text" ? channel.advancedConfig?.textModel : "";
    const configuredModel = models.find((model) => normalizeModelId(model) === normalizeModelId(configured || ""));
    if (configuredModel && channelModelCapability(channel, configuredModel) === kind) return configuredModel;
    const catalogModel = models.find((model) => channelModelCapability(channel, model) === kind);
    if (catalogModel) return catalogModel;
    const defaultValue = kind === "image" ? defaults.imageModel : kind === "video" ? defaults.videoModel : kind === "audio" ? defaults.audioModel : defaults.textModel;
    const normalizedDefault = modelNameFromOption(defaultValue || "");
    if (normalizedDefault && models.includes(normalizedDefault) && channelModelCapability(channel, normalizedDefault) === kind) return normalizedDefault;
    if (channel.advancedConfig?.protocol === "globalaiopc") return models.find((model) => resolveGlobalAiOpcPreset(channel.advancedConfig, model)?.capability === kind);
    const matcher =
        kind === "image"
            ? /image|img|gpt-image|dall|flux|sd|midjourney/i
            : kind === "video"
              ? /video|vid|i2v|t2v|seedance|kling|sora|veo|grok-imagine/i
              : kind === "audio"
                ? /audio|speech|voice|tts|music|whisper|sensevoice/i
                : /gpt|chat|claude|deepseek|qwen|grok|text|gemini|glm/i;
    return models.find((model) => matcher.test(model) && channelModelCapability(channel, model) === kind);
}

export function modelNameFromOption(value: string) {
    const normalized = value.trim();
    if (!normalized) return "";
    const parts = normalized.split("::");
    return parts[parts.length - 1] || normalized;
}

export function isCdkExpired(code: PublicCdkCode) {
    return Boolean(code.expiresAt && Date.parse(code.expiresAt) <= Date.now());
}

export type CdkStatusLabels = {
    plainMissing: string;
    expired: string;
    unavailable: string;
    exhausted: string;
    partial: string;
    unused: string;
};

const DEFAULT_CDK_STATUS_LABELS: CdkStatusLabels = {
    plainMissing: "明文缺失",
    expired: "已过期",
    unavailable: "不可用",
    exhausted: "已兑完",
    partial: "部分兑换",
    unused: "未兑换",
};

export function cdkStatusLabel(code: PublicCdkCode, labels: CdkStatusLabels = DEFAULT_CDK_STATUS_LABELS) {
    if (!code.code) return labels.plainMissing;
    if (isCdkExpired(code)) return labels.expired;
    if (code.status !== "active") return labels.unavailable;
    if (code.redeemedCount >= code.maxRedemptions) return labels.exhausted;
    return code.redeemedCount > 0 ? labels.partial : labels.unused;
}

export function cdkStatusTone(code: PublicCdkCode) {
    if (!code.code || isCdkExpired(code) || code.status !== "active") return "default";
    if (code.redeemedCount >= code.maxRedemptions) return "green";
    return code.redeemedCount > 0 ? "blue" : "gold";
}

export type CdkExportLabels = {
    title: string;
    exportedAt: string;
    count: string;
    points: string;
    maxRedemptions: string;
    expiry: string;
    longTerm: string;
    note: string;
    footer: string;
};

const DEFAULT_CDK_EXPORT_LABELS: CdkExportLabels = {
    title: "{site} CDK 导出",
    exportedAt: "导出时间：{time}",
    count: "数量：{count}",
    points: "积分：{points}",
    maxRedemptions: "可兑换次数：{count}",
    expiry: "有效期：{value}",
    longTerm: "长期有效",
    note: "备注：{note}",
    footer: "说明：仅导出本次生成且可复制的明文 CDK。",
};

function fillTemplate(template: string, params: Record<string, string | number>) {
    return template.replace(/\{(\w+)\}/g, (matched, name: string) => (name in params ? String(params[name]) : matched));
}

export function formatCreatedCdkExport(codes: CreatedCdkCode[], siteTitle = "JoveCanvas", labels: CdkExportLabels = DEFAULT_CDK_EXPORT_LABELS) {
    const locale = labels.longTerm === DEFAULT_CDK_EXPORT_LABELS.longTerm ? "zh-CN" : undefined;
    const lines = [
        fillTemplate(labels.title, { site: siteTitle }),
        fillTemplate(labels.exportedAt, { time: new Date().toLocaleString(locale, { hour12: false }) }),
        fillTemplate(labels.count, { count: codes.length }),
        "",
        ...codes.map((code, index) =>
            [
                `${index + 1}. ${code.code}`,
                fillTemplate(labels.points, { points: formatCreditAmount(code.points) }),
                fillTemplate(labels.maxRedemptions, { count: code.maxRedemptions }),
                fillTemplate(labels.expiry, {
                    value: code.expiresAt ? new Date(code.expiresAt).toLocaleString(locale, { hour12: false }) : labels.longTerm,
                }),
                code.note ? fillTemplate(labels.note, { note: code.note }) : "",
            ]
                .filter(Boolean)
                .join(" | "),
        ),
        "",
        labels.footer,
    ];
    return lines.join("\n");
}

export function downloadTextFile(filename: string, text: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function CdkRedemptionDetail({ code }: { code: PublicCdkCode }) {
    const t = useTranslations("admin");
    const redemptions = [...code.redemptions].sort((a, b) => Date.parse(b.redeemedAt) - Date.parse(a.redeemedAt));
    const visibleRedemptions = redemptions.slice(0, 20);

    return (
        <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-800 dark:bg-stone-900/60">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("dashboardElements.redemption.title")}</div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                    {redemptions.length > visibleRedemptions.length ? t("dashboardElements.redemption.totalCountTruncated", { count: redemptions.length }) : t("dashboardElements.redemption.totalCount", { count: redemptions.length })}
                </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {visibleRedemptions.map((item) => (
                    <div key={`${item.userId}-${item.redeemedAt}`} className="min-w-0 rounded-md border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950">
                        <div className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                            {item.displayName}
                            <span className="ml-1 font-normal text-stone-500 dark:text-stone-400">@{item.username}</span>
                        </div>
                        <AdminAccountId accountId={item.accountId} className="mt-0.5" />
                        <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{new Date(item.redeemedAt).toLocaleString()}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function splitTags(value?: string) {
    return (value || "")
        .split(/[,，\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
}

export function clampInteger(value: unknown, min: number, max: number, fallback: number) {
    const numberValue = Math.floor(Number(value));
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(min, Math.min(max, numberValue));
}
