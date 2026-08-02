"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Pagination, Popconfirm, Segmented, Select, Space, Switch, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
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
import { imagePreviewUrl } from "@/lib/media-image-url";
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
import { ANNOUNCEMENT_PAGE_SIZE } from "./use-admin-dashboard-data-actions";

export function AdminAnnouncementsSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const locale = useLocale();
    const {
        announcements,
        announcementPage,
        announcementTotal,
        announcementsLoading,
        announcementSaving,
        announcementModalOpen,
        announcementDraft,
        setAnnouncementDraft,
        activeSection,
        loadAnnouncements,
        saveAnnouncementDraft,
        openAnnouncementModal,
        closeAnnouncementModal,
        updateAnnouncementById,
        deleteAnnouncementById,
    } = controller;
    if (activeSection !== "announcements") return null;
    return (
        <Panel>
            <PanelHeader
                title={t("content.announcements.title")}
                description={t("content.announcements.description")}
                actions={
                    <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                        <Button type="primary" icon={<Plus className="size-4" />} onClick={openAnnouncementModal}>
                            {t("content.announcements.publish")}
                        </Button>
                        <Button icon={<ExternalLink className="size-4" />} href="/announcements" target="_blank">
                            {t("content.announcements.publicPage")}
                        </Button>
                        <Button icon={<RefreshCw className="size-4" />} loading={announcementsLoading} onClick={() => void loadAnnouncements()}>
                            {t("content.announcements.refresh")}
                        </Button>
                    </div>
                }
            />
            <div className="space-y-5 p-4 sm:p-5">
                <section className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <SectionTitle icon={<Database className="size-4" />} title={t("content.announcements.records")} />
                        <Tag className="m-0 w-fit">{t("content.announcements.totalCount", { count: announcementTotal })}</Tag>
                    </div>
                    <div className="grid gap-3">
                        {announcements.map((announcement) => (
                            <div key={announcement.id} className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-semibold text-stone-950 dark:text-stone-100">{announcement.title}</h3>
                                            <Tag color={announcement.enabled ? "green" : "default"} className="m-0">
                                                {announcement.enabled ? t("content.announcements.showing") : t("content.announcements.disabled")}
                                            </Tag>
                                            {announcement.popupHome ? <Tag className="m-0">{t("content.announcements.popupHome")}</Tag> : null}
                                            {announcement.popupAfterLogin ? <Tag className="m-0">{t("content.announcements.popupLogin")}</Tag> : null}
                                        </div>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600 dark:text-stone-300">{announcement.content}</p>
                                        <div className="mt-2 text-xs text-stone-500 dark:text-stone-400">{new Date(announcement.createdAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}</div>
                                    </div>
                                    <Space wrap className="shrink-0 lg:justify-end">
                                        <Button size="small" href={`/announcements#${announcement.id}`} target="_blank" icon={<ExternalLink className="size-3.5" />}>
                                            {t("content.announcements.view")}
                                        </Button>
                                        <Switch
                                            checked={announcement.enabled}
                                            checkedChildren={t("content.announcements.show")}
                                            unCheckedChildren={t("content.announcements.stop")}
                                            onChange={(enabled) => void updateAnnouncementById(announcement, { enabled })}
                                        />
                                        <Switch
                                            checked={announcement.popupHome}
                                            checkedChildren={t("content.announcements.home")}
                                            unCheckedChildren={t("content.announcements.home")}
                                            onChange={(popupHome) => void updateAnnouncementById(announcement, { popupHome })}
                                        />
                                        <Switch
                                            checked={announcement.popupAfterLogin}
                                            checkedChildren={t("content.announcements.login")}
                                            unCheckedChildren={t("content.announcements.login")}
                                            onChange={(popupAfterLogin) => void updateAnnouncementById(announcement, { popupAfterLogin })}
                                        />
                                        <Popconfirm title={t("content.announcements.deleteConfirm")} okText={t("common.delete")} cancelText={t("common.cancel")} onConfirm={() => void deleteAnnouncementById(announcement.id)}>
                                            <Button danger icon={<Trash2 className="size-4" />}>
                                                {t("common.delete")}
                                            </Button>
                                        </Popconfirm>
                                    </Space>
                                </div>
                            </div>
                        ))}
                        {!announcements.length && !announcementsLoading ? (
                            <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-stone-200 px-3 py-10 text-center text-sm text-stone-500 dark:border-stone-800">
                                <span>{t("content.announcements.empty")}</span>
                                <Button type="primary" icon={<Plus className="size-4" />} onClick={openAnnouncementModal}>
                                    {t("content.announcements.publishFirst")}
                                </Button>
                            </div>
                        ) : null}
                    </div>
                    {announcementTotal > ANNOUNCEMENT_PAGE_SIZE ? (
                        <Pagination className="mt-4 justify-end" current={announcementPage} pageSize={ANNOUNCEMENT_PAGE_SIZE} total={announcementTotal} showSizeChanger={false} onChange={(page) => void loadAnnouncements(page)} />
                    ) : null}
                </section>
            </div>
            <Modal
                title={t("content.announcements.modalTitle")}
                open={announcementModalOpen}
                width={760}
                centered
                destroyOnHidden
                onCancel={closeAnnouncementModal}
                styles={{ body: { maxHeight: "min(68dvh, 640px)", overflowY: "auto", paddingTop: 8 } }}
                footer={[
                    <Button key="cancel" onClick={closeAnnouncementModal} disabled={announcementSaving}>
                        {t("common.cancel")}
                    </Button>,
                    <Button key="save" type="primary" loading={announcementSaving} icon={<Save className="size-4" />} onClick={() => void saveAnnouncementDraft()}>
                        {t("content.announcements.publish")}
                    </Button>,
                ]}
            >
                <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-500 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-400">{t("content.announcements.modalHint")}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <LabeledControl label={t("content.announcements.fieldTitle")}>
                            <Input value={announcementDraft.title} maxLength={80} placeholder={t("content.announcements.titlePlaceholder")} onChange={(event) => setAnnouncementDraft((current) => ({ ...current, title: event.target.value }))} />
                        </LabeledControl>
                    </div>
                    <LabeledControl label={t("content.announcements.startsAt")}>
                        <DatePicker
                            className="w-full"
                            classNames={{ popup: { root: "admin-date-picker-dropdown" } }}
                            showTime
                            allowClear
                            value={announcementDraft.startsAt ? dayjs(announcementDraft.startsAt) : null}
                            onChange={(value) => setAnnouncementDraft((current) => ({ ...current, startsAt: value?.toISOString() || undefined }))}
                        />
                    </LabeledControl>
                    <LabeledControl label={t("content.announcements.endsAt")}>
                        <DatePicker
                            className="w-full"
                            classNames={{ popup: { root: "admin-date-picker-dropdown" } }}
                            showTime
                            allowClear
                            value={announcementDraft.endsAt ? dayjs(announcementDraft.endsAt) : null}
                            onChange={(value) => setAnnouncementDraft((current) => ({ ...current, endsAt: value?.toISOString() || undefined }))}
                        />
                    </LabeledControl>
                    <div className="sm:col-span-2">
                        <LabeledControl label={t("content.announcements.content")}>
                            <Input.TextArea
                                value={announcementDraft.content}
                                rows={5}
                                maxLength={3000}
                                placeholder={t("content.announcements.contentPlaceholder")}
                                onChange={(event) => setAnnouncementDraft((current) => ({ ...current, content: event.target.value }))}
                            />
                        </LabeledControl>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <Checkbox checked={announcementDraft.enabled !== false} onChange={(event) => setAnnouncementDraft((current) => ({ ...current, enabled: event.target.checked }))}>
                        {t("content.announcements.enableDisplay")}
                    </Checkbox>
                    <Checkbox checked={announcementDraft.popupHome === true} onChange={(event) => setAnnouncementDraft((current) => ({ ...current, popupHome: event.target.checked }))}>
                        {t("content.announcements.popupHome")}
                    </Checkbox>
                    <Checkbox checked={announcementDraft.popupAfterLogin === true} onChange={(event) => setAnnouncementDraft((current) => ({ ...current, popupAfterLogin: event.target.checked }))}>
                        {t("content.announcements.popupLogin")}
                    </Checkbox>
                </div>
            </Modal>
        </Panel>
    );
}

export function AdminPromptsSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const {
        prompts,
        promptListTotal,
        promptsLoading,
        deletingPromptId,
        promptSearch,
        setPromptSearch,
        promptPage,
        setPromptPage,
        selectedPromptIds,
        setSelectedPromptIds,
        bulkDeletingPrompts,
        activeSection,
        selectedPrompts,
        promptListStart,
        promptListEnd,
        deletePrompt,
        bulkDeletePrompts,
        openPromptModal,
        promptColumns,
    } = controller;
    if (activeSection !== "prompts") return null;
    return (
        <Panel>
            <PanelHeader
                title={t("content.prompts.title")}
                description={t("content.prompts.description")}
                actions={
                    <Button type="primary" icon={<Plus className="size-4" />} onClick={openPromptModal}>
                        {t("content.prompts.add")}
                    </Button>
                }
            />
            <div className="space-y-6 p-4 sm:p-6">
                <section className="admin-prompt-table rounded-xl">
                    <div className="admin-prompt-table-header flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold text-stone-950 dark:text-stone-100">{t("content.prompts.listTitle")}</h3>
                            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t("content.prompts.listDesc")}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 dark:bg-white/10 dark:text-stone-300">
                                {promptListTotal ? t("content.prompts.rangeCount", { from: promptListStart, to: promptListEnd, total: promptListTotal }) : t("content.prompts.zeroCount")}
                            </span>
                            <Button size="small" icon={<Plus className="size-3.5" />} onClick={openPromptModal}>
                                {t("content.prompts.addShort")}
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 border-t border-stone-200/70 px-4 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <Input
                            className="w-full sm:max-w-md"
                            prefix={<Search className="size-4 text-stone-400" />}
                            allowClear
                            placeholder={t("content.prompts.searchPlaceholder")}
                            value={promptSearch}
                            onChange={(event) => {
                                setPromptSearch(event.target.value);
                                setPromptPage(1);
                            }}
                        />
                        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                            <span className="text-xs text-stone-500 dark:text-stone-400">{t("content.prompts.selectedCount", { count: selectedPrompts.length })}</span>
                            <Popconfirm title={t("content.prompts.bulkDeleteTitle")} description={t("content.prompts.bulkDeleteDesc")} okText={t("common.delete")} cancelText={t("common.cancel")} onConfirm={() => void bulkDeletePrompts()}>
                                <Button danger disabled={!selectedPrompts.length} loading={bulkDeletingPrompts} icon={<Trash2 className="size-4" />}>
                                    {t("content.prompts.bulkDelete")}
                                </Button>
                            </Popconfirm>
                        </div>
                    </div>
                    <div className="space-y-3 px-4 pb-4 md:hidden">
                        {prompts.map((prompt) => (
                            <div key={prompt.id} className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950">
                                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3">
                                    <Checkbox checked={selectedPromptIds.includes(prompt.id)} onChange={(event) => setSelectedPromptIds((ids) => (event.target.checked ? Array.from(new Set([...ids, prompt.id])) : ids.filter((id) => id !== prompt.id)))} />
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 gap-3">
                                            {prompt.coverUrl ? (
                                                <img
                                                    src={imagePreviewUrl(prompt.coverUrl, 480)}
                                                    alt={prompt.title}
                                                    className="h-16 w-24 shrink-0 rounded-md border border-stone-200 object-cover dark:border-stone-800"
                                                    loading="lazy"
                                                    referrerPolicy="no-referrer"
                                                />
                                            ) : (
                                                <div className="h-16 w-24 shrink-0 rounded-md border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900" />
                                            )}
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-stone-950 dark:text-stone-100">{prompt.title}</div>
                                                <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{prompt.prompt}</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex min-w-0 flex-wrap gap-1">
                                            {prompt.category ? (
                                                <Tag className="m-0 max-w-full truncate text-[11px]" color="blue">
                                                    {prompt.category}
                                                </Tag>
                                            ) : null}
                                            {prompt.tags.map((tag) => (
                                                <Tag key={tag} className="m-0 max-w-full truncate text-[11px]">
                                                    {tag}
                                                </Tag>
                                            ))}
                                        </div>
                                        <div className="mt-3 flex justify-end">
                                            <Popconfirm title={t("prompts.table.deleteConfirmTitle")} okText={t("prompts.table.deleteOk")} cancelText={t("prompts.table.deleteCancel")} onConfirm={() => deletePrompt(prompt.id)}>
                                                <Button size="small" danger loading={deletingPromptId === prompt.id} icon={<Trash2 className="size-3.5" />}>
                                                    {t("common.delete")}
                                                </Button>
                                            </Popconfirm>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!prompts.length && !promptsLoading ? (
                            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-stone-300 py-12 text-center text-sm text-stone-500 dark:border-stone-700">
                                <span>{t("content.prompts.empty")}</span>
                                <Button type="primary" icon={<Plus className="size-4" />} onClick={openPromptModal}>
                                    {t("content.prompts.addFirst")}
                                </Button>
                            </div>
                        ) : null}
                        {promptListTotal > PROMPT_PAGE_SIZE ? <Pagination className="pt-1" current={promptPage} pageSize={PROMPT_PAGE_SIZE} total={promptListTotal} showSizeChanger={false} size="small" onChange={(page) => setPromptPage(page)} /> : null}
                    </div>
                    <div className="hidden md:block">
                        <Table
                            rowKey="id"
                            columns={promptColumns}
                            dataSource={prompts}
                            loading={promptsLoading}
                            pagination={{
                                current: promptPage,
                                pageSize: PROMPT_PAGE_SIZE,
                                total: promptListTotal,
                                showSizeChanger: false,
                                showTotal: (total, range) => t("content.prompts.showTotal", { from: range[0], to: range[1], total }),
                                onChange: (page) => setPromptPage(page),
                            }}
                            size="middle"
                            scroll={{ x: 760 }}
                            rowSelection={{
                                selectedRowKeys: selectedPromptIds,
                                onChange: (keys) => setSelectedPromptIds(keys.map(String)),
                            }}
                        />
                    </div>
                </section>
            </div>
        </Panel>
    );
}
