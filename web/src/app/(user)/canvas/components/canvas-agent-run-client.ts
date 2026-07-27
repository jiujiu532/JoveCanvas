import type { CanvasAgentOp } from "../utils/canvas-agent-ops";
import type { CanvasAgentRunStage, CanvasAgentStableStageKey } from "./canvas-agent-progress";

type CanvasT = (key: string, values?: Record<string, string | number>) => string;

type RunHandlers = {
    onPlan: (ops: CanvasAgentOp[], reply: string) => void;
    onAssistant: (text: string, detail?: { nodeIds?: string[]; taskType?: "text" | "image" | "video" | "audio"; runId?: string; taskId?: string; title?: string }) => void;
    onStage: (stage: CanvasAgentRunStage) => void;
    onPaused: (paused: boolean) => void;
    onOps: (ops: CanvasAgentOp[]) => void;
};

// 测试与无 React 调用点默认中文文案，保证现有断言继续通过
const ZH_RUN_MESSAGES: Record<string, string> = {
    "run.planning": "正在理解需求并分析当前画布",
    "run.skills": "正在匹配合适的创作技能",
    "run.planAdded": "创作计划已添加到画布，后台正在执行任务。",
    "run.planReady": "文本执行计划已生成，正在准备任务",
    "run.taskFallback": "创作任务",
    "run.executing": "正在执行「{title}」",
    "run.executingAttempt": "正在执行「{title}」（第 {attempt} 次）",
    "run.taskCompleted": "「{title}」已完成，正在继续处理。",
    "run.taskFailed": "「{title}」执行失败：{error}",
    "run.serviceUnavailable": "生成服务暂时不可用",
    "run.reviewRetry": "发现可优化内容，正在重新生成",
    "run.reviewPassed": "检查完成，正在整理结果",
    "run.reviewUnavailable": "正在整理已完成结果",
    "run.allCompleted": "创作计划与后台生成任务已全部完成。",
    "run.runFailed": "Agent 执行失败",
    "run.taskCancelled": "Agent 任务已取消。",
    "run.paused": "任务已暂停",
    "run.resumed": "任务已恢复，正在继续执行",
    "run.snapshotCompleted": "Agent 任务已完成，结果已经返回。",
    "run.connectionLost": "Agent 事件连接多次重试后仍无法恢复",
    "run.reconnecting": "连接暂时中断，正在进行第 {count} 次自动恢复",
};

function defaultCanvasT(key: string, values?: Record<string, string | number>) {
    const template = ZH_RUN_MESSAGES[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (matched, name: string) => (name in values ? String(values[name]) : matched));
}

export function watchCanvasAgentRun(runId: string, handlers: RunHandlers, t: CanvasT = defaultCanvasT) {
    return new Promise<void>((resolve, reject) => {
        const stream = new EventSource(`/api/agent/runs/${encodeURIComponent(runId)}/events`);
        let appliedPlan = false;
        let connectionErrors = 0;
        let settled = false;
        let paused: boolean | undefined;
        let latestStageKey: CanvasAgentStableStageKey = "planning";
        let latestOutput: { nodeIds?: string[]; taskType?: "text" | "image" | "video" | "audio" } | undefined;
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

        stream.addEventListener("run.planning", () => reportStage({ key: "planning", text: t("run.planning") }));
        stream.addEventListener("skills.selected", () => reportStage({ key: "skills", text: t("run.skills") }));
        stream.addEventListener("canvas.ops", (event) => {
            const payload = read<{ data?: { ops?: CanvasAgentOp[]; reply?: string } }>(event);
            if (!appliedPlan && payload.data?.ops?.length) {
                appliedPlan = true;
                handlers.onPlan(payload.data.ops, payload.data.reply || t("run.planAdded"));
            }
            reportStage({ key: "plan", text: t("run.planReady") });
        });
        stream.addEventListener("task.running", (event) => {
            const payload = read<{ data?: { title?: string; attempts?: number } }>(event);
            const title = payload.data?.title || t("run.taskFallback");
            const attempt = payload.data?.attempts;
            reportStage({
                key: "executing",
                text: attempt ? t("run.executingAttempt", { title, attempt }) : t("run.executing", { title }),
            });
        });
        stream.addEventListener("task.completed", (event) => {
            const payload = read<{ data?: { message?: string; title?: string; outputNodeIds?: string[]; type?: "text" | "image" | "video" | "audio"; ops?: CanvasAgentOp[] } }>(event);
            if (payload.data?.ops?.length) handlers.onOps(payload.data.ops);
            latestOutput = { nodeIds: payload.data?.outputNodeIds, taskType: payload.data?.type };
            handlers.onAssistant(payload.data?.message || t("run.taskCompleted", { title: payload.data?.title || t("run.taskFallback") }), latestOutput);
        });
        stream.addEventListener("task.failed", (event) => {
            const payload = read<{ data?: { taskId?: string; title?: string; error?: string } }>(event);
            if (!payload.data?.taskId) return;
            latestFailedTask = { taskId: payload.data.taskId, title: payload.data.title };
            handlers.onAssistant(
                t("run.taskFailed", {
                    title: payload.data.title || t("run.taskFallback"),
                    error: payload.data.error || t("run.serviceUnavailable"),
                }),
                { taskType: undefined, nodeIds: [], ...latestFailedTask, runId },
            );
        });
        stream.addEventListener("run.review.retry", () => reportStage({ key: "reviewing", text: t("run.reviewRetry") }));
        stream.addEventListener("run.review.passed", () => reportStage({ key: "finalizing", text: t("run.reviewPassed") }));
        stream.addEventListener("run.review.unavailable", () => reportStage({ key: "finalizing", text: t("run.reviewUnavailable") }));
        stream.addEventListener("run.completed", (event) => {
            const payload = read<{ data?: { reply?: string } }>(event);
            handlers.onAssistant(payload.data?.reply || t("run.allCompleted"), latestOutput);
            finish();
        });
        stream.addEventListener("run.failed", (event) => {
            const payload = read<{ data?: { message?: string } }>(event);
            if (latestFailedTask) finish();
            else finish(new Error(payload.data?.message || t("run.runFailed")));
        });
        stream.addEventListener("run.cancelled", () => {
            handlers.onAssistant(t("run.taskCancelled"));
            finish();
        });
        stream.addEventListener("run.paused", () => {
            setPaused(true);
            reportStage({ key: "paused", text: t("run.paused") });
        });
        stream.addEventListener("run.resumed", () => {
            setPaused(false);
            reportStage({ key: "executing", text: t("run.resumed") });
        });
        stream.addEventListener("run.snapshot", (event) => {
            const payload = read<{ status?: string }>(event);
            if (payload.status === "cancelled") {
                handlers.onAssistant(t("run.taskCancelled"));
                finish();
            }
            if (payload.status === "completed") {
                handlers.onAssistant(t("run.snapshotCompleted"));
                finish();
            }
            if (payload.status === "failed") finish(new Error(t("run.runFailed")));
            if (payload.status === "paused") setPaused(true);
            if (payload.status === "planning" || payload.status === "running") setPaused(false);
        });
        stream.onopen = () => {
            connectionErrors = 0;
        };
        stream.onerror = () => {
            if (settled) return;
            connectionErrors += 1;
            if (connectionErrors >= 5) finish(new Error(t("run.connectionLost")));
            else reportStage({ key: "reconnecting", resumeKey: latestStageKey, text: t("run.reconnecting", { count: connectionErrors }) });
        };
    });
}
