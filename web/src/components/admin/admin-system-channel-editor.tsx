"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { App, Button, Checkbox, Input, Popconfirm, Select, Switch, Tag, Tooltip } from "antd";
import { Eye, EyeOff, PlugZap, RefreshCw, Sparkles, Trash2 } from "lucide-react";

import { LabeledControl } from "@/components/admin/admin-settings-controls";
import { formatCreditAmount } from "@/constant/credits";
import { parseChannelExampleConfig } from "@/lib/channel-example-parser";
import { buildGlobalAiOpcSelection, GLOBAL_AIOPC_PRESETS, globalAiOpcPresetOptions, resolveGlobalAiOpcCatalogPresets, resolveGlobalAiOpcPresets } from "@/lib/globalaiopc-catalog";
import type { LogicalModelCapability, SystemChannelAdvancedConfig, SystemChannelModelConfig, SystemChannelProtocol, SystemModelChannel } from "@/lib/auth/store";
import type { ChannelHealthKind as SharedChannelHealthKind, ChannelHealthResult as SharedChannelHealthResult } from "@/lib/channel-health-result";
import { capabilityLabel, channelDetectedCapabilities, channelModelCapability } from "@/lib/model-routing-config";
import { normalizeModelId } from "@/lib/model-capability";
import { revealAdminChannelApiKey } from "@/services/api/admin-settings";
import { AdminChannelProtocolSetup } from "@/components/admin/admin-channel-protocol-setup";
import { applyModelProtocol, channelConnectionReady, channelProtocolDefinition, channelProtocolOptions, channelRequiresApiKey, emptyAdvancedConfig } from "@/lib/channel-protocol-registry";

export type ChannelHealthKind = SharedChannelHealthKind;
export type ChannelHealthResult = SharedChannelHealthResult;

const ALL_GLOBAL_AIOPC_PRESETS = "__all_globalaiopc_presets__";
const modelCapabilityOptionValues: LogicalModelCapability[] = ["text", "image", "video", "audio"];

export function createDefaultChannelAdvancedConfig(): SystemChannelAdvancedConfig {
    return emptyAdvancedConfig();
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
    const modelCapabilityOptions = modelCapabilityOptionValues.map((value) => ({ value, label: t(`channelEditor.kinds.${value}` as never) }));
    const { message } = App.useApp();
    const [exampleText, setExampleText] = useState("");
    const [revealedApiKey, setRevealedApiKey] = useState("");
    const [apiKeyVisible, setApiKeyVisible] = useState(false);
    const [apiKeyLoading, setApiKeyLoading] = useState(false);
    const healthKinds = channelHealthKinds(channel);
    const visibleHealthResults = healthKinds.map((kind) => healthResults[`${channel.id}:${kind}`] || channel.healthResults?.[kind]).filter((item): item is ChannelHealthResult => Boolean(item));
    const advanced = channel.advancedConfig || createDefaultChannelAdvancedConfig();
    const protocolDefinition = channelProtocolDefinition(advanced.protocol);
    const capabilitySummary = channelCapabilitySummary(channel, {
        text: t("channelEditor.kinds.text"),
        image: t("channelEditor.kinds.image"),
        video: t("channelEditor.kinds.video"),
        audio: t("channelEditor.kinds.audio"),
    });
    const detectedCapabilities = channelDetectedCapabilities(channel);
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
        message.success(t("channelEditor.exampleApplied", { summary: parsed.summary.slice(0, 4).join("、") }));
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
    const requiresApiKey = channelRequiresApiKey(channel);
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
                        {capabilitySummary ? <Tag className="m-0">{capabilitySummary}</Tag> : null}
                    </div>
                    <div className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">{channel.baseUrl || t("channelEditor.baseUrlMissing")}</div>
                    <div className="mt-1 text-xs text-stone-400 dark:text-stone-500">{requiresApiKey ? t("channelEditor.beginnerHint") : t("channelEditor.beginnerHint")}</div>
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
            <AdminChannelProtocolSetup channel={channel} onChange={onChange} />
            <div className="mt-3 grid gap-3 sm:mt-4 lg:grid-cols-[180px_minmax(0,1fr)_minmax(220px,0.8fr)]">
                <LabeledControl label={t("channelEditor.channelName")}>
                    <Input value={channel.name} placeholder={t("channelEditor.channelNamePlaceholder")} onChange={(event) => onChange({ name: event.target.value })} />
                </LabeledControl>
                <LabeledControl label="Base URL">
                    <Input value={channel.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => onChange({ baseUrl: event.target.value })} />
                </LabeledControl>
                {requiresApiKey ? (
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
                ) : (
                    <LabeledControl label={t("protocolSetup.authMode")}>
                        <Input value={t("protocolSetup.auth.none")} disabled />
                    </LabeledControl>
                )}
            </div>
            <ChannelCapabilitySummary channel={channel} results={visibleHealthResults} />
            {visibleHealthResults.length ? (
                <div className="mt-3 space-y-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                    {visibleHealthResults.map((result) => (
                        <ChannelHealthResultRow key={`${result.kind}:${result.model}`} result={result} />
                    ))}
                </div>
            ) : null}
            <details className="mt-3 rounded-lg border border-stone-200 bg-stone-50/70 dark:border-stone-800 dark:bg-stone-900/40">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-stone-800 dark:text-stone-100">{t("channelEditor.advanced")}</summary>
                <div className="grid gap-3 border-t border-stone-200 p-3 md:grid-cols-2 dark:border-stone-800">
                    {protocolDefinition.advanced && advanced.protocol !== "custom" ? (
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
                            <Input.TextArea
                                className="mt-3"
                                value={exampleText}
                                rows={5}
                                placeholder={t("channelEditor.examplePlaceholder")}
                                onChange={(event) => setExampleText(event.target.value)}
                            />
                        </div>
                    ) : null}
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
                        <Select
                            disabled={!protocolDefinition.advanced}
                            className="w-full"
                            mode="tags"
                            maxTagCount="responsive"
                            value={advanced.modelCatalogPaths || []}
                            placeholder="/v1/models"
                            onChange={(modelCatalogPaths) => updateAdvanced({ modelCatalogPaths })}
                        />
                    </LabeledControl>
                    <LabeledControl label={t("channelEditor.models")}>
                        <Select
                            disabled={Boolean(protocolDefinition.builtInModels?.length)}
                            className="w-full"
                            mode="tags"
                            maxTagCount="responsive"
                            value={channel.models}
                            placeholder={t("channelEditor.modelsPlaceholder")}
                            onChange={(models) => onChange({ models })}
                        />
                    </LabeledControl>
                    {detectedCapabilities.has("text") ? (
                        <LabeledControl label={t("channelEditor.textModel")}>
                            <Input value={advanced.textModel} placeholder={t("channelEditor.autoFillPlaceholder")} onChange={(event) => updateAdvanced({ textModel: event.target.value })} />
                        </LabeledControl>
                    ) : null}
                    {detectedCapabilities.has("image") ? (
                        <LabeledControl label={t("channelEditor.imageModel")}>
                            <Input value={advanced.imageModel} placeholder={t("channelEditor.autoFillPlaceholder")} onChange={(event) => updateAdvanced({ imageModel: event.target.value })} />
                        </LabeledControl>
                    ) : null}
                    {detectedCapabilities.has("video") ? (
                        <LabeledControl label={t("channelEditor.videoModel")}>
                            <Input value={advanced.videoModel} placeholder={t("channelEditor.autoFillPlaceholder")} onChange={(event) => updateAdvanced({ videoModel: event.target.value })} />
                        </LabeledControl>
                    ) : null}
                    <ModelRouteConfigEditor channel={channel} advanced={advanced} onChange={updateAdvanced} />
                    {protocolDefinition.advanced ? (
                        <>
                            {detectedCapabilities.has("video") ? (
                                <LabeledControl label={t("channelEditor.fallbackDuration")}>
                                    <Input
                                        disabled={multipleGlobalPresets}
                                        value={advanced.durationRange}
                                        placeholder={multipleGlobalPresets ? t("channelEditor.autoByModel") : t("channelEditor.durationPlaceholder")}
                                        onChange={(event) => updateAdvanced({ durationRange: event.target.value })}
                                    />
                                </LabeledControl>
                            ) : null}
                            <LabeledControl label={t("channelEditor.fallbackCreatePath")}>
                                <Input disabled={multipleGlobalPresets} value={advanced.createPath} placeholder={multipleGlobalPresets ? t("channelEditor.autoRoute") : "/video/generations"} onChange={(event) => updateAdvanced({ createPath: event.target.value })} />
                            </LabeledControl>
                            {detectedCapabilities.has("image") ? (
                                <LabeledControl label={t("channelEditor.fallbackEditPath")}>
                                    <Input disabled={multipleGlobalPresets} value={advanced.editPath} placeholder={multipleGlobalPresets ? t("channelEditor.autoRoute") : "/images/edits"} onChange={(event) => updateAdvanced({ editPath: event.target.value })} />
                                </LabeledControl>
                            ) : null}
                            {detectedCapabilities.has("video") ? (
                                <>
                                    <LabeledControl label={t("channelEditor.fallbackImageToVideoPath")}>
                                        <Input
                                            disabled={multipleGlobalPresets}
                                            value={advanced.imageToVideoPath}
                                            placeholder={multipleGlobalPresets ? t("channelEditor.autoRoute") : "/videos"}
                                            onChange={(event) => updateAdvanced({ imageToVideoPath: event.target.value })}
                                        />
                                    </LabeledControl>
                                    <LabeledControl label={t("channelEditor.fallbackQueryPath")}>
                                        <Input
                                            disabled={multipleGlobalPresets}
                                            value={advanced.queryPath}
                                            placeholder={multipleGlobalPresets ? t("channelEditor.autoRoute") : "/video/generations/:task_id"}
                                            onChange={(event) => updateAdvanced({ queryPath: event.target.value })}
                                        />
                                    </LabeledControl>
                                </>
                            ) : null}
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
                        </>
                    ) : (
                        <div className="md:col-span-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
                            {t("channelEditor.fixedProtocolHint", { capability: t("channelEditor.referenceCapability") })}
                        </div>
                    )}
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
                    <div className="text-xs leading-5 text-stone-500 md:col-span-2 dark:text-stone-400">{t("channelEditor.fetchMergeHint")}</div>
                </div>
            </details>
        </div>
    );
}

function ModelRouteConfigEditor({ channel, advanced, onChange }: { channel: SystemModelChannel; advanced: SystemChannelAdvancedConfig; onChange: (patch: Partial<SystemChannelAdvancedConfig>) => void }) {
    const t = useTranslations("admin");
    const modelCapabilityOptions = modelCapabilityOptionValues.map((value) => ({ value, label: t(`channelEditor.kinds.${value}` as never) }));
    const protocolOptions = channelProtocolOptions().map(({ value }) => ({ value, label: t(`channelEditor.protocols.${value}.label`) }));

    const [selected, setSelected] = useState("");
    const models = channel.models;
    const selectedModel = models.some((model) => normalizeModelId(model) === normalizeModelId(selected)) ? models.find((model) => normalizeModelId(model) === normalizeModelId(selected)) || "" : models[0] || "";
    const key = normalizeModelId(selectedModel);
    const stored = key ? advanced.modelConfigs?.[key] : undefined;
    const config: SystemChannelModelConfig | undefined = selectedModel ? stored || { capability: channelModelCapability(channel, selectedModel) } : undefined;
    const selectedProtocol = config?.protocol || advanced.protocol;
    const definition = channelProtocolDefinition(selectedProtocol);
    const showImageEditPath = config?.capability === "image";
    const showImageToVideoPath = config?.capability === "video";
    const showAsyncFields = config?.capability === "video" || (!definition.strict && config?.capability !== "text");
    const write = (next: SystemChannelModelConfig) => {
        if (!key) return;
        onChange({
            modelCapabilities: { ...(advanced.modelCapabilities || {}), [key]: next.capability },
            modelConfigs: { ...(advanced.modelConfigs || {}), [key]: { ...next, source: "manual" } },
        });
    };
    const update = (patch: Partial<SystemChannelModelConfig>) => {
        if (!key || !config) return;
        write({ ...config, ...patch });
    };
    const selectProtocol = (protocol: SystemChannelProtocol | undefined) => config && write(applyModelProtocol(config, protocol || advanced.protocol));
    const selectCapability = (capability: LogicalModelCapability) => config && write(applyModelProtocol({ ...config, capability }, selectedProtocol));
    const clearRoutes = () => {
        if (!key || !config) return;
        const next = { ...(advanced.modelConfigs || {}) };
        delete next[key];
        onChange({ modelConfigs: next, modelCapabilities: { ...(advanced.modelCapabilities || {}), [key]: config.capability } });
    };

    return (
        <div className="rounded-md border border-stone-200 bg-white/70 p-3 md:col-span-2 dark:border-stone-800 dark:bg-stone-950/50">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <div className="text-xs font-semibold text-stone-800 dark:text-stone-100">{t("channelEditor.modelRouteTitle")}</div>
                    <div className="mt-1 text-[11px] leading-5 text-stone-500 dark:text-stone-400">{t("channelEditor.modelRouteHint")}</div>
                </div>
                {stored ? (
                    <Button type="text" size="small" onClick={clearRoutes}>
                        {t("channelEditor.clear")}
                    </Button>
                ) : null}
            </div>
            {config ? (
                <>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <LabeledControl label={t("channelEditor.models")}>
                            <Select className="w-full" showSearch optionFilterProp="label" value={selectedModel} options={models.map((model) => ({ label: model, value: model }))} onChange={setSelected} />
                        </LabeledControl>
                        <LabeledControl label={t("logicalModels.capabilityType")}>
                            <Select className="w-full" value={config.capability} options={definition.strict ? modelCapabilityOptions.filter((item) => definition.capabilities.includes(item.value)) : modelCapabilityOptions} onChange={selectCapability} />
                        </LabeledControl>
                        <LabeledControl label={t("channelEditor.apiFormat")}>
                            <Select
                                className="w-full"
                                allowClear
                                placeholder={t("settingsActions.channelFallback")}
                                value={config.apiFormat}
                                options={[
                                    { label: "OpenAI", value: "openai" },
                                    { label: "Gemini", value: "gemini" },
                                ]}
                                onChange={(apiFormat) => update({ apiFormat })}
                            />
                        </LabeledControl>
                        <LabeledControl label={t("channelEditor.protocol")}>
                            <Select className="w-full" allowClear placeholder={t("settingsActions.channelFallback")} value={config.protocol} options={protocolOptions} onChange={selectProtocol} />
                        </LabeledControl>
                        <LabeledControl
                            label={
                                config.capability === "text"
                                    ? t("channelEditor.pathText")
                                    : config.capability === "image"
                                      ? t("channelEditor.pathImage")
                                      : config.capability === "video"
                                        ? t("channelEditor.pathVideo")
                                        : t("channelEditor.pathAudio")
                            }
                        >
                            <Input
                                disabled={definition.strict}
                                value={config.createPath || ""}
                                placeholder={config.capability === "text" ? "/chat/completions" : config.capability === "video" ? "/videos" : "/images/generations"}
                                onChange={(event) => update({ createPath: event.target.value })}
                            />
                        </LabeledControl>
                        {showImageEditPath ? (
                            <LabeledControl label={t("channelEditor.editPathLabel")}>
                                <Input disabled={definition.strict} value={config.editPath || ""} placeholder="/images/edits" onChange={(event) => update({ editPath: event.target.value })} />
                            </LabeledControl>
                        ) : null}
                        {showImageToVideoPath ? (
                            <LabeledControl label={t("channelEditor.imageToVideoPathLabel")}>
                                <Input disabled={definition.strict} value={config.imageToVideoPath || ""} placeholder="/videos" onChange={(event) => update({ imageToVideoPath: event.target.value })} />
                            </LabeledControl>
                        ) : null}
                        {showAsyncFields ? (
                            <LabeledControl label={t("channelEditor.queryPath")}>
                                <Input disabled={definition.strict} value={config.queryPath || ""} placeholder="/videos/:task_id" onChange={(event) => update({ queryPath: event.target.value })} />
                            </LabeledControl>
                        ) : null}
                        {showAsyncFields ? (
                            <LabeledControl label={t("channelEditor.cancelPath")}>
                                <Input disabled={definition.strict} value={config.cancelPath || ""} placeholder="/videos/:task_id/cancel" onChange={(event) => update({ cancelPath: event.target.value })} />
                            </LabeledControl>
                        ) : null}
                        {showAsyncFields && config.cancelPath ? (
                            <LabeledControl label={t("channelEditor.cancelMethod")}>
                                <Select
                                    className="w-full"
                                    disabled={definition.strict}
                                    value={config.cancelMethod || "POST"}
                                    options={[
                                        { label: "POST", value: "POST" },
                                        { label: "DELETE", value: "DELETE" },
                                    ]}
                                    onChange={(cancelMethod) => update({ cancelMethod })}
                                />
                            </LabeledControl>
                        ) : null}
                        <LabeledControl label={t("channelEditor.resultField")}>
                            <Input disabled={definition.strict} value={config.resultField || ""} placeholder="video_url / data[0].url" onChange={(event) => update({ resultField: event.target.value })} />
                        </LabeledControl>
                        {showAsyncFields ? (
                            <LabeledControl label={t("channelEditor.statusField")}>
                                <Input disabled={definition.strict} value={config.statusField || ""} placeholder="status / state" onChange={(event) => update({ statusField: event.target.value })} />
                            </LabeledControl>
                        ) : null}
                        {config.capability === "video" ? (
                            <LabeledControl label={t("channelEditor.durationRule")}>
                                <Input disabled={definition.strict} value={config.durationRange || ""} placeholder={t("channelEditor.durationRulePlaceholder")} onChange={(event) => update({ durationRange: event.target.value })} />
                            </LabeledControl>
                        ) : null}
                    </div>
                    <details className="mt-3 border-t border-stone-200 pt-2 dark:border-stone-800">
                        <summary className="cursor-pointer text-xs font-medium text-stone-600 dark:text-stone-300">{t("channelEditor.requestTemplateAndRef")}</summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <LabeledControl label={t("channelEditor.requestTemplate")}>
                                    <Input.TextArea
                                        disabled={definition.strict}
                                        rows={3}
                                        value={config.requestTemplate || ""}
                                        placeholder='{"model":"{{model}}","prompt":"{{prompt}}"}'
                                        onChange={(event) => update({ requestTemplate: event.target.value })}
                                    />
                                </LabeledControl>
                            </div>
                            <div className="sm:col-span-2 flex flex-wrap gap-4 text-xs text-stone-600 dark:text-stone-300">
                                <Checkbox disabled={definition.strict} checked={config.supportsReferenceImage === true} onChange={(event) => update({ supportsReferenceImage: event.target.checked })}>
                                    {t("logicalModels.refImage")}
                                </Checkbox>
                                <Checkbox disabled={definition.strict} checked={config.supportsReferenceVideo === true} onChange={(event) => update({ supportsReferenceVideo: event.target.checked })}>
                                    {t("logicalModels.refVideo")}
                                </Checkbox>
                                <Checkbox disabled={definition.strict} checked={config.supportsReferenceAudio === true} onChange={(event) => update({ supportsReferenceAudio: event.target.checked })}>
                                    {t("logicalModels.refAudio")}
                                </Checkbox>
                            </div>
                        </div>
                    </details>
                </>
            ) : (
                <div className="mt-3 text-xs text-stone-500 dark:text-stone-400">{t("channelEditor.modelRouteEmpty")}</div>
            )}
        </div>
    );
}

function channelCapabilitySummary(channel: SystemModelChannel, labels?: Partial<Record<LogicalModelCapability, string>>) {
    const counts = channel.models.reduce((result, model) => ({ ...result, [channelModelCapability(channel, model)]: result[channelModelCapability(channel, model)] + 1 }), { text: 0, image: 0, video: 0, audio: 0 } as Record<
        LogicalModelCapability,
        number
    >);
    return modelCapabilityOptionValues
        .filter((value) => counts[value])
        .map((value) => `${capabilityLabel(value, labels)} ${counts[value]}`)
        .join(" · ");
}

export function channelHealthKinds(channel: SystemModelChannel): ChannelHealthKind[] {
    const supported = new Set(channelProtocolDefinition(channel.advancedConfig?.protocol || "auto").capabilities);
    const detected = channelDetectedCapabilities(channel);
    return (["text", "image", "video", "audio"] as ChannelHealthKind[]).filter((kind) => supported.has(kind) && detected.has(kind));
}

function ChannelCapabilitySummary({ channel, results }: { channel: SystemModelChannel; results: ChannelHealthResult[] }) {
    const t = useTranslations("admin");
    const advanced = channel.advancedConfig || createDefaultChannelAdvancedConfig();
    const credentialsReady = channelConnectionReady(channel);
    const verifiedResults = credentialsReady ? results : [];
    const text = verifiedResults.find((result) => result.kind === "text");
    const image = verifiedResults.find((result) => result.kind === "image");
    const video = verifiedResults.find((result) => result.kind === "video");
    const audio = verifiedResults.find((result) => result.kind === "audio");
    const needsPublicReference = /公网|public|localhost|NEXT_PUBLIC_SITE_URL/i.test(advanced.referenceRule || video?.referenceHint || "");
    const pending = credentialsReady ? undefined : t("channelEditor.state.notMeasured");
    const capabilities = new Set(channelHealthKinds(channel));
    const items: Array<{ label: string; value: string; tone: "default" | "green" | "red" }> = [];
    if (capabilities.has("text")) items.push({ label: t("channelEditor.caps.text"), value: pending || healthStateText(text, t), tone: pending ? "default" : healthStateTone(text) });
    if (capabilities.has("image")) {
        items.push({ label: t("channelEditor.caps.genImage"), value: pending || healthStateText(image, t), tone: pending ? "default" : healthStateTone(image) });
        items.push({ label: t("channelEditor.caps.imageToImage"), value: pending || referenceImageText(image, advanced, needsPublicReference, t), tone: pending ? "default" : referenceImageTone(image) });
    }
    if (capabilities.has("video")) {
        items.push({ label: t("channelEditor.caps.video"), value: pending || healthStateText(video, t), tone: pending ? "default" : healthStateTone(video) });
        items.push({ label: t("channelEditor.caps.imageToVideo"), value: pending || referenceVideoText(video, advanced, needsPublicReference, t), tone: pending ? "default" : referenceImageTone(video) });
        items.push({ label: t("channelEditor.caps.refVideoAudio"), value: pending || referenceMediaText(video, advanced, t), tone: pending ? "default" : video && !video.ok ? "red" : "default" });
    }
    if (capabilities.has("audio")) items.push({ label: t("channelEditor.caps.audio"), value: pending || healthStateText(audio, t), tone: pending ? "default" : healthStateTone(audio) });
    if (!items.length) return null;
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

function healthStateText(result?: ChannelHealthResult, t?: ReturnType<typeof useTranslations<"admin">>) {
    if (!result) return t ? t("channelEditor.state.notTested") : "未检测";
    return result.ok ? (t ? t("channelEditor.state.available") : "可用") : (t ? t("channelEditor.state.needsCheck") : "需检查");
}

function healthStateTone(result?: ChannelHealthResult) {
    if (!result) return "default";
    return result.ok ? "green" : "red";
}

function referenceImageText(result: ChannelHealthResult | undefined, advanced: SystemChannelAdvancedConfig, needsPublicReference: boolean, t?: ReturnType<typeof useTranslations<"admin">>) {
    if (!result) return t ? t("channelEditor.state.notTested") : "未检测";
    if (!result.ok) return t ? t("channelEditor.state.needsCheck") : "需检查";
    if (!advanced.supportsReferenceImage) return t ? t("channelEditor.state.unsupported") : "不支持";
    if (result.referenceImageTest) return result.referenceImageTest.ok ? (t ? t("channelEditor.state.available") : "可用") : (t ? t("channelEditor.state.needsCheck") : "需检查");
    return needsPublicReference ? (t ? t("channelEditor.state.needsPublicImage") : "需公网图，未实测") : (t ? t("channelEditor.state.notMeasured") : "未实测");
}

function referenceVideoText(result: ChannelHealthResult | undefined, advanced: SystemChannelAdvancedConfig, needsPublicReference: boolean, t?: ReturnType<typeof useTranslations<"admin">>) {
    if (!result) return t ? t("channelEditor.state.notTested") : "未检测";
    if (!result.ok) return t ? t("channelEditor.state.needsCheck") : "需检查";
    if (!advanced.supportsReferenceImage) return t ? t("channelEditor.state.unsupported") : "不支持";
    return needsPublicReference ? (t ? t("channelEditor.state.needsPublicImage") : "需公网图，未实测") : t ? t("channelEditor.state.notMeasured") : "未实测";
}

function referenceImageTone(result: ChannelHealthResult | undefined) {
    if (result && !result.ok) return "red";
    if (result?.referenceImageTest) return result.referenceImageTest.ok ? "green" : "red";
    return "default";
}

function referenceMediaText(result: ChannelHealthResult | undefined, advanced: SystemChannelAdvancedConfig, t?: ReturnType<typeof useTranslations<"admin">>) {
    if (!result) return t ? t("channelEditor.state.notTested") : "未检测";
    if (!result.ok) return t ? t("channelEditor.state.needsCheck") : "需检查";
    return advanced.supportsReferenceVideo || advanced.supportsReferenceAudio ? (t ? t("channelEditor.state.notMeasured") : "未实测") : t ? t("channelEditor.state.unsupported") : "不支持";
}

function ChannelHealthResultRow({ result }: { result: ChannelHealthResult }) {
    const t = useTranslations("admin");
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
            {result.referenceImageTest ? (
                <span className="min-w-0 basis-full truncate">
                    {result.referenceImageTest.ok
                        ? t("channelEditor.result.imageToImageOk")
                        : t("channelEditor.result.imageToImageFail", {
                              detail: result.referenceImageTest.error || t("channelEditor.result.statusCode", { status: result.referenceImageTest.status || "-" }),
                          })}
                </span>
            ) : null}
            <span className="min-w-0 flex-1 truncate">
                {result.remoteUrl ? t("channelEditor.result.remote") : result.taskId ? t("channelEditor.result.task") : result.error ? t("channelEditor.result.reason") : ""}
                {detail}
            </span>
        </div>
    );
}

export function healthKindLabel(kind: ChannelHealthKind, t?: ReturnType<typeof useTranslations<"admin">> | ((key: string) => string)) {
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
