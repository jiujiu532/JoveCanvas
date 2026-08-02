"use client";

import { Input, Select } from "antd";
import { Activity, ArrowRight, BookOpenCheck, Check, CircleAlert, Coins, DatabaseBackup, ExternalLink, Megaphone, PlugZap, Search, Settings2, ShieldCheck, ShoppingBag, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useMemo, useState } from "react";

import type { AdminSectionKey } from "@/components/admin/admin-sections";
import { cn } from "@/lib/utils";

import {
    ADMIN_HELP_ARTICLE_IDS,
    buildAdminHelpArticles,
    findAdminHelpArticle,
    searchAdminHelpArticles,
    type AdminHelpArticle,
    type AdminHelpArticleId,
    type AdminHelpLink,
    type AdminHelpTranslate,
} from "./admin-help-content";
import { buildAdminHelpGuidance, type AdminHelpTroubleshooting } from "./admin-help-guidance";

const articleIcons: Record<AdminHelpArticleId, LucideIcon> = {
    "getting-started": Sparkles,
    operations: Activity,
    commerce: ShoppingBag,
    finance: Coins,
    models: PlugZap,
    system: Settings2,
    storage: DatabaseBackup,
    content: Megaphone,
    maintenance: ShieldCheck,
};

const articleIconClasses: Record<AdminHelpArticleId, string> = {
    "getting-started": "bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300",
    operations: "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",
    commerce: "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
    finance: "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
    models: "bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
    system: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    storage: "bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300",
    content: "bg-orange-50 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300",
    maintenance: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
};

export function AdminHelpSection({ onOpenSection }: { onOpenSection: (section: AdminSectionKey) => void }) {
    const t = useTranslations("admin.help");
    const translate = t as unknown as AdminHelpTranslate;

    const articles = useMemo(() => buildAdminHelpArticles(translate), [translate]);
    const guidance = useMemo(() => buildAdminHelpGuidance(translate), [translate]);

    const [activeId, setActiveId] = useState<AdminHelpArticleId>(ADMIN_HELP_ARTICLE_IDS[0]);
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const results = useMemo(() => searchAdminHelpArticles(deferredQuery, articles, guidance), [deferredQuery, articles, guidance]);
    const activeArticle = findAdminHelpArticle(articles, activeId) || articles[0];
    const activeGuidance = guidance[activeArticle.id];

    const selectArticle = (id: AdminHelpArticleId) => {
        setActiveId(id);
        window.requestAnimationFrame(() => document.getElementById("admin-help-article")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };

    return (
        <div className="min-w-0">
            <header className="grid gap-4 border-b border-zinc-200 pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-end dark:border-zinc-800">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <BookOpenCheck className="size-4" /> {t("eyebrow")}
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-zinc-950 sm:text-2xl dark:text-zinc-100">{t("title")}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
                </div>
                <Input allowClear size="large" prefix={<Search className="size-4 text-zinc-400" />} placeholder={t("searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t("searchAria")} />
            </header>

            {query.trim() ? (
                <section className="border-b border-zinc-200 py-4 dark:border-zinc-800" aria-label={t("searchResultsAria")}>
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{t("searchResultsTitle")}</h3>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("resultCount", { count: results.length })}</span>
                    </div>
                    {results.length ? (
                        <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {results.map((article) => {
                                const Icon = articleIcons[article.id];
                                const active = activeId === article.id;
                                return (
                                    <button
                                        key={article.id}
                                        type="button"
                                        className={cn(
                                            "flex min-w-0 items-start gap-3 rounded-lg border px-3 py-3 text-left transition",
                                            active
                                                ? "border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100"
                                                : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900",
                                        )}
                                        onClick={() => selectArticle(article.id)}
                                    >
                                        <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-cyan-700 dark:text-cyan-300" : "text-zinc-500 dark:text-zinc-400")} />
                                        <span className="min-w-0">
                                            <span className={cn("block text-sm font-medium", active ? "text-cyan-950 dark:text-cyan-100" : "text-zinc-900 dark:text-zinc-100")}>{article.title}</span>
                                            <span className={cn("mt-1 line-clamp-2 block text-xs leading-5", active ? "text-cyan-700 dark:text-cyan-300" : "text-zinc-500 dark:text-zinc-400")}>{article.summary}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">{t("emptySearch")}</div>
                    )}
                </section>
            ) : null}

            <div className="grid min-w-0 gap-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
                <aside className="hidden lg:block">
                    <nav className="sticky top-20 space-y-1" aria-label={t("catalogAria")}>
                        {articles.map((article) => {
                            const Icon = articleIcons[article.id];
                            const active = article.id === activeId;
                            return (
                                <button
                                    key={article.id}
                                    type="button"
                                    className={cn(
                                        "flex w-full min-w-0 items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                                        active
                                            ? "border-cyan-200 bg-cyan-50 font-medium text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100"
                                            : "border-transparent text-zinc-500 hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                                    )}
                                    onClick={() => selectArticle(article.id)}
                                    aria-current={active ? "page" : undefined}
                                >
                                    <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-cyan-700 dark:text-cyan-300" : "text-zinc-500 dark:text-zinc-400")} />
                                    <span className="min-w-0 flex-1">
                                        <span className={cn("block text-[11px]", active ? "text-cyan-700 dark:text-cyan-300" : "text-zinc-500 dark:text-zinc-400")}>{article.category}</span>
                                        <span className={cn("mt-0.5 block break-words leading-5", active ? "text-cyan-950 dark:text-cyan-100" : "text-zinc-900 dark:text-zinc-100")}>{article.title}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                <main className="min-w-0">
                    <div className="mb-5 lg:hidden">
                        <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400" htmlFor="admin-help-mobile-section">
                            {t("selectArticle")}
                        </label>
                        <Select
                            id="admin-help-mobile-section"
                            className="w-full"
                            size="large"
                            value={activeId}
                            options={articles.map((article) => ({ label: `${article.category} · ${article.title}`, value: article.id }))}
                            onChange={(value) => selectArticle(value)}
                        />
                    </div>

                    <article id="admin-help-article" className="min-w-0 scroll-mt-20">
                        <ArticleHeader article={activeArticle} purposeLabel={t("purposeLabel")} />

                        <section className="mt-7 sm:mt-8">
                            <SectionHeading title={t("recommendedOrderTitle")} description={t("recommendedOrderDescription")} />
                            <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                                {activeArticle.steps.map((step, index) => (
                                    <div key={`${activeArticle.id}-step-${index}`} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[36px_minmax(0,1fr)] sm:py-5">
                                        <span className="grid size-8 place-items-center rounded-full border border-zinc-300 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">{String(index + 1).padStart(2, "0")}</span>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-semibold text-zinc-950 sm:text-base dark:text-zinc-100">{step.title}</h4>
                                            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{step.description}</p>
                                            <StepGuidance
                                                actions={activeGuidance.stepActions[index]}
                                                checks={step.checks}
                                                actionsLabel={t("stepActionsLabel")}
                                                criteriaLabel={t("completionCriteriaLabel")}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="mt-8 grid min-w-0 gap-6 xl:grid-cols-2">
                            <div className="min-w-0">
                                <SectionHeading title={t("checksTitle")} description={t("checksDescription")} />
                                <ul className="space-y-2.5 border-l-2 border-emerald-500/60 pl-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                                    {activeArticle.checks.map((check, index) => (
                                        <li key={`${activeArticle.id}-check-${index}`} className="flex min-w-0 items-start gap-2.5">
                                            <Check className="mt-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                            <span>{check}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {activeArticle.warnings?.length ? (
                                <div className="min-w-0">
                                    <SectionHeading title={t("warningsTitle")} description={t("warningsDescription")} />
                                    <ul className="space-y-2.5 border-l-2 border-amber-500/70 pl-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                                        {activeArticle.warnings.map((warning, index) => (
                                            <li key={`${activeArticle.id}-warning-${index}`} className="flex min-w-0 items-start gap-2.5">
                                                <CircleAlert className="mt-1 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                                <span>{warning}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </section>

                        <TroubleshootingSection
                            items={activeGuidance.troubleshooting}
                            title={t("troubleshootingTitle")}
                            description={t("troubleshootingDescription")}
                            symptomLabel={t("symptomLabel")}
                            causeLabel={t("causeLabel")}
                            remedyLabel={t("remedyLabel")}
                        />

                        <section className="mt-8 pb-3 sm:mt-10 sm:pb-6">
                            <SectionHeading title={t("linksTitle")} description={t("linksDescription")} />
                            <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {activeArticle.links.map((link, index) => (
                                    <AdminHelpTarget key={`${activeArticle.id}-link-${index}`} link={link} onOpenSection={onOpenSection} />
                                ))}
                            </div>
                        </section>
                    </article>
                </main>
            </div>
        </div>
    );
}

function StepGuidance({
    actions,
    checks,
    actionsLabel,
    criteriaLabel,
}: {
    actions: string[];
    checks?: string[];
    actionsLabel: string;
    criteriaLabel: string;
}) {
    return (
        <div className="mt-3 space-y-3">
            <div className="border-l-2 border-cyan-500/50 pl-3">
                <p className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">{actionsLabel}</p>
                <ol className="mt-2 space-y-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                    {actions.map((action, index) => (
                        <li key={`action-${index}`} className="flex min-w-0 items-start gap-2">
                            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-cyan-50 text-[9px] font-semibold text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">{index + 1}</span>
                            <span>{action}</span>
                        </li>
                    ))}
                </ol>
            </div>
            {checks?.length ? (
                <div>
                    <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{criteriaLabel}</p>
                    <ul className="mt-2 grid min-w-0 gap-2 text-xs leading-5 text-zinc-600 sm:grid-cols-2 dark:text-zinc-300">
                        {checks.map((check, index) => (
                            <li key={`check-${index}`} className="flex min-w-0 items-start gap-2">
                                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>{check}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

function TroubleshootingSection({
    items,
    title,
    description,
    symptomLabel,
    causeLabel,
    remedyLabel,
}: {
    items: AdminHelpTroubleshooting[];
    title: string;
    description: string;
    symptomLabel: string;
    causeLabel: string;
    remedyLabel: string;
}) {
    return (
        <section className="mt-8 sm:mt-10">
            <SectionHeading title={title} description={description} />
            <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {items.map((item, index) => (
                    <article key={`ts-${index}`} className="grid min-w-0 gap-3 py-5 xl:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)] xl:gap-8">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                                <Wrench className="size-3.5" /> {symptomLabel}
                            </div>
                            <h4 className="mt-1.5 text-sm font-semibold leading-6 text-zinc-950 dark:text-zinc-100">{item.symptom}</h4>
                        </div>
                        <div className="min-w-0 space-y-3 text-sm leading-6">
                            <p className="text-zinc-600 dark:text-zinc-300">
                                <span className="font-semibold text-zinc-950 dark:text-zinc-100">{causeLabel}</span>
                                {item.cause}
                            </p>
                            <div>
                                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{remedyLabel}</p>
                                <ul className="mt-1.5 space-y-1.5 text-zinc-600 dark:text-zinc-300">
                                    {item.actions.map((action, actionIndex) => (
                                        <li key={`ts-action-${index}-${actionIndex}`} className="flex min-w-0 items-start gap-2">
                                            <ArrowRight className="mt-1.5 size-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                                            <span>{action}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {item.caution ? (
                                <p className="flex min-w-0 items-start gap-2 border-l-2 border-amber-500/70 pl-3 text-xs text-amber-800 dark:text-amber-200">
                                    <CircleAlert className="mt-1 size-3.5 shrink-0" />
                                    <span>{item.caution}</span>
                                </p>
                            ) : null}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

function ArticleHeader({ article, purposeLabel }: { article: AdminHelpArticle; purposeLabel: string }) {
    const Icon = articleIcons[article.id];
    return (
        <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
            <div className="flex min-w-0 items-start gap-3">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", articleIconClasses[article.id])}>
                    <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{article.category}</p>
                    <h3 className="mt-1 text-xl font-semibold text-zinc-950 sm:text-2xl dark:text-zinc-100">{article.title}</h3>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">{article.summary}</p>
                </div>
            </div>
            <div className="mt-5 border-l-2 border-cyan-500/70 pl-4">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-cyan-700 dark:text-cyan-300">{purposeLabel}</p>
                <p className="mt-1.5 max-w-5xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">{article.purpose}</p>
            </div>
        </header>
    );
}

function AdminHelpTarget({ link, onOpenSection }: { link: AdminHelpLink; onOpenSection: (section: AdminSectionKey) => void }) {
    const className =
        "group flex min-w-0 items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900";
    const content = (
        <>
            <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{link.label}</span>
                <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{link.description}</span>
            </span>
            <ExternalLink className="size-3.5 shrink-0 text-zinc-400 transition group-hover:text-zinc-700 dark:group-hover:text-zinc-200" />
        </>
    );

    if (link.section) {
        return (
            <button type="button" className={className} onClick={() => onOpenSection(link.section)}>
                {content}
            </button>
        );
    }

    return (
        <Link href={link.href} className={className}>
            {content}
        </Link>
    );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
    return (
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-base font-semibold text-zinc-950 sm:text-lg dark:text-zinc-100">{title}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
    );
}
