"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Pagination, Popconfirm, Segmented, Select, Space, Switch, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BillingOperations } from "@/app/admin/billing/components/billing-operations";
import { GenerationOperationsClient } from "@/app/admin/generation-operations/components/generation-operations-client";
import {
    formatAdminLogDuration,
    formatAdminLogTime,
    formatGenerationLogModel,
    GenerationLogAssetPreview,
    GenerationLogDetail,
    GenerationLogMobileCard,
    generationKindLabel,
    generationSourceLabel,
    generationStatusClass,
    generationStatusLabel,
} from "@/components/admin/admin-generation-log";
import { GenerationConcurrencyPanel, GenerationDefaultsPanel, localAgentReadiness } from "@/components/admin/admin-generation-settings";
import type { AgentReadiness } from "@/components/admin/admin-generation-settings";
import { AdminLocalMediaStorage } from "@/components/admin/admin-local-media-storage";
import { QuotaRuleTable } from "@/components/admin/admin-quota-rules";
import { AdminOverview, buildOperationsSummary } from "@/components/admin/admin-overview";
import { AdminLogicalModelManager } from "@/components/admin/admin-logical-model-manager";
import { Metric, Panel, PanelHeader } from "@/components/admin/admin-panel";
import { AdminSectionNav, adminSections } from "@/components/admin/admin-section-nav";
import type { AdminSectionKey } from "@/components/admin/admin-sections";
import { UpdateCenterPanel } from "@/components/admin/admin-update-center";
import { LabeledControl, SectionTitle, SettingInlineToggle, SettingToggle } from "@/components/admin/admin-settings-controls";
import { SiteLogoPreview, SiteSettingStatus, SiteShowcasePreview, siteSocialItems } from "@/components/admin/admin-site-preview";
import { createDefaultChannelAdvancedConfig, healthKindLabel, SystemChannelEditor } from "@/components/admin/admin-system-channel-editor";
import type { ChannelHealthKind, ChannelHealthResult } from "@/components/admin/admin-system-channel-editor";
import { formatAdminMoney, toNumberOrOne, toNumberOrZero, uniqueList } from "@/components/admin/admin-values";
import {
    ArrowRight,
    ChevronDown,
    Copy,
    CreditCard,
    CircleDollarSign,
    Database,
    Download,
    ExternalLink,
    Eye,
    Gift,
    Globe2,
    Image as ImageIcon,
    KeyRound,
    Mail,
    Menu,
    PlugZap,
    Plus,
    ReceiptText,
    RefreshCw,
    Save,
    Search,
    Send,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Upload,
    UserCog,
    UserRound,
    WalletCards,
} from "lucide-react";
import dayjs from "dayjs";
import { nanoid } from "nanoid";

import { formatCreditAmount } from "@/constant/credits";
import { normalizeDefaultModelsConfig } from "@/lib/model-routing-config";
import type { AgentSkill, AuthSettings, CreatedCdkCode, PublicAnnouncement, PublicCdkCode, PublicUser, SiteFriendLink, SiteShowcaseItem, SiteSocialKey, SystemChannelAdvancedConfig, SystemModelChannel, UserRole, UserStatus } from "@/lib/auth/store";
import type { GenerationAssetStats, StoredGenerationLog } from "@/lib/server/generation-log-store";
import type { AdminSetupSummary } from "@/lib/server/admin-setup-status";
import type { PaymentConfigSummary } from "@/lib/payment-config-types";
import type { AdminBillingSummary } from "@/lib/admin-billing-types";
import type { Prompt } from "@/services/api/prompts";

import type { AdminDashboardController } from "./use-admin-dashboard-controller";
import {
    settingsStatusToneClass,
    SettingsStatusTile,
    SettingsAnchorItem,
    FinanceFlowItem,
    FinanceMiniRow,
    createSystemChannel,
    suggestedChannelModels,
    buildAdvancedConfigFromHealth,
    firstOkResult,
    requestAdminModels,
    selectChannelHealthModel,
    modelNameFromOption,
    isCdkExpired,
    cdkStatusLabel,
    cdkStatusTone,
    formatCreatedCdkExport,
    downloadTextFile,
    CdkRedemptionDetail,
    splitTags,
    clampInteger,
} from "./admin-dashboard-elements";
import { PROMPT_PAGE_SIZE, PROMPT_SEARCH_DEBOUNCE_MS, CDK_PAGE_SIZE, GENERATION_LOG_PAGE_SIZE } from "./use-admin-dashboard-controller";

export function AdminChannelsSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const {
        settings,
        setSettings,
        settingsLoading,
        fetchingModelId,
        testingChannelKey,
        channelHealthResults,
        activeSection,
        settingsSummary,
        saveSettings,
        updateChannel,
        addChannel,
        deleteChannel,
        fetchModelsForChannel,
        fetchAllModels,
        testChannelHealth,
        testAllChannelHealth,
    } = controller;
    if (activeSection !== "channels") return null;
    return (
        <Panel>
            <PanelHeader
                title={t("upstreamSections.channels.title")}
                description={t("upstreamSections.channels.description")}
                actions={
                    <div className="flex items-center justify-end gap-1.5 sm:w-auto sm:flex-row sm:gap-2">
                        <div className="hidden flex-wrap gap-2 text-xs text-stone-500 sm:flex dark:text-stone-400">
                            <Tag className="m-0">{t("upstreamSections.channels.channelCount", { enabled: settingsSummary.enabledChannels, total: settingsSummary.totalChannels })}</Tag>
                            <Tag className="m-0">{t("upstreamSections.channels.modelCount", { count: settingsSummary.models })}</Tag>
                        </div>
                        <div className="flex items-center gap-1.5 sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2">
                            <Button
                                aria-label={t("upstreamSections.channels.fetchAllModels")}
                                title={t("upstreamSections.channels.fetchAllModels")}
                                icon={<RefreshCw className="size-4" />}
                                loading={fetchingModelId === "all"}
                                onClick={() => void fetchAllModels()}
                            >
                                <span className="hidden sm:inline">{t("upstreamSections.channels.fetchAllModels")}</span>
                            </Button>
                            <Button aria-label={t("upstreamSections.channels.addChannel")} title={t("upstreamSections.channels.addChannel")} icon={<Plus className="size-4" />} onClick={addChannel}>
                                <span className="sm:hidden">{t("upstreamSections.channels.addShort")}</span>
                                <span className="hidden sm:inline">{t("upstreamSections.channels.addChannel")}</span>
                            </Button>
                            <Button
                                type="primary"
                                aria-label={t("upstreamSections.channels.saveConfig")}
                                title={t("upstreamSections.channels.saveConfig")}
                                loading={settingsLoading}
                                icon={<Save className="size-4" />}
                                onClick={() => saveSettings({ systemChannels: settings.systemChannels, logicalModels: settings.logicalModels, defaultModels: settings.defaultModels }, t("upstreamSections.channels.saved"))}
                            >
                                <span className="sm:hidden">{t("upstreamSections.channels.saveShort")}</span>
                                <span className="hidden sm:inline">{t("upstreamSections.channels.saveConfig")}</span>
                            </Button>
                        </div>
                    </div>
                }
            />
            <div className="space-y-3 p-3 sm:space-y-5 sm:p-5">
                <div className="hidden flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50/70 p-3 sm:flex xl:flex-row xl:items-center xl:justify-between dark:border-stone-800 dark:bg-stone-900/40">
                    <div className="text-sm leading-6 text-stone-600 dark:text-stone-300">{t("upstreamSections.channels.userNote")}</div>
                </div>
                <div className="space-y-3">
                    {settings.systemChannels.map((channel) => (
                        <SystemChannelEditor
                            key={channel.id}
                            channel={channel}
                            fetching={fetchingModelId === channel.id}
                            testingKey={testingChannelKey}
                            healthResults={channelHealthResults}
                            onChange={(patch) => updateChannel(channel.id, patch)}
                            onDelete={() => deleteChannel(channel.id)}
                            onFetchModels={() => void fetchModelsForChannel(channel)}
                            onTestHealth={(kind) => void testChannelHealth(channel, kind)}
                            onTestAllHealth={() => void testAllChannelHealth(channel)}
                        />
                    ))}
                    {!settings.systemChannels.length ? (
                        <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/70 p-5 text-center text-sm text-stone-500 sm:p-8 dark:border-stone-800 dark:bg-stone-900/30 dark:text-stone-400">
                            {t("upstreamSections.channels.empty")}
                        </div>
                    ) : null}
                </div>
                <AdminLogicalModelManager channels={settings.systemChannels} logicalModels={settings.logicalModels} defaultModels={settings.defaultModels} onChange={(routing) => setSettings((current) => ({ ...current, ...routing }))} />
                <section className="hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <SectionTitle icon={<Sparkles className="size-4" />} title="Agent Skills" />
                        <Button
                            icon={<Plus className="size-4" />}
                            onClick={() =>
                                setSettings((current) => ({
                                    ...current,
                                    agentSkills: [
                                        ...current.agentSkills,
                                        {
                                            id: nanoid(),
                                            name: t("upstreamSections.channels.newSkillName"),
                                            description: "",
                                            instructions: "",
                                            enabled: true,
                                            keywords: [],
                                            workspaces: ["image"],
                                            action: "generate",
                                            requiresReference: false,
                                            defaultConfig: {},
                                        },
                                    ],
                                }))
                            }
                        >
                            {t("upstreamSections.channels.addSkill")}
                        </Button>
                    </div>
                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        {settings.agentSkills.map((skill) => (
                            <div key={skill.id} className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-950/40">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <Switch
                                        checked={skill.enabled}
                                        checkedChildren={t("channelEditor.enabled")}
                                        unCheckedChildren={t("channelEditor.disabled")}
                                        onChange={(enabled) => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, enabled } : item)) }))}
                                    />
                                    <Button type="text" danger icon={<Trash2 className="size-4" />} onClick={() => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.filter((item) => item.id !== skill.id) }))}>
                                        {t("common.delete")}
                                    </Button>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Input
                                        value={skill.name}
                                        placeholder={t("upstreamSections.channels.skillNamePlaceholder")}
                                        onChange={(event) => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, name: event.target.value } : item)) }))}
                                    />
                                    <Input
                                        value={skill.keywords.join("、")}
                                        placeholder={t("upstreamSections.channels.keywordsPlaceholder")}
                                        onChange={(event) =>
                                            setSettings((current) => ({
                                                ...current,
                                                agentSkills: current.agentSkills.map((item) =>
                                                    item.id === skill.id
                                                        ? {
                                                              ...item,
                                                              keywords: event.target.value
                                                                  .split(/[、,，]/)
                                                                  .map((word) => word.trim())
                                                                  .filter(Boolean),
                                                          }
                                                        : item,
                                                ),
                                            }))
                                        }
                                    />
                                </div>
                                <Input
                                    className="mt-3"
                                    value={skill.description}
                                    placeholder={t("upstreamSections.channels.descriptionPlaceholder")}
                                    onChange={(event) => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, description: event.target.value } : item)) }))}
                                />
                                <Input.TextArea
                                    className="mt-3"
                                    autoSize={{ minRows: 4, maxRows: 10 }}
                                    value={skill.instructions}
                                    placeholder={t("upstreamSections.channels.instructionsPlaceholder")}
                                    onChange={(event) => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, instructions: event.target.value } : item)) }))}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </Panel>
    );
}

export function AdminSkillsSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const { message, settings, setSettings, settingsLoading, activeSection, agentReadiness, saveSettings } = controller;
    if (activeSection !== "skills") return null;
    return (
        <Panel>
            <PanelHeader
                title={t("upstreamSections.skills.title")}
                description={t("upstreamSections.skills.description")}
                actions={
                    <>
                        <Button
                            icon={<Plus className="size-4" />}
                            onClick={() =>
                                setSettings((current) => ({
                                    ...current,
                                    agentSkills: [...current.agentSkills, { id: nanoid(), name: t("upstreamSections.skills.newSkillName"), description: "", instructions: "", enabled: true, keywords: [] }],
                                }))
                            }
                        >
                            {t("upstreamSections.skills.addSkill")}
                        </Button>
                        <Button type="primary" loading={settingsLoading} icon={<Save className="size-4" />} onClick={() => saveSettings({ agentSkills: settings.agentSkills }, t("upstreamSections.skills.saved"))}>
                            {t("common.save")}
                        </Button>
                    </>
                }
            />
            {agentReadiness ? (
                <div className="mx-4 mt-4 rounded-lg border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40 sm:mx-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">{t("upstreamSections.skills.readinessTitle")}</div>
                        <Tag color={agentReadiness.ready ? "success" : "warning"}>{agentReadiness.ready ? t("upstreamSections.skills.readyAll") : t("upstreamSections.skills.needConfig")}</Tag>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {agentReadiness.capabilities.map((item) => (
                            <div key={item.type} className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{t(`channelEditor.kinds.${item.type}`)}</span>
                                    <span className={item.ready ? "text-emerald-600" : "text-amber-600"}>{item.ready ? t("upstreamSections.skills.ready") : t("upstreamSections.skills.notReady")}</span>
                                </div>
                                <div className="mt-1 truncate text-xs text-stone-500">{item.model || t("upstreamSections.skills.modelUnset")}</div>
                                <div className="mt-1 text-xs text-stone-500">{item.message}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 text-xs text-stone-500">
                        {t("upstreamSections.skills.enabledSkillsSummary", {
                            image: agentReadiness.skills.image,
                            video: agentReadiness.skills.video,
                            canvas: agentReadiness.skills.canvas,
                            drama: agentReadiness.skills.drama,
                        })}
                    </div>
                </div>
            ) : null}
            <div className="grid gap-3 p-3 sm:gap-4 sm:p-5 lg:grid-cols-2">
                {settings.agentSkills.map((skill) => (
                    <section key={skill.id} className="rounded-lg border border-stone-200 bg-stone-50/70 p-3 sm:p-4 dark:border-stone-800 dark:bg-stone-900/40">
                        <div className="flex items-center justify-between gap-3 sm:mb-3">
                            <div>
                                <div className="font-semibold">{skill.name}</div>
                                {skill.sourceUrl ? (
                                    <a href={skill.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400">
                                        {skill.sourceVersion || "GitHub"} · {skill.license || t("upstreamSections.skills.sourceFallback")}
                                    </a>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    aria-label={t("upstreamSections.skills.enabledAria", { name: skill.name })}
                                    checked={skill.enabled}
                                    onChange={(enabled) => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, enabled } : item)) }))}
                                />
                                <Button
                                    type="text"
                                    danger
                                    icon={<Trash2 className="size-4" />}
                                    aria-label={t("upstreamSections.skills.deleteSkillAria", { name: skill.name })}
                                    title={t("upstreamSections.skills.deleteSkillAria", { name: skill.name })}
                                    onClick={() => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.filter((item) => item.id !== skill.id) }))}
                                />
                            </div>
                        </div>
                        <details className="group">
                            <summary className="mt-2 flex cursor-pointer list-none items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50 sm:hidden dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-900">
                                {t("upstreamSections.skills.editRules")}
                                <ChevronDown className="size-3.5 transition group-open:rotate-180" />
                            </summary>
                            <div className="mt-3 hidden group-open:block sm:mt-0 sm:!block">
                                <Input
                                    value={skill.name}
                                    placeholder={t("upstreamSections.skills.skillNamePlaceholder")}
                                    onChange={(event) => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, name: event.target.value } : item)) }))}
                                />
                                <Input
                                    className="mt-3"
                                    value={skill.keywords.join("、")}
                                    placeholder={t("upstreamSections.skills.keywordsPlaceholder")}
                                    onChange={(event) =>
                                        setSettings((current) => ({
                                            ...current,
                                            agentSkills: current.agentSkills.map((item) =>
                                                item.id === skill.id
                                                    ? {
                                                          ...item,
                                                          keywords: event.target.value
                                                              .split(/[、,，]/)
                                                              .map((word) => word.trim())
                                                              .filter(Boolean),
                                                      }
                                                    : item,
                                            ),
                                        }))
                                    }
                                />
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <Select
                                        mode="multiple"
                                        value={skill.workspaces || ["image"]}
                                        options={[
                                            { value: "image", label: t("upstreamSections.skills.workspaceImage") },
                                            { value: "video", label: t("upstreamSections.skills.workspaceVideo") },
                                            { value: "canvas", label: t("upstreamSections.skills.workspaceCanvas") },
                                            { value: "drama", label: t("upstreamSections.skills.workspaceDrama") },
                                        ]}
                                        placeholder={t("upstreamSections.skills.workspacePlaceholder")}
                                        onChange={(workspaces) =>
                                            setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, workspaces: workspaces as NonNullable<AgentSkill["workspaces"]> } : item)) }))
                                        }
                                    />
                                    <Select
                                        value={skill.action || "generate"}
                                        options={[
                                            { value: "generate", label: t("upstreamSections.skills.actionGenerate") },
                                            { value: "edit", label: t("upstreamSections.skills.actionEdit") },
                                        ]}
                                        onChange={(action) => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, action } : item)) }))}
                                    />
                                </div>
                                <div className="mt-3 flex min-h-8 items-center justify-between rounded-md border border-stone-200 px-3 dark:border-stone-700">
                                    <span className="text-sm text-stone-600 dark:text-stone-300">{t("upstreamSections.skills.requiresReference")}</span>
                                    <Switch
                                        size="small"
                                        aria-label={t("upstreamSections.skills.requiresReferenceAria", { name: skill.name })}
                                        checked={Boolean(skill.requiresReference)}
                                        onChange={(requiresReference) => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, requiresReference } : item)) }))}
                                    />
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <Input
                                        value={String(skill.defaultConfig?.size || "")}
                                        placeholder={t("upstreamSections.skills.defaultSizePlaceholder")}
                                        onChange={(event) =>
                                            setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, defaultConfig: { ...item.defaultConfig, size: event.target.value } } : item)) }))
                                        }
                                    />
                                    <Input
                                        value={String(skill.defaultConfig?.quality || skill.defaultConfig?.vquality || "")}
                                        placeholder={t("upstreamSections.skills.defaultQualityPlaceholder")}
                                        onChange={(event) => {
                                            const key = skill.workspaces?.includes("video") ? "vquality" : "quality";
                                            setSettings((current) => ({
                                                ...current,
                                                agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, defaultConfig: { ...item.defaultConfig, [key]: event.target.value } } : item)),
                                            }));
                                        }}
                                    />
                                    {(skill.workspaces || ["image"]).includes("image") ? (
                                        <InputNumber
                                            className="w-full"
                                            min={1}
                                            max={10}
                                            value={Number(skill.defaultConfig?.count || 1)}
                                            placeholder={t("upstreamSections.skills.defaultCountPlaceholder")}
                                            onChange={(value) =>
                                                setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, defaultConfig: { ...item.defaultConfig, count: value || 1 } } : item)) }))
                                            }
                                        />
                                    ) : null}
                                    {(skill.workspaces || []).includes("video") ? (
                                        <InputNumber
                                            className="w-full"
                                            min={1}
                                            max={60}
                                            value={Number(skill.defaultConfig?.videoSeconds || 5)}
                                            placeholder={t("upstreamSections.skills.defaultVideoSecondsPlaceholder")}
                                            onChange={(value) =>
                                                setSettings((current) => ({
                                                    ...current,
                                                    agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, defaultConfig: { ...item.defaultConfig, videoSeconds: value || 5 } } : item)),
                                                }))
                                            }
                                        />
                                    ) : null}
                                </div>
                                <Input
                                    className="mt-3"
                                    value={skill.description}
                                    placeholder={t("upstreamSections.skills.descriptionPlaceholder")}
                                    onChange={(event) => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, description: event.target.value } : item)) }))}
                                />
                                <Input.TextArea
                                    className="mt-3"
                                    autoSize={{ minRows: 6, maxRows: 14 }}
                                    value={skill.instructions}
                                    placeholder={t("upstreamSections.skills.instructionsPlaceholder")}
                                    onChange={(event) => setSettings((current) => ({ ...current, agentSkills: current.agentSkills.map((item) => (item.id === skill.id ? { ...item, instructions: event.target.value } : item)) }))}
                                />
                            </div>
                        </details>
                    </section>
                ))}
            </div>
        </Panel>
    );
}
