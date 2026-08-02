"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Empty, Input, Popconfirm, Select, Space, Switch, Table, Tabs, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { Blocks, FlaskConical, ListFilter, Plus, RefreshCw, Route, Search, Settings2, Trash2 } from "lucide-react";

import { AdminLogicalModelManager } from "@/components/admin/admin-logical-model-manager";
import type { ChannelHealthKind, ChannelHealthResult } from "@/components/admin/admin-system-channel-editor";
import type { SystemChannelProtocol, SystemModelChannel } from "@/lib/auth/store";
import { channelProtocolDefinitions } from "@/lib/channel-protocol-registry";
import { capabilityLabel, isLogicalModelResolvable } from "@/lib/model-routing-config";

import { AdminChannelDetailDrawer } from "./admin-channel-detail-drawer";
import { AdminChannelOnboardingDrawer } from "./admin-channel-onboarding-drawer";
import { ChannelStatusBadge } from "./admin-channel-status-badge";
import {
    channelBindingCount,
    channelCapabilityLabels,
    channelHealthEntries,
    channelProtocolLabel,
    channelSearchText,
    channelWorkspaceStatus,
    updateChannelInWorkspace,
    type ChannelWorkspaceSettings,
    type ChannelWorkspaceStatus,
} from "./admin-channel-workspace-model";

type Props = {
    settings: ChannelWorkspaceSettings;
    fetchingModelId: string;
    testingChannelKey: string;
    healthResults: Record<string, ChannelHealthResult>;
    saving: boolean;
    onChange: (settings: ChannelWorkspaceSettings) => void;
    onDeleteChannel: (channelId: string) => void;
    onFetchModels: (channel: SystemModelChannel) => Promise<void>;
    onFetchAll: () => Promise<void>;
    onTestHealth: (channel: SystemModelChannel, kind: ChannelHealthKind) => Promise<ChannelHealthResult | null>;
    onTestAll: (channel: SystemModelChannel) => Promise<void>;
    onPersist: (settings: ChannelWorkspaceSettings, successText: string) => Promise<boolean>;
};

export function AdminChannelWorkspace({ settings, fetchingModelId, testingChannelKey, healthResults, saving, onChange, onDeleteChannel, onFetchModels, onFetchAll, onTestHealth, onTestAll, onPersist }: Props) {
    const t = useTranslations("admin");
    const capabilityLabels = {
        text: t("channelEditor.kinds.text"),
        image: t("channelEditor.kinds.image"),
        video: t("channelEditor.kinds.video"),
        audio: t("channelEditor.kinds.audio"),
    };
    const [activeTab, setActiveTab] = useState("channels");
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<ChannelWorkspaceStatus | "all">("all");
    const [protocolFilter, setProtocolFilter] = useState<SystemChannelProtocol | "all">("all");
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wizardProtocol, setWizardProtocol] = useState<SystemChannelProtocol | undefined>();
    const [detailId, setDetailId] = useState("");
    const deferredQuery = useDeferredValue(query.trim().toLowerCase());
    const selectedChannel = settings.systemChannels.find((channel) => channel.id === detailId);
    const visibleChannels = useMemo(
        () =>
            settings.systemChannels.filter((channel) => {
                const status = channelWorkspaceStatus(channel, healthResults);
                return (!deferredQuery || channelSearchText(channel).includes(deferredQuery)) && (statusFilter === "all" || status === statusFilter) && (protocolFilter === "all" || (channel.advancedConfig?.protocol || "auto") === protocolFilter);
            }),
        [deferredQuery, healthResults, protocolFilter, settings.systemChannels, statusFilter],
    );
    const enabledChannels = settings.systemChannels.filter((channel) => channel.enabled).length;
    const healthyChannels = settings.systemChannels.filter((channel) => channelWorkspaceStatus(channel, healthResults) === "healthy").length;
    const protocolCount = new Set(settings.systemChannels.map((channel) => channel.advancedConfig?.protocol || "auto")).size;
    const readyDefaults = (["text", "image", "video", "audio"] as const).filter((capability) => {
        const key = capability === "text" ? "textModel" : capability === "image" ? "imageModel" : capability === "video" ? "videoModel" : "audioModel";
        return isLogicalModelResolvable(settings.logicalModels, settings.systemChannels, capability, settings.defaultModels[key]);
    }).length;
    const openWizard = (protocol?: SystemChannelProtocol) => {
        setWizardProtocol(protocol);
        setWizardOpen(true);
    };
    const updateChannel = (id: string, patch: Partial<SystemModelChannel>) => onChange(updateChannelInWorkspace(settings, id, patch));
    const columns: TableColumnsType<SystemModelChannel> = [
        {
            title: t("channelWorkspace.columns.channel"),
            key: "channel",
            render: (_, channel) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="max-w-[240px] truncate font-medium text-stone-950 dark:text-stone-100">{channel.name || t("channelWorkspace.unnamed")}</span>
                        <ChannelStatusTag channel={channel} healthResults={healthResults} />
                    </div>
                    <div className="mt-1 max-w-[320px] truncate text-xs text-stone-500 dark:text-stone-400">{channel.baseUrl || t("channelWorkspace.baseUrlMissing")}</div>
                </div>
            ),
        },
        { title: t("channelWorkspace.columns.protocol"), key: "protocol", width: 190, render: (_, channel) => <span className="text-sm">{channelProtocolLabel(channel, t)}</span> },
        { title: t("channelWorkspace.columns.models"), key: "models", width: 90, align: "center", render: (_, channel) => channel.models.length },
        {
            title: t("channelWorkspace.columns.capabilities"),
            key: "capabilities",
            width: 170,
            render: (_, channel) => <span className="text-xs text-stone-600 dark:text-stone-300">{channelCapabilityLabels(channel, capabilityLabels).join(" / ") || t("channelWorkspace.pendingDetect")}</span>,
        },
        { title: t("channelWorkspace.columns.bindings"), key: "bindings", width: 80, align: "center", render: (_, channel) => channelBindingCount(channel.id, settings) },
        {
            title: t("channelWorkspace.columns.enabled"),
            key: "enabled",
            width: 80,
            align: "center",
            render: (_, channel) => <Switch size="small" checked={channel.enabled} aria-label={t("channelWorkspace.enabledAria", { name: channel.name })} onChange={(enabled) => updateChannel(channel.id, { enabled })} />,
        },
        {
            title: t("channelWorkspace.columns.actions"),
            key: "actions",
            width: 260,
            render: (_, channel) => (
                <Space size={4}>
                    <Button size="small" onClick={() => setDetailId(channel.id)}>
                        {t("channelWorkspace.view")}
                    </Button>
                    <Button
                        size="small"
                        icon={<RefreshCw className="size-3.5" />}
                        loading={fetchingModelId === channel.id}
                        aria-label={t("channelWorkspace.syncModelsAria", { name: channel.name })}
                        title={t("channelWorkspace.syncModelsTitle")}
                        onClick={() => void onFetchModels(channel)}
                    />
                    <Button
                        size="small"
                        icon={<FlaskConical className="size-3.5" />}
                        loading={testingChannelKey === `${channel.id}:all`}
                        aria-label={t("channelWorkspace.testChannelAria", { name: channel.name })}
                        title={t("channelWorkspace.testChannelTitle")}
                        onClick={() => void onTestAll(channel)}
                    />
                    <Popconfirm title={t("channelWorkspace.deleteTitle")} description={t("channelWorkspace.deleteDesc")} okText={t("channelWorkspace.delete")} cancelText={t("channelWorkspace.cancel")} onConfirm={() => onDeleteChannel(channel.id)}>
                        <Button size="small" danger icon={<Trash2 className="size-3.5" />} aria-label={t("channelWorkspace.deleteAria", { name: channel.name })} title={t("channelWorkspace.deleteAria", { name: channel.name })} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <ChannelMetrics enabled={enabledChannels} total={settings.systemChannels.length} healthy={healthyChannels} protocols={protocolCount} readyDefaults={readyDefaults} />
            <Tabs
                className="max-sm:[&_.ant-tabs-nav-list]:w-full max-sm:[&_.ant-tabs-tab]:!m-0 max-sm:[&_.ant-tabs-tab]:min-w-0 max-sm:[&_.ant-tabs-tab]:flex-1 max-sm:[&_.ant-tabs-tab]:justify-center max-sm:[&_.ant-tabs-tab]:!px-1"
                activeKey={activeTab}
                onChange={setActiveTab}
                tabBarExtraContent={
                    <div className="hidden sm:flex sm:items-center sm:gap-2">
                        <Button icon={<RefreshCw className="size-4" />} loading={fetchingModelId === "all"} onClick={() => void onFetchAll()}>
                            {t("channelWorkspace.syncAll")}
                        </Button>
                        <Button type="primary" icon={<Plus className="size-4" />} onClick={() => openWizard()}>
                            {t("channelWorkspace.onboard")}
                        </Button>
                    </div>
                }
                items={[
                    {
                        key: "channels",
                        label: <TabLabel icon={<Settings2 className="size-4" />} text={t("channelWorkspace.tabs.manage")} />,
                        children: (
                            <ChannelList
                                channels={visibleChannels}
                                allChannels={settings.systemChannels}
                                columns={columns}
                                query={query}
                                statusFilter={statusFilter}
                                protocolFilter={protocolFilter}
                                fetchingModelId={fetchingModelId}
                                testingChannelKey={testingChannelKey}
                                healthResults={healthResults}
                                settings={settings}
                                onQuery={setQuery}
                                onStatus={setStatusFilter}
                                onProtocol={setProtocolFilter}
                                onOpen={setDetailId}
                                onCreate={() => openWizard()}
                                onFetchAll={() => void onFetchAll()}
                                onFetch={(channel) => void onFetchModels(channel)}
                                onTest={(channel) => void onTestAll(channel)}
                            />
                        ),
                    },
                    { key: "protocols", label: <TabLabel icon={<Blocks className="size-4" />} text={t("channelWorkspace.tabs.protocols")} />, children: <ProtocolCenter settings={settings} onCreate={openWizard} onOpenChannel={setDetailId} /> },
                    {
                        key: "logical",
                        label: <TabLabel icon={<Route className="size-4" />} text={t("channelWorkspace.tabs.logical")} />,
                        children: <AdminLogicalModelManager channels={settings.systemChannels} logicalModels={settings.logicalModels} defaultModels={settings.defaultModels} onChange={(routing) => onChange({ ...settings, ...routing })} />,
                    },
                    { key: "validation", label: <TabLabel icon={<FlaskConical className="size-4" />} text={t("channelWorkspace.tabs.validation")} />, children: <ValidationRecords settings={settings} healthResults={healthResults} onOpen={setDetailId} /> },
                ]}
            />
            <div className="mt-3 flex gap-2 sm:hidden">
                <Button className="min-w-0 flex-1" icon={<RefreshCw className="size-4" />} loading={fetchingModelId === "all"} onClick={() => void onFetchAll()}>
                    {t("channelWorkspace.syncModels")}
                </Button>
                <Button className="min-w-0 flex-1" type="primary" icon={<Plus className="size-4" />} onClick={() => openWizard()}>
                    {t("channelWorkspace.onboardShort")}
                </Button>
            </div>
            <AdminChannelOnboardingDrawer
                open={wizardOpen}
                initialProtocol={wizardProtocol}
                settings={settings}
                fetchingModelId={fetchingModelId}
                testingChannelKey={testingChannelKey}
                healthResults={healthResults}
                saving={saving}
                onClose={() => setWizardOpen(false)}
                onChange={onChange}
                onFetchModels={onFetchModels}
                onTestAll={onTestAll}
                onPersist={onPersist}
            />
            <AdminChannelDetailDrawer
                open={Boolean(selectedChannel)}
                channel={selectedChannel}
                settings={settings}
                fetching={fetchingModelId === selectedChannel?.id}
                testingKey={testingChannelKey}
                healthResults={healthResults}
                onClose={() => setDetailId("")}
                onChange={(patch) => selectedChannel && updateChannel(selectedChannel.id, patch)}
                onDelete={() => selectedChannel && onDeleteChannel(selectedChannel.id)}
                onFetchModels={() => selectedChannel && void onFetchModels(selectedChannel)}
                onTestHealth={(kind) => selectedChannel && void onTestHealth(selectedChannel, kind)}
                onTestAll={() => selectedChannel && void onTestAll(selectedChannel)}
            />
        </div>
    );
}

function ChannelMetrics({ enabled, total, healthy, protocols, readyDefaults }: { enabled: number; total: number; healthy: number; protocols: number; readyDefaults: number }) {
    const t = useTranslations("admin");
    const metrics = [
        { label: t("channelWorkspace.metrics.enabled"), value: `${enabled}/${total}` },
        { label: t("channelWorkspace.metrics.healthy"), value: String(healthy) },
        { label: t("channelWorkspace.metrics.protocols"), value: String(protocols) },
        { label: t("channelWorkspace.metrics.defaults"), value: `${readyDefaults}/4` },
    ];
    return (
        <div className="grid grid-cols-2 border-b border-stone-200 sm:grid-cols-4 dark:border-stone-800">
            {metrics.map((metric, index) => (
                <div key={metric.label} className={`px-2 py-3 sm:px-4 ${index % 2 ? "border-l" : ""} ${index > 1 ? "border-t sm:border-t-0" : ""} sm:border-l dark:border-stone-800`}>
                    <div className="text-xs text-stone-500 dark:text-stone-400">{metric.label}</div>
                    <div className="mt-1 text-lg font-semibold text-stone-950 dark:text-stone-100">{metric.value}</div>
                </div>
            ))}
        </div>
    );
}

function ChannelList({
    channels,
    allChannels,
    columns,
    query,
    statusFilter,
    protocolFilter,
    fetchingModelId,
    testingChannelKey,
    healthResults,
    settings,
    onQuery,
    onStatus,
    onProtocol,
    onOpen,
    onCreate,
    onFetchAll,
    onFetch,
    onTest,
}: {
    channels: SystemModelChannel[];
    allChannels: SystemModelChannel[];
    columns: TableColumnsType<SystemModelChannel>;
    query: string;
    statusFilter: ChannelWorkspaceStatus | "all";
    protocolFilter: SystemChannelProtocol | "all";
    fetchingModelId: string;
    testingChannelKey: string;
    healthResults: Record<string, ChannelHealthResult>;
    settings: ChannelWorkspaceSettings;
    onQuery: (value: string) => void;
    onStatus: (value: ChannelWorkspaceStatus | "all") => void;
    onProtocol: (value: SystemChannelProtocol | "all") => void;
    onOpen: (id: string) => void;
    onCreate: () => void;
    onFetchAll: () => void;
    onFetch: (channel: SystemModelChannel) => void;
    onTest: (channel: SystemModelChannel) => void;
}) {
    const t = useTranslations("admin");
    return (
        <div>
            <div className="mb-3 flex min-w-0 flex-col gap-2 md:flex-row">
                <Input allowClear className="min-w-0 flex-1" prefix={<Search className="size-4 text-stone-400" />} value={query} placeholder={t("channelWorkspace.searchPlaceholder")} onChange={(event) => onQuery(event.target.value)} />
                <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
                    <div className="min-w-0 md:w-32">
                        <Select
                            className="w-full"
                            value={statusFilter}
                            options={[
                                { label: t("channelWorkspace.statusAll"), value: "all" },
                                { label: t("channelWorkspace.statusHealthy"), value: "healthy" },
                                { label: t("channelWorkspace.statusWarning"), value: "warning" },
                                { label: t("channelWorkspace.statusUntested"), value: "untested" },
                                { label: t("channelWorkspace.statusDraft"), value: "draft" },
                                { label: t("channelWorkspace.statusDisabled"), value: "disabled" },
                            ]}
                            onChange={onStatus}
                        />
                    </div>
                    <div className="min-w-0 md:w-44">
                        <Select
                            className="w-full"
                            value={protocolFilter}
                            options={[{ label: t("channelWorkspace.protocolAll"), value: "all" }, ...channelProtocolDefinitions.map((definition) => ({ label: t(`channelEditor.protocols.${definition.id}.label`), value: definition.id }))]}
                            onChange={onProtocol}
                        />
                    </div>
                </div>
            </div>
            <div className="hidden md:block">
                <Table
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 12, hideOnSinglePage: true }}
                    columns={columns}
                    dataSource={channels}
                    scroll={{ x: 1060 }}
                    locale={{ emptyText: <ChannelEmpty hasChannels={Boolean(allChannels.length)} onCreate={onCreate} /> }}
                />
            </div>
            <div className="space-y-2 md:hidden">
                {channels.map((channel) => (
                    <div key={channel.id} className="min-w-0 overflow-hidden rounded-md border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-sm font-semibold text-stone-950 dark:text-stone-100">{channel.name || t("channelWorkspace.unnamed")}</span>
                                    <ChannelStatusTag channel={channel} healthResults={healthResults} />
                                </div>
                                <div className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">{channelProtocolLabel(channel, t)}</div>
                            </div>
                            <Switch size="small" checked={channel.enabled} disabled aria-label={t("channelWorkspace.enabledStateAria", { name: channel.name })} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                            <span>{t("channelWorkspace.modelCount", { count: channel.models.length })}</span>
                            <span>
                                {channelCapabilityLabels(channel, {
                                    text: t("channelEditor.kinds.text"),
                                    image: t("channelEditor.kinds.image"),
                                    video: t("channelEditor.kinds.video"),
                                    audio: t("channelEditor.kinds.audio"),
                                }).join(" / ") || t("channelWorkspace.capabilityPending")}
                            </span>
                            <span>{t("channelWorkspace.bindingCount", { count: channelBindingCount(channel.id, settings) })}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3 dark:border-stone-900">
                            <Button size="small" className="min-w-0 flex-1" onClick={() => onOpen(channel.id)}>
                                {t("channelWorkspace.view")}
                            </Button>
                            <Button size="small" icon={<RefreshCw className="size-3.5" />} loading={fetchingModelId === channel.id} aria-label={t("channelWorkspace.syncModelsAria", { name: channel.name })} onClick={() => onFetch(channel)} />
                            <Button size="small" icon={<FlaskConical className="size-3.5" />} loading={testingChannelKey === `${channel.id}:all`} aria-label={t("channelWorkspace.testChannelAria", { name: channel.name })} onClick={() => onTest(channel)} />
                        </div>
                    </div>
                ))}
                {!channels.length ? <ChannelEmpty hasChannels={Boolean(allChannels.length)} onCreate={onCreate} /> : null}
            </div>
        </div>
    );
}

function ProtocolCenter({ settings, onCreate, onOpenChannel }: { settings: ChannelWorkspaceSettings; onCreate: (protocol?: SystemChannelProtocol) => void; onOpenChannel: (id: string) => void }) {
    const t = useTranslations("admin");
    const definitions = channelProtocolDefinitions.filter((definition) => !["auto", "compatible"].includes(definition.id));
    const customChannels = settings.systemChannels.filter((channel) => channel.advancedConfig?.protocol === "custom");
    return (
        <div className="space-y-6">
            <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("channelWorkspace.builtInProtocols")}</div>
                    <Tag>{t("channelWorkspace.countUnit", { count: definitions.length })}</Tag>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                    {definitions.map((definition) => {
                        const used = settings.systemChannels.filter((channel) => channel.advancedConfig?.protocol === definition.id).length;
                        return (
                            <div key={definition.id} className="rounded-md border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t(`channelEditor.protocols.${definition.id}.label`)}</span>
                                            <Tag className="m-0">{t("channelWorkspace.builtIn")}</Tag>
                                            {definition.strict ? <Tag className="m-0 !border-stone-300 !bg-stone-50 !text-stone-700 dark:!border-stone-700 dark:!bg-stone-900 dark:!text-stone-200">{t("channelWorkspace.strict")}</Tag> : null}
                                        </div>
                                        <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{t(`channelEditor.protocols.${definition.id}.description`)}</div>
                                    </div>
                                    <Button size="small" onClick={() => onCreate(definition.id)}>
                                        {t("channelWorkspace.connect")}
                                    </Button>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                    {definition.capabilities.map((capability) => (
                                        <Tag key={capability}>
                                            {capabilityLabel(capability, {
                                                text: t("channelEditor.kinds.text"),
                                                image: t("channelEditor.kinds.image"),
                                                video: t("channelEditor.kinds.video"),
                                                audio: t("channelEditor.kinds.audio"),
                                            })}
                                        </Tag>
                                    ))}
                                    <span className="ml-auto text-xs text-stone-500 dark:text-stone-400">{t("channelWorkspace.usedBy", { count: used })}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
            <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("channelWorkspace.customDrafts")}</div>
                        <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t("channelWorkspace.customDraftsHint")}</div>
                    </div>
                    <Button icon={<Plus className="size-4" />} onClick={() => onCreate("custom")}>
                        {t("channelWorkspace.createCustom")}
                    </Button>
                </div>
                <div className="divide-y divide-stone-200 border-y border-stone-200 dark:divide-stone-800 dark:border-stone-800">
                    {customChannels.map((channel) => (
                        <div key={channel.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-stone-950 dark:text-stone-100">{channel.name}</div>
                                <div className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">{channel.advancedConfig?.documentationUrl || channel.baseUrl || t("channelWorkspace.docUrlMissing")}</div>
                            </div>
                            <Space>
                                <Tag>{channel.enabled ? t("channelWorkspace.channelEnabled") : t("channelWorkspace.channelDraft")}</Tag>
                                <Button size="small" onClick={() => onOpenChannel(channel.id)}>
                                    {t("channelWorkspace.continueConfig")}
                                </Button>
                            </Space>
                        </div>
                    ))}
                    {!customChannels.length ? <div className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">{t("channelWorkspace.noCustomDrafts")}</div> : null}
                </div>
            </section>
        </div>
    );
}

function ValidationRecords({ settings, healthResults, onOpen }: { settings: ChannelWorkspaceSettings; healthResults: Record<string, ChannelHealthResult>; onOpen: (id: string) => void }) {
    const t = useTranslations("admin");
    const records = settings.systemChannels.flatMap((channel) => channelHealthEntries(channel.id, healthResults, channel.healthResults).map((entry) => ({ ...entry, channel })));
    return (
        <div>
            <div className="mb-3 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <ListFilter className="size-4" /> {t("channelWorkspace.sessionResults")}
            </div>
            <div className="divide-y divide-stone-200 border-y border-stone-200 dark:divide-stone-800 dark:border-stone-800">
                {records.map(({ key, result, channel }) => (
                    <button key={key} type="button" className="flex w-full min-w-0 flex-col gap-2 py-3 text-left hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-stone-900/60" onClick={() => onOpen(channel.id)}>
                        <div className="min-w-0 px-2">
                            <div className="truncate text-sm font-medium text-stone-950 dark:text-stone-100">
                                {channel.name} ·{" "}
                                {capabilityLabel(result.kind, {
                                    text: t("channelEditor.kinds.text"),
                                    image: t("channelEditor.kinds.image"),
                                    video: t("channelEditor.kinds.video"),
                                    audio: t("channelEditor.kinds.audio"),
                                })}
                            </div>
                            <div className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">
                                {result.model || t("channelWorkspace.modelUnset")} · {result.protocol || channelProtocolLabel(channel, t)}
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 px-2">
                            <span className="text-xs text-stone-500 dark:text-stone-400">HTTP {result.status || "-"}</span>
                            <Tag color={result.ok ? "success" : "error"}>{result.ok ? t("channelWorkspace.pass") : t("channelWorkspace.fail")}</Tag>
                        </div>
                    </button>
                ))}
                {!records.length ? <div className="py-12 text-center text-sm text-stone-500 dark:text-stone-400">{t("channelWorkspace.noValidation")}</div> : null}
            </div>
        </div>
    );
}

function ChannelStatusTag({ channel, healthResults }: { channel: SystemModelChannel; healthResults: Record<string, ChannelHealthResult> }) {
    const status = channelWorkspaceStatus(channel, healthResults);
    return <ChannelStatusBadge status={status} />;
}

function ChannelEmpty({ hasChannels, onCreate }: { hasChannels: boolean; onCreate: () => void }) {
    const t = useTranslations("admin");
    return (
        <div className="py-10 text-center">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={hasChannels ? t("channelWorkspace.noMatch") : t("channelWorkspace.noChannels")} />
            {!hasChannels ? (
                <Button type="primary" icon={<Plus className="size-4" />} onClick={onCreate}>
                    {t("channelWorkspace.onboardFirst")}
                </Button>
            ) : null}
        </div>
    );
}

function TabLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <span className="inline-flex items-center whitespace-nowrap sm:gap-1.5">
            <span className="hidden sm:inline-flex" aria-hidden>
                {icon}
            </span>
            {text}
        </span>
    );
}
