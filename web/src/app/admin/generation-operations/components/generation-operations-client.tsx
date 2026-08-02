"use client";

import { App, Button, Input, Modal, Pagination, Select, Table, Tag, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { Activity, CircleCheckBig, CircleStop, Clock3, Coins, RefreshCw, RotateCcw, Route, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Panel, PanelHeader } from "@/components/admin/admin-panel";
import { AdminUserIdentity } from "@/components/admin/admin-user-identity";
import type { AdminGenerationChannel, AdminGenerationOperationsPayload, AdminGenerationTask } from "@/lib/admin-generation-operations";
import { generationOperationStatusTagClass, generationOperationThemeClasses } from "./generation-operations-theme";

const PAGE_SIZE = 20;

type GenerationOpsTranslator = ReturnType<typeof useTranslations<"admin.generationOps">>;

export function GenerationOperationsClient() {
    const { message } = App.useApp();
    const t = useTranslations("admin.generationOps");
    const [data, setData] = useState<AdminGenerationOperationsPayload>();
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [type, setType] = useState("");
    const [status, setStatus] = useState("");
    const [surface, setSurface] = useState("");
    const [search, setSearch] = useState("");
    const [submittedSearch, setSubmittedSearch] = useState("");
    const [actingId, setActingId] = useState("");
    const [reviewingTask, setReviewingTask] = useState<AdminGenerationTask>();
    const [reviewAction, setReviewAction] = useState<"resume_upstream" | "provide_result" | "confirm_failed">("resume_upstream");
    const [reviewValue, setReviewValue] = useState("");
    const [reviewing, setReviewing] = useState(false);
    const [health, setHealth] = useState<Record<string, { loading?: boolean; ok?: boolean; error?: string; status?: number }>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
            if (type) query.set("type", type);
            if (status) query.set("status", status);
            if (surface) query.set("surface", surface);
            if (submittedSearch) query.set("search", submittedSearch);
            const response = await fetch(`/api/admin/generation-operations?${query}`, { cache: "no-store" });
            const payload = (await response.json().catch(() => ({}))) as { data?: AdminGenerationOperationsPayload; msg?: string };
            if (!response.ok || !payload.data) throw new Error(payload.msg || t("loadFailed"));
            setData(payload.data);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("loadFailed"));
        } finally {
            setLoading(false);
        }
    }, [message, page, status, submittedSearch, surface, t, type]);

    useEffect(() => {
        void load();
    }, [load]);

    const runAction = async (task: AdminGenerationTask, action: "cancel" | "retry") => {
        setActingId(`${task.id}:${action}`);
        try {
            const url =
                action === "retry"
                    ? `/api/agent/runs/${encodeURIComponent(task.id)}/tasks/${encodeURIComponent(task.retryTaskId || "")}/retry`
                    : task.type === "agent"
                      ? `/api/agent/runs/${encodeURIComponent(task.id)}/cancel`
                      : task.type === "render"
                        ? `/api/drama/render/${encodeURIComponent(task.id)}`
                        : `/api/${task.type}-tasks/${encodeURIComponent(task.id)}`;
            const response = await fetch(url, action === "retry" || task.type === "agent" ? { method: "POST" } : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
            const payload = (await response.json().catch(() => ({}))) as { msg?: string; error?: string };
            if (!response.ok) throw new Error(payload.msg || payload.error || t("actionFailed"));
            message.success(action === "retry" ? t("retrySuccess") : t("cancelSuccess"));
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("actionFailed"));
        } finally {
            setActingId("");
        }
    };

    const testChannel = async (channel: AdminGenerationChannel) => {
        const key = channelKey(channel);
        setHealth((current) => ({ ...current, [key]: { loading: true } }));
        try {
            const response = await fetch("/api/admin/channel-health", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId: channel.id, model: channel.upstreamModel, kind: channel.capability }),
            });
            const payload = (await response.json().catch(() => ({}))) as { result?: { ok?: boolean; status?: number; error?: string }; error?: string };
            if (!response.ok || !payload.result) throw new Error(payload.error || t("probeFailed"));
            setHealth((current) => ({ ...current, [key]: { ok: Boolean(payload.result?.ok), status: payload.result?.status, error: payload.result?.error } }));
        } catch (error) {
            setHealth((current) => ({ ...current, [key]: { ok: false, error: error instanceof Error ? error.message : t("probeFailed") } }));
        }
    };

    const openReview = (task: AdminGenerationTask) => {
        setReviewingTask(task);
        setReviewAction("resume_upstream");
        setReviewValue(task.upstreamTaskId || "");
    };

    const submitReview = async () => {
        if (!reviewingTask) return;
        setReviewing(true);
        try {
            const body =
                reviewAction === "resume_upstream"
                    ? { action: reviewAction, upstreamTaskId: reviewValue.trim() }
                    : reviewAction === "provide_result"
                      ? { action: reviewAction, result: reviewValue.trim() }
                      : { action: reviewAction, reason: reviewValue.trim() };
            const response = await fetch(`/api/admin/generation-operations/${reviewingTask.type}/${encodeURIComponent(reviewingTask.id)}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const payload = (await response.json().catch(() => ({}))) as { msg?: string };
            if (!response.ok) throw new Error(payload.msg || t("reviewFailed"));
            message.success(reviewAction === "confirm_failed" ? t("reviewSuccessFailed") : t("reviewSuccessContinue"));
            setReviewingTask(undefined);
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("reviewFailed"));
        } finally {
            setReviewing(false);
        }
    };

    const columns = useMemo<TableColumnsType<AdminGenerationTask>>(
        () => [
            {
                title: t("table.task"),
                dataIndex: "id",
                width: 260,
                render: (_, task) => (
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <TaskTypeTag type={task.type} t={t} />
                            <StatusTag status={task.status} t={t} />
                            {task.canReview ? <ReviewTag t={t} /> : null}
                        </div>
                        <Tooltip title={task.id}>
                            <div className="mt-2 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{task.id}</div>
                        </Tooltip>
                    </div>
                ),
            },
            {
                title: t("table.user"),
                width: 210,
                render: (_, task) => <AdminUserIdentity displayName={task.displayName} username={task.username} accountId={task.accountId} fallback={t("userUnavailable")} />,
            },
            {
                title: t("table.modelEntry"),
                width: 190,
                render: (_, task) => (
                    <div>
                        <div className="truncate text-sm">{task.model || t("unrecorded")}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                            {surfaceLabel(task.surface, t)}
                            {task.channelId ? ` · ${t("channelPrefix", { id: task.channelId })}` : ""}
                            {task.projectId ? ` · ${t("projectPrefix", { id: task.projectId.slice(0, 8) })}` : ""}
                        </div>
                    </div>
                ),
            },
            {
                title: t("table.request"),
                render: (_, task) => (
                    <div>
                        <div className="line-clamp-2 text-sm leading-5">{task.prompt || task.error || t("noPromptSummary")}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                            {formatDuration(task.durationMs, t)} · {t("pointsCost", { count: task.pointsCost })}
                            {task.attempts && task.attempts.length > 1 ? ` · ${t("attempts", { count: task.attempts.length })}` : ""}
                        </div>
                    </div>
                ),
            },
            {
                title: t("table.actions"),
                width: 118,
                fixed: "right",
                render: (_, task) => (
                    <div className="flex gap-1">
                        {task.canCancel ? (
                            <Tooltip title={t("cancelTask")}>
                                <Button danger type="text" shape="circle" icon={<CircleStop className="size-4" />} loading={actingId === `${task.id}:cancel`} onClick={() => void runAction(task, "cancel")} />
                            </Tooltip>
                        ) : null}
                        {task.retryTaskId ? (
                            <Tooltip title={t("retryFailedSubtask")}>
                                <Button type="text" shape="circle" icon={<RotateCcw className="size-4" />} loading={actingId === `${task.id}:retry`} onClick={() => void runAction(task, "retry")} />
                            </Tooltip>
                        ) : null}
                        {task.canReview ? (
                            <Tooltip title={t("reviewTask")}>
                                <Button aria-label={t("reviewTask")} type="text" shape="circle" icon={<ShieldAlert className="size-4 text-amber-600 dark:text-amber-300" />} onClick={() => openReview(task)} />
                            </Tooltip>
                        ) : null}
                    </div>
                ),
            },
        ],
        [actingId, t],
    );

    const summary = data?.summary;
    return (
        <>
            <div className="space-y-3 sm:space-y-4">
                <Panel>
                    <PanelHeader
                        title={t("overviewTitle")}
                        description={t("overviewDescription")}
                        actions={
                            <Button aria-label={t("refreshAria")} icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void load()}>
                                {t("refresh")}
                            </Button>
                        }
                    />
                    <section className="grid grid-cols-2 gap-px bg-zinc-200 dark:bg-zinc-800 sm:grid-cols-3 xl:grid-cols-6">
                        <SummaryMetric icon={<Activity />} label={t("metrics.total")} value={summary?.total || 0} detail={t("metrics.totalDetail")} />
                        <SummaryMetric icon={<Route />} label={t("metrics.active")} value={summary?.active || 0} detail={t("metrics.activeDetail")} />
                        <SummaryMetric icon={<CircleCheckBig />} label={t("metrics.success")} value={summary?.success || 0} detail={t("metrics.successDetail")} />
                        <SummaryMetric icon={<CircleStop />} label={t("metrics.failed")} value={summary?.failed || 0} detail={t("metrics.failedDetail")} tone="danger" />
                        <SummaryMetric icon={<Clock3 />} label={t("metrics.avgDuration")} value={formatDuration(summary?.averageDurationMs || 0, t)} detail={t("metrics.avgDurationDetail")} />
                        <SummaryMetric icon={<Coins />} label={t("metrics.pointsCost")} value={summary?.totalPointsCost || 0} detail={t("metrics.pointsCostDetail")} />
                    </section>
                </Panel>

                {data?.agentPerformance.sampleSize ? (
                    <Panel>
                        <PanelHeader
                            title={t("agentPerfTitle")}
                            description={t("agentPerfDescription")}
                            actions={<Tag className={generationOperationThemeClasses.neutralTag}>{t("agentPerfSamples", { count: data.agentPerformance.sampleSize })}</Tag>}
                        />
                        <section className="grid grid-cols-2 gap-px bg-zinc-200 dark:bg-zinc-800 sm:grid-cols-4 xl:grid-cols-7">
                            <PerformanceValue label={t("agentPerf.planningP50")} value={data.agentPerformance.planningP50Ms} detail={t("agentPerf.planningP50Detail")} t={t} />
                            <PerformanceValue label={t("agentPerf.planningP95")} value={data.agentPerformance.planningP95Ms} detail={t("agentPerf.planningP95Detail")} t={t} />
                            <PerformanceValue label={t("agentPerf.firstResultP50")} value={data.agentPerformance.firstResultP50Ms} detail={t("agentPerf.firstResultP50Detail")} t={t} />
                            <PerformanceValue label={t("agentPerf.firstResultP95")} value={data.agentPerformance.firstResultP95Ms} detail={t("agentPerf.firstResultP95Detail")} t={t} />
                            <PerformanceValue label={t("agentPerf.queueAverage")} value={data.agentPerformance.queueAverageMs} detail={t("agentPerf.queueAverageDetail")} t={t} />
                            <PerformanceValue label={t("agentPerf.upstreamAverage")} value={data.agentPerformance.upstreamAverageMs} detail={t("agentPerf.upstreamAverageDetail")} t={t} />
                            <PerformanceValue className="col-span-2 sm:col-span-1" label={t("agentPerf.reviewAverage")} value={data.agentPerformance.reviewAverageMs} detail={t("agentPerf.reviewAverageDetail")} t={t} />
                        </section>
                    </Panel>
                ) : null}

                <Panel>
                    <PanelHeader title={t("queueTitle")} description={t("queueDescription", { count: data?.total || 0 })} />
                    <section className="border-b border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-4">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-[minmax(280px,1fr)_repeat(3,minmax(140px,180px))] xl:gap-3">
                            <Input.Search
                                className="col-span-2 sm:col-span-3 xl:col-span-1"
                                value={search}
                                allowClear
                                aria-label={t("searchAria")}
                                placeholder={t("searchPlaceholder")}
                                enterButton={t("query")}
                                onChange={(event) => setSearch(event.target.value)}
                                onSearch={(value) => {
                                    setPage(1);
                                    setSubmittedSearch(value.trim());
                                }}
                            />
                            <div className="min-w-0">
                                <Select
                                    className="w-full"
                                    aria-label={t("typeFilterAria")}
                                    value={type || undefined}
                                    allowClear
                                    placeholder={t("typePlaceholder")}
                                    options={["agent", "text", "image", "video", "audio", "render"].map((value) => ({ value, label: taskTypeLabel(value, t) }))}
                                    onChange={(value) => {
                                        setPage(1);
                                        setType(value || "");
                                    }}
                                />
                            </div>
                            <div className="min-w-0">
                                <Select
                                    className="w-full"
                                    aria-label={t("statusFilterAria")}
                                    value={status || undefined}
                                    allowClear
                                    placeholder={t("statusPlaceholder")}
                                    options={["pending", "running", "paused", "success", "error", "cancelled"].map((value) => ({ value, label: statusLabel(value, t) }))}
                                    onChange={(value) => {
                                        setPage(1);
                                        setStatus(value || "");
                                    }}
                                />
                            </div>
                            <div className="col-span-2 min-w-0 sm:col-span-1">
                                <Select
                                    className="w-full"
                                    aria-label={t("surfaceFilterAria")}
                                    value={surface || undefined}
                                    allowClear
                                    placeholder={t("surfacePlaceholder")}
                                    options={[
                                        { value: "chat", label: t("surfaces.chat") },
                                        { value: "canvas", label: t("surfaces.canvas") },
                                        { value: "drama", label: t("surfaces.drama") },
                                    ]}
                                    onChange={(value) => {
                                        setPage(1);
                                        setSurface(value || "");
                                    }}
                                />
                            </div>
                        </div>
                    </section>

                    <section className="min-w-0 p-3 sm:p-4">
                        <div className="hidden overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 md:block">
                            <Table rowKey="id" size="middle" loading={loading} columns={columns} dataSource={data?.items || []} pagination={false} scroll={{ x: 980 }} />
                        </div>
                        <div className="space-y-3 md:hidden">
                            {(data?.items || []).map((task) => (
                                <TaskCard key={task.id} task={task} actingId={actingId} onAction={runAction} onReview={openReview} t={t} />
                            ))}
                            {loading ? <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">{t("loading")}</div> : null}
                            {!loading && !data?.items.length ? <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">{t("empty")}</div> : null}
                        </div>
                        <div className="mt-4 flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-900">
                            <Pagination current={page} pageSize={PAGE_SIZE} total={data?.total || 0} showSizeChanger={false} responsive onChange={setPage} />
                        </div>
                    </section>
                </Panel>

                <Panel>
                    <PanelHeader title={t("channelHealth")} description={t("channelHealthDescription")} />
                    <section className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2">
                        {(data?.channels || []).map((channel) => {
                            const state = health[channelKey(channel)];
                            return (
                                <article key={channelKey(channel)} className="min-w-0 rounded-lg border border-zinc-200 p-3.5 dark:border-zinc-800">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">{channel.name}</span>
                                                <Tag className={generationOperationThemeClasses.neutralTag}>{taskTypeLabel(channel.capability, t)}</Tag>
                                                {!channel.enabled ? <Tag className={generationOperationThemeClasses.neutralTag}>{t("disabled")}</Tag> : null}
                                                {channel.runtimeHealth.status === "cooling" ? <Tag className={generationOperationThemeClasses.reviewTag}>{t("cooling")}</Tag> : null}
                                            </div>
                                            <div className="mt-2 truncate text-xs text-zinc-500 dark:text-zinc-400">
                                                {channel.logicalModelName} → {channel.upstreamModel}
                                            </div>
                                        </div>
                                        <Button className={generationOperationThemeClasses.secondaryButton} size="small" disabled={!channel.enabled} loading={state?.loading} onClick={() => void testChannel(channel)}>
                                            {t("probe")}
                                        </Button>
                                    </div>
                                    {channel.runtimeHealth.status === "cooling" ? <div className="mt-3 line-clamp-2 text-xs leading-5 text-amber-700 dark:text-amber-300">{channel.runtimeHealth.lastError || t("coolingFallback")}</div> : null}
                                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-900 dark:text-zinc-400">
                                        {channel.planningRuntime ? (
                                            <span>
                                                {t("planningSample", {
                                                    protocol: planningProtocolLabel(channel.planningRuntime.protocol, t),
                                                    latency: formatDuration(channel.planningRuntime.averageLatencyMs || 0, t),
                                                    success: channel.planningRuntime.successCount,
                                                    failure: channel.planningRuntime.failureCount,
                                                })}
                                            </span>
                                        ) : (
                                            <span>{t("noPlanningSample")}</span>
                                        )}
                                        {state && !state.loading ? (
                                            <Tag className={generationOperationStatusTagClass(state.ok ? "success" : "error")}>
                                                {state.ok ? t("probeOk", { status: state.status || "" }) : state.error || t("probeError")}
                                            </Tag>
                                        ) : null}
                                    </div>
                                </article>
                            );
                        })}
                        {!loading && !data?.channels.length ? <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400 lg:col-span-2">{t("noChannels")}</div> : null}
                    </section>
                </Panel>
            </div>

            <Modal
                open={Boolean(reviewingTask)}
                title={t("reviewModalTitle")}
                centered
                width="min(520px, calc(100vw - 24px))"
                okText={reviewAction === "confirm_failed" ? t("reviewOkConfirmFailed") : t("reviewOkContinue")}
                okButtonProps={{ danger: reviewAction === "confirm_failed", disabled: reviewAction !== "confirm_failed" && !reviewValue.trim(), className: reviewAction === "confirm_failed" ? undefined : generationOperationThemeClasses.primaryButton }}
                cancelButtonProps={{ className: generationOperationThemeClasses.secondaryButton }}
                confirmLoading={reviewing}
                destroyOnHidden
                onOk={() => void submitReview()}
                onCancel={() => !reviewing && setReviewingTask(undefined)}
            >
                <div className="space-y-4 pt-2">
                    <div className={generationOperationThemeClasses.reviewPanel}>{t("reviewHint")}</div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { value: "resume_upstream", label: t("reviewAction.resumeUpstream") },
                            { value: "provide_result", label: reviewingTask?.type === "text" ? t("reviewAction.provideResultText") : t("reviewAction.provideResultUrl") },
                            { value: "confirm_failed", label: t("reviewAction.confirmFailed") },
                        ].map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                className={`min-h-10 rounded-lg border px-2 text-xs font-medium transition-colors sm:text-sm ${reviewAction === item.value ? generationOperationThemeClasses.selectedAction : generationOperationThemeClasses.idleAction}`}
                                onClick={() => {
                                    setReviewAction(item.value as typeof reviewAction);
                                    setReviewValue(item.value === "resume_upstream" ? reviewingTask?.upstreamTaskId || "" : "");
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <Input.TextArea
                        className={generationOperationThemeClasses.textarea}
                        value={reviewValue}
                        autoSize={{ minRows: reviewAction === "provide_result" && reviewingTask?.type === "text" ? 4 : 2, maxRows: 8 }}
                        placeholder={
                            reviewAction === "resume_upstream"
                                ? t("reviewPlaceholder.upstreamTaskId")
                                : reviewAction === "provide_result"
                                  ? reviewingTask?.type === "text"
                                      ? t("reviewPlaceholder.resultText")
                                      : t("reviewPlaceholder.resultUrl")
                                  : t("reviewPlaceholder.failReason")
                        }
                        onChange={(event) => setReviewValue(event.target.value)}
                    />
                    <div className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {t("reviewTaskMeta", {
                            id: reviewingTask?.id || "",
                            type: taskTypeLabel(reviewingTask?.type || "", t),
                            phase: executionPhaseLabel(reviewingTask?.executionPhase, t),
                        })}
                    </div>
                </div>
            </Modal>
        </>
    );
}

function planningProtocolLabel(protocol: "responses" | "chat" | "gemini" | "custom" | undefined, t: GenerationOpsTranslator) {
    if (protocol === "responses") return "Responses";
    if (protocol === "gemini") return "Gemini";
    if (protocol === "custom") return t("protocols.custom");
    return "Chat";
}

function SummaryMetric({ icon, label, value, detail, tone = "default" }: { icon: React.ReactNode; label: string; value: string | number; detail: string; tone?: "default" | "danger" }) {
    return (
        <div className="flex min-h-[94px] min-w-0 flex-col justify-between bg-white p-3 dark:bg-zinc-950 sm:min-h-28 sm:p-4">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 sm:text-xs">{label}</span>
                <span className={`[&>svg]:size-4 ${tone === "danger" ? "text-red-600 dark:text-red-300" : "text-zinc-400 dark:text-zinc-500"}`}>{icon}</span>
            </div>
            <div>
                <div className="truncate text-xl font-semibold leading-none tabular-nums text-zinc-950 dark:text-zinc-100 sm:text-2xl">{value}</div>
                <div className="mt-1.5 truncate text-[10px] text-zinc-400 dark:text-zinc-500 sm:text-[11px]">{detail}</div>
            </div>
        </div>
    );
}

function PerformanceValue({ label, value, detail, className = "", t }: { label: string; value: number; detail: string; className?: string; t: GenerationOpsTranslator }) {
    return (
        <div className={`min-h-[82px] min-w-0 bg-white p-3 dark:bg-zinc-950 sm:min-h-24 sm:p-4 ${className}`}>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
            <div className="mt-2 truncate text-base font-semibold tabular-nums text-zinc-950 dark:text-zinc-100 sm:text-lg">{formatDuration(value, t)}</div>
            <div className="mt-1 truncate text-[10px] text-zinc-400 dark:text-zinc-500">{detail}</div>
        </div>
    );
}

function TaskCard({
    task,
    actingId,
    onAction,
    onReview,
    t,
}: {
    task: AdminGenerationTask;
    actingId: string;
    onAction: (task: AdminGenerationTask, action: "cancel" | "retry") => Promise<void>;
    onReview: (task: AdminGenerationTask) => void;
    t: GenerationOpsTranslator;
}) {
    return (
        <article className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap gap-1.5">
                    <TaskTypeTag type={task.type} t={t} />
                    <StatusTag status={task.status} t={t} />
                    {task.canReview ? <ReviewTag t={t} /> : null}
                </div>
                <div className="flex shrink-0 gap-0.5">
                    {task.canCancel ? (
                        <Tooltip title={t("cancelTask")}>
                            <Button aria-label={t("cancelTask")} danger type="text" shape="circle" icon={<CircleStop className="size-4" />} loading={actingId === `${task.id}:cancel`} onClick={() => void onAction(task, "cancel")} />
                        </Tooltip>
                    ) : null}
                    {task.retryTaskId ? (
                        <Tooltip title={t("retryFailedSubtask")}>
                            <Button aria-label={t("retryFailedSubtask")} type="text" shape="circle" icon={<RotateCcw className="size-4" />} loading={actingId === `${task.id}:retry`} onClick={() => void onAction(task, "retry")} />
                        </Tooltip>
                    ) : null}
                    {task.canReview ? (
                        <Tooltip title={t("reviewTask")}>
                            <Button aria-label={t("reviewTask")} type="text" shape="circle" icon={<ShieldAlert className="size-4 text-amber-600 dark:text-amber-300" />} onClick={() => onReview(task)} />
                        </Tooltip>
                    ) : null}
                </div>
            </div>
            <Tooltip title={task.id}>
                <div className="mt-2 truncate font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{task.id}</div>
            </Tooltip>
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
                <AdminUserIdentity displayName={task.displayName} username={task.username} accountId={task.accountId} fallback={t("userUnavailable")} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-zinc-100 py-3 text-xs dark:border-zinc-900">
                <TaskCardFact label={t("card.model")} value={task.model || t("unrecorded")} />
                <TaskCardFact label={t("card.surface")} value={surfaceLabel(task.surface, t)} />
                <TaskCardFact label={t("card.duration")} value={formatDuration(task.durationMs, t)} />
                <TaskCardFact label={t("card.points")} value={t("pointsCost", { count: task.pointsCost })} />
            </div>
            <div className="mt-3">
                <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">{t("card.promptSummary")}</div>
                <p className="mt-1 line-clamp-3 text-sm leading-5 text-zinc-700 dark:text-zinc-300">{task.prompt || task.error || t("noPromptSummary")}</p>
            </div>
        </article>
    );
}

function TaskCardFact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{label}</div>
            <div className="mt-0.5 truncate text-zinc-700 dark:text-zinc-300">{value}</div>
        </div>
    );
}

function StatusTag({ status, t }: { status: string; t: GenerationOpsTranslator }) {
    return <Tag className={generationOperationStatusTagClass(status)}>{statusLabel(status, t)}</Tag>;
}

function TaskTypeTag({ type, t }: { type: string; t: GenerationOpsTranslator }) {
    return <Tag className={generationOperationThemeClasses.neutralTag}>{taskTypeLabel(type, t)}</Tag>;
}

function ReviewTag({ t }: { t: GenerationOpsTranslator }) {
    return <Tag className={generationOperationThemeClasses.reviewTag}>{t("needsReview")}</Tag>;
}

function taskTypeLabel(value: string, t: GenerationOpsTranslator) {
    const map: Record<string, string> = {
        agent: t("types.agent"),
        text: t("types.text"),
        image: t("types.image"),
        video: t("types.video"),
        audio: t("types.audio"),
        render: t("types.render"),
    };
    return map[value] || value;
}

function statusLabel(value: string, t: GenerationOpsTranslator) {
    const map: Record<string, string> = {
        pending: t("statuses.pending"),
        running: t("statuses.running"),
        paused: t("statuses.paused"),
        success: t("statuses.success"),
        error: t("statuses.error"),
        cancelled: t("statuses.cancelled"),
    };
    return map[value] || value;
}

function surfaceLabel(value: string | undefined, t: GenerationOpsTranslator) {
    if (value === "canvas") return t("surfaces.canvas");
    if (value === "drama") return t("surfaces.drama");
    if (value === "chat") return t("surfaces.chat");
    return t("surfaces.workbench");
}

function formatDuration(ms: number, t: GenerationOpsTranslator) {
    if (!ms) return t("duration.zero");
    return ms < 60_000
        ? t("duration.seconds", { count: Math.max(1, Math.round(ms / 1000)) })
        : t("duration.minutesSeconds", { minutes: Math.floor(ms / 60_000), seconds: Math.round((ms % 60_000) / 1000) });
}

function channelKey(channel: AdminGenerationChannel) {
    return `${channel.id}:${channel.capability}:${channel.logicalModelId}:${channel.upstreamModel}`;
}

function executionPhaseLabel(value: AdminGenerationTask["executionPhase"] | undefined, t: GenerationOpsTranslator) {
    const map: Record<string, string> = {
        created: t("phases.created"),
        submitting: t("phases.submitting"),
        submitted: t("phases.submitted"),
        polling: t("phases.polling"),
        result_ready: t("phases.result_ready"),
        persisting: t("phases.persisting"),
        needs_review: t("phases.needs_review"),
        completed: t("phases.completed"),
    };
    return map[value || ""] || t("unrecorded");
}
