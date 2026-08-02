import type { Metadata } from "next";
import { ArrowUpRight, CalendarDays, Eye } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";

import { SiteLogo } from "@/components/layout/site-logo";
import { PublicWorkCommunityActions } from "@/components/works/public-work-community-actions";
import { PublicWorkMediaBrowser } from "@/components/works/public-work-media-browser";
import { createAgentPromptHref } from "@/lib/create-agent-prompt";
import { GalleryThemeToggle } from "@/app/gallery/gallery-theme-toggle";
import { WorkPublicationServiceError, getPublicWorkPublication } from "@/lib/server/work-publication-service";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { absoluteSiteUrl, getPublicSiteSettings, siteMetadataBase } from "@/lib/server/site-metadata";
import { buildCreativeWorkStructuredData, serializeStructuredData } from "@/lib/structured-data";
import { userAvatarFallback } from "@/lib/user-avatar";
import { WorkViewTracker } from "./work-view-tracker";
import { WorkGovernanceActions } from "./work-governance-actions";
import { WorkPromptActions } from "./work-prompt-actions";

type SharePageProps = { params: Promise<{ slug: string }> };

const getSharedWork = cache(async (slug: string) => {
    try {
        return await getPublicWorkPublication(slug);
    } catch (error) {
        if (error instanceof WorkPublicationServiceError && error.status === 404) return null;
        throw error;
    }
});

function workFallbackDescription(work: { authorName?: string | null; category: string }, t: Awaited<ReturnType<typeof getTranslations>>) {
    return work.authorName ? t("defaultDescriptionWithAuthor", { author: work.authorName, category: work.category }) : t("defaultDescription", { category: work.category });
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
    const { slug } = await params;
    const [work, site, t, locale] = await Promise.all([getSharedWork(slug), getPublicSiteSettings(), getTranslations("public.works.share"), getLocale()]);
    if (!work) return { title: `${t("notFoundTitle")} | ${site.title}`, robots: { index: false, follow: false } };

    const base = siteMetadataBase();
    const canonical = `/share/${encodeURIComponent(work.slug)}`;
    const cover = work.assets.find((asset) => asset.role === "cover" && asset.mediaType === "image") || work.assets.find((asset) => asset.mediaType === "image");
    const imageUrl = absoluteSiteUrl(cover ? imagePreviewUrl(cover.url, 1920) : site.logoUrl || "/logo.svg", base);
    const description = work.description || workFallbackDescription(work, t);
    const title = `${work.title} | ${site.title}`;
    return {
        metadataBase: base,
        title,
        description,
        keywords: work.tags,
        alternates: { canonical },
        robots: work.visibility === "public" ? { index: true, follow: true } : { index: false, follow: true, noarchive: true },
        openGraph: {
            type: "article",
            title,
            description,
            siteName: site.title,
            url: canonical,
            images: [{ url: imageUrl, alt: work.title }],
            publishedTime: work.publishedAt,
            locale: locale === "en" ? "en_US" : "zh_CN",
        },
        twitter: {
            card: cover ? "summary_large_image" : "summary",
            title,
            description,
            images: [imageUrl],
        },
    };
}

export default async function SharePage({ params }: SharePageProps) {
    const { slug } = await params;
    const [work, site, t, locale] = await Promise.all([getSharedWork(slug), getPublicSiteSettings(), getTranslations("public.works.share"), getLocale()]);
    if (!work) notFound();
    const contentAssets = work.assets.filter((asset) => asset.role === "content").sort((left, right) => left.sortOrder - right.sortOrder);
    const createHref = createAgentPromptHref(work.publicPrompt);
    const base = siteMetadataBase();
    const canonicalUrl = absoluteSiteUrl(`/share/${encodeURIComponent(work.slug)}`, base);
    const cover = work.assets.find((asset) => asset.role === "cover" && asset.mediaType === "image") || work.assets.find((asset) => asset.mediaType === "image");
    const structuredData = buildCreativeWorkStructuredData({
        visibility: work.visibility,
        url: canonicalUrl,
        websiteId: `${absoluteSiteUrl("/", base)}#website`,
        title: work.title,
        description: work.description || workFallbackDescription(work, t),
        publishedAt: work.publishedAt,
        category: work.category,
        tags: work.tags,
        authorName: work.authorName,
        imageUrl: cover ? absoluteSiteUrl(imagePreviewUrl(cover.url, 1920), base) : undefined,
    });
    const anonymous = t("anonymousAuthor");
    const authorIdentity = (
        <>
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-[10px] font-semibold text-background">
                {work.authorAvatarUrl ? <img src={work.authorAvatarUrl} alt="" className="size-full object-cover" /> : userAvatarFallback(work.authorName || anonymous)}
            </span>
            <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{t("authorLabel")}</div>
                <div className="mt-0.5 truncate text-sm font-semibold">{work.authorName || anonymous}</div>
            </div>
        </>
    );

    return (
        <main className="app-scroll-page bg-[#f7f8fa] text-[#20242a] dark:bg-[#0f1114] dark:text-[#f3f5f7]">
            {structuredData ? <script id="creative-work-json-ld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} /> : null}
            <WorkViewTracker slug={work.slug} />
            <header className="sticky top-0 z-20 border-b border-[#e3e6ea] bg-white/95 backdrop-blur-xl dark:border-[#292d33] dark:bg-[#0f1114]/95">
                <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-3 sm:h-16 sm:px-6">
                    <Link href="/" className="flex min-w-0 items-center gap-2.5 text-[#20242a] dark:text-[#f3f5f7]" aria-label={site.title}>
                        <SiteLogo logoUrl={site.logoUrl || "/logo.svg"} className="size-7 sm:size-8" />
                        <span className="truncate text-sm font-semibold sm:text-base">{site.title}</span>
                    </Link>
                    <GalleryThemeToggle />
                </div>
            </header>

            <div className="mx-auto w-full max-w-[1600px] px-3 pb-10 pt-3 sm:px-6 sm:pb-16 sm:pt-4">
                <section className="flex min-w-0 flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-4">
                    <div className="min-w-0">
                        <h1 className="break-words text-xl font-semibold leading-tight sm:text-2xl">{work.title}</h1>
                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{sourceTypeLabel(work.sourceType, t)}</span>
                            <span aria-hidden="true">/</span>
                            <span>{work.category}</span>
                            <span aria-hidden="true">/</span>
                            <span>{work.visibility === "public" ? t("visibilityPublic") : t("visibilityLink")}</span>
                        </div>
                    </div>
                    <div className="shrink-0">
                        <WorkGovernanceActions slug={work.slug} createHref={work.publicPrompt ? createHref : undefined} />
                    </div>
                </section>

                <div className="grid min-w-0 gap-4 pt-3 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
                    <PublicWorkMediaBrowser assets={contentAssets} title={work.title} />

                    <aside className="min-w-0 border-t border-border pt-4 lg:rounded-lg lg:border lg:bg-card lg:p-4 lg:pt-4" aria-label={t("detailsAria")}>
                        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
                            <div className="flex min-w-0 items-center justify-between gap-3">
                                {work.authorUsername ? (
                                    <Link href={`/u/${encodeURIComponent(work.authorUsername)}`} className="flex min-w-0 items-center gap-2.5 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        {authorIdentity}
                                    </Link>
                                ) : (
                                    <div className="flex min-w-0 items-center gap-2.5">{authorIdentity}</div>
                                )}
                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <CalendarDays className="size-3.5" />
                                    {formatPublishedDate(work.publishedAt, locale)}
                                </span>
                            </div>

                            <div className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 border-y border-border py-3">
                                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground" title={t("viewsTitle")}>
                                    <Eye className="size-4" />
                                    <span className="tabular-nums text-foreground">{t("viewCount", { count: work.viewCount })}</span>
                                </span>
                                <PublicWorkCommunityActions slug={work.slug} />
                            </div>

                            {work.description ? (
                                <section className="mt-5">
                                    <h2 className="text-sm font-semibold">{t("description")}</h2>
                                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{work.description}</p>
                                </section>
                            ) : null}

                            <section className="mt-5">
                                <h2 className="text-sm font-semibold">{t("publicPrompt")}</h2>
                                {work.publicPrompt ? (
                                    <>
                                        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-sm leading-6 text-foreground">{work.publicPrompt}</pre>
                                        <WorkPromptActions prompt={work.publicPrompt} createHref={createHref} />
                                    </>
                                ) : (
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("noPrompt")}</p>
                                )}
                            </section>

                            {work.tags.length ? (
                                <div className="mt-5 flex min-w-0 flex-wrap gap-1.5">
                                    {work.tags.map((tag) => (
                                        <span key={tag} className="max-w-40 truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </aside>
                </div>

                <footer className="mt-8 flex flex-col gap-4 border-t border-[#dfe3e8] pt-6 dark:border-[#2c3036] sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:pt-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <SiteLogo logoUrl={site.logoUrl || "/logo.svg"} className="size-9" />
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{site.title}</div>
                            <div className="mt-0.5 text-xs text-[#747d89] dark:text-[#939ca8]">{t("footerTagline")}</div>
                        </div>
                    </div>
                    <Link
                        href="/create"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#20242a] px-4 text-sm font-medium text-[#20242a] transition hover:bg-[#20242a] hover:text-white dark:border-[#f3f5f7] dark:text-[#f3f5f7] dark:hover:bg-[#f3f5f7] dark:hover:text-[#17191d]"
                    >
                        {t("createMine")}
                        <ArrowUpRight className="size-4" />
                    </Link>
                </footer>
            </div>
        </main>
    );
}

function sourceTypeLabel(sourceType: "media" | "canvas" | "drama", t: Awaited<ReturnType<typeof getTranslations>>) {
    return sourceType === "media" ? t("sourceMedia") : sourceType === "canvas" ? t("sourceCanvas") : t("sourceDrama");
}

function formatPublishedDate(value: string, locale: string) {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}
