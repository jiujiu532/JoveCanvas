import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ChevronLeft, ChevronRight, Megaphone } from "lucide-react";

import { listAnnouncementsPage } from "@/lib/auth/store";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("public.announcements");
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
        alternates: { canonical: "/announcements" },
        robots: { index: true, follow: true },
    };
}

export default async function AnnouncementsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = searchParams ? await searchParams : {};
    const page = positiveInteger(first(params.page), 1);
    const [announcementPage, t, locale] = await Promise.all([listAnnouncementsPage(false, { page, pageSize: PAGE_SIZE }), getTranslations("public.announcements"), getLocale()]);
    const totalPages = Math.max(1, Math.ceil(announcementPage.total / announcementPage.pageSize));
    const dateLocale = locale === "zh" ? "zh-CN" : "en-US";

    return (
        <main className="app-scroll-page bg-background px-4 py-8 text-stone-950 dark:text-stone-100 sm:px-6">
            <div className="mx-auto max-w-4xl">
                <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/50 dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/20">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/80 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900/70">
                                <Megaphone className="size-5" />
                            </span>
                            <div className="min-w-0">
                                <h1 className="text-2xl font-semibold">{t("title")}</h1>
                                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t("subtitle")}</p>
                            </div>
                        </div>
                        <Link
                            href="/"
                            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 dark:border-stone-800 dark:text-stone-300 dark:hover:border-stone-700 dark:hover:bg-stone-900 dark:hover:text-white"
                        >
                            <ArrowLeft className="size-4" />
                            {t("backHome")}
                        </Link>
                    </div>
                </div>
                <div className="mt-5 space-y-4">
                    {announcementPage.items.map((announcement) => (
                        <article id={announcement.id} key={announcement.id} className="scroll-mt-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/40 dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/20">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-lg font-semibold text-stone-950 dark:text-stone-100">{announcement.title}</h2>
                                <time className="text-xs text-stone-500 dark:text-stone-400">{new Date(announcement.createdAt).toLocaleString(dateLocale)}</time>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-600 dark:text-stone-300">{announcement.content}</p>
                        </article>
                    ))}
                    {!announcementPage.items.length ? <div className="rounded-xl border border-dashed border-stone-300 py-16 text-center text-sm text-stone-500 dark:border-stone-700">{t("empty")}</div> : null}
                </div>
                {announcementPage.total > announcementPage.pageSize ? (
                    <nav className="mt-5 flex items-center justify-center gap-3 text-sm" aria-label={t("paginationAria")}>
                        {page > 1 ? (
                            <Link
                                href={announcementPageHref(page - 1)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-stone-200 px-3 text-stone-700 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-200 dark:hover:bg-stone-900"
                            >
                                <ChevronLeft className="size-4" />
                                {t("prevPage")}
                            </Link>
                        ) : null}
                        <span className="text-xs text-stone-500 dark:text-stone-400">{t("pageStatus", { page, totalPages })}</span>
                        {page < totalPages ? (
                            <Link
                                href={announcementPageHref(page + 1)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-stone-200 px-3 text-stone-700 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-200 dark:hover:bg-stone-900"
                            >
                                {t("nextPage")}
                                <ChevronRight className="size-4" />
                            </Link>
                        ) : null}
                    </nav>
                ) : null}
            </div>
        </main>
    );
}

function first(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: string | undefined, fallback: number) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function announcementPageHref(page: number) {
    return page <= 1 ? "/announcements" : `/announcements?page=${page}`;
}
