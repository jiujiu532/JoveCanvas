"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { App, Button, Checkbox, Input, Popconfirm, Select, Switch, Tag, Tooltip } from "antd";
import { Eye, EyeOff, PlugZap, RefreshCw, Sparkles, Trash2 } from "lucide-react";

import { LabeledControl } from "@/components/admin/admin-settings-controls";
import { formatCreditAmount } from "@/constant/credits";
import { parseChannelExampleConfig } from "@/lib/channel-example-parser";
import { buildGlobalAiOpcSelection, GLOBAL_AIOPC_PRESETS, globalAiOpcPresetOptions, resolveGlobalAiOpcCatalogPresets, resolveGlobalAiOpcPresets } from "@/lib/globalaiopc-catalog";
import type { SystemChannelAdvancedConfig, SystemChannelProtocol, SystemModelChannel } from "@/lib/auth/store";
import { revealAdminChannelApiKey } from "@/services/api/admin-settings";

export type ChannelHealthKind = "text" | "image" | "video" | "audio";

export type ChannelHealthResult = {
    ok: boolean;
    kind: ChannelHealthKind;
    model: string;
    status: number;
    protocolKey?: SystemChannelProtocol;
    protocol?: string;
    referenceHint?: string;
    createPath?: string;
    queryPath?: string;
    requestTemplate?: string;
    resultField?: string;
    statusField?: string;
    durationRange?: string;
    referenceRule?: string;
    supportsReferenceImage?: boolean;
    supportsReferenceVideo?: boolean;
    supportsReferenceAudio?: boolean;
    pointsCost?: number;
    pointsRemaining?: number;
    taskId?: string;
    remoteUrl?: string;
    error?: string;
};

function channelProtocolOptions(t: ReturnType<typeof useTranslations<"admin">>): Array<{ value: SystemChannelProtocol; label: string }> {
    return [
        { value: "auto", label: t("channelEditor.protocols.auto") },
        { value: "openai", label: "OpenAI" },
        { value: "sub2api", label: "sub2api" },
        { value: "qingyan", label: t("channelEditor.protocols.qingyan") },
        { value: "globalaiopc", label: "GlobalAiOpc" },
        { value: "seedance", label: "Seedance" },
        { value: "compatible", label: t("channelEditor.protocols.compatible") },
    ];
}
const ALL_GLOBAL_AIOPC_PRESETS = "__all_globalaiopc_presets__";

export function createDefaultChannelAdvancedConfig(): SystemChannelAdvancedConfig {
    return {
        protocol: "auto",
        textModel: "",
        imageModel: "",
        videoModel: "",
        createPath: "",
        queryPath: "",
        requestTemplate: "",
        resultField: "",
        statusField: "",
        durationRange: "",
        referenceRule: "",
        supportsReferenceImage: false,
        supportsReferenceVideo: false,
        supportsReferenceAudio: false,
    };
}

export function SystemChannelEditor({
    channel,
    fetching,
    testingKey,
    healthResults,
    onChange,
    onDelete,
    onFetchModels,
    onTestHealth,
    onTestAllHealth,
}: {
    channel: SystemModelChannel;
    fetching: boolean;
    testingKey: string;
    healthResults: Record<string, ChannelHealthResult>;
    onChange: (patch: Partial<SystemModelChannel>) => void;
    onDelete: () => void;
    onFetchModels: () => void;
    onTestHealth: (kind: ChannelHealthKind) => void;
    onTestAllHealth: () => void;
}) {
    const t = useTranslations("admin");
    const { message } = App.useApp();
    const [exampleText, setExampleText] = useState("");
    const [revealedApiKey, setRevealedApiKey] = useState("");
    const [apiKeyVisible, setApiKeyVisible] = useState(false);
    const [apiKeyLoading, setApiKeyLoading] = useState(false);
    const healthKinds: ChannelHealthKind[] = ["text", "image", "video", "audio"];
    const visibleHealthResults = healthKinds.map((kind) => healthResults[`${channel.id}:${kind}`]).filter((item): item is ChannelHealthResult => Boolean(item));
    const advanced = channel.advancedConfig || createDefaultChannelAdvancedConfig();
    const selectedGlobalPresets = resolveGlobalAiOpcPresets(advanced);
    const multipleGlobalPresets = advanced.protocol === "globalaiopc" && selectedGlobalPresets.length > 1;
    const updateAdvanced = (patch: Partial<SystemChannelAdvancedConfig>) => onChange({ advancedConfig: { ...advanced, ...patch } });
    const applyGlobalAiOpcPresets = (values: string[]) => {
        const requested = values.includes(ALL_GLOBAL_AIOPC_PRESETS)
            ? (resolveGlobalAiOpcCatalogPresets(channel.baseUrl, { protocol: "auto" }).length ? resolveGlobalAiOpcCatalogPresets(channel.baseUrl, { protocol: "auto" }) : GLOBAL_AIOPC_PRESETS).map((preset) => preset.id)
            : values;
        const selection = buildGlobalAiOpcSelection(requested);
        if (!selection.presetIds.length) return updateAdvanced({ globalAiOpcPreset: undefined, globalAiOpcPresets: [] });
        const onlyPreset = selection.presetIds.length === 1;
        const preset = onlyPreset ? GLOBAL_AIOPC_PRESETS.find((item) => item.id === selection.presetIds[0]) : undefined;
        onChange({
            baseUrl: selection.baseUrl || channel.baseUrl,
            apiFormat: selection.apiFormat,
            models: selection.models,
            advancedConfig: {
                ...advanced,
                protocol: "globalaiopc",
                globalAiOpcPreset: onlyPreset ? selection.presetIds[0] : undefined,
                globalAiOpcPresets: selection.presetIds,
                textModel: selection.textModel,
                imageModel: selection.imageModel,
                videoModel: selection.videoModel,
                createPath: selection.createPath,
                queryPath: selection.queryPath,
                requestTemplate: "",
                resultField: preset?.capability === "image" ? "data[0].url / url / image_url" : preset?.capability === "video" ? "video_url / media_url / result_url / url" : "",
                statusField: preset?.capability === "text" ? "" : "status / state",
                durationRange: selection.durationRange,
                referenceRule: selection.supportsReferenceImage || selection.supportsReferenceVideo || selection.supportsReferenceAudio ? t("channelEditor.publicReferenceRule") : "",
                supportsReferenceImage: selection.supportsReferenceImage,
                supportsReferenceVideo: selection.supportsReferenceVideo,
                supportsReferenceAudio: selection.supportsReferenceAudio,
            },
        });
    };
    const applyExampleConfig = () => {
        const parsed = parseChannelExampleConfig(exampleText, channel, advanced);
        if (!parsed) {
            message.error(t("channelEditor.pasteExampleRequired"));
            return;
        }
        onChange(parsed.patch);
        message.success(t("channelEditor.exampleApplied", { summary: parsed.summary.slice(0, 4).join(", ") }));
    };
    const hideApiKey = () => {
        setApiKeyVisible(false);
        setRevealedApiKey("");
    };
    const toggleApiKey = async () => {
        if (apiKeyVisible) {
            hideApiKey();
            return;
        }
        if (channel.apiKey) {
            setApiKeyVisible(true);
            return;
        }
        if (!channel.hasApiKey) return;

        setApiKeyLoading(true);
        try {
            setRevealedApiKey(await revealAdminChannelApiKey(channel.id));
            setApiKeyVisible(true);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("channelEditor.revealApiKeyFailed"));
        } finally {
            setApiKeyLoading(false);
        }
    };
    const clearApiKey = () => {
        hideApiKey();
        onChange({ apiKey: "", hasApiKey: false, clearApiKey: true });
    };
    const displayedApiKey = channel.apiKey || revealedApiKey;
    return (
        <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm shadow-stone-200/40 sm:p-4 dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/20">
            <div className="flex items-start justify-between gap-2 sm:flex-col sm:gap-3 lg:flex-row lg:justify-between">
                <div className="min-w-0 flex-1 sm:flex-initial">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-stone-950 dark:text-stone-100">
                            <PlugZap className="size-4 text-stone-400" />
                            <span className="truncate">{channel.name || t("channelEditor.unnamedChannel")}</span>
                        </div>
                        <Tag color={channel.enabled ? "green" : "default"} className="m-0">
                            {channel.enabled ? t("channelEditor.enabled") : t("channelEditor.disabled")}
                        </Tag>
                        <Tag className="m-0">{t("channelEditor.modelCount", { count: channel.models.length })}</Tag>
                    </div>
                    <div className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">{channel.baseUrl || t("channelEditor.baseUrlMissing")}</div>
                    <div className="mt-1 text-xs text-stone-400 dark:text-stone-500">{t("channelEditor.beginnerHint")}</div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:w-full sm:justify-start sm:gap-2 lg:w-auto lg:justify-end">
                    <Button type="primary" size="small" aria-label={t("channelEditor.detectAll")} title={t("channelEditor.detectAll")} icon={<RefreshCw className="size-3.5" />} loading={testingKey === `${channel.id}:all`} onClick={onTestAllHealth}>
                        <span className="hidden sm:inline">{t("channelEditor.detectAll")}</span>
                    </Button>
                    <Switch checkedChildren={t("channelEditor.enabled")} unCheckedChildren={t("channelEditor.disabled")} checked={channel.enabled} onChange={(enabled) => onChange({ enabled })} />
                    <Popconfirm title={t("channelEditor.deleteConfirmTitle")} description={t("channelEditor.deleteConfirmDesc")} okText={t("channelEditor.delete")} cancelText={t("channelEditor.cancel")} onConfirm={onDelete}>
                        <Button size="small" danger icon={<Trash2 className="size-3.5" />} aria-label={t("channelEditor.deleteChannelAria")} title={t("channelEditor.deleteChannelAria")} />
                    </Popconfirm>
                </div>
            </div>
            <div className="mt-3 grid gap-3 sm:mt-4 lg:grid-cols-[180px_minmax(0,1fr)_minmax(220px,0.8fr)]">
                <LabeledControl label={t("channelEditor.channelName")}>
                    <Input value={channel.name} placeholder={t("channelEditor.channelNamePlaceholder")} onChange={(event) => onChange({ name: event.target.value })} />
                </LabeledControl>
                <LabeledControl label="Base URL">
                    <Input value={channel.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => onChange({ baseUrl: event.target.value })} />
                </LabeledControl>
                <LabeledControl label="API Key">
                    <div className="flex min-w-0 items-center gap-2">
                        <Input
                            type={apiKeyVisible ? "text" : "password"}
                            value={displayedApiKey}
                            placeholder={channel.hasApiKey ? t("channelEditor.apiKeySavedPlaceholder") : "sk-..."}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(event) => {
                                setRevealedApiKey(event.target.value);
                                onChange({ apiKey: event.target.value, clearApiKey: false });
                            }}
                            suffix={
                                <Tooltip title={apiKeyVisible ? t("channelEditor.hideApiKey") : t("channelEditor.showApiKey")}>
                                    <Button
                                        type="text"
                                        size="small"
                                        loading={apiKeyLoading}
                                        disabled={!displayedApiKey && !channel.hasApiKey}
                                        icon={apiKeyVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                        aria-label={apiKeyVisible ? t("channelEditor.hideApiKey") : t("channelEditor.showApiKey")}
                                        onClick={() => void toggleApiKey()}
                                    />
                                </Tooltip>
                            }
                        />
                        {channel.hasApiKey ? (
                            <Popconfirm title={t("channelEditor.clearApiKeyTitle")} okText={t("channelEditor.clear")} cancelText={t("channelEditor.cancel")} onConfirm={clearApiKey}>
                                <Button size="small" danger className="shrink-0">
                                    {t("channelEditor.clear")}
                                </Button>
                            </Popconfirm>
                        ) : null}
                    </div>
                </LabeledControl>
            </div>
            <ChannelCapabilitySummary channel={channel} results={visibleHealthResults} t={t} />
            {visibleHealthResults.length ? (
                <div className="mt-3 space-y-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                    {visibleHealthResults.map((result) => (
                        <ChannelHealthResultRow key={`${result.kind}:${result.model}`} result={result} t={t} />
                    ))}
                </div>
            ) : null}
            <details className="mt-3 rounded-lg border border-stone-200 bg-stone-50/70 dark:border-stone-800 dark:bg-stone-900/40">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-stone-800 dark:text-stone-100">{t("channelEditor.advanced")}</summary>
                <div className="grid gap-3 border-t border-stone-200 p-3 md:grid-cols-2 dark:border-stone-800">
                    <div className="md:col-span-2 rounded-lg border border-dashed border-stone-300 bg-white/70 p-3 dark:border-stone-700 dark:bg-stone-950/50">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="text-sm font-semibold text-stone-800 dark:text-stone-100">{t("channelEditor.exampleTitle")}</div>
                                <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("channelEditor.exampleDesc")}</div>
                            </div>
                            <Button size="small" icon={<Sparkles className="size-3.5" />} onClick={applyExampleConfig}>
                                {t("channelEditor.applyExample")}
                            </Button>
                        </div>
                        <Input.TextArea className="mt-3" value={exampleText} rows={5} placeholder={t("channelEditor.examplePlaceholder")} onChange={(event) => setExampleText(event.target.value)} />
                    </div>
                    <LabeledControl label={t("channelEditor.protocol")}>
                        <Select className="w-full" value={advanced.protocol} options={channelProtocolOptions(t)} onChange={(protocol: SystemChannelProtocol) => updateAdvanced({ protocol })} />
                    </LabeledControl>
                    {advanced.protocol === "globalaiopc" ? (
                        <LabeledControl label={t("channelEditor.globalScope")}>
                            <Select
                                allowClear
                                className="w-full"
                                mode="multiple"
                                maxTagCount={1}
                                maxTagPlaceholder={(omitted) => t("channelEditor.moreEndpoints", { count: omitted.length })}
                                placeholder={t("channelEditor.selectScope")}
                                value={selectedGlobalPresets.map((preset) => preset.id)}
                                options={[
                                    { label: t("channelEditor.quickSelect"), options: [{ value: ALL_GLOBAL_AIOPC_PRESETS, label: t("channelEditor.allEndpoints") }] },
                                    { label: t("channelEditor.kinds.text"), options: globalAiOpcPresetOptions().filter((item) => item.capability === "text") },
                                    { label: t("channelEditor.kinds.image"), options: globalAiOpcPresetOptions().filter((item) => item.capability === "image") },
                                    { label: t("channelEditor.kinds.video"), options: globalAiOpcPresetOptions().filter((item) => item.capability === "video") },
                                ]}
                                onChange={applyGlobalAiOpcPresets}
                            />
                        </LabeledControl>
                    ) : null}
                    <LabeledControl label={t("channelEditor.models")}>
                        <Select className="w-full" mode="tags" maxTagCount="responsive" value={channel.models} placeholder={t("channelEditor.modelsPlaceholder")} onChange={(models) => onChange({ models })} />
                    </LabeledControl>
                    <LabeledControl label={t("channelEditor.textModel")}>
                        <Input value={advanced.textModel} placeholder={t("channelEditor.autoFillPlaceholder")} onChange={(event) => updateAdvanced({ textModel: event.target.value })} />
                    </LabeledControl>
                    <LabeledControl label={t("channelEditor.imageModel")}>
                        <Input value={advanced.imageModel} placeholder={t("channelEditor.autoFillPlaceholder")} onChange={(event) => updateAdvanced({ imageModel: event.target.value })} />
                    </LabeledControl>
                    <LabeledControl label={t("channelEditor.videoModel")}>
                        <Input value={advanced.videoModel} placeholder={t("channelEditor.autoFillPlaceholder")} onChange={(event) => updateAdvanced({ videoModel: event.target.value })} />
                    </LabeledControl>
                    <LabeledControl label={t("channelEditor.duration")}>
                        <Input
                            disabled={multipleGlobalPresets}
                            value={advanced.durationRange}
                            placeholder={multipleGlobalPresets ? t("channelEditor.autoByModel") : t("channelEditor.durationPlaceholder")}
                            onChange={(event) => updateAdvanced({ durationRange: event.target.value })}
                        />
                    </LabeledControl>
                    <LabeledControl label={t("channelEditor.createPath")}>
                        <Input
                            disabled={multipleGlobalPresets}
                            value={advanced.createPath}
                            placeholder={multipleGlobalPresets ? t("channelEditor.autoRoute") : "/video/generations"}
                            onChange={(event) => updateAdvanced({ createPath: event.target.value })}
                        />
                    </LabeledControl>
                    <LabeledControl label={t("channelEditor.queryPath")}>
                        <Input
                            disabled={multipleGlobalPresets}
                            value={advanced.queryPath}
                            placeholder={multipleGlobalPresets ? t("channelEditor.autoRoute") : "/video/generations/:task_id"}
                            onChange={(event) => updateAdvanced({ queryPath: event.target.value })}
                        />
                    </LabeledControl>
                    <LabeledControl label={t("channelEditor.resultField")}>
                        <Input value={advanced.resultField} placeholder={t("channelEditor.resultFieldPlaceholder")} onChange={(event) => updateAdvanced({ resultField: event.target.value })} />
                    </LabeledControl>
                    <LabeledControl label={t("channelEditor.statusField")}>
                        <Input value={advanced.statusField} placeholder={t("channelEditor.statusFieldPlaceholder")} onChange={(event) => updateAdvanced({ statusField: event.target.value })} />
                    </LabeledControl>
                    <div className="md:col-span-2">
                        <LabeledControl label={t("channelEditor.requestTemplate")}>
                            <Input.TextArea value={advanced.requestTemplate} rows={3} placeholder='{"model":"{{model}}","prompt":"{{prompt}}"}' onChange={(event) => updateAdvanced({ requestTemplate: event.target.value })} />
                        </LabeledControl>
                    </div>
                    <div className="md:col-span-2">
                        <LabeledControl label={t("channelEditor.referenceRule")}>
                            <Input.TextArea value={advanced.referenceRule} rows={3} placeholder={t("channelEditor.referenceRulePlaceholder")} onChange={(event) => updateAdvanced({ referenceRule: event.target.value })} />
                        </LabeledControl>
                    </div>
                    <div className="md:col-span-2">
                        <div className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">{t("channelEditor.referenceCapability")}</div>
                        <div className="flex flex-wrap gap-4">
                            <Checkbox checked={advanced.supportsReferenceImage} onChange={(event) => updateAdvanced({ supportsReferenceImage: event.target.checked })}>
                                {t("channelEditor.supportRefImage")}
                            </Checkbox>
                            <Checkbox checked={advanced.supportsReferenceVideo} onChange={(event) => updateAdvanced({ supportsReferenceVideo: event.target.checked })}>
                                {t("channelEditor.supportRefVideo")}
                            </Checkbox>
                            <Checkbox checked={advanced.supportsReferenceAudio} onChange={(event) => updateAdvanced({ supportsReferenceAudio: event.target.checked })}>
                                {t("channelEditor.supportRefAudio")}
                            </Checkbox>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                        <Button size="small" icon={<RefreshCw className="size-3.5" />} loading={fetching} onClick={onFetchModels}>
                            {t("channelEditor.fetchModels")}
                        </Button>
                        {healthKinds.map((kind) => (
                            <Button key={kind} size="small" loading={testingKey === `${channel.id}:${kind}`} onClick={() => onTestHealth(kind)}>
                                {t("channelEditor.testKind", { kind: healthKindLabel(kind, t) })}
                            </Button>
                        ))}
                    </div>
                    <div className="text-xs leading-5 text-stone-500 md:col-span-2 dark:text-stone-400">{t("channelEditor.detectHint")}</div>
                </div>
            </details>
        </div>
    );
}

function ChannelCapabilitySummary({ channel, results, t }: { channel: SystemModelChannel; results: ChannelHealthResult[]; t: ReturnType<typeof useTranslations<"admin">> }) {
    const advanced = channel.advancedConfig || createDefaultChannelAdvancedConfig();
    const textResult = results.find((result) => result.kind === "text");
    const image = results.find((result) => result.kind === "image");
    const video = results.find((result) => result.kind === "video");
    const audio = results.find((result) => result.kind === "audio");
    const needsPublicReference = /\u516c\u7f51|public|localhost|NEXT_PUBLIC_SITE_URL/i.test(advanced.referenceRule || video?.referenceHint || "");
    const items = [
        { label: t("channelEditor.caps.text"), value: healthStateText(textResult, t), tone: healthStateTone(textResult) },
        { label: t("channelEditor.caps.genImage"), value: healthStateText(image, t), tone: healthStateTone(image) },
        { label: t("channelEditor.caps.imageToImage"), value: referenceImageText(image, advanced, needsPublicReference, t), tone: referenceImageTone(image, advanced) },
        { label: t("channelEditor.caps.video"), value: healthStateText(video, t), tone: healthStateTone(video) },
        { label: t("channelEditor.caps.audio"), value: healthStateText(audio, t), tone: healthStateTone(audio) },
        { label: t("channelEditor.caps.imageToVideo"), value: referenceVideoText(video, advanced, needsPublicReference, t), tone: referenceImageTone(video, advanced) },
        { label: t("channelEditor.caps.refVideoAudio"), value: referenceMediaText(video, advanced, t), tone: advanced.supportsReferenceVideo || advanced.supportsReferenceAudio ? "green" : video?.ok ? "default" : "default" },
    ] as const;
    return (
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:gap-2 xl:grid-cols-3">
            {items.map((item) => (
                <div key={item.label} className="flex min-w-0 items-center justify-between gap-1.5 rounded-md border border-stone-200 bg-stone-50/80 px-2 py-1.5 text-[11px] sm:gap-2 sm:px-3 sm:py-2 sm:text-xs dark:border-stone-800 dark:bg-stone-900/50">
                    <span className="min-w-0 truncate font-medium text-stone-600 dark:text-stone-300">{item.label}</span>
                    <Tag color={item.tone} className="m-0 max-w-[60%] truncate !px-1 !text-[10px] sm:max-w-[70%] sm:!px-[7px] sm:!text-xs">
                        {item.value}
                    </Tag>
                </div>
            ))}
        </div>
    );
}

function healthStateText(result: ChannelHealthResult | undefined, t: ReturnType<typeof useTranslations<"admin">>) {
    if (!result) return t("channelEditor.state.notTested");
    return result.ok ? t("channelEditor.state.available") : t("channelEditor.state.needsCheck");
}

function healthStateTone(result?: ChannelHealthResult) {
    if (!result) return "default";
    return result.ok ? "green" : "red";
}

function referenceImageText(result: ChannelHealthResult | undefined, advanced: SystemChannelAdvancedConfig, needsPublicReference: boolean, t: ReturnType<typeof useTranslations<"admin">>) {
    if (!result) return advanced.supportsReferenceImage ? t("channelEditor.state.notMeasured") : t("channelEditor.state.notTested");
    if (!result.ok) return t("channelEditor.state.needsCheck");
    if (!advanced.supportsReferenceImage) return t("channelEditor.state.unsupported");
    return needsPublicReference ? t("channelEditor.state.needsPublicImage") : t("channelEditor.state.available");
}

function referenceVideoText(result: ChannelHealthResult | undefined, advanced: SystemChannelAdvancedConfig, needsPublicReference: boolean, t: ReturnType<typeof useTranslations<"admin">>) {
    if (!result) return advanced.supportsReferenceImage ? t("channelEditor.state.notMeasured") : t("channelEditor.state.notTested");
    if (!result.ok) return t("channelEditor.state.needsCheck");
    if (!advanced.supportsReferenceImage) return t("channelEditor.state.unsupported");
    return needsPublicReference ? t("channelEditor.state.needsPublicImage") : t("channelEditor.state.available");
}

function referenceImageTone(result: ChannelHealthResult | undefined, advanced: SystemChannelAdvancedConfig) {
    if (result && !result.ok) return "red";
    if (result?.ok && advanced.supportsReferenceImage) return "green";
    return "default";
}

function referenceMediaText(result: ChannelHealthResult | undefined, advanced: SystemChannelAdvancedConfig, t: ReturnType<typeof useTranslations<"admin">>) {
    if (advanced.supportsReferenceVideo && advanced.supportsReferenceAudio) return t("channelEditor.state.videoAudioOk");
    if (advanced.supportsReferenceVideo) return t("channelEditor.state.refVideoOk");
    if (advanced.supportsReferenceAudio) return t("channelEditor.state.refAudioOk");
    if (!result) return t("channelEditor.state.notTested");
    return result.ok ? t("channelEditor.state.unsupported") : t("channelEditor.state.needsCheck");
}

function ChannelHealthResultRow({ result, t }: { result: ChannelHealthResult; t: ReturnType<typeof useTranslations<"admin">> }) {
    const detail = result.remoteUrl || result.taskId || result.error || t("channelEditor.state.createOk");
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <Tag color={result.ok ? "green" : "red"} className="m-0">
                {healthKindLabel(result.kind, t)}
                {result.ok ? t("channelEditor.state.success") : t("channelEditor.state.failed")}
            </Tag>
            <span className="truncate">{t("channelEditor.result.model", { model: result.model })}</span>
            {result.protocol ? <span className="truncate">{t("channelEditor.result.protocol", { protocol: result.protocol })}</span> : null}
            <span>{t("channelEditor.result.status", { status: result.status || "-" })}</span>
            <span>{t("channelEditor.result.cost", { cost: typeof result.pointsCost === "number" ? formatCreditAmount(result.pointsCost) : "-" })}</span>
            {result.referenceHint ? <span className="min-w-0 flex-1 basis-full truncate sm:basis-auto">{t("channelEditor.result.reference", { hint: result.referenceHint })}</span> : null}
            <span className="min-w-0 flex-1 truncate">
                {result.remoteUrl ? t("channelEditor.result.remote") : result.taskId ? t("channelEditor.result.task") : result.error ? t("channelEditor.result.reason") : ""}
                {detail}
            </span>
        </div>
    );
}

export function healthKindLabel(kind: ChannelHealthKind, t?: ReturnType<typeof useTranslations<"admin">> | ((key: string) => string)) {
    // Compatible with call sites that pass next-intl t, or fall back to zh labels for non-React hooks.
    if (typeof t === "function") {
        try {
            return t(`channelEditor.kinds.${kind}` as never);
        } catch {
            // fall through
        }
    }
    const fallback: Record<ChannelHealthKind, string> = { text: "Text", image: "Image", video: "Video", audio: "Audio" };
    return fallback[kind] || kind;
}
