"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
    Activity,
    BadgePercent,
    BookOpen,
    CircleDollarSign,
    Cloud,
    ChevronDown,
    CreditCard,
    Database,
    DatabaseBackup,
    ExternalLink,
    Film,
    Gift,
    GalleryVerticalEnd,
    Globe2,
    HardDrive,
    KeyRound,
    Megaphone,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    PlugZap,
    ReceiptText,
    SlidersHorizontal,
    Sparkles,
    TicketPercent,
    UserPlus,
    UsersRound,
    UserRoundX,
    WalletCards,
    X,
} from "lucide-react";
import type { AdminSectionKey } from "@/components/admin/admin-sections";
import { SiteLogo } from "@/components/layout/site-logo";
import { usePublicSessionStore } from "@/stores/use-public-session-store";

type AdminTranslator = ReturnType<typeof useTranslations<"admin">>;
type AdminSection = { key: AdminSectionKey; label: string; description: string; shortDescription: string; icon: ReactNode };
type AdminSectionGroup = { title: string; items: AdminSection[] };

export function AdminSectionNav({
    activeKey,
    onChange,
    mobileOpen,
    desktopCollapsed,
    onDesktopToggle,
    onMobileToggle,
    onMobileClose,
}: {
    activeKey: AdminSectionKey;
    onChange: (key: AdminSectionKey) => void;
    mobileOpen: boolean;
    desktopCollapsed: boolean;
    onDesktopToggle: () => void;
    onMobileToggle: () => void;
    onMobileClose: () => void;
}) {
    const t = useTranslations("admin");
    const adminSectionGroups = useMemo(() => buildAdminSectionGroups(t), [t]);
    const activeGroup = adminSectionGroups.find((group) => group.items.some((section) => section.key === activeKey));
    const activeGroupTitle = activeGroup?.title;
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { title: "JoveCanvas", logoUrl: "/logo.svg" };
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!activeGroupTitle) return;
        setCollapsedGroups((current) => {
            const next = { ...current };
            if (next[activeGroupTitle]) next[activeGroupTitle] = false;
            return next;
        });
    }, [activeGroupTitle]);

    const renderSectionItems = (items: AdminSection[]) =>
        items.map((section) => {
            const active = section.key === activeKey;
            return (
                <button
                    key={section.key}
                    type="button"
                    title={desktopCollapsed ? section.label : undefined}
                    aria-label={section.label}
                    className={`admin-section-nav-item relative flex h-9 w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition ${active ? "is-active bg-zinc-100 font-medium text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"}`}
                    onClick={() => {
                        onChange(section.key);
                        onMobileClose();
                    }}
                >
                    <span className="admin-section-nav-icon flex size-4 shrink-0 items-center justify-center">{section.icon}</span>
                    <span className="admin-section-nav-copy min-w-0 truncate">{section.label}</span>
                </button>
            );
        });

    return (
        <aside className={`admin-section-nav h-dvh min-w-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-0 lg:z-40 ${mobileOpen ? "is-open" : ""} ${desktopCollapsed ? "is-collapsed" : ""}`}>
            <div className="admin-section-nav-shell flex h-full max-w-full flex-col overflow-hidden">
                <div className="admin-section-mobile-head flex h-[58px] shrink-0 items-center justify-between border-b border-zinc-200 px-3 dark:border-zinc-800 lg:hidden">
                    <button
                        type="button"
                        className="admin-section-nav-toggle flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        aria-label={mobileOpen ? t("nav.collapseSidebar") : t("nav.expandSidebar")}
                        aria-expanded={mobileOpen}
                        onClick={onMobileToggle}
                    >
                        {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
                    </button>
                    <Link href="/" className="admin-section-mobile-brand flex min-w-0 flex-1 items-center gap-2.5 px-1 text-zinc-950 dark:text-zinc-100" onClick={onMobileClose}>
                        <SiteLogo logoUrl={site.logoUrl} className="size-7" />
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{site.title}</span>
                            <span className="block truncate text-[10px] text-zinc-400 dark:text-zinc-500">{t("nav.consoleLabel")}</span>
                        </span>
                    </Link>
                </div>
                <div className="admin-section-desktop-head hidden h-[58px] shrink-0 min-w-0 items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800 lg:flex">
                    <Link href="/" className="admin-section-brand flex min-w-0 flex-1 items-center gap-2.5 text-zinc-950 dark:text-zinc-100">
                        <SiteLogo logoUrl={site.logoUrl} className="size-7" />
                        <span className="admin-section-brand-copy min-w-0">
                            <span className="block truncate text-sm font-semibold">{site.title}</span>
                            <span className="block truncate text-[10px] text-zinc-400 dark:text-zinc-500">{t("nav.consoleLabel")}</span>
                        </span>
                    </Link>
                    <button
                        type="button"
                        className="admin-section-desktop-toggle flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                        aria-label={desktopCollapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
                        aria-expanded={!desktopCollapsed}
                        title={desktopCollapsed ? t("nav.expandSidebarShort") : t("nav.collapseSidebarShort")}
                        onClick={onDesktopToggle}
                    >
                        {desktopCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                    </button>
                </div>
                <div className="admin-section-nav-list flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-3 py-4">
                    {adminSectionGroups.map((group) => {
                        const collapsed = Boolean(collapsedGroups[group.title]) && !desktopCollapsed;
                        return (
                            <div key={group.title} className="admin-section-nav-group block min-w-0">
                                <button
                                    type="button"
                                    className="admin-section-nav-group-title relative flex w-full items-center rounded-md px-2 pb-1.5 pr-7 text-left text-[10px] font-semibold text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-300"
                                    aria-expanded={!collapsed}
                                    aria-controls={`admin-section-group-${group.title}`}
                                    onClick={() => setCollapsedGroups((current) => ({ ...current, [group.title]: !current[group.title] }))}
                                >
                                    <span>{group.title}</span>
                                    <ChevronDown className={`admin-section-nav-group-chevron absolute right-2 top-1/2 size-3 shrink-0 -translate-y-1/2 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                                </button>
                                {!collapsed ? (
                                    <div id={`admin-section-group-${group.title}`} className="admin-section-nav-group-items flex flex-col gap-1">
                                        {renderSectionItems(group.items)}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}

export function adminSections(t: AdminTranslator): AdminSection[] {
    return [
        { key: "overview", label: t("nav.sections.overview.label"), description: t("nav.sections.overview.description"), shortDescription: t("nav.sections.overview.shortDescription"), icon: <Database className="size-4" /> },
        { key: "users", label: t("nav.sections.users.label"), description: t("nav.sections.users.description"), shortDescription: t("nav.sections.users.shortDescription"), icon: <UsersRound className="size-4" /> },
        { key: "logs", label: t("nav.sections.logs.label"), description: t("nav.sections.logs.description"), shortDescription: t("nav.sections.logs.shortDescription"), icon: <Film className="size-4" /> },
        {
            key: "generationOperations",
            label: t("nav.sections.generationOperations.label"),
            description: t("nav.sections.generationOperations.description"),
            shortDescription: t("nav.sections.generationOperations.shortDescription"),
            icon: <Activity className="size-4" />,
        },
        { key: "products", label: t("nav.sections.products.label"), description: t("nav.sections.products.description"), shortDescription: t("nav.sections.products.shortDescription"), icon: <CreditCard className="size-4" /> },
        { key: "promotions", label: t("nav.sections.promotions.label"), description: t("nav.sections.promotions.description"), shortDescription: t("nav.sections.promotions.shortDescription"), icon: <BadgePercent className="size-4" /> },
        { key: "coupons", label: t("nav.sections.coupons.label"), description: t("nav.sections.coupons.description"), shortDescription: t("nav.sections.coupons.shortDescription"), icon: <TicketPercent className="size-4" /> },
        { key: "referrals", label: t("nav.sections.referrals.label"), description: t("nav.sections.referrals.description"), shortDescription: t("nav.sections.referrals.shortDescription"), icon: <UserPlus className="size-4" /> },
        { key: "orders", label: t("nav.sections.orders.label"), description: t("nav.sections.orders.description"), shortDescription: t("nav.sections.orders.shortDescription"), icon: <ReceiptText className="size-4" /> },
        { key: "points", label: t("nav.sections.points.label"), description: t("nav.sections.points.description"), shortDescription: t("nav.sections.points.shortDescription"), icon: <CircleDollarSign className="size-4" /> },
        { key: "payments", label: t("nav.sections.payments.label"), description: t("nav.sections.payments.description"), shortDescription: t("nav.sections.payments.shortDescription"), icon: <PlugZap className="size-4" /> },
        { key: "cdk", label: t("nav.sections.cdk.label"), description: t("nav.sections.cdk.description"), shortDescription: t("nav.sections.cdk.shortDescription"), icon: <Gift className="size-4" /> },
        { key: "wallet", label: t("nav.sections.wallet.label"), description: t("nav.sections.wallet.description"), shortDescription: t("nav.sections.wallet.shortDescription"), icon: <WalletCards className="size-4" /> },
        { key: "site", label: t("nav.sections.site.label"), description: t("nav.sections.site.description"), shortDescription: t("nav.sections.site.shortDescription"), icon: <Globe2 className="size-4" /> },
        { key: "channels", label: t("nav.sections.channels.label"), description: t("nav.sections.channels.description"), shortDescription: t("nav.sections.channels.shortDescription"), icon: <PlugZap className="size-4" /> },
        { key: "skills", label: t("nav.sections.skills.label"), description: t("nav.sections.skills.description"), shortDescription: t("nav.sections.skills.shortDescription"), icon: <Sparkles className="size-4" /> },
        { key: "settings", label: t("nav.sections.settings.label"), description: t("nav.sections.settings.description"), shortDescription: t("nav.sections.settings.shortDescription"), icon: <SlidersHorizontal className="size-4" /> },
        {
            key: "accountDeletion",
            label: t("nav.sections.accountDeletion.label"),
            description: t("nav.sections.accountDeletion.description"),
            shortDescription: t("nav.sections.accountDeletion.shortDescription"),
            icon: <UserRoundX className="size-4" />,
        },
        { key: "mediaStorage", label: t("nav.sections.mediaStorage.label"), description: t("nav.sections.mediaStorage.description"), shortDescription: t("nav.sections.mediaStorage.shortDescription"), icon: <HardDrive className="size-4" /> },
        {
            key: "externalStorage",
            label: t("nav.sections.externalStorage.label"),
            description: t("nav.sections.externalStorage.description"),
            shortDescription: t("nav.sections.externalStorage.shortDescription"),
            icon: <Cloud className="size-4" />,
        },
        { key: "backup", label: t("nav.sections.backup.label"), description: t("nav.sections.backup.description"), shortDescription: t("nav.sections.backup.shortDescription"), icon: <DatabaseBackup className="size-4" /> },
        { key: "updates", label: t("nav.sections.updates.label"), description: t("nav.sections.updates.description"), shortDescription: t("nav.sections.updates.shortDescription"), icon: <ExternalLink className="size-4" /> },
        {
            key: "announcements",
            label: t("nav.sections.announcements.label"),
            description: t("nav.sections.announcements.description"),
            shortDescription: t("nav.sections.announcements.shortDescription"),
            icon: <Megaphone className="size-4" />,
        },
        { key: "works", label: t("nav.sections.works.label"), description: t("nav.sections.works.description"), shortDescription: t("nav.sections.works.shortDescription"), icon: <GalleryVerticalEnd className="size-4" /> },
        { key: "prompts", label: t("nav.sections.prompts.label"), description: t("nav.sections.prompts.description"), shortDescription: t("nav.sections.prompts.shortDescription"), icon: <KeyRound className="size-4" /> },
        { key: "adminHelp", label: t("nav.sections.adminHelp.label"), description: t("nav.sections.adminHelp.description"), shortDescription: t("nav.sections.adminHelp.shortDescription"), icon: <BookOpen className="size-4" /> },
    ];
}

export function buildAdminSectionGroups(t: AdminTranslator): AdminSectionGroup[] {
    const sections = adminSections(t);
    return [
        { title: t("nav.groups.businessAnalytics"), items: sectionsFor(sections, ["overview", "users", "logs", "generationOperations"]) },
        { title: t("nav.groups.productOperations"), items: sectionsFor(sections, ["products", "orders"]) },
        { title: t("nav.groups.marketing"), items: sectionsFor(sections, ["promotions", "coupons", "referrals"]) },
        { title: t("nav.groups.finance"), items: sectionsFor(sections, ["points", "payments", "cdk", "wallet"]) },
        { title: t("nav.groups.upstreamConfig"), items: sectionsFor(sections, ["channels", "skills"]) },
        { title: t("nav.groups.system"), items: sectionsFor(sections, ["site", "settings", "accountDeletion"]) },
        { title: t("nav.groups.storageBackup"), items: sectionsFor(sections, ["mediaStorage", "externalStorage", "backup"]) },
        { title: t("nav.groups.contentOperations"), items: sectionsFor(sections, ["works", "announcements", "prompts"]) },
        { title: t("nav.groups.helpSupport"), items: sectionsFor(sections, ["updates", "adminHelp"]) },
    ];
}

function sectionsFor(sections: AdminSection[], keys: AdminSectionKey[]) {
    const map = new Map(sections.map((section) => [section.key, section]));
    return keys.map((key) => map.get(key)).filter((section): section is AdminSection => Boolean(section));
}
