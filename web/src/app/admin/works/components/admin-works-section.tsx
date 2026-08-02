"use client";

import { App, Button, Input, Modal, Pagination, Segmented, Select, Table, Tag, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { Ban, Check, Eye, GalleryVerticalEnd, RefreshCw, Search, Star, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Panel, PanelHeader } from "@/components/admin/admin-panel";
import { AdminAccountId, AdminUserIdentity } from "@/components/admin/admin-user-identity";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { workStatusToneClass } from "@/lib/work-publication-status";
import {
    deleteAdminWorkPublication,
    listAdminWorkPublications,
    reviewAdminWorkPublication,
    takeDownAdminWorkPublication,
    type WorkPublication,
    type WorkPublicationLifecycleStatus,
    type WorkPublicationModerationStatus,
    type WorkPublicationVisibility,
} from "@/services/api/work-publications";
import { setAdminWorkFeatured } from "@/services/api/work-governance";
import { AdminWorkCasesSection } from "./admin-work-cases-section";

const PAGE_SIZE = 12;

type WorksT = ReturnType<typeof useTranslations<"admin.content.works">>;

export function AdminWorksSection() {
    const t = useTranslations("admin.content.works");
    const [view, setView] = useState<"reviews" | "governance">("reviews");
    return (
        <div className="min-w-0 space-y-3">
            <div className="flex justify-end">
                <Segmented
                    value={view}
                    options={[
                        { value: "reviews", label: t("tabReviews") },
                        { value: "governance", label: t("tabGovernance") },
                    ]}
                    onChange={(value) => setView(value as typeof view)}
                />
            </div>
            {view === "reviews" ? <AdminWorkReviewSection /> : <AdminWorkCasesSection />}
        </div>
    );
}

function AdminWorkReviewSection() {
    const t = useTranslations("admin.content.works");
    const locale = useLocale();
    const { message, modal } = App.useApp();
    const requestIdRef = useRef(0);
    const [items, setItems] = useState<WorkPublication[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<WorkPublicationModerationStatus | "all">("all");
    const [lifecycleStatus, setLifecycleStatus] = useState<WorkPublicationLifecycleStatus | "all">("all");
    const [keyword, setKeyword] = useState("");
    const [debouncedKeyword, setDebouncedKeyword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [actionId, setActionId] = useState("");
    const [reasonAction, setReasonAction] = useState<{ work: WorkPublication; kind: "reject" | "take-down" }>();
    const [reason, setReason] = useState("");
    const [viewingWork, setViewingWork] = useState<WorkPublication>();

    const statusOptions: Array<{ value: WorkPublicationModerationStatus | "all"; label: string }> = [
        { value: "all", label: t("statusAll") },
        { value: "pending", label: t("statusPending") },
        { value: "approved", label: t("statusApproved") },
        { value: "rejected", label: t("statusRejected") },
        { value: "taken_down", label: t("statusTakenDown") },
    ];

    const lifecycleOptions: Array<{ value: WorkPublicationLifecycleStatus | "all"; label: string }> = [
        { value: "all", label: t("lifecycleAll") },
        { value: "active", label: t("lifecycleActive") },
        { value: "revoked", label: t("lifecycleRevoked") },
    ];

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [keyword]);

    const load = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError("");
        try {
            const result = await listAdminWorkPublications({
                page,
                pageSize: PAGE_SIZE,
                status: status === "all" ? undefined : status,
                lifecycleStatus: lifecycleStatus === "all" ? undefined : lifecycleStatus,
                keyword: debouncedKeyword || undefined,
            });
            if (requestId !== requestIdRef.current) return;
            setItems(result.items);
            setTotal(result.total);
        } catch (loadError) {
            if (requestId !== requestIdRef.current) return;
            setItems([]);
            setTotal(0);
            setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [debouncedKeyword, lifecycleStatus, page, status, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const approve = (work: WorkPublication) => {
        const version = work.currentVersion;
        if (!version) return;
        modal.confirm({
            title: t("approveTitle"),
            content: t("approveContent"),
            okText: t("approveOk"),
            cancelText: t("cancel"),
            onOk: async () => {
                setActionId(work.id);
                try {
                    await reviewAdminWorkPublication(work.id, { versionId: version.id, decision: "approved" });
                    message.success(t("approveSuccess"));
                    await load();
                } catch (approveError) {
                    message.error(approveError instanceof Error ? approveError.message : t("reviewFailed"));
                    throw approveError;
                } finally {
                    setActionId("");
                }
            },
        });
    };

    const submitReasonAction = async () => {
        const action = reasonAction;
        const value = reason.trim();
        if (!action || !value) return message.warning(action?.kind === "reject" ? t("rejectReasonRequired") : t("takeDownReasonRequired"));
        const version = action.work.currentVersion;
        if (!version) return;
        setActionId(action.work.id);
        try {
            if (action.kind === "reject") await reviewAdminWorkPublication(action.work.id, { versionId: version.id, decision: "rejected", reason: value });
            else await takeDownAdminWorkPublication(action.work.id, value);
            message.success(action.kind === "reject" ? t("rejectSuccess") : t("takeDownSuccess"));
            setReasonAction(undefined);
            setReason("");
            await load();
        } catch (actionError) {
            message.error(actionError instanceof Error ? actionError.message : t("actionFailed"));
        } finally {
            setActionId("");
        }
    };

    const toggleFeatured = async (work: WorkPublication) => {
        setActionId(work.id);
        try {
            await setAdminWorkFeatured(work.id, !work.isFeatured);
            message.success(work.isFeatured ? t("unfeatureSuccess") : t("featureSuccess"));
            await load();
        } catch (featureError) {
            message.error(featureError instanceof Error ? featureError.message : t("featureFailed"));
        } finally {
            setActionId("");
        }
    };

    const remove = (work: WorkPublication) => {
        modal.confirm({
            title: t("deleteTitle"),
            content: t("deleteContent"),
            okText: t("deleteOk"),
            cancelText: t("cancel"),
            okButtonProps: { danger: true },
            onOk: async () => {
                setActionId(work.id);
                try {
                    await deleteAdminWorkPublication(work.id);
                    message.success(t("deleteSuccess"));
                    await load();
                } catch (deleteError) {
                    message.error(deleteError instanceof Error ? deleteError.message : t("deleteFailed"));
                    throw deleteError;
                } finally {
                    setActionId("");
                }
            },
        });
    };

    const clearFilters = () => {
        setStatus("all");
        setLifecycleStatus("all");
        setKeyword("");
        setPage(1);
    };

    const renderActions = (work: WorkPublication) => {
        const version = work.currentVersion;
        if (!version) return null;
        const busy = actionId === work.id;
        const pending = work.lifecycleStatus === "active" && version.moderationStatus === "pending";
        const shareable = work.lifecycleStatus === "active" && Boolean(work.publishedVersionId) && work.publishedVersion?.visibility !== "private";
        const canFeature = shareable && work.publishedVersion?.visibility === "public";
        const canDelete = work.lifecycleStatus === "revoked" || (!work.publishedVersionId && version.moderationStatus === "taken_down");
        return (
            <div className="flex flex-wrap items-center justify-end gap-0.5">
                <Button type="link" size="small" icon={<Eye className="size-3.5" />} onClick={() => setViewingWork(work)}>
                    {t("detail")}
                </Button>
                {shareable ? (
                    <Tooltip title={t("openPublic")}>
                        <Button type="text" size="small" aria-label={t("openPublic")} icon={<Eye className="size-3.5" />} onClick={() => window.open(`/share/${encodeURIComponent(work.slug)}`, "_blank", "noopener,noreferrer")} />
                    </Tooltip>
                ) : null}
                {canFeature ? (
                    <Tooltip title={work.isFeatured ? t("unfeature") : t("feature")}>
                        <Button
                            type="text"
                            size="small"
                            aria-label={work.isFeatured ? t("unfeature") : t("feature")}
                            icon={<Star className={`size-3.5 ${work.isFeatured ? "fill-current" : ""}`} />}
                            onClick={() => void toggleFeatured(work)}
                            loading={busy}
                        />
                    </Tooltip>
                ) : null}
                {pending ? (
                    <>
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<X className="size-3.5" />}
                            disabled={busy}
                            onClick={() => {
                                setReason("");
                                setReasonAction({ work, kind: "reject" });
                            }}
                        >
                            {t("reject")}
                        </Button>
                        <Button type="link" size="small" icon={<Check className="size-3.5" />} loading={busy} onClick={() => approve(work)}>
                            {t("approve")}
                        </Button>
                    </>
                ) : null}
                {work.lifecycleStatus === "active" && work.publishedVersionId ? (
                    <Button
                        type="link"
                        size="small"
                        danger
                        icon={<Ban className="size-3.5" />}
                        disabled={busy}
                        onClick={() => {
                            setReason("");
                            setReasonAction({ work, kind: "take-down" });
                        }}
                    >
                        {t("takeDown")}
                    </Button>
                ) : null}
                {canDelete ? (
                    <Button type="link" size="small" danger icon={<Trash2 className="size-3.5" />} loading={busy} onClick={() => remove(work)}>
                        {t("delete")}
                    </Button>
                ) : null}
            </div>
        );
    };

    const columns: TableColumnsType<WorkPublication> = [
        {
            title: t("colUpdatedAt"),
            dataIndex: "updatedAt",
            width: 156,
            render: (value: string) => <span className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">{formatAdminTime(value, locale)}</span>,
        },
        {
            title: t("colWork"),
            key: "work",
            width: 330,
            render: (_, work) => <AdminWorkIdentity work={work} />,
        },
        {
            title: t("colUser"),
            key: "owner",
            width: 210,
            render: (_, work) => <AdminUserIdentity displayName={work.ownerDisplayName} username={work.ownerUsername} accountId={work.ownerAccountId} fallback={t("userUnavailable")} />,
        },
        {
            title: t("colSource"),
            dataIndex: "sourceType",
            width: 100,
            render: (value: WorkPublication["sourceType"]) => <span className="text-xs text-zinc-600 dark:text-zinc-300">{sourceTypeLabel(t, value)}</span>,
        },
        {
            title: t("colVersionVisibility"),
            key: "version",
            width: 130,
            render: (_, work) => (
                <div className="text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                    <div>v{work.currentVersion?.versionNumber || 1}</div>
                    <div className="text-zinc-500 dark:text-zinc-400">{visibilityLabel(t, work.currentVersion?.visibility)}</div>
                </div>
            ),
        },
        {
            title: t("colStatus"),
            key: "status",
            width: 112,
            render: (_, work) => <AdminWorkStatus work={work} />,
        },
        {
            title: t("colMetrics"),
            key: "metrics",
            width: 110,
            render: (_, work) => (
                <div className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    <div>{t("viewCount", { count: work.viewCount })}</div>
                    <div>{t("likeCount", { count: work.likeCount })}</div>
                </div>
            ),
        },
        {
            title: t("colActions"),
            key: "actions",
            fixed: "right",
            width: 286,
            render: (_, work) => renderActions(work),
        },
    ];

    return (
        <Panel>
            <PanelHeader title={t("tabReviews")} description={t("reviewsDescription")} />
            <div className="min-w-0 space-y-3 p-3 sm:p-5">
                <div className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-[minmax(180px,1fr)_minmax(110px,130px)_minmax(120px,140px)_auto_auto_auto] md:items-center" data-testid="admin-work-filters">
                    <Input
                        className="col-span-2 min-w-0 md:col-span-1"
                        allowClear
                        prefix={<Search className="size-4 text-zinc-400" />}
                        placeholder={t("searchPlaceholder")}
                        value={keyword}
                        onChange={(event) => {
                            setKeyword(event.target.value);
                            setPage(1);
                        }}
                    />
                    <Select
                        className="min-w-0"
                        value={status}
                        options={statusOptions}
                        onChange={(value) => {
                            setStatus(value);
                            if (value === "taken_down") setLifecycleStatus("all");
                            setPage(1);
                        }}
                    />
                    <Select
                        className="min-w-0"
                        value={lifecycleStatus}
                        options={lifecycleOptions}
                        onChange={(value) => {
                            setLifecycleStatus(value);
                            setPage(1);
                        }}
                    />
                    <span className="col-span-2 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400 md:col-span-1">{t("totalCount", { count: total })}</span>
                    <Button className="w-full md:w-auto" icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void load()}>
                        {t("refresh")}
                    </Button>
                    <Button className="w-full md:w-auto" onClick={clearFilters}>
                        {t("clearFilters")}
                    </Button>
                </div>

                {error ? (
                    <div className="grid min-h-40 place-items-center border-y border-rose-200 px-4 text-center text-sm text-rose-700 dark:border-rose-900/60 dark:text-rose-300">{error}</div>
                ) : (
                    <>
                        <div className="space-y-2 md:hidden">
                            {items.map((work) => (
                                <AdminWorkMobileCard key={work.id} work={work} actions={renderActions(work)} />
                            ))}
                            {!items.length && !loading ? <AdminWorksEmpty /> : null}
                            {loading && !items.length ? <div className="grid min-h-36 place-items-center text-sm text-zinc-500 dark:text-zinc-400">{t("loading")}</div> : null}
                            {total > PAGE_SIZE ? <Pagination current={page} pageSize={PAGE_SIZE} total={total} showSizeChanger={false} size="small" onChange={setPage} /> : null}
                        </div>
                        <div className="hidden min-w-0 md:block">
                            <Table
                                className="admin-work-table"
                                rowKey="id"
                                columns={columns}
                                dataSource={items}
                                loading={loading}
                                pagination={{
                                    current: page,
                                    pageSize: PAGE_SIZE,
                                    total,
                                    showSizeChanger: false,
                                    showTotal: (count, range) => t("showTotal", { from: range[0], to: range[1], total: count }),
                                    onChange: setPage,
                                }}
                                locale={{ emptyText: <AdminWorksEmpty /> }}
                                scroll={{ x: 1374 }}
                                size="middle"
                                tableLayout="fixed"
                            />
                        </div>
                    </>
                )}
            </div>

            <Modal
                title={reasonAction?.kind === "reject" ? t("rejectModalTitle") : t("takeDownModalTitle")}
                open={Boolean(reasonAction)}
                okText={reasonAction?.kind === "reject" ? t("rejectConfirm") : t("takeDownConfirm")}
                cancelText={t("cancel")}
                confirmLoading={Boolean(reasonAction && actionId === reasonAction.work.id)}
                okButtonProps={{ danger: true, disabled: !reason.trim() }}
                onOk={() => void submitReasonAction()}
                onCancel={() => {
                    setReasonAction(undefined);
                    setReason("");
                }}
            >
                <p className="mb-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{reasonAction?.kind === "reject" ? t("rejectHint") : t("takeDownHint")}</p>
                <Input.TextArea value={reason} rows={4} maxLength={500} showCount placeholder={reasonAction?.kind === "reject" ? t("rejectPlaceholder") : t("takeDownPlaceholder")} onChange={(event) => setReason(event.target.value)} />
            </Modal>
            <Modal title={t("detailModalTitle")} open={Boolean(viewingWork)} width={760} footer={null} destroyOnHidden onCancel={() => setViewingWork(undefined)}>
                {viewingWork ? <AdminWorkDetail work={viewingWork} /> : null}
            </Modal>
        </Panel>
    );
}

function AdminWorkIdentity({ work }: { work: WorkPublication }) {
    const t = useTranslations("admin.content.works");
    const version = work.currentVersion;
    if (!version) return <span className="text-xs text-zinc-500">{t("versionUnavailable")}</span>;
    return (
        <div className="flex min-w-0 items-center gap-2.5">
            <AdminWorkThumbnail work={work} />
            <div className="min-w-0 flex-1">
                <Tooltip title={version.title} placement="topLeft">
                    <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">{version.title}</div>
                </Tooltip>
                <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{version.description || t("noDescription")}</div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-400 dark:text-zinc-500" title={work.slug}>
                    {work.slug}
                </div>
            </div>
        </div>
    );
}

function AdminWorkStatus({ work }: { work: WorkPublication }) {
    const t = useTranslations("admin.content.works");
    const version = work.currentVersion;
    if (!version) return <Tag className="m-0">{t("statusUnknown")}</Tag>;
    const moderationSignal = version.moderationStatus === "pending" ? moderationSignalText(t, version.moderationProvider, version.moderationSignal) : "";
    const tag = (
        <span className={`inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium leading-none ${workStatusToneClass(work.lifecycleStatus === "revoked" ? "revoked" : version.moderationStatus)}`}>
            {work.lifecycleStatus === "revoked" ? t("lifecycleRevoked") : adminStatusLabel(t, version.moderationStatus)}
        </span>
    );
    return (
        <div className="flex flex-col items-start gap-1">
            {moderationSignal ? <Tooltip title={moderationSignal}>{tag}</Tooltip> : tag}
            {work.isFeatured ? <Tag color="gold">{t("featured")}</Tag> : null}
            {work.publishedVersion && work.publishedVersion.id !== version.id ? <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{t("liveVersion", { version: work.publishedVersion.versionNumber })}</span> : null}
        </div>
    );
}

function AdminWorkThumbnail({ work }: { work: WorkPublication }) {
    const t = useTranslations("admin.content.works");
    const [failed, setFailed] = useState(false);
    const asset = work.currentPreview;
    const url = asset?.previewUrl || "";
    const imageUrl = imagePreviewUrl(url, 256);
    useEffect(() => setFailed(false), [url]);
    return (
        <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
            <img src="/logo.svg" alt="" className="absolute inset-0 size-full object-contain p-3 opacity-45" />
            {!failed && url && asset?.mediaType === "video" ? <video src={url} muted playsInline preload="metadata" className="relative size-full object-cover" onError={() => setFailed(true)} /> : null}
            {!failed && imageUrl && asset?.mediaType === "image" ? <img src={imageUrl} alt={work.currentVersion?.title || t("previewAlt")} loading="lazy" className="relative size-full object-cover" onError={() => setFailed(true)} /> : null}
        </div>
    );
}

function AdminWorkMobileCard({ work, actions }: { work: WorkPublication; actions: ReactNode }) {
    const t = useTranslations("admin.content.works");
    const locale = useLocale();
    return (
        <article className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <AdminWorkIdentity work={work} />
                </div>
                <AdminWorkStatus work={work} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{work.ownerDisplayName || work.ownerUsername || t("userUnavailable")}</span>
                    <AdminAccountId accountId={work.ownerAccountId} className="shrink-0" />
                </span>
                <span>{sourceTypeLabel(t, work.sourceType)}</span>
                <span>{formatAdminTime(work.updatedAt, locale)}</span>
            </div>
            <div className="mt-2 flex flex-wrap justify-end gap-0.5 border-t border-zinc-200 pt-2 dark:border-zinc-800">{actions}</div>
        </article>
    );
}

function AdminWorksEmpty() {
    const t = useTranslations("admin.content.works");
    return (
        <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-4 text-center">
            <GalleryVerticalEnd className="size-5 text-zinc-400" />
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("emptyTitle")}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("emptyDesc")}</div>
        </div>
    );
}

function AdminWorkDetail({ work }: { work: WorkPublication }) {
    const t = useTranslations("admin.content.works");
    const locale = useLocale();
    const version = work.currentVersion;
    if (!version) return null;
    const asset = work.currentPreview;
    const url = asset?.previewUrl || "";
    const imageUrl = imagePreviewUrl(url, 1920);
    const userName = work.ownerDisplayName || work.ownerUsername || t("userUnavailable");
    const accountSuffix = work.ownerAccountId ? t("detailAccountId", { id: work.ownerAccountId }) : "";
    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[240px_minmax(0,1fr)]">
                <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                    <img src="/logo.svg" alt="" className="absolute inset-0 size-full object-contain p-16 opacity-40" />
                    {url && asset?.mediaType === "video" ? <video src={url} controls playsInline preload="metadata" className="relative size-full object-contain" /> : null}
                    {imageUrl && asset?.mediaType === "image" ? <img src={imageUrl} alt={version.title} loading="lazy" className="relative size-full object-contain" /> : null}
                </div>
                <div className="min-w-0 space-y-3">
                    <div>
                        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">{version.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{version.description || t("noDescription")}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-zinc-200 py-3 text-xs dark:border-zinc-800">
                        <DetailValue label={t("detailUser")} value={`${userName}${accountSuffix}`} />
                        <DetailValue label={t("detailSource")} value={sourceTypeLabel(t, work.sourceType)} />
                        <DetailValue label={t("detailVersion")} value={`v${version.versionNumber}`} />
                        <DetailValue label={t("detailVisibility")} value={visibilityLabel(t, version.visibility)} />
                        <DetailValue label={t("detailUpdatedAt")} value={formatAdminTime(work.updatedAt, locale)} />
                        <DetailValue label={t("detailSlug")} value={work.slug} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <AdminWorkStatus work={work} />
                        {version.tags.map((tag) => (
                            <Tag key={tag} className="m-0">
                                {tag}
                            </Tag>
                        ))}
                    </div>
                </div>
            </div>
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("publicPrompt")}</div>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-zinc-800 dark:text-zinc-200">{version.publicPrompt || t("noPrompt")}</div>
            </div>
            {version.rejectionReason ? <div className="border-l-2 border-rose-400 pl-3 text-sm leading-6 text-rose-700 dark:text-rose-300">{t("resolutionReason", { reason: version.rejectionReason })}</div> : null}
        </div>
    );
}

function DetailValue({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="text-zinc-400 dark:text-zinc-500">{label}</div>
            <div className="mt-0.5 truncate text-zinc-700 dark:text-zinc-200" title={value}>
                {value}
            </div>
        </div>
    );
}

function sourceTypeLabel(t: WorksT, value: WorkPublication["sourceType"]) {
    return value === "canvas" ? t("sourceCanvas") : value === "drama" ? t("sourceDrama") : t("sourceMedia");
}

function visibilityLabel(t: WorksT, value: WorkPublicationVisibility | undefined) {
    return value === "public" ? t("visibilityPublic") : value === "unlisted" ? t("visibilityUnlisted") : t("visibilityPrivate");
}

function formatAdminTime(value: string, locale: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", { hour12: false });
}

function adminStatusLabel(t: WorksT, status: WorkPublicationModerationStatus) {
    return status === "pending" ? t("statusPending") : status === "approved" ? t("statusApproved") : status === "rejected" ? t("statusRejected") : status === "taken_down" ? t("statusTakenDown") : t("statusDraft");
}

function moderationSignalText(t: WorksT, provider: string | undefined, value: unknown) {
    if (!provider || provider === "manual") return t("awaitManualReview");
    if (!value || typeof value !== "object") return "";
    const signal = value as { riskLevel?: unknown; summary?: unknown };
    const summary = typeof signal.summary === "string" ? signal.summary : "";
    if (!summary) return "";
    const level = signal.riskLevel === "safe" ? t("riskLow") : signal.riskLevel === "block" ? t("riskHigh") : t("riskReview");
    return t("moderationSignal", { provider, level, summary });
}
