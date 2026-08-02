"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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
import { AdminOverview, buildOperationsSummary } from "@/components/admin/admin-overview";
import { AdminLogicalModelManager } from "@/components/admin/admin-logical-model-manager";
import { Metric, Panel, PanelHeader } from "@/components/admin/admin-panel";
import { AdminSectionNav, adminSections } from "@/components/admin/admin-section-nav";
import type { AdminSectionKey } from "@/components/admin/admin-sections";
import { UpdateCenterPanel } from "@/components/admin/admin-update-center";
import { LabeledControl, SectionTitle, SettingInlineToggle, SettingToggle } from "@/components/admin/admin-settings-controls";
import { SiteLogoPreview, SiteSettingStatus, SiteShowcasePreview, useSiteSocialItems } from "@/components/admin/admin-site-preview";
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

export function AdminSiteSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const siteSocialItems = useSiteSocialItems();
    const {
        logoInputRef,
        iconInputRef,
        settings,
        settingsLoading,
        activeSection,
        saveSettings,
        updateSiteSetting,
        uploadSiteIcon,
        updateSiteSocialSetting,
        addFriendLink,
        updateFriendLink,
        deleteFriendLink,
        addHomeShowcaseItem,
        updateHomeShowcaseItem,
        deleteHomeShowcaseItem,
    } = controller;
    if (activeSection !== "site") return null;
    return (
        <Panel>
            <PanelHeader
                title={t("siteSettings.title")}
                description={t("siteSettings.description")}
                actions={
                    <Button type="primary" loading={settingsLoading} icon={<Save className="size-4" />} onClick={() => saveSettings({ site: settings.site }, t("siteSettings.saved"))}>
                        {t("siteSettings.save")}
                    </Button>
                }
            />
            <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_360px] sm:p-5">
                <div className="space-y-5">
                    <div className="space-y-5 rounded-lg border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
                        <SectionTitle icon={<Globe2 className="size-4" />} title={t("siteSettings.basicInfo")} />
                        <div className="grid gap-4 md:grid-cols-2">
                            <LabeledControl label={t("siteSettings.siteTitle")}>
                                <Input value={settings.site.title} maxLength={40} placeholder="JoveCanvas" onChange={(event) => updateSiteSetting("title", event.target.value)} />
                            </LabeledControl>
                            <LabeledControl label={t("siteSettings.logoUrl")}>
                                <div className="flex gap-2">
                                    <Input value={settings.site.logoUrl} maxLength={2000} placeholder={t("siteSettings.logoPlaceholder")} onChange={(event) => updateSiteSetting("logoUrl", event.target.value)} />
                                    <Button icon={<Upload className="size-4" />} onClick={() => logoInputRef.current?.click()}>
                                        {t("siteSettings.upload")}
                                    </Button>
                                </div>
                            </LabeledControl>
                            <LabeledControl label={t("siteSettings.iconUrl")}>
                                <div className="flex gap-2">
                                    <Input value={settings.site.iconUrl} maxLength={2000} placeholder={t("siteSettings.iconPlaceholder")} onChange={(event) => updateSiteSetting("iconUrl", event.target.value)} />
                                    <Button icon={<Upload className="size-4" />} onClick={() => iconInputRef.current?.click()}>
                                        {t("siteSettings.upload")}
                                    </Button>
                                </div>
                            </LabeledControl>
                        </div>
                        <div className="rounded-md border border-dashed border-stone-300 bg-white p-3 text-xs leading-5 text-stone-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400">{t("siteSettings.mediaHint")}</div>

                        <div className="border-t border-stone-200 pt-5 dark:border-stone-800">
                            <SectionTitle icon={<Search className="size-4" />} title={t("siteSettings.seoInfo")} />
                            <div className="mt-4 space-y-4">
                                <LabeledControl label={t("siteSettings.seoTitle")}>
                                    <Input value={settings.site.seoTitle} maxLength={72} placeholder={settings.site.title} onChange={(event) => updateSiteSetting("seoTitle", event.target.value)} />
                                </LabeledControl>
                                <LabeledControl label={t("siteSettings.seoDescription")}>
                                    <Input.TextArea value={settings.site.seoDescription} maxLength={180} rows={4} placeholder={t("siteSettings.seoDescriptionPlaceholder")} onChange={(event) => updateSiteSetting("seoDescription", event.target.value)} />
                                </LabeledControl>
                                <LabeledControl label={t("siteSettings.seoKeywords")}>
                                    <Input value={settings.site.seoKeywords} maxLength={240} placeholder={t("siteSettings.seoKeywordsPlaceholder")} onChange={(event) => updateSiteSetting("seoKeywords", event.target.value)} />
                                </LabeledControl>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <SectionTitle icon={<Sparkles className="size-4" />} title={t("siteSettings.homeShowcase")} />
                                <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("siteSettings.homeShowcaseHint")}</div>
                            </div>
                            <div className="w-full sm:w-[272px] sm:shrink-0">
                                <Segmented
                                    block
                                    size="small"
                                    className="w-full [&_.ant-segmented-group]:!flex [&_.ant-segmented-item]:!min-w-0 [&_.ant-segmented-item]:!flex-1 [&_.ant-segmented-item-label]:!px-2 [&_.ant-segmented-item-label]:!text-center"
                                    value={settings.site.homeShowcaseMode || "random"}
                                    onChange={(value) => updateSiteSetting("homeShowcaseMode", value as AuthSettings["site"]["homeShowcaseMode"])}
                                    options={[
                                        { label: t("siteSettings.randomPrompts"), value: "random" },
                                        { label: t("siteSettings.customShowcase"), value: "custom" },
                                    ]}
                                />
                            </div>
                        </div>

                        {settings.site.homeShowcaseMode === "custom" ? (
                            <div className="mt-5 space-y-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-xs text-stone-500 dark:text-stone-400">{t("siteSettings.showcaseTip")}</div>
                                    <Button icon={<Plus className="size-4" />} disabled={(settings.site.homeShowcaseItems || []).length >= 8} onClick={addHomeShowcaseItem}>
                                        {t("siteSettings.addShowcase")}
                                    </Button>
                                </div>
                                <div className="grid gap-3">
                                    {(settings.site.homeShowcaseItems || []).map((item, index) => (
                                        <div key={item.id} className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950/60 md:grid-cols-[168px_minmax(0,1fr)]">
                                            <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900">
                                                {item.coverUrl ? (
                                                    <img src={imagePreviewUrl(item.coverUrl, 640)} alt="" className="aspect-[4/3] w-full object-cover" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#f8fafc,#dff5ff_45%,#111827)] text-xs text-stone-500 dark:bg-[linear-gradient(135deg,#0f172a,#164e63_45%,#020617)] dark:text-stone-300">
                                                        {t("siteSettings.noCover")}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("siteSettings.showcaseItem", { index: index + 1 })}</div>
                                                    <Button
                                                        size="small"
                                                        danger
                                                        icon={<Trash2 className="size-3.5" />}
                                                        aria-label={t("siteSettings.deleteShowcaseAria")}
                                                        title={t("siteSettings.deleteShowcaseAria")}
                                                        onClick={() => deleteHomeShowcaseItem(item.id)}
                                                    />
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <Input value={item.title} maxLength={80} placeholder={t("siteSettings.showcaseTitlePlaceholder")} onChange={(event) => updateHomeShowcaseItem(item.id, { title: event.target.value })} />
                                                    <Input value={item.category} maxLength={40} placeholder={t("siteSettings.showcaseCategoryPlaceholder")} onChange={(event) => updateHomeShowcaseItem(item.id, { category: event.target.value })} />
                                                </div>
                                                <Input value={item.coverUrl} maxLength={2000} placeholder={t("siteSettings.showcaseCoverPlaceholder")} onChange={(event) => updateHomeShowcaseItem(item.id, { coverUrl: event.target.value })} />
                                                <Input
                                                    value={(item.tags || []).join("，")}
                                                    maxLength={120}
                                                    placeholder={t("siteSettings.showcaseTagsPlaceholder")}
                                                    onChange={(event) =>
                                                        updateHomeShowcaseItem(item.id, {
                                                            tags: event.target.value
                                                                .split(/[,，]/)
                                                                .map((tag) => tag.trim())
                                                                .filter(Boolean),
                                                        })
                                                    }
                                                />
                                                <Input.TextArea
                                                    value={item.prompt}
                                                    rows={3}
                                                    maxLength={3000}
                                                    placeholder={t("siteSettings.showcasePromptPlaceholder")}
                                                    onChange={(event) => updateHomeShowcaseItem(item.id, { prompt: event.target.value })}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {!settings.site.homeShowcaseItems?.length ? (
                                        <div className="rounded-md border border-dashed border-stone-200 px-3 py-8 text-center text-sm text-stone-500 dark:border-stone-800">{t("siteSettings.showcaseEmpty")}</div>
                                    ) : null}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-5 rounded-lg border border-dashed border-stone-200 bg-white px-4 py-5 text-sm leading-6 text-stone-600 dark:border-stone-800 dark:bg-stone-950/60 dark:text-stone-300">{t("siteSettings.randomModeHint")}</div>
                        )}
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <SectionTitle icon={<Globe2 className="size-4" />} title={t("siteSettings.footerSocial")} />
                            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">{t("siteSettings.footerSocialHint")}</span>
                        </div>
                        <div className="mt-5 space-y-4">
                            <LabeledControl label={t("siteSettings.copyright")}>
                                <Input value={settings.site.footerCopyright} maxLength={120} placeholder="© 2026 JoveCanvas. All rights reserved." onChange={(event) => updateSiteSetting("footerCopyright", event.target.value)} />
                            </LabeledControl>
                            <div className="grid gap-4 md:grid-cols-2">
                                <LabeledControl label={t("siteSettings.termsUrl")}>
                                    <Input value={settings.site.termsUrl} maxLength={2000} placeholder={t("siteSettings.termsPlaceholder")} onChange={(event) => updateSiteSetting("termsUrl", event.target.value)} />
                                </LabeledControl>
                                <LabeledControl label={t("siteSettings.privacyUrl")}>
                                    <Input value={settings.site.privacyUrl} maxLength={2000} placeholder={t("siteSettings.privacyPlaceholder")} onChange={(event) => updateSiteSetting("privacyUrl", event.target.value)} />
                                </LabeledControl>
                            </div>
                            <div className="grid gap-3">
                                {siteSocialItems.map((item) => {
                                    const social = settings.site.socials[item.key];
                                    return (
                                        <div key={item.key} className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950/60">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 text-sm font-semibold text-stone-950 dark:text-stone-100">
                                                    <span className="flex size-7 items-center justify-center rounded-md bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/70 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900/60">{item.icon}</span>
                                                    {item.label}
                                                </div>
                                                <Switch checked={social.enabled} checkedChildren={t("siteSettings.show")} unCheckedChildren={t("siteSettings.hide")} onChange={(enabled) => updateSiteSocialSetting(item.key, { enabled })} />
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                                                <Input value={social.label} maxLength={32} placeholder={item.label} onChange={(event) => updateSiteSocialSetting(item.key, { label: event.target.value })} />
                                                <Input value={social.url} maxLength={2000} placeholder={item.placeholder} onChange={(event) => updateSiteSocialSetting(item.key, { url: event.target.value })} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="border-t border-stone-200 pt-4 dark:border-stone-800">
                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("siteSettings.friendLinks")}</div>
                                        <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t("siteSettings.friendLinksHint")}</div>
                                    </div>
                                    <Button icon={<Plus className="size-4" />} onClick={addFriendLink}>
                                        {t("siteSettings.addLink")}
                                    </Button>
                                </div>
                                <div className="grid gap-3">
                                    {(settings.site.friendLinks || []).map((link) => (
                                        <div key={link.id} className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950/60">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{link.label || t("siteSettings.friendLinkFallback")}</div>
                                                <div className="flex items-center gap-2">
                                                    <Switch checked={link.enabled} checkedChildren={t("siteSettings.show")} unCheckedChildren={t("siteSettings.hide")} onChange={(enabled) => updateFriendLink(link.id, { enabled })} />
                                                    <Button
                                                        size="small"
                                                        danger
                                                        icon={<Trash2 className="size-3.5" />}
                                                        aria-label={t("siteSettings.deleteFriendLinkAria")}
                                                        title={t("siteSettings.deleteFriendLinkAria")}
                                                        onClick={() => deleteFriendLink(link.id)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                                                <Input value={link.label} maxLength={32} placeholder="Linux.do" onChange={(event) => updateFriendLink(link.id, { label: event.target.value })} />
                                                <Input value={link.url} maxLength={2000} placeholder="https://linux.do/" onChange={(event) => updateFriendLink(link.id, { url: event.target.value })} />
                                            </div>
                                        </div>
                                    ))}
                                    {!settings.site.friendLinks?.length ? (
                                        <div className="rounded-md border border-dashed border-stone-200 px-3 py-6 text-center text-sm text-stone-500 dark:border-stone-800">{t("siteSettings.friendLinksEmpty")}。</div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm shadow-stone-200/40 dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/20">
                        <SectionTitle icon={<ImageIcon className="size-4" />} title={t("siteSettings.frontendPreview")} />
                        <div className="mt-5 rounded-lg border border-stone-200 bg-white p-5 text-stone-950 shadow-sm shadow-stone-200/60 dark:border-white/10 dark:bg-stone-950 dark:text-white dark:shadow-black/20">
                            <div className="flex items-center gap-3">
                                <SiteLogoPreview logoUrl={settings.site.logoUrl} />
                                <div className="min-w-0">
                                    <div className="truncate text-lg font-semibold">{settings.site.title || "JoveCanvas"}</div>
                                    <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t("siteSettings.navBrand")}</div>
                                </div>
                            </div>
                            <div className="mt-6 border-t border-stone-200 pt-4 dark:border-white/10">
                                <div className="text-base font-semibold">{settings.site.seoTitle || settings.site.title}</div>
                                <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-500 dark:text-stone-400">{settings.site.seoDescription}</p>
                            </div>
                        </div>
                    </div>
                    <SiteSettingStatus site={settings.site} />
                    <SiteShowcasePreview site={settings.site} onAdd={addHomeShowcaseItem} />
                </div>
            </div>
        </Panel>
    );
}

export function AdminSettingsSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const { settings, setSettings, settingsLoading, mailTestLoading, mailTestTo, setMailTestTo, activeSection, saveSettings, updateGenerationConcurrency, updateGenerationDefaults, updateMailSetting, testMailSettings } = controller;
    if (activeSection !== "settings") return null;
    return (
        <Panel>
            <PanelHeader
                title={t("systemSettings.title")}
                description={t("systemSettings.description")}
                actions={
                    <div className="flex items-center justify-end gap-1.5 sm:w-auto sm:flex-row sm:gap-2">
                        <div className="hidden flex-wrap gap-2 text-xs text-stone-500 sm:flex dark:text-stone-400">
                            <Tag className="m-0">{settings.registrationEnabled ? t("systemSettings.registrationOpen") : t("systemSettings.registrationClosed")}</Tag>
                        </div>
                        <Button
                            type="primary"
                            aria-label={t("systemSettings.saveAria")}
                            title={t("systemSettings.saveAria")}
                            loading={settingsLoading}
                            icon={<Save className="size-4" />}
                            onClick={() =>
                                saveSettings(
                                    {
                                        registrationEnabled: settings.registrationEnabled,
                                        emailRegistrationEnabled: settings.emailRegistrationEnabled,
                                        mail: settings.mail,
                                        generationConcurrency: settings.generationConcurrency,
                                        generationDefaults: settings.generationDefaults,
                                    },
                                    t("systemSettings.saved"),
                                )
                            }
                        >
                            <span className="sm:hidden">{t("systemSettings.saveShort")}</span>
                            <span className="hidden sm:inline">{t("systemSettings.save")}</span>
                        </Button>
                    </div>
                }
            />
            <div className="space-y-3 p-3 sm:space-y-5 sm:p-5">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <SettingsStatusTile
                        icon={<UserCog className="size-4" />}
                        label={t("systemSettings.accountEntry")}
                        value={settings.registrationEnabled ? t("systemSettings.registrationOpen") : t("systemSettings.registrationClosed")}
                        detail={settings.emailRegistrationEnabled ? t("systemSettings.emailRegistrationEnabled") : t("systemSettings.emailRegistrationDisabled")}
                        tone="cyan"
                    />
                    <SettingsStatusTile
                        icon={<Sparkles className="size-4" />}
                        label={t("systemSettings.generationControl")}
                        value={t("systemSettings.agentCount", { count: settings.generationConcurrency.agent || 1 })}
                        detail={`${t("systemSettings.imageCount", { count: settings.generationDefaults.imageCount || 1 })} / ${settings.generationDefaults.videoSeconds === -1 ? t("systemSettings.videoSmartDuration") : t("systemSettings.videoSeconds", { count: settings.generationDefaults.videoSeconds || 5 })}`}
                        tone="blue"
                    />
                </div>

                <div className="grid gap-4 2xl:grid-cols-[248px_minmax(0,1fr)]">
                    <aside className="2xl:sticky 2xl:top-4 2xl:self-start">
                        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="px-2 pb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">{t("systemSettings.settingsOrder")}</div>
                            <nav className="grid grid-cols-2 gap-1.5 sm:gap-2 2xl:grid-cols-1" aria-label={t("systemSettings.groupsAria")}>
                                <SettingsAnchorItem href="#admin-settings-account" icon={<UserCog className="size-4" />} title={t("systemSettings.accountMail")} detail={t("systemSettings.accountMailDetail")} />
                                <SettingsAnchorItem href="#admin-settings-generation" icon={<SlidersHorizontal className="size-4" />} title={t("systemSettings.generationControl")} detail={t("systemSettings.generationDetail")} />
                            </nav>
                        </div>
                    </aside>

                    <div className="min-w-0 space-y-4">
                        <section id="admin-settings-account" className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.72fr)_minmax(0,1.28fr)]">
                                <div className="min-w-0 space-y-4">
                                    <SectionTitle icon={<UserCog className="size-4" />} title={t("systemSettings.accountPolicy")} />
                                    <div className="grid gap-3">
                                        <SettingToggle
                                            title={t("systemSettings.openRegistration")}
                                            description={t("systemSettings.openRegistrationDesc")}
                                            checked={settings.registrationEnabled}
                                            checkedChildren={t("systemSettings.open")}
                                            unCheckedChildren={t("systemSettings.close")}
                                            onChange={(registrationEnabled) => setSettings((current) => ({ ...current, registrationEnabled }))}
                                        />
                                        <SettingToggle
                                            title={t("systemSettings.emailRegistration")}
                                            description={t("systemSettings.emailRegistrationDesc")}
                                            checked={settings.emailRegistrationEnabled}
                                            checkedChildren={t("systemSettings.on")}
                                            unCheckedChildren={t("systemSettings.close")}
                                            onChange={(emailRegistrationEnabled) => setSettings((current) => ({ ...current, emailRegistrationEnabled }))}
                                        />
                                    </div>
                                </div>

                                <div className="min-w-0 border-t border-stone-200 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0 dark:border-stone-800">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <SectionTitle icon={<Mail className="size-4" />} title={t("systemSettings.mailService")} />
                                        <Button className="w-full sm:w-auto" loading={mailTestLoading} icon={<Send className="size-4" />} onClick={() => void testMailSettings()}>
                                            {t("systemSettings.testMail")}
                                        </Button>
                                    </div>
                                    <div className="mt-4 grid gap-3">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <LabeledControl label={t("systemSettings.mailProvider")}>
                                                <Input value={settings.mail.provider} placeholder={t("systemSettings.mailProviderPlaceholder")} onChange={(event) => updateMailSetting("provider", event.target.value)} />
                                            </LabeledControl>
                                            <LabeledControl label={t("systemSettings.smtpServer")}>
                                                <Input value={settings.mail.host} placeholder="smtp.qq.com" onChange={(event) => updateMailSetting("host", event.target.value)} />
                                            </LabeledControl>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                            <LabeledControl label={t("systemSettings.port")}>
                                                <InputNumber className="w-full" min={1} max={65535} precision={0} value={settings.mail.port} onChange={(value) => updateMailSetting("port", Number(value) || 465)} />
                                            </LabeledControl>
                                            <SettingInlineToggle
                                                title="SSL"
                                                checked={settings.mail.secure}
                                                checkedChildren={t("systemSettings.on")}
                                                unCheckedChildren={t("systemSettings.close")}
                                                onChange={(secure) => updateMailSetting("secure", secure)}
                                            />
                                        </div>
                                        <div className="grid gap-3 lg:grid-cols-2">
                                            <LabeledControl label={t("systemSettings.mailAccount")}>
                                                <Input value={settings.mail.username} placeholder="admin@example.com" onChange={(event) => updateMailSetting("username", event.target.value)} />
                                            </LabeledControl>
                                            <LabeledControl label={t("systemSettings.authCode")}>
                                                <Input.Password value={settings.mail.password} placeholder={t("systemSettings.authCodePlaceholder")} onChange={(event) => updateMailSetting("password", event.target.value)} />
                                            </LabeledControl>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <LabeledControl label={t("systemSettings.fromEmail")}>
                                                <Input value={settings.mail.fromEmail} placeholder={t("systemSettings.fromEmailPlaceholder")} onChange={(event) => updateMailSetting("fromEmail", event.target.value)} />
                                            </LabeledControl>
                                            <LabeledControl label={t("systemSettings.fromName")}>
                                                <Input value={settings.mail.fromName} placeholder="JoveCanvas" onChange={(event) => updateMailSetting("fromName", event.target.value)} />
                                            </LabeledControl>
                                        </div>
                                        <LabeledControl label={t("systemSettings.testTo")}>
                                            <Input value={mailTestTo} placeholder={t("systemSettings.testToPlaceholder")} onChange={(event) => setMailTestTo(event.target.value)} />
                                        </LabeledControl>
                                        <div className="rounded-lg border border-cyan-200/70 bg-cyan-50/80 px-3 py-2 text-xs leading-5 text-cyan-900 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-100">{t("systemSettings.mailHint")}</div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section id="admin-settings-generation" className="scroll-mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                            <GenerationConcurrencyPanel settings={settings} onChange={updateGenerationConcurrency} />
                            <GenerationDefaultsPanel settings={settings} onChange={updateGenerationDefaults} />
                        </section>
                    </div>
                </div>
            </div>
        </Panel>
    );
}
