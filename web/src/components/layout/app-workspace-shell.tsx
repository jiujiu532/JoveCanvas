"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { SiteLogo } from "@/components/layout/site-logo";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { navigationToolForPathname } from "@/constant/navigation-tools";
import { usePublicSessionStore } from "@/stores/use-public-session-store";

export function AppWorkspaceShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const t = useTranslations("layout");
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { title: "JoveCanvas", logoUrl: "/logo.svg" };
    const tool = navigationToolForPathname(pathname);
    const fullscreen = /^\/canvas\/[^/]+/.test(pathname);
    const rootSlug = pathname.split("/").filter(Boolean)[0] || "";
    const pageTitles: Record<string, string> = {
        billing: t("workspaceShell.pageTitleBilling"),
        help: t("helpCenter"),
        profile: t("workspaceShell.pageTitleProfile"),
    };
    const pageTitle = (tool ? t(`nav.${tool.slug}.label`) : undefined) || pageTitles[rootSlug] || t("workspaceShell.pageTitleDefault");

    if (fullscreen) return <div className="h-dvh min-h-0 overflow-hidden">{children}</div>;

    return (
        <div className="workspace-shell flex h-dvh min-h-0 overflow-hidden bg-[#fafbfc] text-foreground dark:bg-[#111316]">
            <AppSidebar activeToolSlug={tool?.slug} expanded={sidebarExpanded} />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-[#e8ebef] bg-white/95 px-3 backdrop-blur-xl sm:px-4 lg:px-5 dark:border-[#292d33] dark:bg-[#111316]/95">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <button
                            type="button"
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 lg:hidden dark:text-stone-300 dark:hover:bg-stone-900 dark:hover:text-white"
                            onClick={() => setMobileNavOpen(true)}
                            aria-label={t("openNavMenu")}
                            title={t("navMenu")}
                        >
                            <Menu className="size-5" />
                        </button>
                        <Link href="/create" className="inline-flex shrink-0 items-center lg:hidden" aria-label={site.title || "JoveCanvas"}>
                            <SiteLogo logoUrl={site.logoUrl} className="size-6" />
                        </Link>
                        <button
                            type="button"
                            className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-[#68717c] transition hover:bg-[#f1f3f5] hover:text-[#20242a] lg:inline-flex dark:text-[#a5adb8] dark:hover:bg-[#22262c] dark:hover:text-white"
                            onClick={() => setSidebarExpanded((value) => !value)}
                            aria-label={sidebarExpanded ? t("workspaceShell.collapseSidebar") : t("workspaceShell.expandSidebar")}
                            title={sidebarExpanded ? t("workspaceShell.collapseSidebar") : t("workspaceShell.expandSidebar")}
                            aria-pressed={sidebarExpanded}
                        >
                            {sidebarExpanded ? <PanelLeftClose className="size-[17px]" /> : <PanelLeftOpen className="size-[17px]" />}
                        </button>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[#20242a] dark:text-[#f3f5f7]">{pageTitle}</div>
                        </div>
                    </div>
                    <div className="min-w-0 max-w-[calc(100vw-6.5rem)] shrink-0 overflow-visible sm:max-w-[calc(100vw-8rem)] lg:max-w-none">
                        <UserStatusActions />
                    </div>
                </header>
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[#fafbfc] dark:bg-[#111316]">{children}</div>
            </div>
            <MobileNavDrawer open={mobileNavOpen} activeToolSlug={tool?.slug} onClose={() => setMobileNavOpen(false)} />
        </div>
    );
}
