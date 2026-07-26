"use client";

import { Button, Checkbox, Popconfirm, Tag } from "antd";
import { Eye, Film, Image as ImageIcon, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { browserReadableMediaUrl } from "@/lib/browser-media-url";
import { imagePreviewUrl } from "@/lib/media-image-url";
import type { StoredGenerationLog } from "@/lib/server/generation-log-store";

type AdminTranslator = ReturnType<typeof useTranslations<"admin">>;

export function GenerationLogAssetPreview({ log }: { log: StoredGenerationLog }) {
    const asset = log.assets[0];
    const assetUrl = asset ? generationLogAssetAccessUrl(asset) : "";
    if (!assetUrl) {
        return (
            <div className="flex size-12 items-center justify-center rounded-lg border border-stone-200 bg-stone-100 text-stone-400 dark:border-stone-800 dark:bg-stone-900">
                {log.kind === "video" ? <Film className="size-4" /> : <ImageIcon className="size-4" />}
            </div>
        );
    }
    if (asset.type === "video") {
        return <video className="size-12 rounded-lg border border-stone-200 bg-stone-100 object-cover dark:border-stone-800 dark:bg-stone-900" src={assetUrl} muted playsInline preload="metadata" />;
    }
    return <img className="size-12 rounded-lg border border-stone-200 bg-stone-100 object-cover dark:border-stone-800 dark:bg-stone-900" src={imagePreviewUrl(assetUrl, 256)} alt="" loading="lazy" referrerPolicy="no-referrer" />;
}

export function GenerationLogMobileCard({ log, selected, onSelectedChange, onView, onDelete }: { log: StoredGenerationLog; selected: boolean; onSelectedChange: (checked: boolean) => void; onView: () => void; onDelete: () => void }) {
    const t = useTranslations("admin");
    return (
        <div className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
                <Checkbox checked={selected} onChange={(event) => onSelectedChange(event.target.checked)} />
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Tag className="m-0" color={log.kind === "video" ? "purple" : "blue"}>
                            {generationKindLabel(log.kind, t)}
                        </Tag>
                        <span className={generationStatusClass(log.status)}>{generationStatusLabel(log.status, t)}</span>
                        <span className="text-xs text-stone-500">{generationSourceLabel(log.source, t)}</span>
                    </div>
                    <div className="mt-2 truncate text-sm font-semibold text-stone-950 dark:text-stone-100">{log.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{log.prompt || log.summary}</div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                        <span>{formatAdminLogTime(log.createdAt)}</span>
                        <span>{log.displayName || log.username}</span>
                        <span>{formatAdminLogDuration(log.durationMs)}</span>
                    </div>
                </div>
                <GenerationLogAssetPreview log={log} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
                <Button size="small" icon={<Eye className="size-3.5" />} onClick={onView}>
                    {t("logs.table.detail")}
                </Button>
                <Popconfirm title={t("logs.table.deleteConfirmTitle")} okText={t("logs.table.deleteOk")} cancelText={t("logs.table.deleteCancel")} onConfirm={onDelete}>
                    <Button size="small" danger icon={<Trash2 className="size-3.5" />}>
                        {t("logs.table.deleteOk")}
                    </Button>
                </Popconfirm>
            </div>
        </div>
    );
}

export function GenerationLogDetail({ log }: { log: StoredGenerationLog }) {
    const t = useTranslations("admin");
    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <InfoBox label={t("logs.table.user")} value={`${log.displayName || log.username} / ${log.username || "-"}`} />
                <InfoBox label={t("logs.table.source")} value={generationSourceLabel(log.source, t)} />
                <InfoBox label={t("logs.table.kind")} value={generationKindLabel(log.kind, t)} />
                <InfoBox label={t("logs.table.status")} value={generationStatusLabel(log.status, t)} />
                <InfoBox label={t("logs.table.time")} value={formatAdminLogTime(log.createdAt)} />
                <InfoBox label={t("logs.table.duration")} value={formatAdminLogDuration(log.durationMs)} />
                <InfoBox label={t("logs.table.model")} value={formatGenerationLogModel(log.model)} />
                <InfoBox label={t("logs.detail.count")} value={t("logs.detail.countValue", { success: log.successCount, fail: log.failCount, total: log.count })} />
            </div>
            <GenerationLogResultSection log={log} />
            <div>
                <div className="mb-1 text-sm font-semibold text-stone-950 dark:text-stone-100">{t("logs.table.prompt")}</div>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200">{log.prompt || "-"}</div>
            </div>
            {log.error ? (
                <div>
                    <div className="mb-1 text-sm font-semibold text-red-600 dark:text-red-300">{t("logs.detail.errorInfo")}</div>
                    <div className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{log.error}</div>
                </div>
            ) : null}
        </div>
    );
}

function GenerationLogResultSection({ log }: { log: StoredGenerationLog }) {
    const t = useTranslations("admin");
    const assets = (log.assets || []).filter((asset) => Boolean(generationLogAssetAccessUrl(asset)));
    if (!assets.length) {
        return (
            <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900/70">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-950 dark:text-stone-100">
                    {log.kind === "video" ? <Film className="size-4" /> : <ImageIcon className="size-4" />}
                    {t("logs.detail.result")}
                </div>
                <div className="text-sm leading-6 text-stone-500 dark:text-stone-400">{log.status === "success" ? t("logs.detail.noAccessibleMedia") : t("logs.detail.noSuccessResult")}</div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("logs.detail.result")}</div>
                <Tag className="m-0" color={log.kind === "video" ? "purple" : "blue"}>
                    {t("logs.detail.resultCount", { count: assets.length })}
                </Tag>
            </div>
            <div className="space-y-3">
                {assets.map((asset, index) => {
                    const assetUrl = generationLogAssetAccessUrl(asset);
                    return (
                        <div key={`${asset.url}-${index}`} className="grid min-w-0 items-start gap-3 rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950/60 sm:grid-cols-[156px_minmax(0,1fr)]">
                            <div className="min-w-0">
                                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-stone-500 dark:text-stone-400">
                                    <span>{asset.type === "video" ? t("logs.detail.videoIndex", { index: index + 1 }) : t("logs.detail.imageIndex", { index: index + 1 })}</span>
                                    {asset.width || asset.height ? <span className="shrink-0 tabular-nums">{[asset.width, asset.height].filter(Boolean).join("x")}</span> : null}
                                </div>
                                <div className="flex h-32 items-center justify-center overflow-hidden rounded-md bg-stone-100 p-2 dark:bg-stone-900 sm:h-36">
                                    {asset.type === "video" ? (
                                        <video className="h-full w-full rounded bg-black object-contain" src={assetUrl} controls playsInline preload="metadata" />
                                    ) : (
                                        <img className="h-full w-full object-contain" src={imagePreviewUrl(assetUrl, 960)} alt="" referrerPolicy="no-referrer" loading="lazy" />
                                    )}
                                </div>
                            </div>
                            <div className="min-w-0 self-center text-sm text-stone-500 dark:text-stone-400">
                                <div>{asset.type === "video" ? t("logs.kind.video") : t("logs.kind.image")}</div>
                                <div className="mt-1 text-xs">{asset.bytes ? formatAssetBytes(asset.bytes) : t("logs.detail.sizeUnrecorded")}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function generationLogAssetAccessUrl(asset: StoredGenerationLog["assets"][number]) {
    const directUrl = asset.url && !asset.url.startsWith("/api/generation-log-assets/") && asset.url !== asset.serverUrl ? asset.url : "";
    const serverUrl = asset.serverUrl || (asset.url?.startsWith("/api/generation-log-assets/") ? asset.url : "");
    return browserReadableMediaUrl(asset.remoteUrl || directUrl || serverUrl || asset.serverUrl || (asset.url?.startsWith("/api/generation-log-assets/") ? asset.url : ""));
}

function formatAssetBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatGenerationLogModel(model: string) {
    const value = (model || "").trim();
    if (!value) return "-";
    const separatorIndex = value.indexOf("::");
    return separatorIndex >= 0 ? value.slice(separatorIndex + 2).trim() || value : value;
}

export function formatAdminLogTime(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "-";
    return date.toLocaleString(undefined, { hour12: false });
}

export function formatAdminLogDuration(value: number) {
    if (!value) return "-";
    if (value < 1000) return `${Math.round(value)}ms`;
    return `${(value / 1000).toFixed(2)}s`;
}

export function generationKindLabel(value: string, t: AdminTranslator) {
    return value === "video" ? t("logs.kind.video") : t("logs.kind.image");
}

export function generationSourceLabel(value: string, t: AdminTranslator) {
    if (value === "agent") return t("logs.source.agent");
    if (value === "canvas") return t("logs.source.canvas");
    if (value === "drama") return t("logs.source.drama");
    if (value === "video-workbench") return t("logs.source.videoWorkbench");
    if (value === "image-workbench") return t("logs.source.imageWorkbench");
    return t("logs.source.unknown");
}

export function generationStatusLabel(value: string, t: AdminTranslator) {
    if (value === "success") return t("logs.status.success");
    if (value === "failed") return t("logs.status.failed");
    if (value === "pending") return t("logs.status.pending");
    return value || "-";
}

export function generationStatusClass(value: string) {
    if (value === "success") return "inline-flex h-6 items-center rounded-md bg-emerald-50 px-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/25";
    if (value === "failed") return "inline-flex h-6 items-center rounded-md bg-rose-50 px-2 text-xs font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/25";
    return "inline-flex h-6 items-center rounded-md bg-sky-50 px-2 text-xs font-medium text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/25";
}

function InfoBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-900">
            <div className="text-xs text-stone-500 dark:text-stone-400">{label}</div>
            <div className="mt-1 truncate text-sm font-medium text-stone-900 dark:text-stone-100" title={value}>
                {value}
            </div>
        </div>
    );
}
