export type CanvasAgentStableStageKey = "planning" | "skills" | "plan" | "executing" | "reviewing" | "finalizing" | "paused";
export type CanvasAgentRunStageKey = CanvasAgentStableStageKey | "reconnecting";

export type CanvasAgentRunStage = {
    key: CanvasAgentRunStageKey;
    text: string;
    resumeKey?: CanvasAgentStableStageKey;
};

export type CanvasAgentProgressStep = {
    key: "canvas" | "skills" | "plan" | "execute" | "review" | "deliver";
    label: string;
    status: "pending" | "running" | "completed" | "paused";
};

type CanvasT = (key: string, values?: Record<string, string | number>) => string;

const STEP_KEYS: Array<CanvasAgentProgressStep["key"]> = ["canvas", "skills", "plan", "execute", "review", "deliver"];

// 测试与无 React 调用点默认中文文案
const ZH_PROGRESS_LABELS: Record<CanvasAgentProgressStep["key"], string> = {
    canvas: "理解当前需求",
    skills: "检查素材与能力",
    plan: "准备执行任务",
    execute: "执行生成任务",
    review: "检查生成结果",
    deliver: "整理生成结果",
};

function defaultProgressT(key: string) {
    const step = key.replace(/^progress\./, "") as CanvasAgentProgressStep["key"];
    return ZH_PROGRESS_LABELS[step] ?? key;
}

export function canvasAgentProgressSteps(stage: CanvasAgentRunStage, t: CanvasT = defaultProgressT): CanvasAgentProgressStep[] {
    const activeKey = stage.key === "reconnecting" ? stage.resumeKey || "planning" : stage.key;
    const activeIndex = activeKey === "planning" ? 0 : activeKey === "skills" ? 1 : activeKey === "plan" ? 2 : activeKey === "executing" || activeKey === "paused" ? 3 : activeKey === "reviewing" ? 4 : 5;
    return STEP_KEYS.map((key, index) => ({
        key,
        label: t(`progress.${key}`),
        status: index < activeIndex ? "completed" : index > activeIndex ? "pending" : activeKey === "paused" ? "paused" : "running",
    }));
}
