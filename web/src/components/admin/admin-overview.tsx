"use client";

import { Button, Tag } from "antd";
import { CircleDollarSign, Database, PlugZap, RefreshCw, UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { generationKindLabel, generationSourceLabel } from "@/components/admin/admin-generation-log";
import { Metric, Panel, PanelHeader } from "@/components/admin/admin-panel";
import { formatAdminMoney } from "@/components/admin/admin-values";
import type { AdminBillingSummary } from "@/lib/admin-billing-types";
import type { AdminGenerationOverviewSummary } from "@/lib/admin-generation-overview";
import type { SystemModelChannel } from "@/lib/auth/store";
import type { GenerationAssetStats, StoredGenerationLog } from "@/lib/server/generation-log-store";

type OverviewStats = { total: number; active: number; admins: number };
type SettingsSummary = { totalChannels: number; enabledChannels: number };
type WalletSummary = { enabledPlans: number; usersWithPlan: number };
type DistributionItem = { label: string; value: number; percent: number };
type OperationsSummary = AdminGenerationOverviewSummary;
type AdminOverviewProps = {
    stats: OverviewStats;
    settingsSummary: SettingsSummary;
    walletSummary: WalletSummary;
    billingSummary: AdminBillingSummary | null;
    operationsSummary: OperationsSummary;
    promptCount: number;
    assetStats: GenerationAssetStats | null;
    enabledProducts: number;
    loading: boolean;
    onRefresh: () => void;
};

export function AdminOverview({ stats, settingsSummary, walletSummary, billingSummary, operationsSummary, promptCount, assetStats, enabledProducts, loading, onRefresh }: AdminOverviewProps) {
    const t = useTranslations("admin");
    return (
        <div className="space-y-3 sm:space-y-5">
            <section className="admin-metric-grid grid grid-cols-2 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 xl:grid-cols-4">
                <Metric label={t("overview.metrics.totalUsers")} value={stats.total} detail={t("overview.metrics.totalUsersDetail", { count: stats.active })} icon={<UsersRound className="size-5" />} tone="slate" />
                <Metric
                    label={t("overview.metrics.channelConfig")}
                    value={settingsSummary.enabledChannels}
                    detail={t("overview.metrics.channelConfigDetail", { count: settingsSummary.totalChannels })}
                    icon={<PlugZap className="size-5" />}
                    tone="emerald"
                />
                <Metric
                    label={t("overview.metrics.paidAmount")}
                    value={formatAdminMoney(billingSummary?.orders.paidAmountCents || 0)}
                    detail={t("overview.metrics.paidAmountDetail", { count: billingSummary?.orders.paid || 0 })}
                    icon={<CircleDollarSign className="size-5" />}
                    tone="slate"
                />
                <Metric
                    label={t("overview.metrics.dailyCalls")}
                    value={operationsSummary.dailyCalls.at(-1)?.value || 0}
                    detail={t("overview.metrics.dailyCallsDetail", { days: operationsSummary.windowDays, count: operationsSummary.totalCalls })}
                    icon={<Database className="size-5" />}
                    tone="slate"
                />
            </section>
            <Panel>
                <PanelHeader
                    title={t("overview.breakdown.title")}
                    description={t("overview.breakdown.description")}
                    actions={
                        <div className="flex flex-wrap justify-end gap-2">
                            <Tag className="m-0">{t("overview.breakdown.admins", { count: stats.admins })}</Tag>
                            <Tag className="m-0">{t("overview.breakdown.prompts", { count: promptCount })}</Tag>
                            <Tag className="m-0">{t("overview.breakdown.assets", { count: assetStats ? assetStats.totalFiles : "-" })}</Tag>
                        </div>
                    }
                />
                <div className="admin-resource-grid grid grid-cols-2 lg:grid-cols-4">
                    <ResourceStat
                        label={t("overview.resource.successCalls")}
                        value={t("overview.resource.timesValue", { count: operationsSummary.successCalls })}
                        detail={t("overview.resource.successRateDetail", { rate: operationsSummary.successRate })}
                    />
                    <ResourceStat label={t("overview.resource.activeUsers")} value={t("overview.resource.peopleValue", { count: operationsSummary.activeUsers })} detail={t("overview.resource.activeUsersDetail", { days: operationsSummary.windowDays })} />
                    <ResourceStat label={t("overview.resource.enabledProducts")} value={t("overview.resource.countValue", { count: enabledProducts })} detail={t("overview.resource.enabledProductsDetail", { count: walletSummary.enabledPlans })} />
                    <ResourceStat
                        label={t("overview.resource.localAssets")}
                        value={assetStats ? t("overview.resource.countValue", { count: assetStats.totalFiles }) : "-"}
                        detail={assetStats ? formatBytes(assetStats.totalBytes) : t("overview.resource.awaitingStats")}
                    />
                </div>
            </Panel>
            <div className="grid gap-3 sm:gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <ModelDistributionPanel items={operationsSummary.modelDistribution} emptyText={t("overview.modelDistribution.empty")} />
                <UsageLinePanel items={operationsSummary.dailyCalls} loading={loading} onRefresh={onRefresh} />
            </div>
            <div className="grid gap-3 sm:gap-5 lg:grid-cols-2">
                <CompactDonutPanel
                    title={t("overview.entrySource.title")}
                    description={t("overview.entrySource.description")}
                    items={operationsSummary.sourceDistribution}
                    emptyText={t("overview.entrySource.empty")}
                    totalLabel={t("overview.entrySource.totalLabel")}
                />
                <CompactDonutPanel
                    title={t("overview.contentType.title")}
                    description={t("overview.contentType.description")}
                    items={operationsSummary.kindDistribution}
                    emptyText={t("overview.contentType.empty")}
                    totalLabel={t("overview.contentType.totalLabel")}
                />
            </div>
            <Panel>
                <PanelHeader title={t("overview.businessHealth.title")} description={t("overview.businessHealth.description")} />
                <div className="admin-resource-grid grid grid-cols-2 lg:grid-cols-4">
                    <ResourceStat
                        label={t("overview.businessHealth.plansOnSale")}
                        value={t("overview.resource.countValue", { count: walletSummary.enabledPlans })}
                        detail={t("overview.businessHealth.plansOnSaleDetail", { count: walletSummary.usersWithPlan })}
                    />
                    <ResourceStat
                        label={t("overview.businessHealth.enabledChannels")}
                        value={t("overview.resource.countValue", { count: settingsSummary.enabledChannels })}
                        detail={t("overview.metrics.channelConfigDetail", { count: settingsSummary.totalChannels })}
                    />
                    <ResourceStat label={t("overview.businessHealth.failedCalls")} value={t("overview.resource.timesValue", { count: operationsSummary.failedCalls })} detail={t("overview.businessHealth.failedCallsDetail")} />
                    <ResourceStat label={t("overview.businessHealth.assetIssues")} value={assetStats ? t("overview.resource.countValue", { count: assetStats.missingReferences }) : "-"} detail={t("overview.businessHealth.assetIssuesDetail")} />
                </div>
            </Panel>
        </div>
    );
}
function ModelDistributionPanel({ items, emptyText }: { items: DistributionItem[]; emptyText: string }) {
    const t = useTranslations("admin");
    const locale = useLocale();
    const displayItems = items.length ? items : [{ label: emptyText, value: 0, percent: 100 }];
    return (
        <Panel>
            <PanelHeader title={t("overview.modelDistribution.title")} description={t("overview.modelDistribution.description")} />
            <div className="grid gap-3 p-3 sm:gap-6 sm:p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="flex items-center justify-center">
                    <DonutChart items={items} emptyText={emptyText} totalLabel={t("overview.modelDistribution.totalLabel")} variant="large" />
                </div>
                <div className="min-w-0 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
                    <div className="grid grid-cols-[minmax(0,1.2fr)_58px_58px] border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[10px] font-semibold text-zinc-500 sm:grid-cols-[minmax(0,1.2fr)_72px_72px] sm:px-4 sm:py-2.5 sm:text-[11px] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                        <span>{t("overview.modelDistribution.model")}</span>
                        <span className="text-right">{t("overview.modelDistribution.requests")}</span>
                        <span className="text-right">{t("overview.modelDistribution.percent")}</span>
                    </div>
                    {displayItems.map((item, index) => (
                        <div
                            key={item.label}
                            className="grid grid-cols-[minmax(0,1.2fr)_58px_58px] items-center border-b border-zinc-100 px-3 py-2.5 text-xs last:border-b-0 sm:grid-cols-[minmax(0,1.2fr)_72px_72px] sm:px-4 sm:py-3 sm:text-sm dark:border-zinc-800/70"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <span className={`size-2.5 shrink-0 rounded-full ${items.length ? "" : "bg-stone-300 dark:bg-stone-700"}`} style={items.length ? { background: chartColor(index) } : undefined} />
                                <span className={`min-w-0 truncate font-medium ${items.length ? "text-stone-900 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"}`}>{item.label}</span>
                            </div>
                            <span className="text-right tabular-nums text-stone-500 dark:text-stone-400">{formatCompactNumber(item.value, locale)}</span>
                            <span className="text-right tabular-nums font-semibold text-stone-950 dark:text-stone-100">{items.length ? `${item.percent}%` : "-"}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Panel>
    );
}

function CompactDonutPanel({ title, description, items, emptyText, totalLabel }: { title: string; description: string; items: DistributionItem[]; emptyText: string; totalLabel: string }) {
    const t = useTranslations("admin");
    const locale = useLocale();
    const displayItems = items.length ? items : [{ label: emptyText, value: 0, percent: 100 }];
    return (
        <Panel>
            <PanelHeader title={title} description={description} />
            <div className="grid gap-3 p-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5 sm:p-5">
                <div className="flex items-center justify-center">
                    <DonutChart items={items} emptyText={emptyText} totalLabel={totalLabel} variant="compact" />
                </div>
                <div className="min-w-0 self-center">
                    {displayItems.map((item, index) => (
                        <div key={item.label} className="min-w-0 border-b border-zinc-100 px-1 py-3 last:border-b-0 dark:border-zinc-800">
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span className={`size-2.5 shrink-0 rounded-full ${items.length ? "" : "bg-stone-300 dark:bg-stone-700"}`} style={items.length ? { background: chartColor(index) } : undefined} />
                                    <span className={`min-w-0 truncate font-medium ${items.length ? "text-stone-900 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"}`}>{item.label}</span>
                                </span>
                                <span className="shrink-0 tabular-nums font-semibold text-stone-950 dark:text-stone-100">{items.length ? `${item.percent}%` : "-"}</span>
                            </div>
                            <div className="mt-2 text-xs tabular-nums text-stone-500 dark:text-stone-400">{t("overview.resource.timesValue", { count: formatCompactNumber(item.value, locale) })}</div>
                        </div>
                    ))}
                </div>
            </div>
        </Panel>
    );
}

const donutChartVariants = {
    large: { sizeClass: "size-40 sm:size-56", viewBoxSize: 160, radius: 58, strokeWidth: 22, totalClassName: "text-xl sm:text-3xl", labelClassName: "text-[10px] sm:text-xs" },
    compact: { sizeClass: "size-32 sm:size-44", viewBoxSize: 150, radius: 54, strokeWidth: 20, totalClassName: "text-lg sm:text-2xl", labelClassName: "text-[10px] sm:text-[11px]" },
} as const;

function DonutChart({ items, emptyText, totalLabel, variant }: { items: DistributionItem[]; emptyText: string; totalLabel: string; variant: keyof typeof donutChartVariants }) {
    const locale = useLocale();
    const { sizeClass, viewBoxSize, radius, strokeWidth, totalClassName, labelClassName } = donutChartVariants[variant];
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const displayItems = items.length ? items : [{ label: emptyText, value: 0, percent: 100 }];
    const center = viewBoxSize / 2;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return (
        <div className={`relative ${sizeClass}`}>
            <svg className="size-full -rotate-90" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} aria-hidden="true">
                <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" className="text-stone-100 dark:text-stone-800" style={{ color: "var(--admin-chart-track)" }} strokeWidth={strokeWidth} />
                {displayItems.map((item, index) => {
                    const dash = items.length ? (item.value / Math.max(1, total)) * circumference : circumference;
                    const segment = (
                        <circle
                            key={item.label}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            className={items.length ? "" : "text-stone-200 dark:text-stone-800"}
                            style={items.length ? { color: chartColor(index) } : undefined}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${dash} ${Math.max(0, circumference - dash)}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="round"
                        />
                    );
                    offset += dash;
                    return segment;
                })}
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                    <div className={`${totalClassName} font-semibold tracking-normal text-stone-950 dark:text-stone-100`}>{formatCompactNumber(total, locale)}</div>
                    <div className={`mt-1 ${labelClassName} text-stone-500 dark:text-stone-400`}>{totalLabel}</div>
                </div>
            </div>
        </div>
    );
}

function UsageLinePanel({ items, loading, onRefresh }: { items: Array<{ label: string; value: number }>; loading: boolean; onRefresh: () => void }) {
    const t = useTranslations("admin");
    const locale = useLocale();
    const max = Math.max(1, ...items.map((item) => item.value));
    const width = 640;
    const height = 240;
    const paddingX = 32;
    const paddingY = 26;
    const plotWidth = width - paddingX * 2;
    const plotHeight = height - paddingY * 2;
    const points = items.map((item, index) => {
        const x = paddingX + (items.length <= 1 ? plotWidth : (index / (items.length - 1)) * plotWidth);
        const y = paddingY + plotHeight - (item.value / max) * plotHeight;
        return { ...item, x, y };
    });
    const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
    const area = points.length ? `${paddingX},${paddingY + plotHeight} ${polyline} ${paddingX + plotWidth},${paddingY + plotHeight}` : "";
    return (
        <Panel>
            <PanelHeader
                title={t("overview.usageTrend.title")}
                description={t("overview.usageTrend.description")}
                actions={
                    <Button loading={loading} icon={<RefreshCw className="size-4" />} onClick={onRefresh}>
                        {t("overview.usageTrend.refresh")}
                    </Button>
                }
            />
            <div className="p-3 sm:p-5">
                <div>
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-stone-500 sm:mb-4 dark:text-stone-400">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full" style={{ background: "var(--admin-chart-1)" }} />
                            {t("overview.usageTrend.requestVolume")}
                        </span>
                        <span>{t("overview.usageTrend.peak", { count: formatCompactNumber(max, locale) })}</span>
                        {loading ? <Tag className="m-0">{t("overview.usageTrend.loading")}</Tag> : null}
                    </div>
                    <svg className="h-44 w-full overflow-visible sm:h-72" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const y = paddingY + ratio * plotHeight;
                            return <line key={ratio} x1={paddingX} x2={paddingX + plotWidth} y1={y} y2={y} className="stroke-stone-200 dark:stroke-stone-800" strokeWidth="1" />;
                        })}
                        {area ? <polygon points={area} style={{ fill: "var(--admin-chart-area)" }} /> : null}
                        {polyline ? <polyline points={polyline} fill="none" style={{ stroke: "var(--admin-chart-1)" }} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" /> : null}
                        {points.map((point) => (
                            <circle key={point.label} cx={point.x} cy={point.y} r="5" className="fill-white dark:fill-stone-950" style={{ stroke: "var(--admin-chart-1)" }} strokeWidth="3" />
                        ))}
                    </svg>
                    <div className="mt-3 grid grid-cols-7 gap-2 text-center text-[11px] text-stone-400">
                        {items.map((item) => (
                            <div key={item.label} className="min-w-0">
                                <div className="truncate">{item.label}</div>
                                <div className="mt-1 font-semibold tabular-nums text-stone-700 dark:text-stone-300">{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Panel>
    );
}

function ResourceStat({ label, value, detail }: { label: string; value: string; detail: string }) {
    return (
        <div className="admin-resource-stat min-w-0 p-2.5 sm:p-5">
            <div className="text-[10px] font-medium text-zinc-500 sm:text-[11px] dark:text-zinc-400">{label}</div>
            <div className="mt-1 truncate text-base font-semibold tabular-nums text-zinc-950 sm:mt-2 sm:text-lg dark:text-zinc-100">{value}</div>
            <div className="mt-0.5 truncate text-[10px] text-zinc-400 sm:mt-1 sm:text-[11px] dark:text-zinc-500">{detail}</div>
        </div>
    );
}

export function buildOperationsSummary(logs: StoredGenerationLog[], channels: SystemModelChannel[], labels: { unknownModel: string; unknown: string }, t: ReturnType<typeof useTranslations<"admin">>) {
    const totalCalls = logs.length;
    const successCalls = logs.filter((log) => log.status === "success").length;
    const failedCalls = logs.filter((log) => log.status === "failed").length;
    const activeUsers = new Set(logs.map((log) => log.userId).filter(Boolean)).size;
    const today = new Date();
    const dayItems = Array.from({ length: 7 }).map((_, offset) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - offset));
        const key = date.toISOString().slice(0, 10);
        const label = date.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" });
        return { key, label, value: 0 };
    });
    const dayMap = new Map(dayItems.map((item) => [item.key, item]));
    for (const log of logs) {
        const key = new Date(log.createdAt).toISOString().slice(0, 10);
        const item = dayMap.get(key);
        if (item) item.value += 1;
    }
    const knownModels = new Set(channels.flatMap((channel) => channel.models));
    const modelDistribution = distributionFromValues(
        logs.map((log) => log.model || labels.unknownModel),
        (value) => (knownModels.has(value) ? value : value || labels.unknownModel),
        labels.unknown,
    );
    const sourceDistribution = distributionFromValues(
        logs.map((log) => generationSourceLabel(log.source, t)),
        (value) => value,
        labels.unknown,
    );
    const kindDistribution = distributionFromValues(
        logs.map((log) => generationKindLabel(log.kind, t)),
        (value) => value,
        labels.unknown,
    );
    return {
        totalCalls,
        successCalls,
        failedCalls,
        activeUsers,
        successRate: totalCalls ? Math.round((successCalls / totalCalls) * 100) : 0,
        dailyCalls: dayItems.map(({ label, value }) => ({ label, value })),
        modelDistribution,
        sourceDistribution,
        kindDistribution,
    };
}

function distributionFromValues(values: string[], normalize: (value: string) => string = (value) => value, unknownLabel = "-") {
    const counts = new Map<string, number>();
    for (const value of values) {
        const label = normalize(value).trim() || unknownLabel;
        counts.set(label, (counts.get(label) || 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
    return Array.from(counts.entries())
        .map(([label, value]) => ({ label, value, percent: total ? Math.round((value / total) * 100) : 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
}

function formatCompactNumber(value: number, locale: string) {
    const numberValue = Number(value || 0);
    return new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN", { notation: "compact", maximumFractionDigits: numberValue >= 100000000 ? 2 : 1 }).format(numberValue);
}

function chartColor(index: number) {
    return `var(--admin-chart-${(index % 6) + 1})`;
}

function formatBytes(value: number) {
    if (!value) return "0 B";
    const units = ["B", "KB", "MB", "GB"] as const;
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}
