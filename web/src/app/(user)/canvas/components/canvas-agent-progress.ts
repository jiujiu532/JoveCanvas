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

export type CanvasAgentProgressLabels = Record<CanvasAgentProgressStep["key"], string>;

export const DEFAULT_CANVAS_AGENT_PROGRESS_LABELS: CanvasAgentProgressLabels = {
    canvas: "理解当前需求",
    skills: "检查素材与能力",
    plan: "准备执行任务",
    execute: "执行生成任务",
    review: "检查生成结果",
    deliver: "整理生成结果",
};

export function canvasAgentProgressLabelsFromT(t: (key: string) => string): CanvasAgentProgressLabels {
    return {
        canvas: t("progress.canvas"),
        skills: t("progress.skills"),
        plan: t("progress.plan"),
        execute: t("progress.execute"),
        review: t("progress.review"),
        deliver: t("progress.deliver"),
    };
}

const STEP_KEYS: Array<CanvasAgentProgressStep["key"]> = ["canvas", "skills", "plan", "execute", "review", "deliver"];

export function canvasAgentProgressSteps(stage: CanvasAgentRunStage, labels: CanvasAgentProgressLabels = DEFAULT_CANVAS_AGENT_PROGRESS_LABELS): CanvasAgentProgressStep[] {
    const activeKey = stage.key === "reconnecting" ? stage.resumeKey || "planning" : stage.key;
    const activeIndex = activeKey === "planning" ? 0 : activeKey === "skills" ? 1 : activeKey === "plan" ? 2 : activeKey === "executing" || activeKey === "paused" ? 3 : activeKey === "reviewing" ? 4 : 5;
    return STEP_KEYS.map((key, index) => ({
        key,
        label: labels[key],
        status: index < activeIndex ? "completed" : index > activeIndex ? "pending" : activeKey === "paused" ? "paused" : "running",
    }));
}
