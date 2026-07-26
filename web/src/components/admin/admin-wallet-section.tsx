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

export function AdminWalletSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const { billingSummary, billingSummaryLoading, activeSection, setActiveSection, walletSummary, loadBillingSummary } = controller;
    if (activeSection !== "wallet") return null;
    return (
        <div className="space-y-3 sm:space-y-5">
            <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Metric
                    label={t("wallet.metrics.paidAmount")}
                    value={formatAdminMoney(billingSummary?.orders.paidAmountCents || 0)}
                    detail={t("wallet.metrics.paidAmountDetail", { count: billingSummary?.orders.paid || 0 })}
                    icon={<CircleDollarSign className="size-5" />}
                    tone="emerald"
                />
                <Metric
                    label={t("wallet.metrics.pendingAmount")}
                    value={formatAdminMoney(billingSummary?.orders.pendingAmountCents || 0)}
                    detail={t("wallet.metrics.pendingAmountDetail", { count: billingSummary?.orders.pending || 0 })}
                    icon={<ReceiptText className="size-5" />}
                    tone="amber"
                />
                <Metric
                    label={t("wallet.metrics.refundedAmount")}
                    value={formatAdminMoney(billingSummary?.orders.refundedAmountCents || 0)}
                    detail={t("wallet.metrics.refundedAmountDetail", { count: billingSummary?.orders.refunded || 0 })}
                    icon={<RefreshCw className="size-5" />}
                    tone="blue"
                />
                <Metric label={t("wallet.metrics.userBalance")} value={formatCreditAmount(walletSummary.totalBalance)} detail={t("wallet.metrics.userBalanceDetail")} icon={<WalletCards className="size-5" />} tone="slate" />
            </section>
            <Panel>
                <PanelHeader
                    title={t("wallet.title")}
                    description={t("wallet.description")}
                    actions={
                        <Button aria-label={t("wallet.refresh")} title={t("wallet.refresh")} loading={billingSummaryLoading} icon={<RefreshCw className="size-4" />} onClick={() => void loadBillingSummary()}>
                            <span className="hidden sm:inline">{t("wallet.refresh")}</span>
                        </Button>
                    }
                />
                <div className="grid gap-3 p-3 sm:gap-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3">
                        <FinanceFlowItem
                            title={t("wallet.flow.topupIncome.title")}
                            amount={formatAdminMoney(billingSummary?.orders.paidAmountCents || 0)}
                            description={t("wallet.flow.topupIncome.description", { count: billingSummary?.orders.paid || 0 })}
                            icon={<CircleDollarSign className="size-4" />}
                        />
                        <FinanceFlowItem
                            title={t("wallet.flow.refundExpense.title")}
                            amount={formatAdminMoney(billingSummary?.orders.refundedAmountCents || 0)}
                            description={t("wallet.flow.refundExpense.description", { count: billingSummary?.orders.refunded || 0 })}
                            icon={<ReceiptText className="size-4" />}
                        />
                        <FinanceFlowItem
                            title={t("wallet.flow.netIncome.title")}
                            amount={formatAdminMoney((billingSummary?.orders.paidAmountCents || 0) - (billingSummary?.orders.refundedAmountCents || 0))}
                            description={t("wallet.flow.netIncome.description")}
                            icon={<CircleDollarSign className="size-4" />}
                        />
                        <FinanceFlowItem
                            title={t("wallet.flow.pointsLiability.title")}
                            amount={t("wallet.flow.pointsLiability.amount", { count: formatCreditAmount(walletSummary.totalBalance) })}
                            description={t("wallet.flow.pointsLiability.description")}
                            icon={<WalletCards className="size-4" />}
                        />
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3 sm:p-4 dark:border-stone-800 dark:bg-stone-900/40">
                        <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("wallet.reconciliationNote.title")}</div>
                        <div className="mt-2 line-clamp-2 text-xs leading-5 text-stone-500 sm:line-clamp-none sm:text-sm sm:leading-6 dark:text-stone-400">{t("wallet.reconciliationNote.description")}</div>
                        <div className="mt-4 grid gap-2 rounded-lg border border-stone-200 bg-white p-3 text-sm dark:border-stone-800 dark:bg-stone-950">
                            <FinanceMiniRow label={t("wallet.mini.totalOrdersLabel")} value={t("wallet.mini.totalOrders", { count: billingSummary?.orders.total || 0 })} />
                            <FinanceMiniRow
                                label={t("wallet.mini.reconciliationIssuesLabel")}
                                value={t("wallet.mini.reconciliationIssues", {
                                    count: billingSummary ? billingSummary.reconciliation.paidOrdersWithoutSucceededPayment + billingSummary.reconciliation.succeededPaymentsWithoutPaidOrder + billingSummary.reconciliation.amountMismatchPayments : 0,
                                })}
                            />
                            <FinanceMiniRow label={t("wallet.mini.plansOnSaleLabel")} value={t("wallet.mini.plansOnSale", { count: walletSummary.enabledPlans })} />
                            <FinanceMiniRow label={t("wallet.mini.planUsersLabel")} value={t("wallet.mini.planUsers", { count: walletSummary.usersWithPlan })} />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:grid-cols-1 sm:gap-2">
                            <Button className="px-2 text-xs sm:px-3 sm:text-sm" onClick={() => setActiveSection("products")} icon={<CreditCard className="size-3.5 sm:size-4" />}>
                                {t("nav.sections.products.label")}
                            </Button>
                            <Button className="px-2 text-xs sm:px-3 sm:text-sm" onClick={() => setActiveSection("orders")} icon={<ReceiptText className="size-3.5 sm:size-4" />}>
                                {t("nav.sections.orders.label")}
                            </Button>
                            <Button className="px-2 text-xs sm:px-3 sm:text-sm" onClick={() => setActiveSection("payments")} icon={<PlugZap className="size-3.5 sm:size-4" />}>
                                {t("nav.sections.payments.label")}
                            </Button>
                        </div>
                    </div>
                </div>
            </Panel>
        </div>
    );
}
