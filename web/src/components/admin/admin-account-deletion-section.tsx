"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Grid, Input, Modal, Pagination, Select, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { Check, RefreshCw, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { AccountDeletionRequestStatus, AdminAccountDeletionRequest } from "@/lib/account-deletion-contract";
import { AdminUserIdentity } from "@/components/admin/admin-user-identity";
import { listAdminAccountDeletionRequests, reviewAdminAccountDeletionRequest } from "@/services/api/account-deletion";

import { Panel, PanelHeader } from "./admin-panel";

const PAGE_SIZE = 20;

export function AdminAccountDeletionSection({ active }: { active: boolean }) {
    const t = useTranslations("admin");
    const locale = useLocale();
    const { message } = App.useApp();
    const screens = Grid.useBreakpoint();
    const [items, setItems] = useState<AdminAccountDeletionRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [keyword, setKeyword] = useState("");
    const [status, setStatus] = useState<AccountDeletionRequestStatus | undefined>("pending");
    const [reviewing, setReviewing] = useState<{ request: AdminAccountDeletionRequest; status: "accepted" | "rejected" } | null>(null);
    const [reviewNote, setReviewNote] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(
        async (targetPage = 1) => {
            setLoading(true);
            try {
                const result = await listAdminAccountDeletionRequests({ page: targetPage, pageSize: PAGE_SIZE, keyword, status });
                setItems(result.items);
                setTotal(result.total);
                setPage(result.page);
            } catch (error) {
                message.error(error instanceof Error ? error.message : t("accountDeletion.loadFailed"));
            } finally {
                setLoading(false);
            }
        },
        [keyword, message, status, t],
    );

    useEffect(() => {
        if (active) void load(1);
    }, [active, load]);

    const submitReview = async () => {
        if (!reviewing || !reviewNote.trim()) return;
        setSaving(true);
        try {
            await reviewAdminAccountDeletionRequest(reviewing.request.id, { status: reviewing.status, reviewNote });
            message.success(reviewing.status === "accepted" ? t("accountDeletion.acceptedSuccess") : t("accountDeletion.rejectedSuccess"));
            setReviewing(null);
            setReviewNote("");
            await load(page);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("accountDeletion.reviewFailed"));
        } finally {
            setSaving(false);
        }
    };

    const openReview = (request: AdminAccountDeletionRequest, nextStatus: "accepted" | "rejected") => {
        setReviewing({ request, status: nextStatus });
        setReviewNote("");
    };

    const columns = useMemo<TableColumnsType<AdminAccountDeletionRequest>>(
        () => [
            {
                title: t("accountDeletion.table.user"),
                key: "user",
                render: (_, item) => <AdminUserIdentity displayName={item.displayName} username={item.username} accountId={item.accountId} />,
            },
            {
                title: t("accountDeletion.table.status"),
                dataIndex: "status",
                width: 90,
                render: (value: AccountDeletionRequestStatus) => <Tag color={statusColor(value)}>{statusLabel(value, t)}</Tag>,
            },
            {
                title: t("accountDeletion.table.requestedAt"),
                dataIndex: "requestedAt",
                width: 170,
                render: (value: string) => formatTime(value, locale),
            },
            {
                title: t("accountDeletion.table.note"),
                key: "note",
                render: (_, item) => <span className="line-clamp-2 max-w-md text-sm text-zinc-600 dark:text-zinc-300">{item.note || item.reviewNote || t("accountDeletion.table.noNote")}</span>,
            },
            {
                title: t("accountDeletion.table.actions"),
                key: "actions",
                width: 172,
                render: (_, item) =>
                    item.status === "pending" ? (
                        <div className="flex gap-2">
                            <Button size="small" type="primary" icon={<Check className="size-3.5" />} onClick={() => openReview(item, "accepted")}>
                                {t("accountDeletion.table.accept")}
                            </Button>
                            <Button size="small" danger icon={<X className="size-3.5" />} onClick={() => openReview(item, "rejected")}>
                                {t("accountDeletion.table.reject")}
                            </Button>
                        </div>
                    ) : (
                        <span className="text-xs text-zinc-400">{item.reviewedByUsername ? t("accountDeletion.table.reviewedBy", { name: item.reviewedByUsername }) : t("accountDeletion.table.reviewed")}</span>
                    ),
            },
        ],
        [locale, t],
    );

    if (!active) return null;

    return (
        <Panel>
            <PanelHeader
                title={t("accountDeletion.title")}
                description={t("accountDeletion.description")}
                actions={
                    <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void load(page)}>
                        {t("accountDeletion.refresh")}
                    </Button>
                }
            />
            <div className="grid gap-3 border-b border-zinc-200 bg-zinc-50/50 p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/20">
                <Input allowClear prefix={<Search className="size-4 text-zinc-400" />} placeholder={t("accountDeletion.searchPlaceholder")} value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => void load(1)} />
                <Select
                    allowClear
                    placeholder={t("accountDeletion.statusAll")}
                    value={status}
                    options={[
                        { value: "pending", label: t("accountDeletion.status.pending") },
                        { value: "accepted", label: t("accountDeletion.status.accepted") },
                        { value: "rejected", label: t("accountDeletion.status.rejected") },
                        { value: "withdrawn", label: t("accountDeletion.status.withdrawn") },
                    ]}
                    onChange={(value) => setStatus(value)}
                />
                <Button type="primary" icon={<Search className="size-4" />} onClick={() => void load(1)}>
                    {t("accountDeletion.query")}
                </Button>
            </div>

            {screens.md ? (
                <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, hideOnSinglePage: true, onChange: (nextPage) => void load(nextPage) }} />
            ) : (
                <div className="space-y-2 p-3">
                    {items.map((item) => (
                        <article key={item.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <AdminUserIdentity displayName={item.displayName} username={item.username} accountId={item.accountId} className="min-w-0" />
                                <Tag color={statusColor(item.status)}>{statusLabel(item.status, t)}</Tag>
                            </div>
                            <div className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                {formatTime(item.requestedAt, locale)}
                                {item.note ? ` · ${item.note}` : ""}
                            </div>
                            {item.status === "pending" ? (
                                <div className="mt-3 flex gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                                    <Button className="flex-1" type="primary" icon={<Check className="size-3.5" />} onClick={() => openReview(item, "accepted")}>
                                        {t("accountDeletion.table.accept")}
                                    </Button>
                                    <Button className="flex-1" danger icon={<X className="size-3.5" />} onClick={() => openReview(item, "rejected")}>
                                        {t("accountDeletion.table.reject")}
                                    </Button>
                                </div>
                            ) : null}
                        </article>
                    ))}
                    {!loading && !items.length ? <div className="py-10 text-center text-sm text-zinc-400">{t("accountDeletion.empty")}</div> : null}
                    {total > PAGE_SIZE ? <Pagination size="small" current={page} pageSize={PAGE_SIZE} total={total} showSizeChanger={false} onChange={(nextPage) => void load(nextPage)} /> : null}
                </div>
            )}

            <Modal
                title={reviewing?.status === "accepted" ? t("accountDeletion.modal.acceptTitle") : t("accountDeletion.modal.rejectTitle")}
                open={Boolean(reviewing)}
                okText={reviewing?.status === "accepted" ? t("accountDeletion.modal.confirmAccept") : t("accountDeletion.modal.confirmReject")}
                cancelText={t("common.cancel")}
                okButtonProps={{ danger: reviewing?.status === "rejected", disabled: !reviewNote.trim() }}
                confirmLoading={saving}
                onOk={() => void submitReview()}
                onCancel={() => {
                    if (saving) return;
                    setReviewing(null);
                    setReviewNote("");
                }}
            >
                <div className="space-y-3 pt-2">
                    <div className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{reviewing?.status === "accepted" ? t("accountDeletion.modal.acceptHint") : t("accountDeletion.modal.rejectHint")}</div>
                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("accountDeletion.modal.reviewNoteLabel")}</span>
                        <Input.TextArea value={reviewNote} maxLength={1000} rows={4} showCount placeholder={t("accountDeletion.modal.reviewNotePlaceholder")} onChange={(event) => setReviewNote(event.target.value)} />
                    </label>
                </div>
            </Modal>
        </Panel>
    );
}

function statusLabel(status: AccountDeletionRequestStatus, t: ReturnType<typeof useTranslations<"admin">>) {
    if (status === "pending") return t("accountDeletion.status.pending");
    if (status === "accepted") return t("accountDeletion.status.accepted");
    if (status === "rejected") return t("accountDeletion.status.rejected");
    return t("accountDeletion.status.withdrawn");
}

function statusColor(status: AccountDeletionRequestStatus) {
    if (status === "pending") return "gold";
    if (status === "accepted") return "blue";
    if (status === "rejected") return "red";
    return "default";
}

function formatTime(value: string, locale: string) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", { hour12: false }) : "-";
}
