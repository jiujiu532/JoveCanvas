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
import { useTranslations } from "next-intl";

import { formatCreditAmount } from "@/constant/credits";
import { imagePreviewUrl } from "@/lib/media-image-url";
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

export type AdminDashboardProps = {
    initialUsers: PublicUser[];
    initialUserSummary: PublicUserSummary;
    initialSettings: AuthSettings;
    initialPromptCount: number;
    currentUser: PublicUser;
    initialSection?: AdminSectionKey;
    setupSummary?: AdminSetupSummary;
    headerActions?: ReactNode;
};
export type PromptFormValue = {
    title: string;
    prompt: string;
    category?: string;
    tags?: string;
    coverUrl?: string;
    preview?: string;
};

export type UserEditorValue = {
    username?: string;
    displayName: string;
    email?: string;
    password?: string;
    role: UserRole;
    status: UserStatus;
    pointsBalance: number;
};

export const PROMPT_PAGE_SIZE = 20;
export const PROMPT_SEARCH_DEBOUNCE_MS = 300;
export const CDK_PAGE_SIZE = 20;
export const GENERATION_LOG_PAGE_SIZE = 20;
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

import type { AdminDashboardState } from "./use-admin-dashboard-state";
import type { AdminDashboardDataActions } from "./use-admin-dashboard-data-actions";
import type { AdminDashboardSettingsActions } from "./use-admin-dashboard-settings-actions";

export function useAdminDashboardTableModel({ state, data, settingsActions }: { state: AdminDashboardState; data: AdminDashboardDataActions; settingsActions: AdminDashboardSettingsActions }) {
    const t = useTranslations("admin");
    const { currentUser, setupSummary, userForm, settings, updatingUserId, deletingPromptId, setViewingGenerationLog, setViewingCdkCode, editingUser, setEditingUser, creatingUser, setCreatingUser, activeSection } = state;
    const { updateUser, createUser, deleteUser, deletePrompt, deleteGenerationLogsByIds, deleteCdkById, copyCdkPlainCode } = data;
    const {} = settingsActions;

    const openUserEditor = (user: PublicUser) => {
        setCreatingUser(false);
        setEditingUser(user);
        userForm.setFieldsValue({
            username: user.username,
            displayName: user.displayName,
            email: user.email || "",
            password: "",
            role: user.role,
            status: user.status,
            pointsBalance: user.permanentPointsBalance,
        });
    };

    const openCreateUserEditor = () => {
        setEditingUser(null);
        setCreatingUser(true);
        userForm.setFieldsValue({ username: "", displayName: "", email: "", password: "", role: "user", status: "active", pointsBalance: 0 });
    };

    const closeUserEditor = () => {
        setEditingUser(null);
        setCreatingUser(false);
        userForm.resetFields();
    };

    const saveUserEditor = async (value: UserEditorValue) => {
        if (creatingUser) {
            const user = await createUser(value);
            if (user) closeUserEditor();
            return;
        }
        if (!editingUser) return;
        const user = await updateUser(editingUser.id, {
            displayName: value.displayName,
            email: value.email || "",
            password: value.password || undefined,
            role: value.role,
            status: value.status,
            pointsBalance: toNumberOrZero(value.pointsBalance),
        });
        if (user) closeUserEditor();
    };

    const userColumns: TableColumnsType<PublicUser> = [
        {
            title: t("users.table.user"),
            dataIndex: "displayName",
            render: (_, record) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium text-stone-950 dark:text-stone-100">
                        <UserRound className="size-4 text-stone-400" />
                        <span className="truncate">{record.displayName}</span>
                    </div>
                    <div className="mt-1 text-xs text-stone-500">@{record.username}</div>
                    <div className="mt-0.5 truncate text-xs text-stone-400">{record.email || t("users.table.noEmail")}</div>
                    <div className="mt-2 flex flex-wrap gap-1 sm:hidden">
                        <Tag color={record.role === "admin" ? "blue" : "default"}>{record.role === "admin" ? t("users.table.roleAdmin") : t("users.table.roleUser")}</Tag>
                        <Tag color={record.status === "active" ? "green" : "red"}>{record.status === "active" ? t("users.table.statusActive") : t("users.table.statusDisabled")}</Tag>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-stone-500 sm:hidden dark:text-stone-400">
                        <div>
                            {t("users.table.total")} <span className="font-semibold text-stone-950 dark:text-stone-100">{formatCreditAmount(record.pointsBalance)}</span> · {t("users.table.today")} {formatCreditAmount(record.dailyPointsBalance)} ·{" "}
                            {t("users.table.permanent")} {formatCreditAmount(record.permanentPointsBalance)}
                        </div>
                        <div>
                            {t("users.table.registered")} {formatAdminLogTime(record.createdAt)}
                        </div>
                        <div>
                            {t("users.table.active")} {record.lastLoginAt ? formatAdminLogTime(record.lastLoginAt) : t("users.table.neverLoggedIn")}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: t("users.table.role"),
            dataIndex: "role",
            width: 120,
            responsive: ["sm"],
            render: (role: UserRole) => <Tag color={role === "admin" ? "blue" : "default"}>{role === "admin" ? t("users.table.roleAdmin") : t("users.table.roleUser")}</Tag>,
        },
        {
            title: t("users.table.status"),
            dataIndex: "status",
            width: 120,
            responsive: ["sm"],
            render: (status: UserStatus) => <Tag color={status === "active" ? "green" : "red"}>{status === "active" ? t("users.table.statusActive") : t("users.table.statusDisabled")}</Tag>,
        },
        {
            title: t("users.table.points"),
            dataIndex: "pointsBalance",
            width: 170,
            responsive: ["sm"],
            render: (pointsBalance: number, record) => (
                <div className="text-xs text-stone-500 dark:text-stone-400">
                    <div className="font-semibold text-stone-950 dark:text-stone-100">
                        {t("users.table.total")} {formatCreditAmount(pointsBalance)}
                    </div>
                    <div className="mt-1">
                        {t("users.table.today")} {formatCreditAmount(record.dailyPointsBalance)} · {t("users.table.permanent")} {formatCreditAmount(record.permanentPointsBalance)}
                    </div>
                </div>
            ),
        },
        {
            title: t("users.table.time"),
            width: 210,
            responsive: ["sm"],
            render: (_, record) => (
                <div className="space-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <div>
                        <span className="mr-2 text-stone-400 dark:text-stone-500">{t("users.table.registered")}</span>
                        {formatAdminLogTime(record.createdAt)}
                    </div>
                    <div>
                        <span className="mr-2 text-stone-400 dark:text-stone-500">{t("users.table.active")}</span>
                        {record.lastLoginAt ? formatAdminLogTime(record.lastLoginAt) : t("users.table.neverLoggedIn")}
                    </div>
                </div>
            ),
        },
        {
            title: t("users.table.actions"),
            width: 150,
            render: (_, record) => (
                <Space size={6}>
                    <Button size="small" icon={<SlidersHorizontal className="size-3.5" />} loading={updatingUserId === record.id} onClick={() => openUserEditor(record)}>
                        {t("users.table.manage")}
                    </Button>
                    <Popconfirm title={t("users.table.deleteConfirmTitle")} description={t("users.table.deleteConfirmDescription")} okText={t("users.table.deleteOk")} cancelText={t("users.table.deleteCancel")} onConfirm={() => void deleteUser(record.id)}>
                        <Button
                            size="small"
                            danger
                            disabled={record.id === currentUser.id}
                            loading={updatingUserId === record.id}
                            icon={<Trash2 className="size-3.5" />}
                            aria-label={t("users.table.deleteAriaLabel", { name: record.displayName })}
                            title={t("users.table.deleteAriaLabel", { name: record.displayName })}
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const promptColumns: TableColumnsType<Prompt> = [
        {
            title: t("prompts.table.title"),
            dataIndex: "title",
            render: (_, record) => (
                <div className="flex min-w-0 gap-3">
                    {record.coverUrl ? (
                        <img src={imagePreviewUrl(record.coverUrl, 480)} alt={record.title} className="h-14 w-20 shrink-0 rounded-md border border-stone-200 object-cover dark:border-stone-800" loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="h-14 w-20 shrink-0 rounded-md border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900" />
                    )}
                    <div className="min-w-0">
                        <div className="font-medium text-stone-950 dark:text-stone-100">{record.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{record.prompt}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {record.tags.map((tag) => (
                                <Tag key={tag} className="m-0 text-[11px]">
                                    {tag}
                                </Tag>
                            ))}
                        </div>
                    </div>
                </div>
            ),
        },
        { title: t("prompts.table.category"), dataIndex: "category", width: 140 },
        {
            title: t("prompts.table.actions"),
            width: 90,
            render: (_, record) => (
                <Popconfirm title={t("prompts.table.deleteConfirmTitle")} okText={t("prompts.table.deleteOk")} cancelText={t("prompts.table.deleteCancel")} onConfirm={() => deletePrompt(record.id)}>
                    <Button
                        size="small"
                        danger
                        loading={deletingPromptId === record.id}
                        icon={<Trash2 className="size-3.5" />}
                        aria-label={t("prompts.table.deleteAriaLabel", { name: record.title })}
                        title={t("prompts.table.deleteAriaLabel", { name: record.title })}
                    />
                </Popconfirm>
            ),
        },
    ];
    const generationLogColumns: TableColumnsType<StoredGenerationLog> = [
        {
            title: t("logs.table.time"),
            dataIndex: "createdAt",
            width: 170,
            render: (value) => <span className="text-sm text-stone-700 dark:text-stone-200">{formatAdminLogTime(String(value))}</span>,
        },
        {
            title: t("logs.table.kind"),
            dataIndex: "kind",
            width: 92,
            render: (_, record) => (
                <Tag className="m-0" color={record.kind === "video" ? "purple" : "blue"}>
                    {generationKindLabel(record.kind, t)}
                </Tag>
            ),
        },
        {
            title: t("logs.table.user"),
            width: 150,
            render: (_, record) => (
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">{record.displayName || record.username}</div>
                    <div className="truncate text-xs text-stone-500 dark:text-stone-400">@{record.username || "unknown"}</div>
                </div>
            ),
        },
        {
            title: t("logs.table.source"),
            dataIndex: "source",
            width: 120,
            render: (value) => <span className="text-sm text-stone-600 dark:text-stone-300">{generationSourceLabel(String(value), t)}</span>,
        },
        {
            title: t("logs.table.model"),
            dataIndex: "model",
            width: 160,
            render: (value) => <span className="line-clamp-1 text-sm text-stone-600 dark:text-stone-300">{formatGenerationLogModel(String(value || ""))}</span>,
        },
        {
            title: t("logs.table.duration"),
            dataIndex: "durationMs",
            width: 90,
            render: (value) => <span className="text-sm tabular-nums text-stone-700 dark:text-stone-200">{formatAdminLogDuration(Number(value) || 0)}</span>,
        },
        {
            title: t("logs.table.status"),
            dataIndex: "status",
            width: 92,
            render: (_, record) => <span className={generationStatusClass(record.status)}>{generationStatusLabel(record.status, t)}</span>,
        },
        {
            title: t("logs.table.result"),
            width: 100,
            render: (_, record) => <GenerationLogAssetPreview log={record} />,
        },
        {
            title: t("logs.table.prompt"),
            dataIndex: "prompt",
            width: 360,
            render: (_, record) => (
                <div className="admin-generation-log-prompt-cell min-w-0">
                    <div className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">{record.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{record.prompt || record.summary}</div>
                </div>
            ),
        },
        {
            title: t("logs.table.actions"),
            width: 176,
            fixed: "right",
            render: (_, record) => (
                <div className="admin-generation-log-actions">
                    <Button size="small" type="text" icon={<Eye className="size-3.5" />} onClick={() => setViewingGenerationLog(record)}>
                        {t("logs.table.detail")}
                    </Button>
                    <Popconfirm title={t("logs.table.deleteConfirmTitle")} okText={t("logs.table.deleteOk")} cancelText={t("logs.table.deleteCancel")} onConfirm={() => void deleteGenerationLogsByIds([record.id])}>
                        <Button size="small" type="text" danger icon={<Trash2 className="size-3.5" />}>
                            {t("logs.table.deleteOk")}
                        </Button>
                    </Popconfirm>
                </div>
            ),
        },
    ];
    const cdkColumns: TableColumnsType<PublicCdkCode> = [
        {
            title: "CDK",
            dataIndex: "codePreview",
            width: 390,
            render: (_, code) => (
                <div className="min-w-0 space-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 max-w-full truncate font-mono text-sm font-semibold text-stone-950 dark:text-stone-100">{code.code || "CDK"}</span>
                        <Tag className="m-0" color={cdkStatusTone(code)}>
                            {cdkStatusLabel(code)}
                        </Tag>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                        <Button className="h-6 px-1.5 text-xs" size="small" type="text" icon={<Copy className="size-3.5" />} onClick={() => void copyCdkPlainCode(code)}>
                            {t("cdk.table.copy")}
                        </Button>
                        {code.note ? <span className="min-w-0 max-w-full truncate">{t("cdk.table.note", { note: code.note })}</span> : null}
                    </div>
                </div>
            ),
        },
        {
            title: t("cdk.table.rules"),
            width: 190,
            render: (_, code) => (
                <div className="text-sm leading-6 text-stone-700 dark:text-stone-200">
                    <div>{t("cdk.table.points", { count: formatCreditAmount(code.points) })}</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">{t("cdk.table.redeemed", { count: code.redeemedCount, max: code.maxRedemptions })}</div>
                </div>
            ),
        },
        {
            title: t("cdk.table.latestRedemption"),
            width: 260,
            render: (_, code) => {
                const latest = [...code.redemptions].sort((a, b) => Date.parse(b.redeemedAt) - Date.parse(a.redeemedAt))[0];
                if (!latest) return <span className="text-sm text-stone-500 dark:text-stone-400">{t("cdk.table.noRedemption")}</span>;
                return (
                    <div className="min-w-0 text-sm leading-6 text-stone-700 dark:text-stone-200">
                        <div className="truncate font-medium">
                            {latest.displayName}
                            <span className="ml-1 font-normal text-stone-500 dark:text-stone-400">@{latest.username}</span>
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">{new Date(latest.redeemedAt).toLocaleString()}</div>
                    </div>
                );
            },
        },
        {
            title: t("cdk.table.validity"),
            width: 190,
            render: (_, code) => (
                <div className="text-sm text-stone-700 dark:text-stone-200">
                    {code.expiresAt ? (
                        <>
                            <div>{new Date(code.expiresAt).toLocaleString()}</div>
                            <div className="text-xs text-stone-500 dark:text-stone-400">{t("cdk.table.created", { date: new Date(code.createdAt).toLocaleDateString() })}</div>
                        </>
                    ) : (
                        <>
                            <div>{t("cdk.table.longTermValid")}</div>
                            <div className="text-xs text-stone-500 dark:text-stone-400">{t("cdk.table.created", { date: new Date(code.createdAt).toLocaleDateString() })}</div>
                        </>
                    )}
                </div>
            ),
        },
        {
            title: t("cdk.table.actions"),
            width: 200,
            fixed: "right",
            render: (_, code) => (
                <Space size={6} wrap>
                    <Button size="small" type="text" icon={<Eye className="size-3.5" />} onClick={() => setViewingCdkCode(code)}>
                        {t("cdk.table.detail")}
                    </Button>
                    <Popconfirm title={t("cdk.table.deleteConfirmTitle")} description={t("cdk.table.deleteConfirmDescription")} okText={t("cdk.table.deleteOk")} cancelText={t("cdk.table.deleteCancel")} onConfirm={() => void deleteCdkById(code.id)}>
                        <Button size="small" danger icon={<Trash2 className="size-3.5" />}>
                            {t("cdk.table.deleteOk")}
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];
    const activeSectionInfo = adminSections(t).find((section) => section.key === activeSection) || adminSections(t)[0];
    const nextSetupStep = setupSummary?.steps.find((step) => step.status !== "done") || setupSummary?.steps[setupSummary.steps.length - 1];
    return {
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
    };
}

export type AdminDashboardTableModel = ReturnType<typeof useAdminDashboardTableModel>;
