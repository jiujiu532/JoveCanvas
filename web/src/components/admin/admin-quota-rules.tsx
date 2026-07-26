"use client";

import { useState } from "react";
import { Button, Input, InputNumber, Segmented, Switch, Tag } from "antd";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { DEFAULT_MODEL_POINT_COST_KEY } from "@/constant/credits";
import type { AuthSettings } from "@/lib/auth/store";
import type { LogicalModelCapability } from "@/lib/auth/store";
import { configuredModelPointCostKeys, resolveConfiguredModelPointCost } from "@/lib/model-point-cost";
import { LabeledControl } from "@/components/admin/admin-settings-controls";
import { toNumberOrOne, toNumberOrZero, uniqueList } from "@/components/admin/admin-values";

type AdminTranslator = ReturnType<typeof useTranslations<"admin">>;

function imageQualityMultiplierOptions(t: AdminTranslator) {
    return [
        { key: "auto", label: t("points.quota.imageQuality.auto") },
        { key: "low", label: t("points.quota.imageQuality.low") },
        { key: "medium", label: t("points.quota.imageQuality.medium") },
        { key: "high", label: t("points.quota.imageQuality.high") },
    ];
}
const videoQualityMultiplierOptions = [
    { key: "480", label: "480p" },
    { key: "720", label: "720p" },
    { key: "1080", label: "1080p" },
];
function videoSecondsMultiplierOptions(t: AdminTranslator) {
    return [
        { key: "-1", label: t("points.quota.multiplier.smart") },
        { key: "5", label: "5s" },
        { key: "10", label: "10s" },
    ];
}
const suggestedVideoSecondOptions = [6, 8, 20];
const legacyDefaultVideoSecondKeys = new Set(["12", "16"]);
function modelCapabilityOptions(t: AdminTranslator): Array<{ value: LogicalModelCapability; label: string }> {
    return [
        { value: "text", label: t("points.quota.capability.text") },
        { value: "image", label: t("points.quota.capability.image") },
        { value: "video", label: t("points.quota.capability.video") },
        { value: "audio", label: t("points.quota.capability.audio") },
    ];
}
export function QuotaRuleTable({
    settings,
    customModel,
    onCustomModelChange,
    onAddCustomModel,
    onFreeDailyPointsEnabledChange,
    onFreeDailyPointsChange,
    onModelPointCostChange,
    onModelPointCostDelete,
    onGenerationPointMultiplierChange,
    onGenerationPointMultiplierDelete,
}: {
    settings: AuthSettings;
    customModel: string;
    onCustomModelChange: (value: string) => void;
    onAddCustomModel: () => void;
    onFreeDailyPointsEnabledChange: (enabled: boolean) => void;
    onFreeDailyPointsChange: (value: number | null) => void;
    onModelPointCostChange: (model: string, value: number | null) => void;
    onModelPointCostDelete: (model: string) => void;
    onGenerationPointMultiplierChange: (group: keyof AuthSettings["generationPointMultipliers"], key: string, value: number | null) => void;
    onGenerationPointMultiplierDelete: (group: keyof AuthSettings["generationPointMultipliers"], key: string) => void;
}) {
    const t = useTranslations("admin");
    const [activeCapability, setActiveCapability] = useState<LogicalModelCapability>("text");
    const capabilityOptions = modelCapabilityOptions(t);
    const models = listPointCostModels(settings);
    const managedModelSet = new Set(settings.logicalModels.length ? settings.logicalModels.map((model) => model.id) : settings.systemChannels.flatMap((channel) => channel.models));
    const groupedModels = capabilityOptions.map((option) => ({ ...option, models: models.filter((model) => resolvePointCostModelCapability(settings, model) === option.value) }));
    const visibleModels = groupedModels.find((group) => group.value === activeCapability)?.models || [];
    const activeCapabilityLabel = capabilityOptions.find((item) => item.value === activeCapability)?.label;
    return (
        <div className="min-w-0">
            <section className="grid gap-3 border-b border-zinc-200 pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] sm:items-end sm:gap-6 sm:pb-5 dark:border-zinc-800">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("points.quota.freeDailyPoints.title")}</div>
                    <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("points.quota.freeDailyPoints.description")}</p>
                </div>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
                    <div className="pb-1">
                        <div className="mb-1.5 text-xs font-medium text-stone-600 dark:text-stone-300">{t("points.quota.freeDailyPoints.statusLabel")}</div>
                        <Switch size="small" checked={settings.freeDailyPointsEnabled} checkedChildren={t("points.quota.freeDailyPoints.on")} unCheckedChildren={t("points.quota.freeDailyPoints.off")} onChange={onFreeDailyPointsEnabledChange} />
                    </div>
                    <LabeledControl label={t("points.quota.freeDailyPoints.dailyQuota")}>
                        <InputNumber className="w-full" min={0} precision={0} value={settings.freeDailyPoints} onChange={(value) => onFreeDailyPointsChange(toNumberOrZero(value))} />
                    </LabeledControl>
                </div>
            </section>
            <section className="border-b border-zinc-200 py-4 sm:py-5 dark:border-zinc-800">
                <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("points.quota.modelCost.title")}</div>
                <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("points.quota.modelCost.description")}</div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-end">
                    <LabeledControl label={t("points.quota.modelCost.defaultLabel")}>
                        <InputNumber className="w-full" min={0} precision={2} value={settings.modelPointCosts[DEFAULT_MODEL_POINT_COST_KEY] ?? 1} onChange={(value) => onModelPointCostChange(DEFAULT_MODEL_POINT_COST_KEY, toNumberOrOne(value))} />
                    </LabeledControl>
                    <LabeledControl label={t("points.quota.modelCost.addLabel")}>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                            <Input value={customModel} placeholder={t("points.quota.modelCost.addPlaceholder")} onChange={(event) => onCustomModelChange(event.target.value)} onPressEnter={onAddCustomModel} />
                            <Button icon={<Plus className="size-4" />} aria-label={t("points.quota.modelCost.addButton")} title={t("points.quota.modelCost.addButton")} onClick={onAddCustomModel}>
                                <span className="hidden sm:inline">{t("points.quota.modelCost.addButton")}</span>
                            </Button>
                        </div>
                    </LabeledControl>
                </div>
                <div className="mt-4 overflow-x-auto pb-1">
                    <Segmented
                        block
                        className="min-w-[360px]"
                        value={activeCapability}
                        options={groupedModels.map((group) => ({ value: group.value, label: `${group.label} ${group.models.length}` }))}
                        onChange={(value) => setActiveCapability(value as LogicalModelCapability)}
                    />
                </div>
                <div className="mt-3 text-[11px] text-stone-400 dark:text-stone-500">{t("points.quota.modelCost.currentShowing", { capability: activeCapabilityLabel || "" })}</div>
                <div className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-2">
                    {visibleModels.length ? (
                        visibleModels.map((model) => {
                            const logical = settings.logicalModels.find((item) => item.id.toLowerCase() === model.toLowerCase());
                            return (
                                <div
                                    key={model}
                                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_76px_28px] items-center gap-2 border-t border-zinc-100 py-2 first:border-t-0 md:[&:nth-child(2)]:border-t-0 dark:border-zinc-900 sm:grid-cols-[minmax(0,1fr)_104px_32px]"
                                >
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="block min-w-0 truncate text-sm text-stone-700 dark:text-stone-200" title={logical ? `${logical.name} (${logical.id})` : model}>
                                                {logical?.name || model}
                                            </span>
                                            <ModelCapabilityTag capability={activeCapability} />
                                        </div>
                                        {logical && logical.name !== logical.id ? (
                                            <span className="mt-0.5 block truncate text-xs text-stone-400">ID: {logical.id}</span>
                                        ) : !managedModelSet.has(model) ? (
                                            <span className="mt-0.5 block text-xs text-stone-400">{t("points.quota.modelCost.manuallyAdded")}</span>
                                        ) : null}
                                    </div>
                                    <InputNumber
                                        className="w-full"
                                        min={0}
                                        precision={2}
                                        value={resolveConfiguredModelPointCost(settings.modelPointCosts, model, settings.logicalModels)}
                                        onChange={(value) => onModelPointCostChange(model, toNumberOrOne(value))}
                                    />
                                    <Button
                                        className="!h-7 !w-7 !min-w-7 !p-0"
                                        size="small"
                                        danger
                                        icon={<Trash2 className="size-3.5" />}
                                        aria-label={t("points.quota.modelCost.deleteConfig")}
                                        title={t("points.quota.modelCost.deleteConfig")}
                                        onClick={() => {
                                            const keys = configuredModelPointCostKeys(settings.modelPointCosts, model, settings.logicalModels);
                                            (keys.length ? keys : [model]).forEach(onModelPointCostDelete);
                                        }}
                                    />
                                </div>
                            );
                        })
                    ) : (
                        <div className="rounded-md border border-dashed border-stone-200 px-3 py-6 text-center text-sm text-stone-500 md:col-span-2 dark:border-stone-800">
                            {t("points.quota.modelCost.emptyState", { capability: activeCapabilityLabel || "" })}
                        </div>
                    )}
                </div>
            </section>
            <section className="pt-4 sm:pt-5">
                <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("points.quota.multiplier.title")}</div>
                <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("points.quota.multiplier.description")}</div>
                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(220px,0.8fr)_minmax(220px,0.8fr)_minmax(360px,1.4fr)]">
                    <MultiplierGroup
                        title={t("points.quota.multiplier.imageQuality")}
                        values={imageQualityMultiplierOptions(t)}
                        group="imageQuality"
                        settings={settings.generationPointMultipliers.imageQuality}
                        onChange={onGenerationPointMultiplierChange}
                    />
                    <MultiplierGroup title={t("points.quota.multiplier.videoQuality")} values={videoQualityMultiplierOptions} group="videoQuality" settings={settings.generationPointMultipliers.videoQuality} onChange={onGenerationPointMultiplierChange} />
                    <VideoSecondsMultiplierGroup settings={settings.generationPointMultipliers.videoSeconds} onChange={onGenerationPointMultiplierChange} onDelete={onGenerationPointMultiplierDelete} />
                </div>
            </section>
        </div>
    );
}

export function listPointCostModels(settings: Pick<AuthSettings, "logicalModels" | "systemChannels" | "modelPointCosts">) {
    const logicalIds = settings.logicalModels.map((model) => model.id);
    const channelModels = uniqueList(settings.systemChannels.flatMap((channel) => channel.models));
    const bindingAliases = new Set(settings.logicalModels.flatMap((model) => model.bindings.map((binding) => binding.upstreamModel.toLowerCase())));
    const customModels = Object.keys(settings.modelPointCosts || {}).filter((model) => model !== DEFAULT_MODEL_POINT_COST_KEY && (!logicalIds.length || !bindingAliases.has(model.toLowerCase())));
    return uniqueList([...(logicalIds.length ? logicalIds : channelModels), ...customModels]);
}

export function resolvePointCostModelCapability(settings: Pick<AuthSettings, "logicalModels">, model: string): LogicalModelCapability {
    const normalized = model.trim().toLowerCase();
    const logical = settings.logicalModels.find((item) => item.id.toLowerCase() === normalized || item.bindings.some((binding) => binding.upstreamModel.trim().toLowerCase() === normalized));
    if (logical) return logical.capability;
    if (/(?:video|seedance|sora|veo|kling|wan|hailuo|runway|luma|vidu)/i.test(normalized)) return "video";
    if (/(?:image|imagen|dall|flux|midjourney|sdxl|stable[-_. ]?diffusion|seedream|recraft|ideogram)/i.test(normalized)) return "image";
    if (/(?:audio|tts|speech|whisper|voice|music)/i.test(normalized)) return "audio";
    return "text";
}

function ModelCapabilityTag({ capability }: { capability: LogicalModelCapability }) {
    const t = useTranslations("admin");
    const labels: Record<LogicalModelCapability, string> = { text: t("points.quota.capability.text"), image: t("points.quota.capability.image"), video: t("points.quota.capability.video"), audio: t("points.quota.capability.audio") };
    const colors: Record<LogicalModelCapability, string> = { text: "default", image: "blue", video: "green", audio: "gold" };
    return (
        <Tag className="!m-0 shrink-0" color={colors[capability]}>
            {labels[capability]}
        </Tag>
    );
}

function MultiplierGroup({
    title,
    values,
    group,
    settings,
    onChange,
}: {
    title: string;
    values: Array<{ key: string; label: string }>;
    group: keyof AuthSettings["generationPointMultipliers"];
    settings: Record<string, number>;
    onChange: (group: keyof AuthSettings["generationPointMultipliers"], key: string, value: number | null) => void;
}) {
    return (
        <div className="min-w-0 rounded-md border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="mb-3 text-xs font-semibold text-stone-600 dark:text-stone-300">{title}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(104px,1fr))]">
                {values.map((item) => (
                    <div key={item.key} className="min-w-0 rounded-md border border-stone-200 bg-white px-2 py-2 dark:border-stone-800 dark:bg-stone-950/70">
                        <div className="mb-1 truncate text-xs font-medium text-stone-600 dark:text-stone-300">{item.label}</div>
                        <InputNumber className="w-full" size="small" min={0} precision={2} value={settings[item.key] ?? 1} onChange={(value) => onChange(group, item.key, toNumberOrOne(value))} />
                    </div>
                ))}
            </div>
        </div>
    );
}

function VideoSecondsMultiplierGroup({
    settings,
    onChange,
    onDelete,
}: {
    settings: Record<string, number>;
    onChange: (group: keyof AuthSettings["generationPointMultipliers"], key: string, value: number | null) => void;
    onDelete: (group: keyof AuthSettings["generationPointMultipliers"], key: string) => void;
}) {
    const t = useTranslations("admin");
    const [customSeconds, setCustomSeconds] = useState<number | null>(null);
    const secondsOptions = videoSecondsMultiplierOptions(t);
    const standardKeys = new Set(secondsOptions.map((item) => item.key));
    const customRows = Object.keys(settings || {})
        .filter((key) => !standardKeys.has(key))
        .filter((key) => !legacyDefaultVideoSecondKeys.has(key) || settings[key] !== 1)
        .filter((key) => {
            const value = Number(key);
            return Number.isFinite(value) && Number.isInteger(value) && value > 0;
        })
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => ({ key, label: key + "s" }));
    const addCustomSeconds = () => {
        const seconds = Math.floor(Number(customSeconds));
        if (!Number.isFinite(seconds) || seconds <= 0) return;
        onChange("videoSeconds", String(seconds), settings[String(seconds)] ?? 1);
        setCustomSeconds(null);
    };

    return (
        <div className="min-w-0 rounded-md border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="mb-3 text-xs font-semibold text-stone-600 dark:text-stone-300">{t("points.quota.multiplier.videoSeconds")}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(96px,1fr))]">
                {secondsOptions.map((item) => (
                    <VideoSecondMultiplierCell key={item.key} label={item.label} value={settings[item.key] ?? 1} onChange={(value) => onChange("videoSeconds", item.key, value)} />
                ))}
                {customRows.map((item) => (
                    <VideoSecondMultiplierCell key={item.key} label={item.label} value={settings[item.key] ?? 1} onChange={(value) => onChange("videoSeconds", item.key, value)} onDelete={() => onDelete("videoSeconds", item.key)} />
                ))}
                <div className="col-span-full flex flex-wrap gap-1.5">
                    {suggestedVideoSecondOptions.map((seconds) => (
                        <Button key={seconds} size="small" onClick={() => onChange("videoSeconds", String(seconds), settings[String(seconds)] ?? 1)}>
                            {seconds}s
                        </Button>
                    ))}
                </div>
                <div className="col-span-full mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <InputNumber className="w-full" min={1} max={20} precision={0} placeholder={t("points.quota.multiplier.customSecondsPlaceholder")} value={customSeconds} onChange={setCustomSeconds} />
                    <Button size="small" icon={<Plus className="size-3.5" />} onClick={addCustomSeconds}>
                        {t("points.quota.multiplier.add")}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function VideoSecondMultiplierCell({ label, value, onChange, onDelete }: { label: string; value: number; onChange: (value: number | null) => void; onDelete?: () => void }) {
    const t = useTranslations("admin");
    return (
        <div className="relative min-w-0 rounded-md border border-stone-200 bg-white px-2 py-2 dark:border-stone-800 dark:bg-stone-950/70">
            <div className="mb-1 truncate pr-6 text-xs font-medium text-stone-600 dark:text-stone-300">{label}</div>
            {onDelete ? (
                <Button
                    className="!absolute right-1 top-1 !h-5 !w-5 !min-w-5 !p-0"
                    size="small"
                    danger
                    icon={<Trash2 className="size-3" />}
                    aria-label={t("points.quota.multiplier.deleteCustomSeconds")}
                    title={t("points.quota.multiplier.deleteCustomSeconds")}
                    onClick={onDelete}
                />
            ) : null}
            <InputNumber className="w-full" size="small" min={0} precision={2} value={value} onChange={(nextValue) => onChange(toNumberOrOne(nextValue))} />
        </div>
    );
}
