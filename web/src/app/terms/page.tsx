import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, CheckCircle2, CloudCog, DatabaseBackup, Scale } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("public.terms");
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
        alternates: { canonical: "/terms" },
    };
}

export default async function TermsPage() {
    const t = await getTranslations("public.terms");
    const terms = [
        { title: t("section1Title"), body: t("section1Body"), icon: <Scale className="size-5" /> },
        { title: t("section2Title"), body: t("section2Body"), icon: <CloudCog className="size-5" /> },
        { title: t("section3Title"), body: t("section3Body"), icon: <CheckCircle2 className="size-5" /> },
        { title: t("section4Title"), body: t("section4Body"), icon: <DatabaseBackup className="size-5" /> },
    ];

    return (
        <main className="app-scroll-page bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_58%,#eef2f7_100%)] text-stone-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_34%),linear-gradient(180deg,#0a0a0a_0%,#101010_58%,#171717_100%)] dark:text-stone-200">
            <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-8 sm:py-10">
                <Link
                    href="/"
                    className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-sm font-medium text-stone-700 shadow-sm shadow-stone-200/50 backdrop-blur transition hover:border-cyan-300 hover:text-cyan-700 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:shadow-black/30 dark:hover:border-cyan-500/50 dark:hover:text-cyan-200"
                >
                    <ArrowLeft className="size-4" />
                    {t("backHome")}
                </Link>

                <section className="mt-8 overflow-hidden rounded-lg border border-stone-200 bg-white/88 shadow-xl shadow-stone-200/60 backdrop-blur dark:border-white/10 dark:bg-stone-950/78 dark:shadow-black/30">
                    <div className="border-b border-stone-200 bg-stone-950 px-6 py-8 text-white sm:px-8 dark:border-white/10 dark:bg-white/[0.06]">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-cyan-100">
                            <Scale className="size-3.5" />
                            VOZEB PRO Legal
                        </div>
                        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">{t("title")}</h1>
                        <p className="mt-4 max-w-2xl text-base leading-8 text-stone-200 dark:text-stone-300">{t("subtitle")}</p>
                    </div>

                    <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
                        {terms.map((item) => (
                            <article key={item.title} className="rounded-lg border border-stone-200 bg-stone-50/80 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                                <div className="flex items-center gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/70 dark:bg-cyan-950/45 dark:text-cyan-200 dark:ring-cyan-800/60">{item.icon}</span>
                                    <h2 className="text-base font-semibold text-stone-950 dark:text-white">{item.title}</h2>
                                </div>
                                <p className="mt-4 text-sm leading-7 text-stone-600 dark:text-stone-400">{item.body}</p>
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
