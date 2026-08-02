"use client";

import type { ReactNode } from "react";
import { Button, Tag } from "antd";
import { Mail, Plus, RefreshCw, Send, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { SectionTitle } from "@/components/admin/admin-settings-controls";
import { SiteLogo } from "@/components/layout/site-logo";
import type { AuthSettings, SiteSocialKey } from "@/lib/auth/store";
import { imagePreviewUrl } from "@/lib/media-image-url";

// Static fallback metadata for callers that only need keys/icons; display copy should use useSiteSocialItems.
export const siteSocialItems: Array<{ key: SiteSocialKey; label: string; placeholder: string; icon: ReactNode }> = [
    { key: "email", label: "邮箱联系", placeholder: "mailto:admin@example.com", icon: <Mail className="size-4" /> },
    { key: "telegram", label: "Telegram", placeholder: "未配置", icon: <Send className="size-4" /> },
    { key: "x", label: "X", placeholder: "未配置", icon: <span className="text-xs font-bold">X</span> },
    { key: "instagram", label: "Instagram", placeholder: "未配置", icon: <span className="text-[11px] font-bold">IG</span> },
];

export function useSiteSocialItems(): Array<{ key: SiteSocialKey; label: string; placeholder: string; icon: ReactNode }> {
    const t = useTranslations("admin");
    return [
        { key: "email", label: t("siteSettings.socialEmail"), placeholder: "mailto:admin@example.com", icon: <Mail className="size-4" /> },
        { key: "telegram", label: "Telegram", placeholder: t("siteSettings.socialNotConfigured"), icon: <Send className="size-4" /> },
        { key: "x", label: "X", placeholder: t("siteSettings.socialNotConfigured"), icon: <span className="text-xs font-bold">X</span> },
        { key: "instagram", label: "Instagram", placeholder: t("siteSettings.socialNotConfigured"), icon: <span className="text-[11px] font-bold">IG</span> },
    ];
}

export function SiteLogoPreview({ logoUrl }: { logoUrl: string }) {
    return (
        <span className="grid size-12 place-items-center rounded-md bg-stone-100 p-1 text-stone-950 dark:bg-white/10 dark:text-white">
            <SiteLogo logoUrl={logoUrl || "/logo.svg"} className="size-10" />
        </span>
    );
}

export function SiteSettingStatus({ site }: { site: AuthSettings["site"] }) {
    const t = useTranslations("admin");
    const socialItems = useSiteSocialItems();
    const enabledSocialCount = socialItems.filter((item) => site.socials[item.key]?.enabled && site.socials[item.key]?.url.trim()).length;
    const enabledFriendLinkCount = (site.friendLinks || []).filter((link) => link.enabled && link.label.trim() && link.url.trim()).length;
    const validShowcaseCount = (site.homeShowcaseItems || []).filter((item) => item.title.trim() && item.prompt.trim()).length;
    const isCustom = site.homeShowcaseMode === "custom";
    const seoReady = Boolean((site.seoTitle || site.title).trim() && site.seoDescription.trim());

    return (
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm shadow-stone-200/40 dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/20">
            <SectionTitle icon={<RefreshCw className="size-4" />} title={t("siteSettings.syncStatus")} />
            <div className="mt-4 grid grid-cols-2 gap-2">
                <SiteStatusChip label={t("siteSettings.logo")} value={site.logoUrl.trim() ? t("siteSettings.configured") : t("siteSettings.defaultValue")} active={Boolean(site.logoUrl.trim())} />
                <SiteStatusChip label={t("siteSettings.browserIcon")} value={site.iconUrl.trim() ? t("siteSettings.configured") : t("siteSettings.defaultValue")} active={Boolean(site.iconUrl.trim())} />
                <SiteStatusChip label={t("siteSettings.seo")} value={seoReady ? t("siteSettings.seoComplete") : t("siteSettings.seoIncomplete")} active={seoReady} />
                <SiteStatusChip label={t("siteSettings.socialMedia")} value={t("siteSettings.countItems", { count: enabledSocialCount })} active={enabledSocialCount > 0} />
                <SiteStatusChip label={t("siteSettings.friendLinks")} value={t("siteSettings.countLinks", { count: enabledFriendLinkCount })} active={enabledFriendLinkCount > 0} />
            </div>
            <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/50">
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-stone-950 dark:text-stone-100">{t("siteSettings.homePrompts")}</span>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200 dark:bg-stone-950 dark:text-stone-200 dark:ring-stone-800">
                        {isCustom ? t("siteSettings.customCount", { count: validShowcaseCount }) : t("siteSettings.randomPromptLibrary")}
                    </span>
                </div>
                <div className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("siteSettings.syncHint")}</div>
            </div>
        </div>
    );
}

function SiteStatusChip({ label, value, active }: { label: string; value: string; active: boolean }) {
    return (
        <div className="min-w-0 rounded-lg border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="text-xs text-stone-500 dark:text-stone-400">{label}</div>
            <div className={`mt-1 truncate text-sm font-semibold ${active ? "text-stone-950 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"}`}>{value}</div>
        </div>
    );
}

export function SiteShowcasePreview({ site, onAdd }: { site: AuthSettings["site"]; onAdd: () => void }) {
    const t = useTranslations("admin");
    const items = site.homeShowcaseItems || [];
    const customItems = items.filter((item) => item.title.trim() && item.prompt.trim()).slice(0, 3);
    const isCustom = site.homeShowcaseMode === "custom";

    return (
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm shadow-stone-200/40 dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/20">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <SectionTitle icon={<Sparkles className="size-4" />} title={t("siteSettings.showcasePreview")} />
                    <div className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{isCustom ? t("siteSettings.customItemsCount", { count: items.length }) : t("siteSettings.randomShowcaseDesc")}</div>
                </div>
                <Tag className="m-0" color={isCustom ? "geekblue" : "green"}>
                    {isCustom ? t("siteSettings.customTag") : t("siteSettings.randomTag")}
                </Tag>
            </div>

            {isCustom ? (
                customItems.length ? (
                    <div className="mt-4 space-y-2">
                        {customItems.map((item) => (
                            <div key={item.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-lg border border-stone-200 bg-stone-50/70 p-2 dark:border-stone-800 dark:bg-stone-900/60">
                                {item.coverUrl ? (
                                    <img src={imagePreviewUrl(item.coverUrl, 256)} alt="" className="aspect-square rounded-md object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="aspect-square rounded-md bg-[linear-gradient(135deg,#f8fafc,#dff5ff_45%,#111827)] dark:bg-[linear-gradient(135deg,#0f172a,#164e63_45%,#020617)]" />
                                )}
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-stone-950 dark:text-stone-100">{item.title}</div>
                                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{item.prompt}</div>
                                </div>
                            </div>
                        ))}
                        {items.length > customItems.length ? <div className="text-center text-xs text-stone-500 dark:text-stone-400">{t("siteSettings.moreItemsOnHome", { count: items.length - customItems.length })}</div> : null}
                    </div>
                ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-stone-200 bg-stone-50/70 px-3 py-6 text-center dark:border-stone-800 dark:bg-stone-900/50">
                        <div className="text-sm font-medium text-stone-700 dark:text-stone-200">{t("siteSettings.noShowcaseContent")}</div>
                        <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t("siteSettings.noShowcaseHint")}</div>
                        <Button className="mt-3" size="small" icon={<Plus className="size-3.5" />} onClick={onAdd}>
                            {t("siteSettings.addShowcase")}
                        </Button>
                    </div>
                )
            ) : (
                <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
                                <div className="h-16 bg-[linear-gradient(145deg,#f8fafc,#e0f2fe_48%,#0f172a)] dark:bg-[linear-gradient(145deg,#0f172a,#164e63_48%,#020617)]" />
                                <div className="space-y-1 p-2">
                                    <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-700" />
                                    <div className="h-1.5 w-2/3 rounded-full bg-stone-100 dark:bg-stone-800" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/50">
                        <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("siteSettings.randomFromLibrary")}</div>
                        <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("siteSettings.randomFromLibraryHint")}</div>
                    </div>
                </div>
            )}

            <div className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("siteSettings.showcaseLazyHint")}</div>
        </div>
    );
}
