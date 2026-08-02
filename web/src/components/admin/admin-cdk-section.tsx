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
import { AdminAccountId } from "@/components/admin/admin-user-identity";
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

export function AdminCdkSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const {
        message,
        setViewingCdkCode,
        cdkCodes,
        cdkLoading,
        cdkGenerating,
        createdCdkCodes,
        selectedCreatedCdkIds,
        setSelectedCreatedCdkIds,
        cdkForm,
        setCdkForm,
        cdkSearch,
        setCdkSearch,
        cdkFilter,
        setCdkFilter,
        cdkPage,
        setCdkPage,
        cdkTotal,
        cdkStats,
        selectedCdkIds,
        setSelectedCdkIds,
        bulkDeletingCdk,
        activeSection,
        selectedCreatedCdkCodes,
        createdCdkActionCodes,
        allCreatedCdkSelected,
        loadCdkCodes,
        generateCdkCodes,
        deleteCdkById,
        deleteCreatedCdkCodes,
        bulkDeleteCdkCodes,
        copyCreatedCdkCodes,
        copyCdkPlainCode,
        exportCreatedCdkCodes,
        cdkColumns,
    } = controller;
    if (activeSection !== "cdk") return null;
    return (
        <Panel>
            <PanelHeader
                title={t("nav.sections.cdk.label")}
                description={t("cdk.section.description")}
                actions={
                    <Button icon={<RefreshCw className="size-4" />} loading={cdkLoading} onClick={() => void loadCdkCodes()}>
                        {t("cdk.section.refresh")}
                    </Button>
                }
            />
            <div className="space-y-3 p-2.5 sm:space-y-5 sm:p-5">
                <div className="grid items-start gap-3 sm:gap-4 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.15fr)]">
                    <section className="rounded-lg border border-stone-200 bg-stone-50/70 p-3 sm:p-4 dark:border-stone-800 dark:bg-stone-900/40">
                        <SectionTitle icon={<KeyRound className="size-4" />} title={t("cdk.section.generate.title")} />
                        <div className="mt-3 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 sm:mt-4 sm:gap-3">
                            <LabeledControl label={t("cdk.section.generate.count")}>
                                <InputNumber className="!w-full" min={1} max={100} precision={0} value={cdkForm.count} onChange={(value) => setCdkForm((current) => ({ ...current, count: clampInteger(value, 1, 100, 1) }))} />
                            </LabeledControl>
                            <LabeledControl label={t("cdk.section.generate.points")}>
                                <InputNumber className="!w-full" min={0} precision={0} value={cdkForm.points} onChange={(value) => setCdkForm((current) => ({ ...current, points: toNumberOrZero(value) }))} />
                            </LabeledControl>
                            <LabeledControl label={t("cdk.section.generate.maxRedemptions")}>
                                <InputNumber className="!w-full" min={1} max={10000} precision={0} value={cdkForm.maxRedemptions} onChange={(value) => setCdkForm((current) => ({ ...current, maxRedemptions: clampInteger(value, 1, 10000, 1) }))} />
                            </LabeledControl>
                            <LabeledControl label={t("cdk.section.generate.expiresInDays")}>
                                <InputNumber
                                    className="!w-full"
                                    min={1}
                                    max={3650}
                                    precision={0}
                                    value={cdkForm.expiresInDays}
                                    placeholder={t("cdk.section.generate.expiresInDaysPlaceholder")}
                                    onChange={(value) => setCdkForm((current) => ({ ...current, expiresInDays: value === null ? null : clampInteger(value, 1, 3650, 1) }))}
                                />
                            </LabeledControl>
                            <p className="col-span-2 -mt-0.5 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("cdk.section.generate.expiresInDaysHint")}</p>
                            <div className="col-span-2">
                                <LabeledControl label={t("cdk.section.generate.note")}>
                                    <Input value={cdkForm.note} maxLength={120} placeholder={t("cdk.section.generate.notePlaceholder")} onChange={(event) => setCdkForm((current) => ({ ...current, note: event.target.value }))} />
                                </LabeledControl>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end sm:mt-5">
                            <Button className="!h-9 w-full sm:w-auto" type="primary" icon={<Gift className="size-4" />} loading={cdkGenerating} onClick={() => void generateCdkCodes()}>
                                {t("cdk.section.generate.submit")}
                            </Button>
                        </div>
                    </section>
                    <section className="rounded-lg border border-stone-200 bg-white p-3 sm:p-4 dark:border-stone-800 dark:bg-stone-950">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <SectionTitle icon={<ShieldCheck className="size-4" />} title={t("cdk.section.result.title")} />
                                <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("cdk.section.result.description")}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                                <Button size="small" disabled={!createdCdkActionCodes.length} onClick={() => void copyCreatedCdkCodes()}>
                                    {selectedCreatedCdkCodes.length ? t("cdk.section.result.copySelected") : t("cdk.section.result.copyAll")}
                                </Button>
                                <Button size="small" icon={<Download className="size-3.5" />} disabled={!createdCdkActionCodes.length} onClick={() => exportCreatedCdkCodes()}>
                                    {selectedCreatedCdkCodes.length ? t("cdk.section.result.exportSelected") : t("cdk.section.result.exportAll")}
                                </Button>
                                <Popconfirm
                                    title={selectedCreatedCdkCodes.length ? t("cdk.section.result.deleteSelectedConfirmTitle") : t("cdk.section.result.deleteThisBatchConfirmTitle")}
                                    description={t("cdk.section.result.deleteConfirmDescription")}
                                    okText={t("cdk.table.deleteOk")}
                                    cancelText={t("cdk.table.deleteCancel")}
                                    onConfirm={() => void deleteCreatedCdkCodes(createdCdkActionCodes.map((code) => code.id))}
                                >
                                    <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!createdCdkActionCodes.length}>
                                        {selectedCreatedCdkCodes.length ? t("cdk.section.result.deleteSelected") : t("cdk.section.result.deleteThisBatch")}
                                    </Button>
                                </Popconfirm>
                            </div>
                        </div>
                        {createdCdkCodes.length ? (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 bg-stone-50/80 px-3 py-2 text-sm dark:border-stone-800 dark:bg-stone-900/40">
                                <Checkbox
                                    checked={allCreatedCdkSelected}
                                    indeterminate={Boolean(selectedCreatedCdkIds.length) && !allCreatedCdkSelected}
                                    onChange={(event) => setSelectedCreatedCdkIds(event.target.checked ? createdCdkCodes.map((code) => code.id) : [])}
                                >
                                    {t("cdk.section.result.selectAll")}
                                </Checkbox>
                                <span className="text-xs text-stone-500 dark:text-stone-400">{t("cdk.section.result.selectedSummary", { selected: selectedCreatedCdkIds.length, total: createdCdkCodes.length })}</span>
                            </div>
                        ) : null}
                        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                            {createdCdkCodes.length ? (
                                createdCdkCodes.map((code) => (
                                    <div key={code.id} className="grid gap-3 rounded-md border border-stone-200 p-3 dark:border-stone-800 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                                        <Checkbox
                                            checked={selectedCreatedCdkIds.includes(code.id)}
                                            onChange={(event) => setSelectedCreatedCdkIds((current) => (event.target.checked ? Array.from(new Set([...current, code.id])) : current.filter((id) => id !== code.id)))}
                                            aria-label={t("cdk.section.result.selectCode", { code: code.codePreview })}
                                        />
                                        <div className="min-w-0">
                                            <div className="break-all font-mono text-sm font-semibold text-stone-900 dark:text-stone-100">{code.code}</div>
                                            <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                                                {t("cdk.section.result.codeSummary", {
                                                    points: formatCreditAmount(code.points),
                                                    max: code.maxRedemptions,
                                                    expiry: code.expiresAt ? t("cdk.section.result.expiresAt", { date: new Date(code.expiresAt).toLocaleDateString() }) : t("cdk.table.longTermValid"),
                                                })}
                                            </div>
                                        </div>
                                        <Space size={6}>
                                            <Button size="small" onClick={() => void navigator.clipboard?.writeText(code.code).then(() => message.success(t("cdk.section.result.copied")))}>
                                                {t("cdk.table.copy")}
                                            </Button>
                                            <Popconfirm
                                                title={t("cdk.table.deleteConfirmTitle")}
                                                description={t("cdk.section.result.deleteSingleConfirmDescription")}
                                                okText={t("cdk.table.deleteOk")}
                                                cancelText={t("cdk.table.deleteCancel")}
                                                onConfirm={() => void deleteCreatedCdkCodes([code.id])}
                                            >
                                                <Button size="small" danger icon={<Trash2 className="size-3.5" />}>
                                                    {t("cdk.table.deleteOk")}
                                                </Button>
                                            </Popconfirm>
                                        </Space>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-md border border-dashed border-stone-200 px-3 py-6 text-center text-sm text-stone-500 sm:py-10 dark:border-stone-800">{t("cdk.section.result.empty")}</div>
                            )}
                        </div>
                    </section>
                </div>
                <section className="rounded-lg border border-stone-200 bg-white p-3 sm:p-4 dark:border-stone-800 dark:bg-stone-950">
                    <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                            <SectionTitle icon={<Database className="size-4" />} title={t("cdk.section.management.title")} />
                            <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("cdk.section.management.description")}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500 dark:text-stone-400">
                                <Tag className="m-0">{t("cdk.section.management.statsTotal", { count: cdkStats.total })}</Tag>
                                <Tag className="m-0">{t("cdk.section.management.statsRedeemed", { count: cdkStats.redeemed })}</Tag>
                                <Tag className="m-0">{t("cdk.section.management.statsUnused", { count: cdkStats.unused })}</Tag>
                                <Tag className="m-0">{t("cdk.section.management.statsExpired", { count: cdkStats.expired })}</Tag>
                            </div>
                        </div>
                        <div className="flex w-full flex-col gap-2 xl:w-auto xl:min-w-[520px] xl:flex-row xl:justify-end">
                            <Input
                                allowClear
                                className="w-full xl:max-w-64"
                                prefix={<Search className="size-4 text-stone-400" />}
                                placeholder={t("cdk.section.management.searchPlaceholder")}
                                value={cdkSearch}
                                onChange={(event) => {
                                    setCdkSearch(event.target.value);
                                    setCdkPage(1);
                                }}
                            />
                            <div className="w-full xl:w-36 xl:shrink-0">
                                <Select
                                    className="w-full"
                                    value={cdkFilter}
                                    onChange={(value) => {
                                        setCdkFilter(value);
                                        setCdkPage(1);
                                    }}
                                    options={[
                                        { value: "all", label: t("cdk.section.management.filterAll") },
                                        { value: "redeemed", label: t("cdk.section.management.filterRedeemed") },
                                        { value: "unused", label: t("cdk.section.management.filterUnused") },
                                        { value: "expired", label: t("cdk.section.management.filterExpired") },
                                    ]}
                                />
                            </div>
                            <Popconfirm
                                title={t("cdk.section.management.bulkDeleteConfirmTitle")}
                                description={t("cdk.table.deleteConfirmDescription")}
                                okText={t("cdk.table.deleteOk")}
                                cancelText={t("cdk.table.deleteCancel")}
                                onConfirm={() => void bulkDeleteCdkCodes()}
                            >
                                <Button danger disabled={!selectedCdkIds.length} loading={bulkDeletingCdk} icon={<Trash2 className="size-4" />}>
                                    {t("cdk.section.management.bulkDelete")}
                                </Button>
                            </Popconfirm>
                        </div>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
                        <div className="md:hidden">
                            {cdkLoading ? (
                                <div className="px-3 py-8 text-center text-sm text-stone-500 dark:text-stone-400">{t("cdk.section.management.loading")}</div>
                            ) : cdkCodes.length ? (
                                <div className="divide-y divide-stone-200 dark:divide-stone-800">
                                    {cdkCodes.map((code) => {
                                        const latest = [...code.redemptions].sort((a, b) => Date.parse(b.redeemedAt) - Date.parse(a.redeemedAt))[0];
                                        const selected = selectedCdkIds.includes(code.id);
                                        return (
                                            <article key={code.id} className="space-y-3 px-3 py-4">
                                                <div className="flex min-w-0 items-start gap-2">
                                                    <Checkbox
                                                        className="mt-0.5 shrink-0"
                                                        checked={selected}
                                                        onChange={(event) => setSelectedCdkIds((current) => (event.target.checked ? Array.from(new Set([...current, code.id])) : current.filter((id) => id !== code.id)))}
                                                        aria-label={t("cdk.section.result.selectCode", { code: code.code || code.codePreview })}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                            <span className="min-w-0 max-w-full break-all font-mono text-sm font-semibold leading-5 text-stone-950 dark:text-stone-100">{code.code || "CDK"}</span>
                                                            <Tag className="m-0" color={cdkStatusTone(code)}>
                                                                {cdkStatusLabel(code, {
                                                                    plainMissing: t("dashboardElements.cdkStatus.plainMissing"),
                                                                    expired: t("dashboardElements.cdkStatus.expired"),
                                                                    unavailable: t("dashboardElements.cdkStatus.unavailable"),
                                                                    exhausted: t("dashboardElements.cdkStatus.exhausted"),
                                                                    partial: t("dashboardElements.cdkStatus.partial"),
                                                                    unused: t("dashboardElements.cdkStatus.unused"),
                                                                })}
                                                            </Tag>
                                                        </div>
                                                        {code.note ? <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("cdk.table.note", { note: code.note })}</div> : null}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 rounded-md bg-stone-50/80 p-3 text-xs leading-5 dark:bg-stone-900/50">
                                                    <div>
                                                        <div className="text-stone-400 dark:text-stone-500">{t("cdk.table.rules")}</div>
                                                        <div className="mt-0.5 font-medium text-stone-800 dark:text-stone-100">
                                                            {formatCreditAmount(code.points)} · {code.redeemedCount}/{code.maxRedemptions}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-stone-400 dark:text-stone-500">{t("cdk.table.validity")}</div>
                                                        <div className="mt-0.5 font-medium text-stone-800 dark:text-stone-100">{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : t("cdk.table.longTermValid")}</div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <div className="text-stone-400 dark:text-stone-500">{t("cdk.table.latestRedemption")}</div>
                                                        {latest ? (
                                                            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-stone-800 dark:text-stone-100">
                                                                <span className="truncate">
                                                                    {latest.displayName} @{latest.username}
                                                                </span>
                                                                <AdminAccountId accountId={latest.accountId} className="shrink-0" />
                                                            </div>
                                                        ) : (
                                                            <div className="mt-0.5 font-medium text-stone-800 dark:text-stone-100">{t("cdk.table.noRedemption")}</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <Button size="small" icon={<Copy className="size-3.5" />} onClick={() => void copyCdkPlainCode(code)}>
                                                        {t("cdk.table.copy")}
                                                    </Button>
                                                    <Button size="small" type="text" icon={<Eye className="size-3.5" />} onClick={() => setViewingCdkCode(code)}>
                                                        {t("cdk.table.detail")}
                                                    </Button>
                                                    <Popconfirm title={t("cdk.table.deleteConfirmTitle")} okText={t("cdk.table.deleteOk")} cancelText={t("cdk.table.deleteCancel")} onConfirm={() => void deleteCdkById(code.id)}>
                                                        <Button size="small" danger icon={<Trash2 className="size-3.5" />}>
                                                            {t("cdk.table.deleteOk")}
                                                        </Button>
                                                    </Popconfirm>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="px-3 py-8 text-center text-sm text-stone-500 dark:text-stone-400">{t("cdk.section.management.empty")}</div>
                            )}
                        </div>
                        <div className="hidden md:block">
                            <Table
                                rowKey="id"
                                columns={cdkColumns}
                                dataSource={cdkCodes}
                                loading={cdkLoading}
                                pagination={false}
                                scroll={{ x: 1080 }}
                                rowSelection={{
                                    selectedRowKeys: selectedCdkIds,
                                    onChange: (keys) => setSelectedCdkIds(keys.map(String)),
                                }}
                                locale={{ emptyText: t("cdk.section.management.empty") }}
                            />
                        </div>
                        <div className="flex flex-col gap-3 border-t border-stone-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800">
                            <div className="text-sm text-stone-500 dark:text-stone-400">{t("cdk.section.management.footerSummary", { selected: selectedCdkIds.length, page: cdkCodes.length, total: cdkTotal })}</div>
                            <Pagination current={cdkPage} pageSize={CDK_PAGE_SIZE} total={cdkTotal} showSizeChanger={false} onChange={(page) => setCdkPage(page)} />
                        </div>
                    </div>
                </section>
            </div>
        </Panel>
    );
}
