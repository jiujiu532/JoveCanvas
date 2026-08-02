import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";

import { GalleryThemeToggle } from "@/app/gallery/gallery-theme-toggle";
import { SiteLogo } from "@/components/layout/site-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { absoluteSiteUrl, getPublicSiteSettings, siteMetadataBase } from "@/lib/server/site-metadata";
import { getPublicCreatorPage, getPublicCreatorProfile, WorkCommunityServiceError } from "@/lib/server/work-community-service";
import type { PublicCreatorPage } from "@/services/api/work-community";
import { PublicCreatorView } from "./public-creator-view";

type CreatorPageProps = { params: Promise<{ username: string }> };

const loadCreatorProfile = cache(async (username: string) => {
    try {
        return await getPublicCreatorProfile(username);
    } catch (error) {
        if (error instanceof WorkCommunityServiceError && error.status === 404) return null;
        throw error;
    }
});

const loadCreatorPage = cache(async (username: string, viewerUserId: string) => {
    try {
        return (await getPublicCreatorPage(username, viewerUserId || undefined, { limit: 18 })) as PublicCreatorPage;
    } catch (error) {
        if (error instanceof WorkCommunityServiceError && error.status === 404) return null;
        throw error;
    }
});

export async function generateMetadata({ params }: CreatorPageProps): Promise<Metadata> {
    const { username } = await params;
    const [profile, site, t, locale] = await Promise.all([loadCreatorProfile(username), getPublicSiteSettings(), getTranslations("public.works.creator"), getLocale()]);
    if (!profile) return { title: `${t("notFoundTitle")} | ${site.title}`, robots: { index: false, follow: false } };
    const canonical = `/u/${encodeURIComponent(profile.username)}`;
    const displayName = profile.displayName || profile.username;
    const title = `${displayName} (@${profile.username}) | ${site.title}`;
    const description = profile.bio || t("defaultDescription", { name: displayName });
    const image = absoluteSiteUrl(profile.avatarUrl || site.logoUrl || "/logo.svg", siteMetadataBase());
    return {
        metadataBase: siteMetadataBase(),
        title,
        description,
        alternates: { canonical },
        robots: { index: true, follow: true },
        openGraph: {
            type: "profile",
            title,
            description,
            siteName: site.title,
            url: canonical,
            images: [{ url: image, alt: displayName }],
            locale: locale === "en" ? "en_US" : "zh_CN",
        },
        twitter: { card: "summary", title, description, images: [image] },
    };
}

export default async function CreatorPage({ params }: CreatorPageProps) {
    const { username } = await params;
    const sitePromise = getPublicSiteSettings();
    const tPromise = getTranslations("public.works.creator");
    const viewer = await getCurrentUser();
    const [site, data, t] = await Promise.all([sitePromise, loadCreatorPage(username, viewer?.id || ""), tPromise]);
    if (!data) notFound();

    return (
        <main className="app-scroll-page bg-background text-foreground">
            <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xl">
                <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-3 sm:h-16 sm:px-6">
                    <Link href="/" className="flex min-w-0 items-center gap-2.5 text-foreground" aria-label={site.title}>
                        <SiteLogo logoUrl={site.logoUrl || "/logo.svg"} className="size-7 sm:size-8" />
                        <span className="truncate text-sm font-semibold sm:text-base">{site.title}</span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                        <Link href="/gallery" className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted">
                            {t("gallery")}
                        </Link>
                        <GalleryThemeToggle />
                    </div>
                </div>
            </header>
            <PublicCreatorView initialData={data} />
        </main>
    );
}
