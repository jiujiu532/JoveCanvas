"use client";

import { App, Button, Input, Pagination, Select, Table, Tag, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { Activity, CircleStop, Clock3, Coins, RefreshCw, RotateCcw, Route, ServerCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Panel } from "@/components/admin/admin-panel";
import type { AdminGenerationChannel, AdminGenerationOperationsPayload, AdminGenerationTask } from "@/lib/admin-generation-operations";

const PAGE_SIZE = 20;

type AdminTranslator = ReturnType<typeof useTranslations<"admin">>;

export function GenerationOperationsClient() {
    const t = useTranslations("admin");
    const { message } = App.useApp();
    const [data, setData] = useState<AdminGenerationOperationsPayload>();
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [type, setType] = useState("");
    const [status, setStatus] = useState("");
    const [surface, setSurface] = useState("");
    const [search, setSearch] = useState("");
    const [submittedSearch, setSubmittedSearch] = useState("");
    const [actingId, setActingId] = useState("");
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
            if (!response.ok || !payload.data) throw new Error(payload.msg || t("generationOps.loadFailed"));
            setData(payload.data);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("generationOps.loadFailed"));
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
            if (!response.ok) throw new Error(payload.msg || payload.error || t("generationOps.actionFailed"));
            message.success(action === "retry" ? t("generationOps.retrySuccess") : t("generationOps.cancelSuccess"));
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("generationOps.actionFailed"));
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
            if (!response.ok || !payload.result) throw new Error(payload.error || t("generationOps.probeFailed"));
            setHealth((current) => ({ ...current, [key]: { ok: Boolean(payload.result?.ok), status: payload.result?.status, error: payload.result?.error } }));
        } catch (error) {
            setHealth((current) => ({ ...current, [key]: { ok: false, error: error instanceof Error ? error.message : t("generationOps.probeFailed") } }));
        }
    };

    const columns = useMemo<TableColumnsType<AdminGenerationTask>>(
        () => [
            {
                title: t("generationOps.table.task"),
                dataIndex: "id",
                width: 260,
                render: (_, task) => (
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <Tag className="m-0">{taskTypeLabel(task.type, t)}</Tag>
                            <StatusTag status={task.status} t={t} />
                        </div>
                        <Tooltip title={task.id}>
                            <div className="mt-2 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{task.id}</div>
                        </Tooltip>
                    </div>
                ),
            },
            {
                title: t("generationOps.table.user"),
                width: 150,
                render: (_, task) => (
                    <div>
                        <div className="text-sm font-medium">{task.displayName}</div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{task.username || task.userId}</div>
                    </div>
                ),
            },
            {
                title: t("generationOps.table.modelEntry"),
                width: 190,
                render: (_, task) => (
                    <div>
                        <div className="truncate text-sm">{task.model || t("generationOps.unrecorded")}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                            {surfaceLabel(task.surface, t)}
                            {task.channelId ? ` · ${t("generationOps.channelPrefix", { id: task.channelId })}` : ""}
                            {task.projectId ? ` · ${t("generationOps.projectPrefix", { id: task.projectId.slice(0, 8) })}` : ""}
                        </div>
                    </div>
                ),
            },
            {
                title: t("generationOps.table.request"),
                render: (_, task) => (
                    <div>
                        <div className="line-clamp-2 text-sm leading-5">{task.prompt || task.error || t("generationOps.noPromptSummary")}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                            {formatDuration(task.durationMs, t)} · {t("generationOps.pointsCost", { count: task.pointsCost })}
                            {task.attempts && task.attempts.length > 1 ? ` · ${t("generationOps.attempts", { count: task.attempts.length })}` : ""}
                        </div>
                    </div>
                ),
            },
            {
                title: t("generationOps.table.actions"),
                width: 118,
                fixed: "right",
                render: (_, task) => (
                    <div className="flex gap-1">
                        {task.canCancel ? (
                            <Tooltip title={t("generationOps.cancelTask")}>
                                <Button danger type="text" shape="circle" icon={<CircleStop className="size-4" />} loading={actingId === `${task.id}:cancel`} onClick={() => void runAction(task, "cancel")} />
                            </Tooltip>
                        ) : null}
                        {task.retryTaskId ? (
                            <Tooltip title={t("generationOps.retryFailedSubtask")}>
                                <Button type="text" shape="circle" icon={<RotateCcw className="size-4" />} loading={actingId === `${task.id}:retry`} onClick={() => void runAction(task, "retry")} />
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
        <Panel>
            <section className="grid grid-cols-2 gap-px border-b border-zinc-200 bg-zinc-200 p-px dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3 xl:grid-cols-5">
                <Metric icon={<Activity />} label={t("generationOps.metrics.total")} value={summary?.total || 0} />
                <Metric icon={<Route />} label={t("generationOps.metrics.active")} value={summary?.active || 0} />
                <Metric icon={<CircleStop />} label={t("generationOps.metrics.failed")} value={summary?.failed || 0} />
                <Metric icon={<Clock3 />} label={t("generationOps.metrics.avgDuration")} value={formatDuration(summary?.averageDurationMs || 0, t)} />
                <Metric className="col-span-2 sm:col-span-1" icon={<Coins />} label={t("generationOps.metrics.pointsCost")} value={summary?.totalPointsCost || 0} />
            </section>

            <section className="p-3 sm:p-5">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(130px,180px))_auto] md:gap-3">
                    <Input.Search
                        className="col-span-2 md:col-span-1"
                        value={search}
                        allowClear
                        placeholder={t("generationOps.searchPlaceholder")}
                        enterButton={t("generationOps.filter")}
                        onChange={(event) => setSearch(event.target.value)}
                        onSearch={(value) => {
                            setPage(1);
                            setSubmittedSearch(value.trim());
                        }}
                    />
                    <Select
                        value={type || undefined}
                        allowClear
                        placeholder={t("generationOps.typePlaceholder")}
                        options={["agent", "text", "image", "video", "audio", "render"].map((value) => ({ value, label: taskTypeLabel(value, t) }))}
                        onChange={(value) => {
                            setPage(1);
                            setType(value || "");
                        }}
                    />
                    <Select
                        value={status || undefined}
                        allowClear
                        placeholder={t("generationOps.statusPlaceholder")}
                        options={["pending", "running", "paused", "success", "error", "cancelled"].map((value) => ({ value, label: statusLabel(value, t) }))}
                        onChange={(value) => {
                            setPage(1);
                            setStatus(value || "");
                        }}
                    />
                    <Select
                        className="col-span-2 md:col-span-1"
                        value={surface || undefined}
                        allowClear
                        placeholder={t("generationOps.surfacePlaceholder")}
                        options={[
                            { value: "chat", label: t("generationOps.surfaces.chat") },
                            { value: "canvas", label: t("generationOps.surfaces.canvas") },
                            { value: "drama", label: t("generationOps.surfaces.drama") },
                        ]}
                        onChange={(value) => {
                            setPage(1);
                            setSurface(value || "");
                        }}
                    />
                    <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void load()}>
                        {t("generationOps.refresh")}
                    </Button>
                </div>

                <div className="mt-4 hidden overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 md:block">
                    <Table rowKey="id" size="middle" loading={loading} columns={columns} dataSource={data?.items || []} pagination={false} scroll={{ x: 980 }} />
                </div>
                <div className="mt-4 space-y-3 md:hidden">
                    {(data?.items || []).map((task) => (
                        <TaskCard key={task.id} task={task} actingId={actingId} onAction={runAction} t={t} />
                    ))}
                    {!loading && !data?.items.length ? <div className="py-6 text-center text-sm text-zinc-500 sm:py-16">{t("generationOps.empty")}</div> : null}
                </div>
                <Pagination className="mt-5 justify-end" current={page} pageSize={PAGE_SIZE} total={data?.total || 0} showSizeChanger={false} onChange={setPage} />
            </section>

            <section className="border-t border-zinc-200 p-4 dark:border-zinc-800 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
                    <ServerCog className="size-4" />
                    <h2 className="font-semibold">{t("generationOps.channelHealth")}</h2>
                    <span className="basis-full text-xs text-zinc-500 sm:basis-auto">{t("generationOps.channelHealthHint")}</span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                    {(data?.channels || []).map((channel) => {
                        const state = health[channelKey(channel)];
                        return (
                            <div key={channelKey(channel)} className="flex min-w-0 items-center gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium">{channel.name}</span>
                                        <Tag className="m-0">{taskTypeLabel(channel.capability, t)}</Tag>
                                        {!channel.enabled ? <Tag color="default">{t("generationOps.disabled")}</Tag> : null}
                                        {channel.runtimeHealth.status === "cooling" ? <Tag color="warning">{t("generationOps.cooling")}</Tag> : null}
                                    </div>
                                    <div className="mt-1 truncate text-xs text-zinc-500">
                                        {channel.logicalModelName} → {channel.upstreamModel}
                                    </div>
                                    {channel.runtimeHealth.status === "cooling" ? <div className="mt-1 truncate text-xs text-amber-600 dark:text-amber-300">{channel.runtimeHealth.lastError || t("generationOps.coolingFallback")}</div> : null}
                                </div>
                                {state && !state.loading ? <Tag color={state.ok ? "success" : "error"}>{state.ok ? t("generationOps.healthy", { status: state.status || "" }) : state.error || t("generationOps.unhealthy")}</Tag> : null}
                                <Button size="small" disabled={!channel.enabled} loading={state?.loading} onClick={() => void testChannel(channel)}>
                                    {t("generationOps.probe")}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </section>
        </Panel>
    );
}

function Metric({ icon, label, value, className = "" }: { icon: React.ReactNode; label: string; value: string | number; className?: string }) {
    return (
        <div className={`flex min-h-16 items-center gap-2 bg-white px-3 py-2 dark:bg-zinc-950 ${className}`}>
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-600 [&>svg]:size-4 dark:bg-zinc-900 dark:text-zinc-300">{icon}</span>
            <div className="min-w-0">
                <div className="text-xs text-zinc-500">{label}</div>
                <div className="mt-0.5 truncate text-base font-semibold sm:text-lg">{value}</div>
            </div>
        </div>
    );
}

function TaskCard({ task, actingId, onAction, t }: { task: AdminGenerationTask; actingId: string; onAction: (task: AdminGenerationTask, action: "cancel" | "retry") => Promise<void>; t: AdminTranslator }) {
    return (
        <article className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <Tag>{taskTypeLabel(task.type, t)}</Tag>
                    <StatusTag status={task.status} t={t} />
                </div>
                <div className="flex gap-1">
                    {task.canCancel ? <Button danger type="text" shape="circle" icon={<CircleStop className="size-4" />} loading={actingId === `${task.id}:cancel`} onClick={() => void onAction(task, "cancel")} /> : null}
                    {task.retryTaskId ? <Button type="text" shape="circle" icon={<RotateCcw className="size-4" />} loading={actingId === `${task.id}:retry`} onClick={() => void onAction(task, "retry")} /> : null}
                </div>
            </div>
            <div className="mt-3 font-mono text-xs text-zinc-500">{task.id}</div>
            <div className="mt-2 text-sm">
                {task.displayName} · {task.model || t("generationOps.unrecordedModel")}
            </div>
            <p className="mt-2 line-clamp-3 text-sm leading-5 text-zinc-600 dark:text-zinc-300">{task.prompt || task.error || t("generationOps.noPromptSummary")}</p>
            <div className="mt-3 text-xs text-zinc-500">
                {surfaceLabel(task.surface, t)} · {formatDuration(task.durationMs, t)} · {t("generationOps.pointsCost", { count: task.pointsCost })}
            </div>
        </article>
    );
}

function StatusTag({ status, t }: { status: string; t: AdminTranslator }) {
    const color = status === "success" ? "success" : status === "error" ? "error" : status === "running" ? "processing" : status === "paused" ? "warning" : "default";
    return <Tag color={color}>{statusLabel(status, t)}</Tag>;
}

function taskTypeLabel(value: string, t: AdminTranslator) {
    const map: Record<string, string> = {
        agent: t("generationOps.types.agent"),
        text: t("generationOps.types.text"),
        image: t("generationOps.types.image"),
        video: t("generationOps.types.video"),
        audio: t("generationOps.types.audio"),
        render: t("generationOps.types.render"),
    };
    return map[value] || value;
}

function statusLabel(value: string, t: AdminTranslator) {
    const map: Record<string, string> = {
        pending: t("generationOps.statuses.pending"),
        running: t("generationOps.statuses.running"),
        paused: t("generationOps.statuses.paused"),
        success: t("generationOps.statuses.success"),
        error: t("generationOps.statuses.error"),
        cancelled: t("generationOps.statuses.cancelled"),
    };
    return map[value] || value;
}

function surfaceLabel(value: string | undefined, t: AdminTranslator) {
    if (value === "canvas") return t("generationOps.surfaces.canvas");
    if (value === "drama") return t("generationOps.surfaces.drama");
    if (value === "chat") return t("generationOps.surfaces.chat");
    return t("generationOps.surfaces.workbench");
}

function formatDuration(ms: number, t: AdminTranslator) {
    if (!ms) return t("generationOps.duration.zero");
    return ms < 60_000 ? t("generationOps.duration.seconds", { count: Math.max(1, Math.round(ms / 1000)) }) : t("generationOps.duration.minutesSeconds", { minutes: Math.floor(ms / 60_000), seconds: Math.round((ms % 60_000) / 1000) });
}

function channelKey(channel: AdminGenerationChannel) {
    return `${channel.id}:${channel.capability}:${channel.logicalModelId}:${channel.upstreamModel}`;
}
