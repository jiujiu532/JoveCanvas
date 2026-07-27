const TECHNICAL_ERROR_PATTERN = /\{\s*"error"|request id|new_api_error|convert_request_failed|not available|backend-anon\/conversation failed/i;
const ACTIONABLE_ERROR_PATTERN =
    /积分不足|余额不足|请先登录|登录(?:状态)?(?:已)?失效|没有权限|无权访问|请求过于频繁|内容(?:不符合|未通过).*审核|Insufficient points|Please sign in|sign in first|not authorized|too many requests|content (?:policy|moderation)/i;

export type AgentMessageFormatLabels = {
    default: string;
    insufficientPoints: string;
    partialTaskFailure: string;
    modelUnavailable: string;
    taskRunning: string;
    taskCompleted: string;
};

// 默认中文回落：测试与非 React 调用点仍得到中文友好文案；组件侧传入 t() 结果
export const DEFAULT_AGENT_MESSAGE_FORMAT_LABELS: AgentMessageFormatLabels = {
    default: "Agent 暂时无法完成这次任务，请切换模型或稍后重试。",
    insufficientPoints: "积分不足",
    partialTaskFailure: "部分创作任务未能完成，请调整需求后重试。",
    modelUnavailable: "当前模型暂不可用，请切换模型或稍后重试。",
    taskRunning: "正在执行创作任务…",
    taskCompleted: "创作任务已完成。",
};

export function friendlyAgentError(value: unknown, fallback?: string, labels: AgentMessageFormatLabels = DEFAULT_AGENT_MESSAGE_FORMAT_LABELS) {
    const resolvedFallback = fallback ?? labels.default;
    const message = value instanceof Error ? value.message : typeof value === "string" ? value : "";
    const actionable = actionableErrorMessage(message, labels);
    if (actionable) return actionable;
    if (!message || TECHNICAL_ERROR_PATTERN.test(message)) return resolvedFallback;
    if (/任务依赖无法继续执行|dependent tasks cannot continue/i.test(message)) return labels.partialTaskFailure;
    return message;
}

export function formatAgentMessageText(text: string, labels: AgentMessageFormatLabels = DEFAULT_AGENT_MESSAGE_FORMAT_LABELS) {
    const actionable = actionableErrorMessage(text, labels);
    if (actionable) return actionable;
    if (TECHNICAL_ERROR_PATTERN.test(text)) return labels.modelUnavailable;
    const legacyTextResult = text.match(/^已完成 1 个创作任务。\s*「[^」]+」已完成：\s*\*\*(.+?)\*\*/s);
    if (legacyTextResult?.[1]) return legacyTextResult[1].trim();
    if (/^正在执行任务 task-[^（]+（第 \d+ 次）…?$/.test(text.trim())) return labels.taskRunning;
    if (text.trim() === "任务依赖无法继续执行") return labels.partialTaskFailure;
    if (text.trim() === "创作计划与后台生成任务已全部完成。") return labels.taskCompleted;
    return text;
}

function actionableErrorMessage(value: string, labels: AgentMessageFormatLabels) {
    const text = value.trim();
    if (!text.startsWith("{")) return normalizeActionableError(text, labels);
    try {
        const payload = JSON.parse(text) as Record<string, unknown>;
        const error = payload.error;
        const response = payload.response && typeof payload.response === "object" ? (payload.response as Record<string, unknown>) : undefined;
        const responseError = response?.error;
        const candidates = [payload.msg, payload.message, error, objectMessage(error), response?.msg, responseError, objectMessage(responseError)];
        return candidates.map((candidate) => (typeof candidate === "string" ? normalizeActionableError(candidate.trim(), labels) : "")).find(Boolean) || normalizeActionableError(text, labels);
    } catch {
        return "";
    }
}

function objectMessage(value: unknown) {
    return value && typeof value === "object" && typeof (value as { message?: unknown }).message === "string" ? String((value as { message: string }).message) : "";
}

function normalizeActionableError(message: string, labels: AgentMessageFormatLabels) {
    if (/积分不足|余额不足|Insufficient points/i.test(message)) return labels.insufficientPoints;
    return ACTIONABLE_ERROR_PATTERN.test(message) ? message : "";
}
