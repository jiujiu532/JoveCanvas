"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Pagination, Popconfirm, Segmented, Select, Space, Switch, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import Link from "next/link";
import dynamic from "next/dynamic";
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
import { normalizeDefaultModelsConfig } from "@/lib/model-routing-config";
import type {
    AgentSkill,
    AuthSettings,
    CreatedCdkCode,
    PublicAnnouncement,
    PublicCdkCode,
    PublicUser,
    PublicUserSummary,
    SiteFriendLink,
    SiteShowcaseItem,
    SiteSocialKey,
    SystemChannelAdvancedConfig,
    SystemModelChannel,
    UserRole,
    UserStatus,
} from "@/lib/auth/store";
import type { GenerationAssetStats, StoredGenerationLog } from "@/lib/server/generation-log-store";
import type { AdminSetupSummary } from "@/lib/server/admin-setup-status";
import type { PaymentConfigSummary } from "@/lib/payment-config-types";
import type { AdminBillingSummary } from "@/lib/admin-billing-types";
import type { Prompt } from "@/services/api/prompts";
import { useTranslations } from "next-intl";

type AdminDashboardProps = {
    initialUsers: PublicUser[];
    initialUserSummary: PublicUserSummary;
    initialSettings: AuthSettings;
    initialPromptCount: number;
    currentUser: PublicUser;
    initialSection?: AdminSectionKey;
    setupSummary?: AdminSetupSummary;
    headerActions?: ReactNode;
};
type PromptFormValue = {
    title: string;
    prompt: string;
    category?: string;
    tags?: string;
    coverUrl?: string;
    preview?: string;
};

type UserEditorValue = {
    username?: string;
    displayName: string;
    email?: string;
    password?: string;
    role: UserRole;
    status: UserStatus;
    pointsBalance: number;
};

const PROMPT_PAGE_SIZE = 20;
const PROMPT_SEARCH_DEBOUNCE_MS = 300;
const CDK_PAGE_SIZE = 20;
const GENERATION_LOG_PAGE_SIZE = 20;
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
import { useAdminDashboardController } from "./use-admin-dashboard-controller";

const AdminSiteSection = dynamic(() => import("./admin-configuration-sections").then((module) => module.AdminSiteSection), { loading: AdminSectionLoading });
const AdminSettingsSection = dynamic(() => import("./admin-configuration-sections").then((module) => module.AdminSettingsSection), { loading: AdminSectionLoading });
const AdminBackupSection = dynamic(() => import("./admin-system-sections").then((module) => module.AdminBackupSection), { loading: AdminSectionLoading });
const AdminExternalStorageSection = dynamic(() => import("./admin-system-sections").then((module) => module.AdminExternalStorageSection), { loading: AdminSectionLoading });
const AdminMediaStorageSection = dynamic(() => import("./admin-system-sections").then((module) => module.AdminMediaStorageSection), { loading: AdminSectionLoading });
const AdminUpdatesSection = dynamic(() => import("./admin-system-sections").then((module) => module.AdminUpdatesSection), { loading: AdminSectionLoading });
const AdminWalletSection = dynamic(() => import("./admin-finance-sections").then((module) => module.AdminWalletSection), { loading: AdminSectionLoading });
const AdminPointsSection = dynamic(() => import("./admin-finance-sections").then((module) => module.AdminPointsSection), { loading: AdminSectionLoading });
const AdminOrdersSection = dynamic(() => import("./admin-finance-sections").then((module) => module.AdminOrdersSection), { loading: AdminSectionLoading });
const AdminProductsSection = dynamic(() => import("./admin-finance-sections").then((module) => module.AdminProductsSection), { loading: AdminSectionLoading });
const AdminPaymentsSection = dynamic(() => import("./admin-finance-sections").then((module) => module.AdminPaymentsSection), { loading: AdminSectionLoading });
const AdminCdkSection = dynamic(() => import("./admin-finance-sections").then((module) => module.AdminCdkSection), { loading: AdminSectionLoading });
const AdminChannelsSection = dynamic(() => import("./admin-upstream-sections").then((module) => module.AdminChannelsSection), { loading: AdminSectionLoading });
const AdminSkillsSection = dynamic(() => import("./admin-upstream-sections").then((module) => module.AdminSkillsSection), { loading: AdminSectionLoading });
const AdminAnnouncementsSection = dynamic(() => import("./admin-content-sections").then((module) => module.AdminAnnouncementsSection), { loading: AdminSectionLoading });
const AdminPromptsSection = dynamic(() => import("./admin-content-sections").then((module) => module.AdminPromptsSection), { loading: AdminSectionLoading });
const AdminUsersSection = dynamic(() => import("./admin-operations-sections").then((module) => module.AdminUsersSection), { loading: AdminSectionLoading });
const AdminLogsSection = dynamic(() => import("./admin-operations-sections").then((module) => module.AdminLogsSection), { loading: AdminSectionLoading });
const AdminGenerationOperationsSection = dynamic(() => import("./admin-operations-sections").then((module) => module.AdminGenerationOperationsSection), { loading: AdminSectionLoading });
const AdminAccountDeletionSection = dynamic(() => import("./admin-account-deletion-section").then((module) => module.AdminAccountDeletionSection), { loading: AdminSectionLoading });

function AdminSectionLoading() {
    const t = useTranslations("admin");
    return <div className="flex min-h-36 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">{t("dashboard.sectionLoading")}</div>;
}

export function AdminDashboard(props: AdminDashboardProps) {
    const t = useTranslations("admin");
    const controller = useAdminDashboardController(props);
    const {
        initialUsers,
        initialSettings,
        initialPromptCount,
        currentUser,
        initialSection,
        setupSummary,
        headerActions,
        message,
        promptForm,
        userForm,
        logoInputRef,
        iconInputRef,
        promptRequestIdRef,
        generationLogRequestIdRef,
        users,
        setUsers,
        settings,
        setSettings,
        prompts,
        setPrompts,
        promptCount,
        setPromptCount,
        promptListTotal,
        setPromptListTotal,
        updatingUserId,
        setUpdatingUserId,
        settingsLoading,
        setSettingsLoading,
        assetStats,
        setAssetStats,
        mailTestLoading,
        setMailTestLoading,
        mailTestTo,
        setMailTestTo,
        fetchingModelId,
        setFetchingModelId,
        testingChannelKey,
        setTestingChannelKey,
        channelHealthResults,
        setChannelHealthResults,
        promptSaving,
        setPromptSaving,
        promptsLoading,
        setPromptsLoading,
        deletingPromptId,
        setDeletingPromptId,
        promptSearch,
        setPromptSearch,
        debouncedPromptSearch,
        setDebouncedPromptSearch,
        promptPage,
        setPromptPage,
        selectedPromptIds,
        setSelectedPromptIds,
        bulkDeletingPrompts,
        setBulkDeletingPrompts,
        userSearch,
        setUserSearch,
        selectedUserIds,
        setSelectedUserIds,
        bulkDeletingUsers,
        setBulkDeletingUsers,
        generationLogs,
        setGenerationLogs,
        generationLogTotal,
        setGenerationLogTotal,
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
        operationsSummaryLoading,
        setGenerationLogsLoading,
        bulkDeletingGenerationLogs,
        setBulkDeletingGenerationLogs,
        viewingGenerationLog,
        setViewingGenerationLog,
        paymentConfig,
        setPaymentConfig,
        billingSummary,
        setBillingSummary,
        billingSummaryLoading,
        setBillingSummaryLoading,
        viewingCdkCode,
        setViewingCdkCode,
        cdkCodes,
        setCdkCodes,
        cdkLoading,
        setCdkLoading,
        cdkGenerating,
        setCdkGenerating,
        createdCdkCodes,
        setCreatedCdkCodes,
        selectedCreatedCdkIds,
        setSelectedCreatedCdkIds,
        cdkForm,
        setCdkForm,
        cdkSearch,
        setCdkSearch,
        debouncedCdkSearch,
        setDebouncedCdkSearch,
        cdkFilter,
        setCdkFilter,
        cdkPage,
        setCdkPage,
        cdkTotal,
        setCdkTotal,
        cdkStats,
        setCdkStats,
        selectedCdkIds,
        setSelectedCdkIds,
        bulkDeletingCdk,
        setBulkDeletingCdk,
        announcements,
        setAnnouncements,
        announcementsLoading,
        setAnnouncementsLoading,
        announcementSaving,
        setAnnouncementSaving,
        announcementModalOpen,
        setAnnouncementModalOpen,
        promptModalOpen,
        setPromptModalOpen,
        announcementDraft,
        setAnnouncementDraft,
        editingUser,
        setEditingUser,
        creatingUser,
        setCreatingUser,
        activeSection,
        setActiveSection,
        agentReadiness,
        setAgentReadiness,
        mobileNavOpen,
        setMobileNavOpen,
        desktopNavCollapsed,
        setDesktopNavCollapsed,
        customPointModel,
        setCustomPointModel,
        stats,
        settingsSummary,
        walletSummary,
        operationsSummary,
        filteredUsers,
        selectedUsers,
        selectedPrompts,
        selectedGenerationLogs,
        promptListStart,
        promptListEnd,
        selectedCreatedCdkCodes,
        createdCdkActionCodes,
        allCreatedCdkSelected,
        saveSettings,
        loadBillingSummary,
        loadOperationsSummary,
        loadGenerationAssetStats,
        updateUser,
        createUser,
        deleteUser,
        bulkDeleteUsers,
        createPrompt,
        deletePrompt,
        bulkDeletePrompts,
        loadPrompts,
        loadGenerationLogs,
        loadPaymentConfig,
        deleteGenerationLogsByIds,
        resetGenerationLogFilters,
        loadCdkCodes,
        generateCdkCodes,
        deleteCdkById,
        deleteCreatedCdkCodes,
        bulkDeleteCdkCodes,
        copyCreatedCdkCodes,
        copyCdkPlainCode,
        exportCreatedCdkCodes,
        loadAnnouncements,
        saveAnnouncementDraft,
        openAnnouncementModal,
        closeAnnouncementModal,
        openPromptModal,
        closePromptModal,
        updateAnnouncementById,
        deleteAnnouncementById,
        updateChannel,
        addChannel,
        deleteChannel,
        updateGenerationConcurrency,
        updateGenerationDefaults,
        updateModelPointCost,
        updateGenerationPointMultiplier,
        deleteGenerationPointMultiplier,
        addCustomPointModel,
        deleteModelPointCost,
        updateMailSetting,
        testMailSettings,
        updateSiteSetting,
        uploadSiteLogo,
        uploadSiteIcon,
        updateSiteSocialSetting,
        addFriendLink,
        updateFriendLink,
        deleteFriendLink,
        addHomeShowcaseItem,
        updateHomeShowcaseItem,
        deleteHomeShowcaseItem,
        fetchModelsForChannel,
        fetchAllModels,
        testChannelHealth,
        testAllChannelHealth,
        openUserEditor,
        openCreateUserEditor,
        closeUserEditor,
        saveUserEditor,
        userColumns,
        promptColumns,
        generationLogColumns,
        cdkColumns,
        activeSectionInfo,
        nextSetupStep,
    } = controller;
    return (
        <div className={`admin-mobile-safe admin-dashboard-shell min-h-dvh w-full min-w-0 ${desktopNavCollapsed ? "is-sidebar-collapsed" : ""}`}>
            {mobileNavOpen ? <button type="button" className="admin-section-nav-backdrop lg:hidden" aria-label={t("nav.collapseSidebar")} onClick={() => setMobileNavOpen(false)} /> : null}
            <AdminSectionNav
                activeKey={activeSection}
                onChange={setActiveSection}
                mobileOpen={mobileNavOpen}
                desktopCollapsed={desktopNavCollapsed}
                onDesktopToggle={() => setDesktopNavCollapsed((collapsed) => !collapsed)}
                onMobileToggle={() => setMobileNavOpen((open) => !open)}
                onMobileClose={() => setMobileNavOpen(false)}
            />
            <div className="w-full min-w-0 max-w-full overflow-x-hidden">
                <header className="admin-dashboard-header sticky top-0 z-20 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6 lg:px-5">
                    <div className="admin-dashboard-header-inner mx-auto flex min-h-9 w-full max-w-[1600px] min-w-0 items-center justify-between gap-3">
                        <div className="admin-dashboard-title-row flex min-w-0 items-center gap-3">
                            <button
                                type="button"
                                className="admin-mobile-menu-trigger flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900 lg:hidden"
                                aria-label={t("nav.expandSidebar")}
                                onClick={() => setMobileNavOpen(true)}
                            >
                                <Menu className="size-4" />
                            </button>
                            <div className="min-w-0 items-center gap-2 text-xs text-zinc-400 lg:flex">
                                <span>{t("dashboard.breadcrumbAdmin")}</span>
                                <span>/</span>
                                <strong className="truncate font-medium text-zinc-700 dark:text-zinc-300">{activeSectionInfo.label}</strong>
                            </div>
                        </div>
                        <div className="admin-dashboard-actions flex min-w-0 items-center gap-2 sm:justify-end">
                            {setupSummary && nextSetupStep ? (
                                <Link
                                    href="/admin/setup"
                                    title={t("dashboard.setupNextTitle", { title: nextSetupStep.title })}
                                    className="admin-dashboard-setup-pill group flex min-w-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                                >
                                    <span className="admin-dashboard-setup-icon grid size-5 shrink-0 place-items-center text-zinc-500 dark:text-zinc-400">
                                        <Sparkles className="size-3.5" />
                                    </span>
                                    <span className="admin-dashboard-setup-copy flex min-w-0 items-center gap-2">
                                        <span className="admin-dashboard-setup-title flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-zinc-700 dark:text-zinc-200">
                                            {t("dashboard.setupPercent", { percent: setupSummary.percent })}
                                            <ArrowRight className="admin-dashboard-setup-arrow size-3 text-zinc-400 transition group-hover:translate-x-0.5" />
                                        </span>
                                        <span className="admin-dashboard-setup-track block h-1 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                                            <span className="admin-dashboard-setup-progress block h-full rounded-full bg-zinc-700 dark:bg-zinc-300" style={{ width: `${setupSummary.percent}%` }} />
                                        </span>
                                    </span>
                                </Link>
                            ) : null}
                            {headerActions ? <div className="admin-dashboard-header-actions flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{headerActions}</div> : null}
                        </div>
                    </div>
                </header>

                <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-3 px-3 py-3 sm:space-y-5 sm:px-6 sm:py-6 lg:px-8 xl:px-9 xl:py-7">
                    <section className="border-b border-zinc-200 pb-3 sm:pb-5 dark:border-zinc-800">
                        <h1 className="text-lg font-semibold text-zinc-950 sm:text-xl dark:text-zinc-100">{activeSectionInfo.label}</h1>
                        <div className="mt-1 line-clamp-2 max-w-3xl text-xs leading-5 text-zinc-500 sm:mt-1.5 sm:line-clamp-none sm:text-sm sm:leading-6 dark:text-zinc-400">{activeSectionInfo.description}</div>
                    </section>

                    {activeSection === "overview" ? (
                        <AdminOverview
                            stats={stats}
                            settingsSummary={settingsSummary}
                            walletSummary={walletSummary}
                            billingSummary={billingSummary}
                            operationsSummary={operationsSummary}
                            promptCount={promptCount}
                            assetStats={assetStats}
                            enabledProducts={setupSummary?.enabledProducts || 0}
                            loading={operationsSummaryLoading}
                            onRefresh={() => void loadOperationsSummary()}
                        />
                    ) : null}
                    {activeSection === "site" ? <AdminSiteSection controller={controller} /> : null}
                    {activeSection === "settings" ? <AdminSettingsSection controller={controller} /> : null}
                    {activeSection === "accountDeletion" ? <AdminAccountDeletionSection active /> : null}
                    {activeSection === "mediaStorage" ? <AdminMediaStorageSection controller={controller} /> : null}
                    {activeSection === "externalStorage" ? <AdminExternalStorageSection controller={controller} /> : null}
                    {activeSection === "backup" ? <AdminBackupSection controller={controller} /> : null}
                    {activeSection === "wallet" ? <AdminWalletSection controller={controller} /> : null}
                    {activeSection === "points" ? <AdminPointsSection controller={controller} /> : null}
                    {activeSection === "orders" ? <AdminOrdersSection controller={controller} /> : null}
                    {activeSection === "products" ? <AdminProductsSection controller={controller} /> : null}
                    {activeSection === "payments" ? <AdminPaymentsSection controller={controller} /> : null}
                    {activeSection === "updates" ? <AdminUpdatesSection controller={controller} /> : null}
                    {activeSection === "channels" ? <AdminChannelsSection controller={controller} /> : null}
                    {activeSection === "skills" ? <AdminSkillsSection controller={controller} /> : null}
                    {activeSection === "cdk" ? <AdminCdkSection controller={controller} /> : null}
                    {activeSection === "announcements" ? <AdminAnnouncementsSection controller={controller} /> : null}
                    {activeSection === "prompts" ? <AdminPromptsSection controller={controller} /> : null}
                    {activeSection === "users" ? <AdminUsersSection controller={controller} /> : null}
                    {activeSection === "logs" ? <AdminLogsSection controller={controller} /> : null}
                    {activeSection === "generationOperations" ? <AdminGenerationOperationsSection controller={controller} /> : null}
                </div>
            </div>

            <Modal
                title={t("dashboard.promptModal.title")}
                open={promptModalOpen}
                okText={t("dashboard.promptModal.okText")}
                cancelText={t("common.cancel")}
                confirmLoading={promptSaving}
                mask={{ closable: !promptSaving }}
                keyboard={!promptSaving}
                width={760}
                onOk={() => promptForm.submit()}
                onCancel={closePromptModal}
            >
                <Form className="admin-prompt-form" form={promptForm} layout="vertical" requiredMark={false} onFinish={createPrompt}>
                    <div className="max-h-[min(68dvh,680px)] overflow-y-auto pr-1">
                        <div className="admin-prompt-note mb-5 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-stone-950 dark:text-stone-100">
                                <Plus className="size-4 text-stone-600 dark:text-stone-300" />
                                {t("dashboard.promptModal.noteTitle")}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-stone-600 dark:text-stone-400">{t("dashboard.promptModal.noteDesc")}</p>
                        </div>
                        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                            <Form.Item label={t("dashboard.promptModal.fieldTitle")} name="title" rules={[{ required: true, message: t("dashboard.promptModal.titleRequired") }]}>
                                <Input placeholder={t("dashboard.promptModal.titlePlaceholder")} />
                            </Form.Item>
                            <Form.Item label={t("dashboard.promptModal.fieldCategory")} name="category">
                                <Input placeholder={t("dashboard.promptModal.categoryPlaceholder")} />
                            </Form.Item>
                        </div>
                        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                            <Form.Item label={t("dashboard.promptModal.fieldTags")} name="tags">
                                <Input placeholder={t("dashboard.promptModal.tagsPlaceholder")} />
                            </Form.Item>
                            <Form.Item label={t("dashboard.promptModal.fieldCover")} name="coverUrl">
                                <Input placeholder="https://example.com/image.png" />
                            </Form.Item>
                        </div>
                        <Form.Item label={t("dashboard.promptModal.fieldPrompt")} name="prompt" rules={[{ required: true, message: t("dashboard.promptModal.promptRequired") }]}>
                            <Input.TextArea rows={7} placeholder={t("dashboard.promptModal.promptPlaceholder")} />
                        </Form.Item>
                        <Form.Item label={t("dashboard.promptModal.fieldPreview")} name="preview">
                            <Input.TextArea rows={3} placeholder={t("dashboard.promptModal.previewPlaceholder")} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
            <Modal
                title={creatingUser ? t("dashboard.userModal.createTitle") : editingUser ? t("dashboard.userModal.editTitle", { name: editingUser.displayName }) : t("dashboard.userModal.defaultTitle")}
                open={creatingUser || Boolean(editingUser)}
                okText={creatingUser ? t("dashboard.userModal.createOk") : t("common.save")}
                cancelText={t("common.cancel")}
                confirmLoading={creatingUser ? updatingUserId === "__new__" : Boolean(editingUser && updatingUserId === editingUser.id)}
                onOk={() => userForm.submit()}
                onCancel={closeUserEditor}
            >
                <Form form={userForm} layout="vertical" requiredMark={false} onFinish={saveUserEditor}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Form.Item label={t("dashboard.userModal.username")} name="username" rules={[{ required: creatingUser, message: t("dashboard.userModal.usernameRequired") }]}>
                            <Input disabled={!creatingUser} placeholder={t("dashboard.userModal.usernamePlaceholder")} />
                        </Form.Item>
                        <Form.Item label={t("dashboard.userModal.displayName")} name="displayName" rules={[{ required: true, message: t("dashboard.userModal.displayNameRequired") }]}>
                            <Input placeholder={t("dashboard.userModal.displayNamePlaceholder")} />
                        </Form.Item>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Form.Item label={t("dashboard.userModal.email")} name="email">
                            <Input placeholder={t("dashboard.userModal.emailPlaceholder")} />
                        </Form.Item>
                        <Form.Item
                            label={creatingUser ? t("dashboard.userModal.passwordCreate") : t("dashboard.userModal.passwordReset")}
                            name="password"
                            rules={[{ required: creatingUser, message: t("dashboard.userModal.passwordRequired") }]}
                            extra={creatingUser ? t("dashboard.userModal.passwordExtraCreate") : t("dashboard.userModal.passwordExtraEdit")}
                        >
                            <Input.Password placeholder={t("dashboard.userModal.passwordPlaceholder")} />
                        </Form.Item>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Form.Item label={t("dashboard.userModal.role")} name="role" rules={[{ required: true, message: t("dashboard.userModal.roleRequired") }]}>
                            <Select
                                options={[
                                    { value: "user", label: t("dashboard.userModal.roleUser") },
                                    { value: "admin", label: t("dashboard.userModal.roleAdmin") },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item label={t("dashboard.userModal.status")} name="status" rules={[{ required: true, message: t("dashboard.userModal.statusRequired") }]}>
                            <Select
                                disabled={editingUser?.id === currentUser.id}
                                options={[
                                    { value: "active", label: t("dashboard.userModal.statusActive") },
                                    { value: "disabled", label: t("dashboard.userModal.statusDisabled") },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item label={t("dashboard.userModal.points")} name="pointsBalance" extra={editingUser ? t("dashboard.userModal.pointsExtra") : undefined} rules={[{ required: true, message: t("dashboard.userModal.pointsRequired") }]}>
                            <InputNumber className="!w-full" min={0} precision={2} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
            <Modal title={t("dashboard.generationLogDetailTitle")} open={Boolean(viewingGenerationLog)} footer={null} onCancel={() => setViewingGenerationLog(null)} width={860}>
                {viewingGenerationLog ? <GenerationLogDetail log={viewingGenerationLog} /> : null}
            </Modal>
            <Modal title={t("dashboard.cdkDetailTitle")} open={Boolean(viewingCdkCode)} footer={null} onCancel={() => setViewingCdkCode(null)} width={760}>
                {viewingCdkCode ? (
                    <div className="space-y-3">
                        <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-800 dark:bg-stone-900/60">
                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("dashboard.cdkCodeLabel")}</div>
                                <Button size="small" icon={<Copy className="size-3.5" />} disabled={!viewingCdkCode.code} onClick={() => void copyCdkPlainCode(viewingCdkCode)}>
                                    {t("dashboard.copyPlain")}
                                </Button>
                            </div>
                            <div className="break-all rounded-md border border-stone-200 bg-white px-3 py-2 font-mono text-sm font-semibold text-stone-950 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-100">
                                {viewingCdkCode.code || t("dashboard.cdkPlainUnavailable")}
                            </div>
                            {!viewingCdkCode.code ? <div className="mt-2 text-xs text-stone-500 dark:text-stone-400">{t("dashboard.cdkNoPlain")}</div> : null}
                        </div>
                        <CdkRedemptionDetail code={viewingCdkCode} />
                    </div>
                ) : null}
            </Modal>
            <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={(event) => {
                    uploadSiteLogo(event.target.files?.[0]);
                    event.target.value = "";
                }}
            />
            <input
                ref={iconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                className="hidden"
                onChange={(event) => {
                    uploadSiteIcon(event.target.files?.[0]);
                    event.target.value = "";
                }}
            />
        </div>
    );
}
