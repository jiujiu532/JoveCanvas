"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Pagination, Popconfirm, Segmented, Select, Space, Switch, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import Link from "next/link";
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
import { AdminUserSearchSelect } from "@/components/admin/admin-user-identity";
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
import { useTranslations } from "next-intl";
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

export function AdminLogsSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const {
        generationLogs,
        generationLogTotal,
        generationLogPage,
        setGenerationLogPage,
        generationLogSearch,
        setGenerationLogSearch,
        generationLogKind,
        setGenerationLogKind,
        generationLogSource,
        setGenerationLogSource,
        generationLogStatus,
        setGenerationLogStatus,
        generationLogUserId,
        setGenerationLogUserId,
        generationLogStart,
        setGenerationLogStart,
        generationLogEnd,
        setGenerationLogEnd,
        selectedGenerationLogIds,
        setSelectedGenerationLogIds,
        generationLogsLoading,
        bulkDeletingGenerationLogs,
        setViewingGenerationLog,
        activeSection,
        selectedGenerationLogs,
        loadGenerationLogs,
        deleteGenerationLogsByIds,
        resetGenerationLogFilters,
        generationLogColumns,
    } = controller;
    if (activeSection !== "logs") return null;
    return (
        <Panel>
            <PanelHeader title={t("nav.sections.logs.label")} description={t("logs.section.description")} />
            <div className="space-y-4 p-4 sm:p-5">
                <div className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_286px] 2xl:items-start">
                    <div className="grid min-w-0 grid-cols-2 gap-2.5 xl:grid-cols-[minmax(220px,300px)_118px_138px_118px_minmax(132px,180px)]">
                        <Input
                            allowClear
                            className="col-span-2 min-w-0 xl:col-span-1"
                            prefix={<Search className="size-4 text-stone-400" />}
                            placeholder={t("logs.section.searchPlaceholder")}
                            value={generationLogSearch}
                            onChange={(event) => {
                                setGenerationLogSearch(event.target.value);
                                setGenerationLogPage(1);
                            }}
                        />
                        <Select
                            allowClear
                            className="min-w-0"
                            placeholder={t("logs.table.kind")}
                            value={generationLogKind || undefined}
                            onChange={(value) => {
                                setGenerationLogKind(value || "");
                                setGenerationLogPage(1);
                            }}
                            options={[
                                { label: t("logs.kind.image"), value: "image" },
                                { label: t("logs.kind.video"), value: "video" },
                            ]}
                        />
                        <Select
                            allowClear
                            className="min-w-0"
                            placeholder={t("logs.table.source")}
                            value={generationLogSource || undefined}
                            onChange={(value) => {
                                setGenerationLogSource(value || "");
                                setGenerationLogPage(1);
                            }}
                            options={[
                                { label: t("logs.source.canvas"), value: "canvas" },
                                { label: t("logs.source.imageWorkbench"), value: "image-workbench" },
                                { label: t("logs.source.videoWorkbench"), value: "video-workbench" },
                            ]}
                        />
                        <Select
                            allowClear
                            className="min-w-0"
                            placeholder={t("logs.table.status")}
                            value={generationLogStatus || undefined}
                            onChange={(value) => {
                                setGenerationLogStatus(value || "");
                                setGenerationLogPage(1);
                            }}
                            options={[
                                { label: t("logs.status.success"), value: "success" },
                                { label: t("logs.status.failed"), value: "failed" },
                                { label: t("logs.status.pending"), value: "pending" },
                            ]}
                        />
                        <AdminUserSearchSelect
                            className="min-w-0"
                            placeholder={t("userIdentity.searchPlaceholderShort")}
                            value={generationLogUserId || undefined}
                            onChange={(value) => {
                                setGenerationLogUserId(value || "");
                                setGenerationLogPage(1);
                            }}
                        />
                    </div>
                    <DatePicker.RangePicker
                        className="admin-log-date-range w-full min-w-0 max-w-full"
                        classNames={{ popup: { root: "admin-date-picker-dropdown" } }}
                        allowClear
                        format="YYYY-MM-DD"
                        placeholder={[t("logs.section.startDate"), t("logs.section.endDate")]}
                        separator={t("logs.section.dateRangeSeparator")}
                        value={generationLogStart || generationLogEnd ? [generationLogStart ? dayjs(generationLogStart) : null, generationLogEnd ? dayjs(generationLogEnd) : null] : null}
                        onChange={(dates) => {
                            setGenerationLogStart(dates?.[0]?.format("YYYY-MM-DD") || "");
                            setGenerationLogEnd(dates?.[1]?.format("YYYY-MM-DD") || "");
                            setGenerationLogPage(1);
                        }}
                    />
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50/70 px-3 py-3 dark:border-stone-800 dark:bg-stone-900/40 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                        <span>{t("logs.section.totalCount", { count: generationLogTotal })}</span>
                        <span>{t("logs.section.selectedCount", { count: selectedGenerationLogs.length })}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                        <Button className="w-full sm:w-auto" icon={<RefreshCw className="size-4" />} loading={generationLogsLoading} onClick={() => void loadGenerationLogs()}>
                            {t("cdk.section.refresh")}
                        </Button>
                        <Button className="w-full sm:w-auto" disabled={!generationLogs.length} onClick={() => setSelectedGenerationLogIds(generationLogs.map((log) => log.id))}>
                            {t("logs.section.selectAllOnPage")}
                        </Button>
                        <Button className="w-full sm:w-auto" onClick={resetGenerationLogFilters}>
                            {t("logs.section.clearFilters")}
                        </Button>
                        <Popconfirm title={t("logs.section.bulkDeleteConfirmTitle")} description={t("logs.section.bulkDeleteConfirmDescription")} okText={t("logs.table.deleteOk")} cancelText={t("logs.table.deleteCancel")} onConfirm={() => void deleteGenerationLogsByIds(selectedGenerationLogIds)}>
                            <Button className="w-full sm:w-auto" danger disabled={!selectedGenerationLogIds.length} loading={bulkDeletingGenerationLogs} icon={<Trash2 className="size-4" />}>
                                {t("logs.section.deleteSelected")}
                            </Button>
                        </Popconfirm>
                    </div>
                </div>
                <div className="space-y-3 md:hidden">
                    {generationLogs.map((log) => (
                        <GenerationLogMobileCard
                            key={log.id}
                            log={log}
                            selected={selectedGenerationLogIds.includes(log.id)}
                            onSelectedChange={(checked) => setSelectedGenerationLogIds((ids) => (checked ? Array.from(new Set([...ids, log.id])) : ids.filter((id) => id !== log.id)))}
                            onView={() => setViewingGenerationLog(log)}
                            onDelete={() => void deleteGenerationLogsByIds([log.id])}
                        />
                    ))}
                    {!generationLogs.length && !generationLogsLoading ? <div className="rounded-lg border border-dashed border-stone-300 py-12 text-center text-sm text-stone-500 dark:border-stone-700">{t("logs.section.empty")}</div> : null}
                </div>
                <div className="hidden md:block">
                    <Table
                        className="admin-generation-log-table"
                        rowKey="id"
                        columns={generationLogColumns}
                        dataSource={generationLogs}
                        loading={generationLogsLoading}
                        pagination={{
                            current: generationLogPage,
                            pageSize: GENERATION_LOG_PAGE_SIZE,
                            total: generationLogTotal,
                            showSizeChanger: false,
                            showTotal: (total, range) => t("logs.section.showTotal", { from: range[0], to: range[1], total }),
                            onChange: (page) => setGenerationLogPage(page),
                        }}
                        rowSelection={{
                            selectedRowKeys: selectedGenerationLogIds,
                            onChange: (keys) => setSelectedGenerationLogIds(keys.map(String)),
                        }}
                        scroll={{ x: 1500 }}
                        size="middle"
                        tableLayout="fixed"
                    />
                </div>
            </div>
        </Panel>
    );
}
