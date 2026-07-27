export type WorkbenchAgentProgressPhase = "planning" | "submitting" | "completed" | "failed" | "cancelled";
export type WorkbenchAgentProgressStepStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type WorkbenchAgentProgress = {
    phase: WorkbenchAgentProgressPhase;
    hasReferences: boolean;
    referenceRequired?: boolean;
    shouldGenerate?: boolean;
    intent?: "conversation" | "generation";
    failedAt?: "planning" | "submitting";
};

export type WorkbenchAgentChoice = {
    label: string;
    description: string;
    prompt?: string;
    action?: "prompt" | "upload";
};

export type WorkbenchAgentMessage = {
    id: string;
    sequence?: number;
    role: "user" | "assistant" | "warning" | "error";
    text: string;
    progress?: WorkbenchAgentProgress;
    choices?: WorkbenchAgentChoice[];
};

export type WorkbenchAgentSession = {
    id: string;
    recordId?: string;
    creativeConversationId?: string;
    title: string;
    messages: WorkbenchAgentMessage[];
    prompt: string;
    lastPrompt: string;
    searchText?: string;
    loaded?: boolean;
    hasOlderMessages?: boolean;
    oldestSequence?: number;
    updatedAt: number;
};

type ProgressStepKey = "brief" | "direction" | "deliverables" | "submit" | "review";

type ProgressStep = {
    key: ProgressStepKey;
    label: string;
    status: WorkbenchAgentProgressStepStatus;
};

export type WorkbenchAgentProgressLabels = {
    brief: string;
    direction: string;
    deliverables: string;
    submit: string;
    review: string;
    planning: string;
    submitting: string;
    failed: string;
    cancelled: string;
    replied: string;
    analysisDone: string;
    ready: string;
    initialText: string;
};

// 默认中文文案：供 vitest 与非 React 调用点回落；UI 渲染时传入 t() 结果
export const DEFAULT_WORKBENCH_AGENT_PROGRESS_LABELS: WorkbenchAgentProgressLabels = {
    brief: "理解当前需求与参考素材",
    direction: "检查创作约束",
    deliverables: "准备生成任务",
    submit: "创建生成任务",
    review: "整理生成结果",
    planning: "正在理解并规划",
    submitting: "正在创建生成任务",
    failed: "Agent 执行失败",
    cancelled: "本次执行已取消",
    replied: "已回复",
    analysisDone: "已完成需求分析",
    ready: "创作任务已就绪",
    initialText: "正在理解你的需求。",
};

const stepKeys: ProgressStepKey[] = ["brief", "direction", "deliverables", "submit", "review"];

export function workbenchAgentProgressSteps(progress: WorkbenchAgentProgress, labels: WorkbenchAgentProgressLabels = DEFAULT_WORKBENCH_AGENT_PROGRESS_LABELS): ProgressStep[] {
    const stepDefinitions = stepKeys.map((key) => ({ key, label: labels[key] }));
    if (progress.intent === "conversation" || (progress.phase === "planning" && !progress.intent)) {
        return [{ ...stepDefinitions[0], status: progress.phase === "completed" ? "completed" : progress.phase === "failed" ? "failed" : progress.phase === "cancelled" ? "cancelled" : "running" }];
    }
    const visible = stepDefinitions.filter((step) => progress.shouldGenerate !== false || step.key === "brief" || step.key === "direction" || step.key === "deliverables");
    if (progress.phase === "completed") return visible.map((step) => ({ ...step, status: "completed" }));

    const activeKey = progress.phase === "submitting" || progress.failedAt === "submitting" ? "submit" : progress.failedAt === "planning" ? "direction" : "brief";
    const activeIndex = visible.findIndex((step) => step.key === activeKey);
    return visible.map((step, index) => ({
        ...step,
        status: index < activeIndex ? "completed" : index > activeIndex ? "pending" : progress.phase === "failed" ? "failed" : progress.phase === "cancelled" ? "cancelled" : "running",
    }));
}

export function workbenchAgentProgressHeading(progress: WorkbenchAgentProgress, labels: WorkbenchAgentProgressLabels = DEFAULT_WORKBENCH_AGENT_PROGRESS_LABELS) {
    if (progress.phase === "planning") return labels.planning;
    if (progress.phase === "submitting") return labels.submitting;
    if (progress.phase === "failed") return labels.failed;
    if (progress.phase === "cancelled") return labels.cancelled;
    if (progress.intent === "conversation") return labels.replied;
    return progress.shouldGenerate === false ? labels.analysisDone : labels.ready;
}

export function createWorkbenchAgentProgressMessage(id: string, hasReferences: boolean, labels: WorkbenchAgentProgressLabels = DEFAULT_WORKBENCH_AGENT_PROGRESS_LABELS): WorkbenchAgentMessage {
    return {
        id,
        role: "assistant",
        text: labels.initialText,
        progress: { phase: "planning", hasReferences },
    };
}

export function appendWorkbenchAgentRequest(messages: WorkbenchAgentMessage[], text: string, progress: WorkbenchAgentMessage): WorkbenchAgentMessage[] {
    const normalized = text.trim();
    const lastUserMessage = messages.findLast((message) => message.role === "user");
    const next = lastUserMessage?.text.trim() === normalized ? messages : [...messages, { id: `${progress.id}-user`, role: "user" as const, text: normalized }];
    return [...next, progress];
}

export function updateWorkbenchAgentProgress(messages: WorkbenchAgentMessage[], id: string, progress: WorkbenchAgentProgress, text?: string, choices?: WorkbenchAgentChoice[]): WorkbenchAgentMessage[] {
    return messages.map((message) =>
        message.id === id
            ? {
                  ...message,
                  role: progress.phase === "failed" ? "error" : progress.phase === "cancelled" ? "warning" : "assistant",
                  text: text ?? message.text,
                  progress,
                  ...(choices ? { choices } : {}),
              }
            : message,
    );
}

export function applyWorkbenchAgentPlan(messages: WorkbenchAgentMessage[], id: string, reply: string, choices?: WorkbenchAgentChoice[]): WorkbenchAgentMessage[] {
    const response: WorkbenchAgentMessage = { id, role: "assistant", text: reply, choices };
    return messages.map((message) => (message.id === id ? response : message));
}

export function updateWorkbenchAgentResponse(messages: WorkbenchAgentMessage[], id: string, text: string, role: "assistant" | "warning" | "error" = "assistant"): WorkbenchAgentMessage[] {
    return messages.map((message) => (message.id === id ? { ...message, role, text, progress: undefined, choices: undefined } : message));
}
