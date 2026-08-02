import type { CanvasAgentOp } from "../utils/canvas-agent-ops";
import type { CanvasAgentRunStage, CanvasAgentStableStageKey } from "./canvas-agent-progress";

export type CanvasAgentRunLabels = {
    planning: string;
    skills: string;
    planAdded: string;
    planReady: string;
    taskFallback: string;
    executing: (title: string) => string;
    executingAttempt: (title: string, attempt: number) => string;
    taskCompleted: (title: string) => string;
    taskFailed: (title: string, error: string) => string;
    serviceUnavailable: string;
    reviewRetry: string;
    reviewPassed: string;
    reviewUnavailable: string;
    allCompleted: string;
    runFailed: string;
    taskCancelled: string;
    paused: string;
    resumed: string;
    snapshotCompleted: string;
    connectionLost: string;
    reconnecting: (count: number) => string;
    childProgress: (title: string, completed: number, total: number) => string;
    childProgressWithFailed: (title: string, completed: number, total: number, failed: number) => string;
    taskFailedTitle: string;
};

/** 默认中文回落：测试与非 React 调用点；组件侧传入 t() 结果 */
export const DEFAULT_CANVAS_AGENT_RUN_LABELS: CanvasAgentRunLabels = {
    planning: "正在理解需求并分析当前画布",
    skills: "正在匹配合适的创作技能",
    planAdded: "创作计划已添加到画布，后台正在执行任务。",
    planReady: "文本执行计划已生成，正在准备任务",
    taskFallback: "创作任务",
    executing: (title) => `正在执行「${title}」`,
    executingAttempt: (title, attempt) => `正在执行「${title}」（第 ${attempt} 次）`,
    taskCompleted: (title) => `「${title}」已完成，正在继续处理。`,
    taskFailed: (title, error) => `「${title}」执行失败：${error}`,
    serviceUnavailable: "生成服务暂时不可用",
    reviewRetry: "发现可优化内容，正在重新生成",
    reviewPassed: "检查完成，正在整理结果",
    reviewUnavailable: "正在整理已完成结果",
    allCompleted: "创作计划与后台生成任务已全部完成。",
    runFailed: "Agent 执行失败",
    taskCancelled: "Agent 任务已取消。",
    paused: "任务已暂停",
    resumed: "任务已恢复，正在继续执行",
    snapshotCompleted: "Agent 任务已完成，结果已经返回。",
    connectionLost: "Agent 事件连接多次重试后仍无法恢复",
    reconnecting: (count) => `连接暂时中断，正在进行第 ${count} 次自动恢复`,
    childProgress: (title, completed, total) => `「${title}」已完成 ${completed}/${total}`,
    childProgressWithFailed: (title, completed, total, failed) => `「${title}」已完成 ${completed}/${total}，失败 ${failed}`,
    taskFailedTitle: "创作任务失败",
};

export function canvasAgentRunLabelsFromT(t: (key: string, values?: Record<string, string | number>) => string): CanvasAgentRunLabels {
    return {
        planning: t("run.planning"),
        skills: t("run.skills"),
        planAdded: t("run.planAdded"),
        planReady: t("run.planReady"),
        taskFallback: t("run.taskFallback"),
        executing: (title) => t("run.executing", { title }),
        executingAttempt: (title, attempt) => t("run.executingAttempt", { title, attempt }),
        taskCompleted: (title) => t("run.taskCompleted", { title }),
        taskFailed: (title, error) => t("run.taskFailed", { title, error }),
        serviceUnavailable: t("run.serviceUnavailable"),
        reviewRetry: t("run.reviewRetry"),
        reviewPassed: t("run.reviewPassed"),
        reviewUnavailable: t("run.reviewUnavailable"),
        allCompleted: t("run.allCompleted"),
        runFailed: t("run.runFailed"),
        taskCancelled: t("run.taskCancelled"),
        paused: t("run.paused"),
        resumed: t("run.resumed"),
        snapshotCompleted: t("run.snapshotCompleted"),
        connectionLost: t("run.connectionLost"),
        reconnecting: (count) => t("run.reconnecting", { count }),
        childProgress: (title, completed, total) => t("run.childProgress", { title, completed, total }),
        childProgressWithFailed: (title, completed, total, failed) => t("run.childProgressWithFailed", { title, completed, total, failed }),
        taskFailedTitle: t("run.taskFailedTitle"),
    };
}

type RunHandlers = {
    onPlan: (ops: CanvasAgentOp[], reply: string) => void;
    onAssistant: (text: string, detail?: { nodeIds?: string[]; taskType?: "text" | "image" | "video" | "audio"; runId?: string; taskId?: string; title?: string }) => void;
    onStage: (stage: CanvasAgentRunStage) => void;
    onPaused: (paused: boolean) => void;
    onOps: (ops: CanvasAgentOp[]) => void;
};

export function watchCanvasAgentRun(runId: string, handlers: RunHandlers, labels: CanvasAgentRunLabels = DEFAULT_CANVAS_AGENT_RUN_LABELS) {
    return new Promise<void>((resolve, reject) => {
        const stream = new EventSource(`/api/agent/runs/${encodeURIComponent(runId)}/events`);
        let appliedPlan = false;
        let connectionErrors = 0;
        let settled = false;
        let paused: boolean | undefined;
        let latestStageKey: CanvasAgentStableStageKey = "planning";
        let latestOutput: { nodeIds?: string[]; taskType?: "text" | "image" | "video" | "audio" } | undefined;
        const completedOutputNodeIds = new Set<string>();
        let latestFailedTask: { taskId: string; title?: string } | undefined;
        const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            stream.close();
            if (error) reject(error);
            else resolve();
        };
        const read = <T>(event: Event) => JSON.parse((event as MessageEvent<string>).data) as T;
        const setPaused = (value: boolean) => {
            if (paused === value) return;
            paused = value;
            handlers.onPaused(value);
        };
        const reportStage = (stage: CanvasAgentRunStage) => {
            if (stage.key !== "reconnecting") latestStageKey = stage.key;
            handlers.onStage(stage);
        };
        const taskTitle = (title?: string) => title || labels.taskFallback;

        stream.addEventListener("run.planning", () => reportStage({ key: "planning", text: labels.planning }));
        stream.addEventListener("skills.selected", () => reportStage({ key: "skills", text: labels.skills }));
        stream.addEventListener("canvas.ops", (event) => {
            const payload = read<{ data?: { ops?: CanvasAgentOp[]; reply?: string } }>(event);
            if (!appliedPlan && payload.data?.ops?.length) {
                appliedPlan = true;
                handlers.onPlan(payload.data.ops, payload.data.reply || labels.planAdded);
            }
            reportStage({ key: "plan", text: labels.planReady });
        });
        stream.addEventListener("task.running", (event) => {
            const payload = read<{ data?: { title?: string; attempts?: number; ops?: CanvasAgentOp[] } }>(event);
            if (payload.data?.ops?.length) handlers.onOps(payload.data.ops);
            const title = taskTitle(payload.data?.title);
            reportStage({
                key: "executing",
                text: payload.data?.attempts ? labels.executingAttempt(title, payload.data.attempts) : labels.executing(title),
            });
        });
        stream.addEventListener("task.created", (event) => {
            const payload = read<{ data?: { ops?: CanvasAgentOp[] } }>(event);
            if (payload.data?.ops?.length) handlers.onOps(payload.data.ops);
        });
        stream.addEventListener("task.child.completed", (event) => {
            const payload = read<{ data?: ChildTaskEventData }>(event);
            if (payload.data?.ops?.length) handlers.onOps(payload.data.ops);
            for (const nodeId of payload.data?.outputNodeIds || []) completedOutputNodeIds.add(nodeId);
            latestOutput = { nodeIds: Array.from(completedOutputNodeIds), taskType: payload.data?.type };
            const progress = childProgressText(payload.data, labels);
            reportStage({ key: "executing", text: progress });
            handlers.onAssistant(progress, latestOutput);
        });
        stream.addEventListener("task.child.failed", (event) => {
            const payload = read<{ data?: ChildTaskEventData }>(event);
            if (payload.data?.ops?.length) handlers.onOps(payload.data.ops);
            const progress = childProgressText(payload.data, labels);
            reportStage({ key: "executing", text: progress });
            handlers.onAssistant(progress, latestOutput);
        });
        stream.addEventListener("task.completed", (event) => {
            const payload = read<{ data?: { message?: string; title?: string; outputNodeIds?: string[]; type?: "text" | "image" | "video" | "audio"; ops?: CanvasAgentOp[] } }>(event);
            if (payload.data?.ops?.length) handlers.onOps(payload.data.ops);
            latestOutput = { nodeIds: payload.data?.outputNodeIds, taskType: payload.data?.type };
            handlers.onAssistant(payload.data?.message || labels.taskCompleted(taskTitle(payload.data?.title)), latestOutput);
        });
        stream.addEventListener("task.failed", (event) => {
            const payload = read<{ data?: { taskId?: string; title?: string; error?: string; ops?: CanvasAgentOp[] } }>(event);
            if (payload.data?.ops?.length) handlers.onOps(payload.data.ops);
            if (!payload.data?.taskId) return;
            latestFailedTask = { taskId: payload.data.taskId, title: payload.data.title };
            handlers.onAssistant(labels.taskFailed(taskTitle(payload.data.title), payload.data.error || labels.serviceUnavailable), {
                taskType: undefined,
                nodeIds: [],
                ...latestFailedTask,
                runId,
            });
        });
        stream.addEventListener("task.retry.requested", (event) => {
            const payload = read<{ data?: { ops?: CanvasAgentOp[] } }>(event);
            if (payload.data?.ops?.length) handlers.onOps(payload.data.ops);
        });
        stream.addEventListener("run.review.retry", () => reportStage({ key: "reviewing", text: labels.reviewRetry }));
        stream.addEventListener("run.review.passed", () => reportStage({ key: "finalizing", text: labels.reviewPassed }));
        stream.addEventListener("run.review.unavailable", () => reportStage({ key: "finalizing", text: labels.reviewUnavailable }));
        stream.addEventListener("run.completed", (event) => {
            const payload = read<{ data?: { reply?: string } }>(event);
            handlers.onAssistant(payload.data?.reply || labels.allCompleted, latestOutput);
            finish();
        });
        stream.addEventListener("run.failed", (event) => {
            const payload = read<{ data?: { message?: string } }>(event);
            if (!latestFailedTask) handlers.onAssistant(payload.data?.message || labels.runFailed, { runId, title: labels.runFailed });
            finish();
        });
        stream.addEventListener("run.cancelled", (event) => {
            const payload = read<{ data?: { ops?: CanvasAgentOp[] } }>(event);
            if (payload.data?.ops?.length) handlers.onOps(payload.data.ops);
            handlers.onAssistant(labels.taskCancelled);
            finish();
        });
        stream.addEventListener("run.paused", () => {
            setPaused(true);
            reportStage({ key: "paused", text: labels.paused });
        });
        stream.addEventListener("run.resumed", () => {
            setPaused(false);
            reportStage({ key: "executing", text: labels.resumed });
        });
        stream.addEventListener("run.snapshot", (event) => {
            const payload = read<{ status?: string; tasks?: Array<{ id?: string; title?: string; status?: string; error?: string }> }>(event);
            if (payload.status === "cancelled") {
                handlers.onAssistant(labels.taskCancelled);
                finish();
            }
            if (payload.status === "completed") {
                handlers.onAssistant(labels.snapshotCompleted);
                finish();
            }
            if (payload.status === "failed") {
                const failed = payload.tasks?.find((task) => task.status === "failed" && task.id);
                if (!latestFailedTask && failed?.id) {
                    handlers.onAssistant(labels.taskFailed(taskTitle(failed.title), failed.error || labels.serviceUnavailable), {
                        runId,
                        taskId: failed.id,
                        title: failed.title || labels.taskFailedTitle,
                    });
                } else if (!latestFailedTask) handlers.onAssistant(labels.runFailed, { runId, title: labels.runFailed });
                finish();
            }
            if (payload.status === "paused") setPaused(true);
            if (payload.status === "planning" || payload.status === "running") setPaused(false);
        });
        stream.onopen = () => {
            connectionErrors = 0;
        };
        stream.onerror = () => {
            if (settled) return;
            connectionErrors += 1;
            if (connectionErrors >= 5) finish(new Error(labels.connectionLost));
            else reportStage({ key: "reconnecting", resumeKey: latestStageKey, text: labels.reconnecting(connectionErrors) });
        };
    });
}

type ChildTaskEventData = {
    title?: string;
    type?: "text" | "image" | "video" | "audio";
    completedCount?: number;
    failedCount?: number;
    totalCount?: number;
    outputNodeIds?: string[];
    ops?: CanvasAgentOp[];
};

function childProgressText(data: ChildTaskEventData | undefined, labels: CanvasAgentRunLabels) {
    const completed = nonNegativeCount(data?.completedCount);
    const failed = nonNegativeCount(data?.failedCount);
    const total = Math.max(1, nonNegativeCount(data?.totalCount));
    const title = data?.title || labels.taskFallback;
    return failed ? labels.childProgressWithFailed(title, completed, total, failed) : labels.childProgress(title, completed, total);
}

function nonNegativeCount(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}
