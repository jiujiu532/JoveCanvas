"use client";

import { App, Button, Input, Modal, Pagination, Select, Tag } from "antd";
import { Check, Eye, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Panel, PanelHeader } from "@/components/admin/admin-panel";
import { AdminAccountId } from "@/components/admin/admin-user-identity";
import { listAdminWorkCases, resolveAdminWorkCase, type WorkGovernanceCase, type WorkGovernanceCaseStatus, type WorkGovernanceCaseType } from "@/services/api/work-governance";

const PAGE_SIZE = 12;

export function AdminWorkCasesSection() {
    const t = useTranslations("admin.content.works");
    const locale = useLocale();
    const { message } = App.useApp();
    const requestIdRef = useRef(0);
    const [items, setItems] = useState<WorkGovernanceCase[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [caseType, setCaseType] = useState<WorkGovernanceCaseType | "all">("all");
    const [status, setStatus] = useState<WorkGovernanceCaseStatus | "all">("open");
    const [keyword, setKeyword] = useState("");
    const [debouncedKeyword, setDebouncedKeyword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [action, setAction] = useState<{ item: WorkGovernanceCase; decision: "approved" | "rejected" }>();
    const [resolution, setResolution] = useState("");

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [keyword]);

    const load = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError("");
        try {
            const result = await listAdminWorkCases({ page, pageSize: PAGE_SIZE, caseType: caseType === "all" ? undefined : caseType, status: status === "all" ? undefined : status, keyword: debouncedKeyword || undefined });
            if (requestId !== requestIdRef.current) return;
            setItems(result.items);
            setTotal(result.total);
        } catch (loadError) {
            if (requestId !== requestIdRef.current) return;
            setItems([]);
            setTotal(0);
            setError(loadError instanceof Error ? loadError.message : t("casesLoadFailed"));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [caseType, debouncedKeyword, page, status, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const submitResolution = async () => {
        if (!action || resolution.trim().length < 5) return message.warning(t("casesResolutionMin"));
        try {
            await resolveAdminWorkCase(action.item.id, { decision: action.decision, resolution: resolution.trim() });
            message.success(actionResultLabel(t, action.item.caseType, action.decision));
            setAction(undefined);
            setResolution("");
            await load();
        } catch (resolveError) {
            message.error(resolveError instanceof Error ? resolveError.message : t("casesResolveFailed"));
        }
    };

    return (
        <Panel>
            <PanelHeader
                title={t("casesTitle")}
                description={t("casesDescription")}
                actions={
                    <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void load()}>
                        {t("refresh")}
                    </Button>
                }
            />
            <div className="min-w-0 space-y-4 p-3 sm:p-5">
                <div className="grid min-w-0 grid-cols-2 gap-2 border-b border-zinc-200 pb-4 lg:flex lg:items-center dark:border-zinc-800">
                    <div className="min-w-0 lg:w-36 lg:shrink-0">
                        <Select
                            className="w-full"
                            value={caseType}
                            options={[
                                { value: "all", label: t("caseTypeAll") },
                                { value: "report", label: t("caseTypeReport") },
                                { value: "appeal", label: t("caseTypeAppeal") },
                            ]}
                            onChange={(value) => {
                                setCaseType(value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <div className="min-w-0 lg:w-36 lg:shrink-0">
                        <Select
                            className="w-full"
                            value={status}
                            options={[
                                { value: "open", label: t("caseStatusOpen") },
                                { value: "approved", label: t("caseStatusApproved") },
                                { value: "rejected", label: t("caseStatusRejected") },
                                { value: "all", label: t("caseStatusAll") },
                            ]}
                            onChange={(value) => {
                                setStatus(value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <Input
                        className="col-span-2 min-w-0 lg:flex-1"
                        allowClear
                        prefix={<Search className="size-4 text-zinc-400" />}
                        placeholder={t("casesSearchPlaceholder")}
                        value={keyword}
                        onChange={(event) => {
                            setKeyword(event.target.value);
                            setPage(1);
                        }}
                    />
                </div>

                {error ? (
                    <div className="grid min-h-40 place-items-center border-y border-rose-200 px-4 text-center text-sm text-rose-700 dark:border-rose-900/60 dark:text-rose-300">{error}</div>
                ) : loading && !items.length ? (
                    <div className="grid min-h-40 place-items-center text-sm text-zinc-500 dark:text-zinc-400">{t("casesLoading")}</div>
                ) : items.length ? (
                    <div className="grid min-w-0 gap-2.5">
                        {items.map((item) => (
                            <GovernanceCaseItem
                                key={item.id}
                                item={item}
                                locale={locale}
                                onResolve={(decision) => {
                                    setResolution("");
                                    setAction({ item, decision });
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex min-h-44 flex-col items-center justify-center gap-2 border-y border-dashed border-zinc-300 px-4 text-center dark:border-zinc-700">
                        <ShieldAlert className="size-5 text-zinc-400" />
                        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("casesEmptyTitle")}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("casesEmptyDesc")}</div>
                    </div>
                )}

                {total > PAGE_SIZE ? <Pagination current={page} pageSize={PAGE_SIZE} total={total} showSizeChanger={false} size="small" onChange={setPage} /> : null}
            </div>
            <Modal
                title={action ? actionModalTitle(t, action.item.caseType, action.decision) : t("casesResolveModalTitle")}
                open={Boolean(action)}
                okText={t("casesResolveConfirm")}
                cancelText={t("cancel")}
                okButtonProps={{ danger: action?.item.caseType === "report" && action.decision === "approved", disabled: resolution.trim().length < 5 }}
                onOk={() => void submitResolution()}
                onCancel={() => setAction(undefined)}
            >
                <p className="mb-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t("casesResolveHint")}</p>
                <Input.TextArea value={resolution} rows={5} maxLength={1000} showCount placeholder={t("casesResolvePlaceholder")} onChange={(event) => setResolution(event.target.value)} />
            </Modal>
        </Panel>
    );
}

function GovernanceCaseItem({ item, locale, onResolve }: { item: WorkGovernanceCase; locale: string; onResolve: (decision: "approved" | "rejected") => void }) {
    const t = useTranslations("admin.content.works");
    return (
        <article className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
            <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
                    <ShieldAlert className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <h3 className="max-w-full truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">{item.title || item.slug}</h3>
                        <Tag color={item.caseType === "report" ? "warning" : "processing"} className="m-0">
                            {item.caseType === "report" ? t("caseTypeReport") : t("caseTypeAppeal")}
                        </Tag>
                        <Tag color={caseStatusColor(item.status)} className="m-0">
                            {caseStatusLabel(t, item.status)}
                        </Tag>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-700 dark:text-zinc-300">{item.description}</p>
                    <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-xs">
                        <span>{t("caseTypeLabel", { category: caseCategoryLabel(t, item.category) })}</span>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                            {t("caseSubmitter", { name: item.submitterDisplayName || item.submitterUsername || t("userUnavailable") })}
                            <AdminAccountId accountId={item.submitterAccountId} />
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                            {t("caseAuthor", { name: item.ownerDisplayName || item.ownerUsername || t("userUnavailable") })}
                            <AdminAccountId accountId={item.ownerAccountId} />
                        </span>
                        <span>{formatTime(item.createdAt, locale)}</span>
                    </div>
                    {item.resolution ? <div className="mt-2 border-l-2 border-zinc-300 pl-2 text-xs leading-5 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">{t("caseResolution", { text: item.resolution })}</div> : null}
                </div>
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <Button size="small" icon={<Eye className="size-3.5" />} onClick={() => window.open(`/share/${encodeURIComponent(item.slug || "")}`, "_blank", "noopener,noreferrer")}>
                    {t("viewWork")}
                </Button>
                {item.status === "open" ? (
                    <>
                        <Button size="small" icon={<X className="size-3.5" />} onClick={() => onResolve("rejected")}>
                            {t("reject")}
                        </Button>
                        <Button size="small" type="primary" danger={item.caseType === "report"} icon={<Check className="size-3.5" />} onClick={() => onResolve("approved")}>
                            {item.caseType === "report" ? t("confirmViolationTakeDown") : t("approveAndRestore")}
                        </Button>
                    </>
                ) : null}
            </div>
        </article>
    );
}

type WorksT = ReturnType<typeof useTranslations<"admin.content.works">>;

function caseStatusLabel(t: WorksT, status: WorkGovernanceCaseStatus) {
    return status === "open" ? t("caseStatusOpen") : status === "approved" ? t("caseStatusApproved") : t("caseStatusRejected");
}
function caseStatusColor(status: WorkGovernanceCaseStatus) {
    return status === "open" ? "processing" : status === "approved" ? "success" : "default";
}
function caseCategoryLabel(t: WorksT, category: string) {
    const map: Record<string, string> = {
        illegal: t("categoryIllegal"),
        copyright: t("categoryCopyright"),
        privacy: t("categoryPrivacy"),
        spam: t("categorySpam"),
        other: t("categoryOther"),
        appeal: t("categoryAppeal"),
    };
    return map[category] || category;
}
function actionModalTitle(t: WorksT, type: WorkGovernanceCaseType, decision: "approved" | "rejected") {
    return type === "report" ? (decision === "approved" ? t("modalConfirmReport") : t("modalRejectReport")) : decision === "approved" ? t("modalApproveAppeal") : t("modalRejectAppeal");
}
function actionResultLabel(t: WorksT, type: WorkGovernanceCaseType, decision: "approved" | "rejected") {
    return type === "report" ? (decision === "approved" ? t("resultReportApproved") : t("resultReportRejected")) : decision === "approved" ? t("resultAppealApproved") : t("resultAppealRejected");
}
function formatTime(value: string, locale: string) {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
