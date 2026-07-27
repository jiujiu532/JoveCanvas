"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { nanoid } from "nanoid";
import { useTranslations } from "next-intl";
import type { CreativeDeliverableSummary, CreativeFoundation } from "@/lib/creative-agent-contract";
import { DEFAULT_AGENT_MESSAGE_FORMAT_LABELS, formatAgentMessageText, type AgentMessageFormatLabels } from "@/components/agent/agent-message-format";
import { refreshUserPointsIfSystem } from "@/services/api/points";

import {
    appendWorkbenchAgentRequest,
    applyWorkbenchAgentPlan,
    createWorkbenchAgentProgressMessage,
    DEFAULT_WORKBENCH_AGENT_PROGRESS_LABELS,
    updateWorkbenchAgentResponse,
    updateWorkbenchAgentProgress,
    type WorkbenchAgentChoice,
    type WorkbenchAgentMessage,
} from "@/components/agent/workbench-agent-progress";

export type WorkbenchAgentWorkspace = "image" | "video";
export type WorkbenchAgentReferenceType = "image" | "video" | "audio";
export type WorkbenchAgentParameterPatch = Partial<Record<"model" | "size" | "quality" | "count" | "vquality" | "videoSeconds", string | number>>;

type AgentRunStage = "planning" | "submitting";
export type WorkbenchCreativeReviewContext = { recordId: string; foundation: CreativeFoundation; deliverables: CreativeDeliverableSummary[] };
type PendingAgentGenerate = {
    messageId: string;
    hasReferences: boolean;
    resolvedPrompt: string;
    parameterPatch: WorkbenchAgentParameterPatch;
    conversationId: string;
    foundation?: CreativeFoundation;
    deliverables: CreativeDeliverableSummary[];
};
type WorkbenchAgentPlanPayload = {
    intent?: unknown;
    parameterPatch?: unknown;
    resolvedPrompt?: unknown;
    shouldGenerate?: unknown;
    reply?: unknown;
    choices?: unknown;
    referenceRequired?: unknown;
    foundation?: unknown;
    deliverables?: unknown;
};

type UseWorkbenchAgentRunOptions = {
    workspace: WorkbenchAgentWorkspace;
    prompt: string;
    previousPrompt: string;
    models: string[];
    modelIds: string[];
    skillIds: string[];
    smartPlanning: boolean;
    currentConfig: Record<string, unknown>;
    hasReferences: boolean;
    referenceTypes: WorkbenchAgentReferenceType[];
    conversationId?: string;
    ensureCreativeConversation: () => Promise<string>;
    setPrompt: (value: string) => void;
    setLastAgentPrompt: (value: string) => void;
    setAgentMessages: Dispatch<SetStateAction<WorkbenchAgentMessage[]>>;
    applyParameterPatch: (patch: WorkbenchAgentParameterPatch) => void;
    submitGeneration: (input: { promptOverride: string; signal: AbortSignal; parameterPatch: WorkbenchAgentParameterPatch; conversationId: string }) => Promise<string | null | undefined>;
    onManualModelRequired?: () => void;
};

export function useWorkbenchAgentRun({
    workspace,
    prompt,
    previousPrompt,
    models,
    modelIds,
    skillIds,
    smartPlanning,
    currentConfig,
    hasReferences,
    referenceTypes,
    conversationId,
    ensureCreativeConversation,
    setPrompt,
    setLastAgentPrompt,
    setAgentMessages,
    applyParameterPatch,
    submitGeneration,
    onManualModelRequired,
}: UseWorkbenchAgentRunOptions) {
    const t = useTranslations("layout");
    const [agentRunning, setAgentRunning] = useState(false);
    const [pendingAgentGenerate, setPendingAgentGenerate] = useState<PendingAgentGenerate | null>(null);
    const [creativeReviewContext, setCreativeReviewContext] = useState<WorkbenchCreativeReviewContext | null>(null);
    const agentRequestRef = useRef<{ messageId: string; controller: AbortController; stage: AgentRunStage } | null>(null);
    const mediaLabel = t(`agent.mediaLabel.${workspace}`);
    const runLabels = useMemo<WorkbenchAgentRunLabels>(
        () => ({
            parseFailed: t("agent.workbenchRun.parseFailed"),
            understood: t("agent.workbenchRun.understood"),
            generating: t("agent.workbenchRun.generating"),
            planFailed: t("agent.workbenchRun.planFailed", { media: mediaLabel }),
            stopped: t("agent.workbenchRun.stopped"),
            submitted: t("agent.workbenchRun.submitted", { media: mediaLabel }),
            createFailed: t("agent.workbenchRun.createFailed", { media: mediaLabel }),
            createNotReady: t("agent.workbenchRun.createNotReady", { media: mediaLabel }),
            planningIncomplete: t("agent.workbenchRun.planningIncomplete"),
            submitFailed: t("agent.workbenchRun.submitFailed", { media: mediaLabel }),
            reasonPrefix: (message) => t("agent.workbenchRun.reasonPrefix", { message }),
            reasonUnknown: t("agent.workbenchRun.reasonUnknown"),
            hintTextModel: t("agent.workbenchRun.hintTextModel"),
            hintVideoModel: t("agent.workbenchRun.hintVideoModel"),
            hintReference: t("agent.workbenchRun.hintReference"),
            hintGeneral: t("agent.workbenchRun.hintGeneral"),
            initialText: t("agent.progress.initialText"),
            format: {
                default: t("agent.errors.default"),
                insufficientPoints: t("agent.errors.insufficientPoints"),
                partialTaskFailure: t("agent.errors.partialTaskFailure"),
                modelUnavailable: t("agent.errors.modelUnavailable"),
                taskRunning: t("agent.errors.taskRunning"),
                taskCompleted: t("agent.errors.taskCompleted"),
            },
        }),
        [mediaLabel, t],
    );

    const runAgentGenerate = useCallback(async () => {
        const text = prompt.trim();
        if (!text || agentRequestRef.current) return;
        if (workbenchRequiresManualModel(smartPlanning, modelIds)) {
            onManualModelRequired?.();
            return;
        }
        const progressId = nanoid();
        const controller = new AbortController();
        setPendingAgentGenerate(null);
        setCreativeReviewContext(null);
        agentRequestRef.current = { messageId: progressId, controller, stage: "planning" };
        setPrompt("");
        setAgentMessages((items) => appendWorkbenchAgentRequest(items, text, createWorkbenchAgentProgressMessage(progressId, hasReferences, { ...DEFAULT_WORKBENCH_AGENT_PROGRESS_LABELS, initialText: runLabels.initialText })));
        setAgentRunning(true);
        try {
            const sharedConversationId = conversationId || (await ensureCreativeConversation());
            const response = await fetch("/api/agent/workbench", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({ requestId: progressId, workspace, conversationId: sharedConversationId, prompt: text, previousPrompt, models, modelIds, skillIds, smartPlanning, currentConfig, hasReferences, referenceTypes }),
            });
            const payload = (await response.json().catch(() => ({}))) as { data?: WorkbenchAgentPlanPayload; msg?: string };
            if (!response.ok || !payload.data) throw new Error(payload.msg || runLabels.parseFailed);
            if (controller.signal.aborted || agentRequestRef.current?.messageId !== progressId) return;

            const patch = normalizeParameterPatch(payload.data.parameterPatch);
            applyParameterPatch(patch);
            const resolvedPrompt = typeof payload.data.resolvedPrompt === "string" && payload.data.resolvedPrompt.trim() ? payload.data.resolvedPrompt : text;
            setLastAgentPrompt(resolvedPrompt);
            const shouldGenerate = payload.data.shouldGenerate !== false;
            const reply = typeof payload.data.reply === "string" && payload.data.reply.trim() ? payload.data.reply : runLabels.understood;
            const choices = Array.isArray(payload.data.choices) ? (payload.data.choices as WorkbenchAgentChoice[]) : [];
            const intent = payload.data.intent === "conversation" ? "conversation" : "generation";
            const foundation = payload.data.foundation && typeof payload.data.foundation === "object" ? (payload.data.foundation as CreativeFoundation) : undefined;
            const deliverables = Array.isArray(payload.data.deliverables) ? (payload.data.deliverables as CreativeDeliverableSummary[]) : [];
            setAgentMessages((items) => applyWorkbenchAgentPlan(items, progressId, shouldGenerate ? runLabels.generating : reply, choices));
            if (shouldGenerate) {
                if (agentRequestRef.current?.messageId === progressId) agentRequestRef.current.stage = "submitting";
                setPendingAgentGenerate({ messageId: progressId, hasReferences, resolvedPrompt, parameterPatch: patch, conversationId: sharedConversationId, foundation: intent === "generation" ? foundation : undefined, deliverables });
            } else {
                agentRequestRef.current = null;
                setAgentRunning(false);
            }
        } catch (error) {
            if (agentRequestRef.current?.messageId !== progressId) return;
            const errorMessage = error instanceof Error ? error.message : runLabels.planFailed;
            const failure = buildWorkbenchAgentFailureUpdate({ aborted: controller.signal.aborted, failedAt: "planning", hasReferences, mediaLabel, errorMessage, labels: runLabels });
            setPendingAgentGenerate(null);
            setAgentMessages((items) => updateWorkbenchAgentProgress(items, progressId, failure.progress, failure.text));
            agentRequestRef.current = null;
            setAgentRunning(false);
        } finally {
            void refreshUserPointsIfSystem("system");
        }
    }, [
        applyParameterPatch,
        conversationId,
        currentConfig,
        ensureCreativeConversation,
        hasReferences,
        mediaLabel,
        models,
        modelIds,
        onManualModelRequired,
        previousPrompt,
        prompt,
        referenceTypes,
        runLabels,
        setAgentMessages,
        setLastAgentPrompt,
        setPrompt,
        skillIds,
        smartPlanning,
        workspace,
    ]);

    const cancelAgentRun = useCallback(() => {
        const active = agentRequestRef.current;
        if (!active) return;
        active.controller.abort();
        setPendingAgentGenerate(null);
        setAgentMessages((items) => updateWorkbenchAgentProgress(items, active.messageId, { phase: "cancelled", hasReferences, failedAt: active.stage }, runLabels.stopped));
        agentRequestRef.current = null;
        setAgentRunning(false);
    }, [hasReferences, runLabels.stopped, setAgentMessages]);

    useEffect(() => {
        if (!pendingAgentGenerate) return;
        const pending = pendingAgentGenerate;
        const active = agentRequestRef.current;
        setPendingAgentGenerate(null);
        if (!active || active.messageId !== pending.messageId || active.controller.signal.aborted) {
            setAgentRunning(false);
            return;
        }
        void submitGeneration({ promptOverride: pending.resolvedPrompt, signal: active.controller.signal, parameterPatch: pending.parameterPatch, conversationId: pending.conversationId })
            .then((recordId) => {
                if (active.controller.signal.aborted || agentRequestRef.current?.messageId !== pending.messageId) return;
                if (!recordId) throw new Error(runLabels.createNotReady);
                if (pending.foundation) setCreativeReviewContext({ recordId, foundation: pending.foundation, deliverables: pending.deliverables });
                setAgentMessages((items) => updateWorkbenchAgentResponse(items, pending.messageId, runLabels.submitted));
            })
            .catch((error) => {
                if (active.controller.signal.aborted) return;
                const errorMessage = error instanceof Error ? error.message : runLabels.createFailed;
                const failure = buildWorkbenchAgentFailureUpdate({ aborted: false, failedAt: "submitting", hasReferences: pending.hasReferences, shouldGenerate: true, mediaLabel, errorMessage, labels: runLabels });
                setAgentMessages((items) => updateWorkbenchAgentResponse(items, pending.messageId, failure.text, "error"));
            })
            .finally(() => {
                if (agentRequestRef.current?.messageId === pending.messageId) agentRequestRef.current = null;
                setAgentRunning(false);
            });
    }, [mediaLabel, pendingAgentGenerate, runLabels, setAgentMessages, submitGeneration]);

    return { agentRunning, runAgentGenerate, cancelAgentRun, creativeReviewContext };
}

export function workbenchRequiresManualModel(smartPlanning: boolean, modelIds: string[]) {
    return !smartPlanning && modelIds.length === 0;
}

export type WorkbenchAgentRunLabels = {
    parseFailed: string;
    understood: string;
    generating: string;
    planFailed: string;
    stopped: string;
    submitted: string;
    createFailed: string;
    createNotReady: string;
    planningIncomplete: string;
    submitFailed: string;
    reasonPrefix: (message: string) => string;
    reasonUnknown: string;
    hintTextModel: string;
    hintVideoModel: string;
    hintReference: string;
    hintGeneral: string;
    initialText: string;
    format: AgentMessageFormatLabels;
};

// 默认中文文案：纯函数单测与无翻译调用点回落
export const DEFAULT_WORKBENCH_AGENT_RUN_LABELS: WorkbenchAgentRunLabels = {
    parseFailed: "Agent 参数解析失败",
    understood: "已完成处理。",
    generating: "已理解需求，正在创建生成任务。",
    planFailed: "Agent 规划失败",
    stopped: "你已停止本轮 Agent，本次没有创建生成任务。",
    submitted: "已提交生成任务，结果会显示在工作区。",
    createFailed: "生成任务创建失败",
    createNotReady: "生成任务未能创建，请检查模型与参数",
    planningIncomplete: "规划没有完成，本次没有创建生成任务。",
    submitFailed: "任务没有创建成功，本次没有进入生成队列。",
    reasonPrefix: (message) => `原因：${message}`,
    reasonUnknown: "原因：未知错误",
    hintTextModel: "。请在后台模型渠道中确认默认文本模型已启用、绑定渠道有密钥，并重新发送需求。",
    hintVideoModel: "。请在后台确认视频逻辑模型和上游渠道可用，或切换到可用视频模型后重试。",
    hintReference: "。请重新上传参考素材、切换可用渠道，或选择无参考方案/只做方案。",
    hintGeneral: "。可以调整需求后重试；若持续失败，请检查后台模型渠道、额度和并发设置。",
    initialText: DEFAULT_WORKBENCH_AGENT_PROGRESS_LABELS.initialText,
    format: DEFAULT_AGENT_MESSAGE_FORMAT_LABELS,
};

export function buildWorkbenchAgentFailureUpdate({
    aborted,
    failedAt,
    hasReferences,
    shouldGenerate,
    mediaLabel,
    errorMessage,
    labels = DEFAULT_WORKBENCH_AGENT_RUN_LABELS,
}: {
    aborted: boolean;
    failedAt: "planning" | "submitting";
    hasReferences: boolean;
    shouldGenerate?: boolean;
    mediaLabel: string;
    errorMessage: string;
    labels?: WorkbenchAgentRunLabels;
}): { progress: { phase: "cancelled" | "failed"; hasReferences: boolean; shouldGenerate?: boolean; failedAt: "planning" | "submitting" }; text: string } {
    const baseProgress = { hasReferences, failedAt, ...(shouldGenerate === undefined ? {} : { shouldGenerate }) };
    if (aborted) {
        return {
            progress: { phase: "cancelled", ...baseProgress },
            text: labels.stopped,
        };
    }

    // 提交失败前缀在默认中文路径仍保留「{media}生成队列」句式，兼容既有断言
    const defaultSubmitFailed = `任务没有创建成功，本次没有进入${mediaLabel}生成队列。`;
    const prefix = failedAt === "planning" ? labels.planningIncomplete : labels === DEFAULT_WORKBENCH_AGENT_RUN_LABELS ? defaultSubmitFailed : labels.submitFailed;
    return {
        progress: { phase: "failed", ...baseProgress },
        text: `${prefix}${workbenchAgentRecoveryHint(errorMessage, labels)}`,
    };
}

function workbenchAgentRecoveryHint(errorMessage: string, labels: WorkbenchAgentRunLabels) {
    const message = formatAgentMessageText(errorMessage.trim(), labels.format);
    const reason = message ? labels.reasonPrefix(message) : labels.reasonUnknown;
    if (/默认文本模型|文本模型|规划失败|执行计划|default text model|planning failed/i.test(message)) return `${reason}${labels.hintTextModel}`;
    if (/视频模型|可用视频模型|video/i.test(message)) return `${reason}${labels.hintVideoModel}`;
    if (/参考|素材|公网|NEXT_PUBLIC_SITE_URL|reference/i.test(message)) return `${reason}${labels.hintReference}`;
    return `${reason}${labels.hintGeneral}`;
}

function normalizeParameterPatch(value: unknown): WorkbenchAgentParameterPatch {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const input = value as Record<string, unknown>;
    const patch: WorkbenchAgentParameterPatch = {};
    (["model", "size", "quality", "count", "vquality", "videoSeconds"] as const).forEach((key) => {
        const next = input[key];
        if (typeof next === "string" || typeof next === "number") patch[key] = next;
    });
    return patch;
}

export function mergeWorkbenchAgentPatch<T extends object>(config: T, patch: WorkbenchAgentParameterPatch | undefined, workspace: WorkbenchAgentWorkspace): T {
    const next: Record<string, unknown> = { ...(config as Record<string, unknown>) };
    if (!patch) return next as T;
    if (patch.size) next.size = String(patch.size);
    if (workspace === "image") {
        if (patch.model) next.imageModel = String(patch.model);
        if (patch.quality) next.quality = String(patch.quality);
        if (patch.count) next.count = String(patch.count);
    } else {
        if (patch.model) next.videoModel = String(patch.model);
        if (patch.vquality) next.vquality = String(patch.vquality);
        if (patch.videoSeconds) next.videoSeconds = String(patch.videoSeconds);
    }
    return next as T;
}
