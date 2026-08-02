"use client";

import { App, Button, Checkbox, Drawer, Empty, Input, InputNumber, Popconfirm, Select, Space, Switch, Tag } from "antd";
import { AlertTriangle, GitBranch, Pencil, Plus, RefreshCw, Route, Search, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { LogicalModel, LogicalModelBinding, LogicalModelCapability, LogicalModelCapabilityProfile, SystemDefaultModels, SystemModelChannel } from "@/lib/auth/store";
import { isLogicalModelResolvable, mergeChannelModelsIntoLogicalModels, normalizeDefaultModelsConfig, resolveLogicalModelConfig } from "@/lib/model-routing-config";
import { LabeledControl, SectionTitle } from "@/components/admin/admin-settings-controls";

type AdminTranslator = ReturnType<typeof useTranslations<"admin">>;

type Props = {
    channels: SystemModelChannel[];
    logicalModels: LogicalModel[];
    defaultModels: SystemDefaultModels;
    onChange: (value: { logicalModels: LogicalModel[]; defaultModels: SystemDefaultModels }) => void;
};

export function AdminLogicalModelManager({ channels, logicalModels, defaultModels, onChange }: Props) {
    const t = useTranslations("admin");
    const { message } = App.useApp();
    const capabilityOptions = useMemo(
        () =>
            (["text", "image", "video", "audio"] as LogicalModelCapability[]).map((value) => ({
                label: capabilityText(value, t),
                value,
            })),
        [t],
    );
    const defaultFields = useMemo(
        () =>
            [
                { capability: "text" as const, key: "textModel" as const, label: t("logicalModels.defaultText") },
                { capability: "image" as const, key: "imageModel" as const, label: t("logicalModels.defaultImage") },
                { capability: "video" as const, key: "videoModel" as const, label: t("logicalModels.defaultVideo") },
                { capability: "audio" as const, key: "audioModel" as const, label: t("logicalModels.defaultAudio") },
            ] as const,
        [t],
    );
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingId, setEditingId] = useState("");
    const [draft, setDraft] = useState<LogicalModel>(() => createLogicalModel(channels));
    const [query, setQuery] = useState("");
    const [capabilityFilter, setCapabilityFilter] = useState<LogicalModelCapability | "all">("all");
    const deferredQuery = useDeferredValue(query.trim().toLowerCase());
    const visibleModels = useMemo(
        () => logicalModels.filter((model) => (capabilityFilter === "all" || model.capability === capabilityFilter) && (!deferredQuery || `${model.id} ${model.name}`.toLowerCase().includes(deferredQuery))),
        [capabilityFilter, deferredQuery, logicalModels],
    );
    const availableDefaultFields = defaultFields.filter(({ capability }) => logicalModels.some((model) => model.capability === capability && isLogicalModelResolvable(logicalModels, channels, capability, model.id)));
    const availableCapabilityOptions = capabilityOptions.filter(({ value }) => availableDefaultFields.some(({ capability }) => capability === value));
    const readyCount = availableDefaultFields.filter(({ capability, key }) => isLogicalModelResolvable(logicalModels, channels, capability, defaultModels[key])).length;

    const openCreate = () => {
        setEditingId("");
        setDraft(createLogicalModel(channels));
        setDrawerOpen(true);
    };

    const openEdit = (model: LogicalModel) => {
        setEditingId(model.id);
        setDraft(cloneLogicalModel(model));
        setDrawerOpen(true);
    };

    const saveDraft = () => {
        const error = validateDraft(draft, logicalModels, channels, editingId, t);
        if (error) {
            message.error(error);
            return;
        }
        const nextModels = editingId ? logicalModels.map((model) => (model.id === editingId ? cloneLogicalModel(draft) : model)) : [...logicalModels, cloneLogicalModel(draft)];
        onChange({ logicalModels: nextModels, defaultModels: normalizeDefaultModelsConfig(defaultModels, nextModels, channels) });
        setDrawerOpen(false);
        message.success(editingId ? t("logicalModels.updated") : t("logicalModels.added"));
    };

    const removeModel = (model: LogicalModel) => {
        const nextModels = logicalModels.filter((item) => item.id !== model.id);
        onChange({ logicalModels: nextModels, defaultModels: normalizeDefaultModelsConfig(clearDefaultReference(defaultModels, model.id), nextModels, channels) });
    };

    const syncChannelModels = () => {
        const nextModels = mergeChannelModelsIntoLogicalModels(logicalModels, channels);
        const addedModels = nextModels.length - logicalModels.length;
        const addedBindings = nextModels.reduce((total, model) => total + model.bindings.length, 0) - logicalModels.reduce((total, model) => total + model.bindings.length, 0);
        if (!addedModels && !addedBindings) {
            message.info(t("logicalModels.allSynced"));
            return;
        }
        onChange({ logicalModels: nextModels, defaultModels: normalizeDefaultModelsConfig(defaultModels, nextModels, channels) });
        message.success(t("logicalModels.synced", { count: addedModels || addedBindings }));
    };

    const updateDefault = (key: keyof SystemDefaultModels, modelId: string) => onChange({ logicalModels, defaultModels: { ...defaultModels, [key]: modelId } });

    return (
        <section className="border-t border-stone-200 pt-5 dark:border-stone-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <SectionTitle icon={<Route className="size-4" />} title={t("logicalModels.title")} />
                        <Tag color={readyCount === availableDefaultFields.length ? "green" : "orange"} className="m-0">
                            {t("logicalModels.readyCount", { ready: readyCount, total: availableDefaultFields.length })}
                        </Tag>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("logicalModels.description")}</p>
                </div>
                <Space wrap>
                    <Button icon={<RefreshCw className="size-4" />} onClick={syncChannelModels}>
                        {t("logicalModels.syncChannels")}
                    </Button>
                    <Button type="primary" icon={<Plus className="size-4" />} onClick={openCreate}>
                        {t("logicalModels.create")}
                    </Button>
                </Space>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0">
                    <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
                        <Input allowClear value={query} prefix={<Search className="size-4 text-stone-400" />} placeholder={t("logicalModels.searchPlaceholder")} onChange={(event) => setQuery(event.target.value)} />
                        <Select value={capabilityFilter} options={[{ label: t("logicalModels.allCapabilities"), value: "all" }, ...availableCapabilityOptions]} onChange={(value) => setCapabilityFilter(value)} />
                    </div>
                    <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
                        {visibleModels.map((model) => {
                            const resolved = resolveLogicalModelConfig(logicalModels, channels, model.capability, model.id);
                            const isDefault = Object.values(defaultModels).some((value) => value.toLowerCase() === model.id.toLowerCase());
                            return (
                                <div
                                    key={model.id}
                                    className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800 dark:bg-stone-950"
                                    style={{ contentVisibility: "auto", containIntrinsicSize: "0 88px" }}
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="truncate text-sm font-semibold text-stone-950 dark:text-stone-100">{model.name}</span>
                                            <Tag className="m-0">{capabilityText(model.capability, t)}</Tag>
                                            <Tag color={model.enabled ? "green" : "default"} className="m-0">
                                                {model.enabled ? t("logicalModels.enabled") : t("logicalModels.disabled")}
                                            </Tag>
                                            {isDefault ? (
                                                <Tag color="blue" className="m-0">
                                                    {t("logicalModels.defaultTag")}
                                                </Tag>
                                            ) : null}
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                                            <span>ID：{model.id}</span>
                                            <span>{t("logicalModels.bindingCount", { count: model.bindings.length })}</span>
                                            <span className={resolved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{resolved ? `${resolved.channel.name} / ${resolved.binding.upstreamModel}` : t("logicalModels.noChannel")}</span>
                                        </div>
                                    </div>
                                    <Space className="shrink-0">
                                        <Button size="small" icon={<Pencil className="size-3.5" />} onClick={() => openEdit(model)}>
                                            {t("logicalModels.edit")}
                                        </Button>
                                        <Popconfirm title={t("logicalModels.deleteTitle")} description={isDefault ? t("logicalModels.deleteDefaultDesc") : t("logicalModels.deleteDesc")} okText={t("logicalModels.delete")} cancelText={t("logicalModels.cancel")} onConfirm={() => removeModel(model)}>
                                            <Button size="small" danger icon={<Trash2 className="size-3.5" />} aria-label={t("logicalModels.deleteAria", { name: model.name })} />
                                        </Popconfirm>
                                    </Space>
                                </div>
                            );
                        })}
                        {!visibleModels.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={logicalModels.length ? t("logicalModels.emptyFiltered") : t("logicalModels.empty")} /> : null}
                    </div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
                    <SectionTitle icon={<GitBranch className="size-4" />} title={t("logicalModels.defaultsTitle")} />
                    <div className="mt-4 space-y-4">
                        {availableDefaultFields.map(({ capability, key, label }) => {
                            const options = logicalModels
                                .filter((model) => model.capability === capability && isLogicalModelResolvable(logicalModels, channels, capability, model.id))
                                .map((model) => ({ label: `${model.name} (${model.id})`, value: model.id }));
                            const selected = logicalModels.find((model) => model.id === defaultModels[key]);
                            const resolved = selected ? resolveLogicalModelConfig(logicalModels, channels, capability, selected.id) : null;
                            return (
                                <LabeledControl key={key} label={label}>
                                    <Select
                                        className="w-full"
                                        allowClear
                                        showSearch
                                        optionFilterProp="label"
                                        value={defaultModels[key] || undefined}
                                        placeholder={t("logicalModels.selectAvailable", { capability: capabilityText(capability, t) })}
                                        options={options}
                                        status={defaultModels[key] && !resolved ? "error" : undefined}
                                        onChange={(value) => updateDefault(key, value || "")}
                                    />
                                    <div className={`mt-1 flex items-center gap-1 text-xs ${resolved ? "text-stone-500 dark:text-stone-400" : "text-amber-600 dark:text-amber-400"}`}>
                                        {!resolved ? <AlertTriangle className="size-3.5 shrink-0" /> : null}
                                        <span>{resolved ? t("logicalModels.actualRoute", { route: `${resolved.channel.name} / ${resolved.binding.upstreamModel}` }) : defaultModels[key] ? t("logicalModels.defaultUnresolved") : t("logicalModels.defaultUnset")}</span>
                                    </div>
                                </LabeledControl>
                            );
                        })}
                    </div>
                </div>
            </div>

            <Drawer
                title={editingId ? t("logicalModels.editTitle") : t("logicalModels.createTitle")}
                size="large"
                open={drawerOpen}
                destroyOnHidden
                onClose={() => setDrawerOpen(false)}
                extra={
                    <Space>
                        <Button onClick={() => setDrawerOpen(false)}>{t("logicalModels.cancel")}</Button>
                        <Button type="primary" onClick={saveDraft}>
                            {t("logicalModels.apply")}
                        </Button>
                    </Space>
                }
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <LabeledControl label={t("logicalModels.logicalId")}>
                        <Input value={draft.id} disabled={Boolean(editingId)} placeholder={t("logicalModels.logicalIdPlaceholder")} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.displayName")}>
                        <Input value={draft.name} placeholder={t("logicalModels.displayNamePlaceholder")} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.capabilityType")}>
                        <Select className="w-full" value={draft.capability} options={capabilityOptions} onChange={(capability) => setDraft((current) => ({ ...current, capability }))} />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.modelStatus")}>
                        <div className="flex h-8 items-center">
                            <Switch checkedChildren={t("logicalModels.enabled")} unCheckedChildren={t("logicalModels.disabled")} checked={draft.enabled} onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))} />
                        </div>
                    </LabeledControl>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("logicalModels.bindingsTitle")}</h3>
                        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t("logicalModels.bindingsHint")}</p>
                    </div>
                    <Button size="small" icon={<Plus className="size-3.5" />} onClick={() => setDraft((current) => ({ ...current, bindings: [...current.bindings, createBinding(channels, current.bindings.length + 1)] }))}>
                        {t("logicalModels.addBinding")}
                    </Button>
                </div>
                <div className="mt-3 space-y-3">
                    {draft.bindings.map((binding) => (
                        <BindingEditor
                            key={binding.id}
                            t={t}
                            binding={binding}
                            capability={draft.capability}
                            channels={channels}
                            onChange={(patch) => setDraft((current) => ({ ...current, bindings: current.bindings.map((item) => (item.id === binding.id ? { ...item, ...patch } : item)) }))}
                            onDelete={() => setDraft((current) => ({ ...current, bindings: current.bindings.filter((item) => item.id !== binding.id) }))}
                        />
                    ))}
                    {!draft.bindings.length ? <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">{t("logicalModels.needBinding")}</div> : null}
                </div>
            </Drawer>
        </section>
    );
}

function BindingEditor({
    binding,
    capability,
    channels,
    onChange,
    onDelete,
    t,
}: {
    binding: LogicalModelBinding;
    capability: LogicalModelCapability;
    channels: SystemModelChannel[];
    onChange: (patch: Partial<LogicalModelBinding>) => void;
    onDelete: () => void;
    t: AdminTranslator;
}) {
    const channel = channels.find((item) => item.id === binding.channelId);
    const channelOptions = channels.map((item) => ({ label: `${item.name}${item.enabled ? "" : t("logicalModels.channelDisabledSuffix")}`, value: item.id }));
    const modelOptions = (channel?.models || []).map((model) => ({ label: model, value: model }));
    const profile = binding.capabilityProfile || {};
    const effectiveAsync = profile.supportsAsync ?? (capability === "image" || capability === "video");
    const timeoutSeconds = profile.timeoutMs ? Math.round(profile.timeoutMs / 1000) : undefined;
    const defaultTimeoutSeconds = capability === "image" ? 600 : capability === "text" ? 120 : 180;
    const updateProfile = (patch: Partial<LogicalModelCapabilityProfile>) => onChange({ capabilityProfile: { ...profile, ...patch } });
    const updateList = (field: "aspectRatios", value: string) =>
        updateProfile({
            [field]: value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
        });
    return (
        <div className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_90px_90px_auto] sm:items-end dark:border-stone-800 dark:bg-stone-900/40">
            <LabeledControl label={t("logicalModels.channel")}>
                <Select
                    className="w-full"
                    value={binding.channelId || undefined}
                    placeholder={t("logicalModels.selectChannel")}
                    options={channelOptions}
                    onChange={(channelId) => {
                        const nextChannel = channels.find((item) => item.id === channelId);
                        onChange({ channelId, upstreamModel: nextChannel?.models[0] || "" });
                    }}
                />
            </LabeledControl>
            <LabeledControl label={t("logicalModels.upstreamModel")}>
                <Select className="w-full" showSearch optionFilterProp="label" value={binding.upstreamModel || undefined} placeholder={t("logicalModels.selectFetchedModel")} options={modelOptions} onChange={(upstreamModel) => onChange({ upstreamModel })} />
            </LabeledControl>
            <LabeledControl label={t("logicalModels.priority")}>
                <InputNumber className="w-full" min={1} max={10000} precision={0} value={binding.priority} onChange={(priority) => onChange({ priority: Number(priority) || 1 })} />
            </LabeledControl>
            <LabeledControl label={t("logicalModels.weight")}>
                <InputNumber className="w-full" min={1} max={10000} precision={0} value={binding.weight || 100} onChange={(weight) => onChange({ weight: Number(weight) || 100 })} />
            </LabeledControl>
            <div className="flex h-8 items-center gap-2">
                <Switch size="small" checked={binding.enabled} onChange={(enabled) => onChange({ enabled })} />
                <Button danger size="small" icon={<Trash2 className="size-3.5" />} aria-label={t("logicalModels.deleteBindingAria")} onClick={onDelete} />
            </div>
            <div className="sm:col-span-5 rounded-md border border-stone-200/80 bg-white/70 p-3 dark:border-stone-800 dark:bg-stone-950/40">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <div className="text-xs font-semibold text-stone-700 dark:text-stone-200">{t("logicalModels.profileTitle")}</div>
                        <div className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">{t("logicalModels.profileHint")}</div>
                    </div>
                    <Tag className="m-0">{capabilityText(capability, t)}</Tag>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 dark:text-stone-300 sm:col-span-2 lg:col-span-4">
                        <Checkbox checked={profile.supportsReferenceImage === true} onChange={(event) => updateProfile({ supportsReferenceImage: event.target.checked })}>
                            {t("logicalModels.refImage")}
                        </Checkbox>
                        <Checkbox checked={profile.supportsReferenceVideo === true} onChange={(event) => updateProfile({ supportsReferenceVideo: event.target.checked })}>
                            {t("logicalModels.refVideo")}
                        </Checkbox>
                        <Checkbox checked={profile.supportsReferenceAudio === true} onChange={(event) => updateProfile({ supportsReferenceAudio: event.target.checked })}>
                            {t("logicalModels.refAudio")}
                        </Checkbox>
                        <Checkbox checked={effectiveAsync} onChange={(event) => updateProfile({ supportsAsync: event.target.checked })}>
                            {t("logicalModels.asyncQuery")}
                        </Checkbox>
                        <Checkbox checked={profile.supportsCancel === true} onChange={(event) => updateProfile({ supportsCancel: event.target.checked })}>
                            {t("logicalModels.upstreamCancel")}
                        </Checkbox>
                        <Checkbox checked={profile.supportsWebhook === true} onChange={(event) => updateProfile({ supportsWebhook: event.target.checked })}>
                            Webhook
                        </Checkbox>
                    </div>
                    <LabeledControl label={t("logicalModels.maxRefImages")}>
                        <InputNumber className="w-full" min={0} max={16} precision={0} value={profile.maxReferenceImages} onChange={(value) => updateProfile({ maxReferenceImages: Number(value) || 0 })} />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.maxBatch")}>
                        <InputNumber className="w-full" min={1} max={100} precision={0} value={profile.maxBatchSize} onChange={(value) => updateProfile({ maxBatchSize: Number(value) || 1 })} />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.minDuration")}>
                        <InputNumber className="w-full" min={0} max={3600} precision={0} value={profile.minDurationSeconds} onChange={(value) => updateProfile({ minDurationSeconds: Number(value) || 0 })} />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.maxDuration")}>
                        <InputNumber className="w-full" min={0} max={3600} precision={0} value={profile.maxDurationSeconds} onChange={(value) => updateProfile({ maxDurationSeconds: Number(value) || 0 })} />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.aspectRatios")}>
                        <Input value={profile.aspectRatios?.join(", ") || ""} placeholder="1:1, 16:9, 9:16" onChange={(event) => updateList("aspectRatios", event.target.value)} />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.timeoutMs")}>
                        <InputNumber
                            className="w-full"
                            min={5}
                            max={1800}
                            precision={0}
                            value={timeoutSeconds}
                            placeholder={String(defaultTimeoutSeconds)}
                            onChange={(value) => updateProfile({ timeoutMs: value ? Number(value) * 1000 : undefined })}
                        />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.concurrency")}>
                        <InputNumber className="w-full" min={1} max={1000} precision={0} value={profile.concurrencyLimit} onChange={(value) => updateProfile({ concurrencyLimit: Number(value) || 1 })} />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.unitCost")}>
                        <InputNumber className="w-full" min={0} precision={4} value={profile.unitCost} onChange={(value) => updateProfile({ unitCost: Number(value) || 0 })} />
                    </LabeledControl>
                    <LabeledControl label={t("logicalModels.costCurrency")}>
                        <Input value={profile.unitCostCurrency || ""} maxLength={12} placeholder="USD / CNY" onChange={(event) => updateProfile({ unitCostCurrency: event.target.value.trim().toUpperCase() })} />
                    </LabeledControl>
                </div>
            </div>
        </div>
    );
}

function createLogicalModel(channels: SystemModelChannel[]): LogicalModel {
    return { id: "", name: "", capability: "text", enabled: true, bindings: [createBinding(channels, 1)] };
}

function createBinding(channels: SystemModelChannel[], priority: number): LogicalModelBinding {
    const channel = channels.find((item) => item.enabled && item.models.length) || channels.find((item) => item.models.length) || channels[0];
    return { id: nanoid(), channelId: channel?.id || "", upstreamModel: channel?.models[0] || "", enabled: true, priority, weight: 100 };
}

function cloneLogicalModel(model: LogicalModel): LogicalModel {
    return { ...model, id: model.id.trim(), name: model.name.trim(), bindings: model.bindings.map((binding) => ({ ...binding })) };
}

function validateDraft(draft: LogicalModel, models: LogicalModel[], channels: SystemModelChannel[], editingId: string, t: AdminTranslator) {
    const id = draft.id.trim();
    if (!id) return t("logicalModels.validate.idRequired");
    if (!/^[a-zA-Z0-9._:/-]+$/.test(id)) return t("logicalModels.validate.idInvalid");
    if (models.some((model) => model.id !== editingId && model.id.toLowerCase() === id.toLowerCase())) return t("logicalModels.validate.idExists");
    if (!draft.name.trim()) return t("logicalModels.validate.nameRequired");
    if (!draft.bindings.length) return t("logicalModels.validate.bindingRequired");
    const seen = new Set<string>();
    for (const binding of draft.bindings) {
        const channel = channels.find((item) => item.id === binding.channelId);
        if (!channel) return t("logicalModels.validate.channelRequired");
        if (!binding.upstreamModel || !channel.models.some((model) => normalizeModelName(model) === normalizeModelName(binding.upstreamModel))) return t("logicalModels.validate.upstreamMissing", { channel: channel.name, model: binding.upstreamModel || t("logicalModels.validate.emptyModel") });
        const key = `${binding.channelId}:${normalizeModelName(binding.upstreamModel)}`;
        if (seen.has(key)) return t("logicalModels.validate.duplicateBinding");
        seen.add(key);
    }
    return "";
}

function clearDefaultReference(defaults: SystemDefaultModels, modelId: string): SystemDefaultModels {
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, value.toLowerCase() === modelId.toLowerCase() ? "" : value])) as SystemDefaultModels;
}

function capabilityText(capability: LogicalModelCapability, t: AdminTranslator) {
    return t(`logicalModels.capability.${capability}` as never);
}

function normalizeModelName(value: string) {
    return value
        .trim()
        .replace(/^models\//i, "")
        .toLowerCase();
}
