"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, History, PanelRightClose, Pause, Play, Plus, Square, Trash2, X } from "lucide-react";
import { Button, Modal, Tooltip } from "antd";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";

import { canvasThemes } from "@/lib/canvas-theme";
import { nanoid } from "nanoid";
import { refreshUserPointsIfSystem } from "@/services/api/points";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { usePublicSessionStore } from "@/stores/use-public-session-store";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { DiaTextReveal } from "@/components/ui/dia-text-reveal";
import { CreativeAgentControls, CreativeAgentSkillCard, type CreativeAgentModelOption } from "@/components/agent/creative-agent-controls";
import { useCreativeAgentOptions } from "@/hooks/use-creative-agent-options";
import { CanvasPromptLibrary } from "./canvas-prompt-library";
import { watchCanvasAgentRun } from "./canvas-agent-run-client";
import type { CanvasAgentRunStage } from "./canvas-agent-progress";
import { formatAgentMessageText, friendlyAgentError } from "@/components/agent/agent-message-format";
import { AgentChatComposer, AgentChatMessage, AgentPanelTabs, AgentWorkingMessage, type CanvasAgentChatMessage } from "./canvas-agent-chat-ui";
import { CANVAS_AGENT_PANEL_MOTION_MS } from "./canvas-agent-panel-motion";
import { CanvasNodeType, type CanvasAssistantMessage, type CanvasAssistantReference, type CanvasAssistantSession, type CanvasNodeData } from "../types";
import type { CanvasAgentOp, CanvasAgentSnapshot } from "../utils/canvas-agent-ops";

const PANEL_MOTION_SECONDS = CANVAS_AGENT_PANEL_MOTION_MS / 1000;
type OnlineAgentTab = "chat" | "history";

type CanvasAssistantPanelProps = {
    conversationId?: string;
    nodes: CanvasNodeData[];
    selectedNodeIds: Set<string>;
    snapshot: CanvasAgentSnapshot;
    sessions: CanvasAssistantSession[];
    activeSessionId: string | null;
    onSelectNodeIds: (ids: Set<string>) => void;
    onSessionsChange: (sessions: CanvasAssistantSession[], activeSessionId: string | null) => void;
    onConversationChange: (conversationId: string) => void;
    onApplyOps: (ops?: CanvasAgentOp[]) => CanvasAgentSnapshot;
    onLocateNode: (nodeId: string) => void;
    onPasteImage: (file: File) => void;
    closing: boolean;
    onCollapse: () => void;
};

import {
    AssistantHistory,
    MessageReferences,
    AssistantReferenceChip,
    assistantImageReferenceLabel,
    assistantMessageToChatMessage,
    formatSessionTime,
    sessionPreview,
    nodeToReference,
    buildAssistantReferences,
    compactSnapshot,
    compactMetadata,
    createSession,
} from "./canvas-assistant-elements";

export function CanvasAssistantPanel({
    conversationId,
    nodes,
    selectedNodeIds,
    snapshot,
    sessions,
    activeSessionId,
    onSelectNodeIds,
    onSessionsChange,
    onConversationChange,
    onApplyOps,
    onLocateNode,
    onPasteImage,
    closing,
    onCollapse,
}: CanvasAssistantPanelProps) {
    const t = useTranslations("canvas");
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const user = useUserStore((state) => state.user);
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { title: "JoveCanvas", logoUrl: "/logo.svg" };
    const { skills, skillsLoading, models } = useCreativeAgentOptions("canvas");
    const [width, setWidth] = useState(520);
    const [view, setView] = useState<OnlineAgentTab>("chat");
    const [prompt, setPrompt] = useState("");
    const [selectedSkillId, setSelectedSkillId] = useState<string>();
    const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
    const [smartPlanning, setSmartPlanning] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [activeRunId, setActiveRunId] = useState("");
    const [runPaused, setRunPaused] = useState(false);
    const [runStage, setRunStage] = useState<CanvasAgentRunStage>({ key: "planning", text: t("panel.understanding") });
    const [deleteChatIds, setDeleteChatIds] = useState<string[]>([]);
    const [resizing, setResizing] = useState(false);
    const [removedReferenceIds, setRemovedReferenceIds] = useState<Set<string>>(new Set());
    const [localSessions, setLocalSessions] = useState<CanvasAssistantSession[]>(sessions);
    const [localActiveSessionId, setLocalActiveSessionId] = useState<string | null>(activeSessionId);
    const snapshotRef = useRef(snapshot);
    const restoredRunRef = useRef("");
    const sessionsKey = useMemo(() => JSON.stringify(sessions), [sessions]);
    const localSessionsKey = useMemo(() => JSON.stringify(localSessions), [localSessions]);

    useEffect(() => {
        setLocalSessions(sessions);
        setLocalActiveSessionId(activeSessionId);
    }, [activeSessionId, sessions]);

    useEffect(() => {
        snapshotRef.current = snapshot;
    }, [snapshot]);

    useEffect(() => {
        if (localActiveSessionId === activeSessionId && localSessionsKey === sessionsKey) return;
        onSessionsChange(localSessions, localActiveSessionId);
    }, [activeSessionId, localActiveSessionId, localSessions, localSessionsKey, onSessionsChange, sessionsKey]);

    const activeSession = useMemo(() => localSessions.find((session) => session.id === localActiveSessionId) || localSessions[0] || null, [localActiveSessionId, localSessions]);
    const historySessions = localSessions.filter((session) => session.messages.length > 0);
    const messages = activeSession?.messages || [];
    const hasMessages = messages.length > 0;
    const selectedNodeKey = useMemo(() => Array.from(selectedNodeIds).sort().join(","), [selectedNodeIds]);
    const allSelectedReferences = useMemo(() => buildAssistantReferences(nodes, selectedNodeIds), [nodes, selectedNodeIds]);
    const selectedReferences = useMemo(() => allSelectedReferences.filter((item) => !removedReferenceIds.has(item.id)), [allSelectedReferences, removedReferenceIds]);
    const selectedSkill = skills.find((skill) => skill.id === selectedSkillId);
    const selectedModels = models.filter((model) => selectedModelIds.includes(model.id));
    const iconButtonStyle = { color: theme.node.muted };
    const controlTheme = { panel: theme.toolbar.panel, border: theme.node.stroke, text: theme.node.text, muted: theme.node.muted, activeBackground: theme.toolbar.activeBg, activeText: theme.toolbar.activeText };

    useEffect(() => {
        setRemovedReferenceIds(new Set());
    }, [selectedNodeKey]);

    const updateSession = (sessionId: string, updater: (session: CanvasAssistantSession) => CanvasAssistantSession) => {
        setLocalSessions((prev) => prev.map((session) => (session.id === sessionId ? updater(session) : session)));
    };

    const appendMessage = (sessionId: string, message: CanvasAssistantMessage) => {
        updateSession(sessionId, (session) => ({
            ...session,
            title: session.messages.length ? session.title : message.text.slice(0, 18) || t("panel.newChat"),
            messages: [...session.messages, message],
            updatedAt: new Date().toISOString(),
        }));
    };

    const upsertMessage = (sessionId: string, message: CanvasAssistantMessage) => {
        updateSession(sessionId, (session) => {
            const exists = session.messages.some((item) => item.id === message.id);
            return {
                ...session,
                title: session.messages.length ? session.title : message.text.slice(0, 18) || t("panel.newChat"),
                messages: exists ? session.messages.map((item) => (item.id === message.id ? { ...item, ...message } : item)) : [...session.messages, message],
                updatedAt: new Date().toISOString(),
            };
        });
    };

    const startChatSession = () => {
        setSelectedSkillId(undefined);
        setSelectedModelIds([]);
        setSmartPlanning(true);
        if (activeSession && activeSession.messages.length === 0) {
            setLocalActiveSessionId(activeSession.id);
            return;
        }
        const session = createSession(t("panel.newChat"));
        setLocalSessions((prev) => [session, ...prev]);
        setLocalActiveSessionId(session.id);
    };

    const removeSessions = (ids: string[]) => {
        const next = localSessions.filter((session) => !ids.includes(session.id));
        if (!next.length) {
            setLocalSessions([]);
            setLocalActiveSessionId(null);
        } else {
            setLocalSessions(next);
            setLocalActiveSessionId(localActiveSessionId && ids.includes(localActiveSessionId) ? next[0].id : localActiveSessionId);
        }
    };

    const clearSessions = () => {
        setLocalSessions([]);
        setLocalActiveSessionId(null);
    };

    const sendMessage = async (text: string, savedReferences?: CanvasAssistantReference[]) => {
        const session = activeSession || createSession(t("panel.newChat"));
        if (!activeSession) {
            setLocalSessions([session]);
            setLocalActiveSessionId(session.id);
        }

        const refs = savedReferences || selectedReferences;
        const userMessage: CanvasAssistantMessage = { id: nanoid(), role: "user", text, references: refs };
        const assistantId = nanoid();
        appendMessage(session.id, userMessage);
        upsertMessage(session.id, { id: assistantId, role: "assistant", text: t("panel.receivedPlan") });
        setRunStage({ key: "planning", text: t("panel.understanding") });
        setIsRunning(true);
        try {
            const response = await fetch("/api/agent/runs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientRequestId: nanoid(),
                    surface: "canvas",
                    conversationId,
                    projectId: snapshotRef.current.projectId,
                    prompt: text,
                    snapshot: compactSnapshot(snapshotRef.current),
                    assetIds: [],
                    skillIds: selectedSkillId ? [selectedSkillId] : [],
                    modelIds: smartPlanning ? [] : selectedModelIds,
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.msg || t("panel.createRunFailed"));
            if (payload.data.run.conversationId && payload.data.run.conversationId !== conversationId) onConversationChange(payload.data.run.conversationId);
            setActiveRunId(payload.data.run.id);
            setSelectedSkillId(undefined);
            setRunPaused(false);
            await waitForBackendAgent(payload.data.run.id, session.id, assistantId);
        } catch (error) {
            upsertMessage(session.id, { id: assistantId, role: "error", title: t("panel.runFailed"), text: friendlyAgentError(error) });
            setIsRunning(false);
        }
    };

    const waitForBackendAgent = async (runId: string, sessionId: string, assistantId: string) => {
        try {
            await watchCanvasAgentRun(
                runId,
                {
                    onPlan: (ops, reply) => {
                        onApplyOps(ops);
                        upsertMessage(sessionId, { id: assistantId, role: "assistant", text: reply });
                    },
                    onAssistant: (text, detail) => {
                        if (detail?.runId && detail.taskId) {
                            appendMessage(sessionId, { id: nanoid(), role: "error", title: detail.title || t("panel.taskFailed"), text, detail });
                            return;
                        }
                        upsertMessage(sessionId, { id: assistantId, role: "assistant", text, ...(detail?.nodeIds?.length ? { detail } : {}) });
                    },
                    onStage: setRunStage,
                    onPaused: setRunPaused,
                    onOps: onApplyOps,
                },
                t,
            );
        } finally {
            await refreshUserPointsIfSystem("system");
            setIsRunning(false);
            setActiveRunId("");
            setRunPaused(false);
        }
    };

    useEffect(() => {
        const projectId = snapshot.projectId;
        if (!projectId || activeRunId || restoredRunRef.current) return;
        let cancelled = false;
        void fetch(`/api/agent/runs?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
                if (cancelled) return;
                const run = (payload?.data?.runs || []).find((item: { status?: string }) => ["planning", "running", "paused"].includes(item.status || ""));
                if (!run?.id || restoredRunRef.current === run.id) return;
                restoredRunRef.current = run.id;
                const session = activeSession || createSession(t("panel.newChat"));
                if (!activeSession) {
                    setLocalSessions([session]);
                    setLocalActiveSessionId(session.id);
                }
                const assistantId = nanoid();
                appendMessage(session.id, { id: assistantId, role: "assistant", text: t("panel.restoredRun") });
                setActiveRunId(run.id);
                setRunPaused(run.status === "paused");
                setIsRunning(true);
                void waitForBackendAgent(run.id, session.id, assistantId).catch((error) => appendMessage(session.id, { id: nanoid(), role: "error", title: t("panel.restoreFailed"), text: friendlyAgentError(error, t("panel.restoreFailedDetail")) }));
            });
        return () => {
            cancelled = true;
        };
    }, [activeRunId, activeSession, snapshot.projectId]);

    const submit = async () => {
        const text = prompt.trim();
        if (!text || isRunning) return;
        setPrompt("");
        await sendMessage(text);
    };

    const controlRun = async (action: "pause" | "resume" | "cancel") => {
        if (!activeRunId) return;
        try {
            const response = await fetch(`/api/agent/runs/${encodeURIComponent(activeRunId)}/${action}`, { method: "POST" });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.msg || t("panel.controlFailed"));
            if (action === "pause") setRunPaused(true);
            if (action === "resume") setRunPaused(false);
            if (action === "cancel") setRunPaused(false);
        } catch (error) {
            const session = activeSession || localSessions[0];
            if (session) appendMessage(session.id, { id: nanoid(), role: "error", title: t("panel.controlFailedTitle"), text: friendlyAgentError(error, t("panel.controlFailedDetail")) });
        }
    };

    const retryFailedTask = async (runId: string, taskId: string) => {
        const session = activeSession || localSessions[0];
        if (!session || isRunning) return;
        const assistantId = nanoid();
        setIsRunning(true);
        setActiveRunId(runId);
        setRunStage({ key: "executing", text: t("panel.retryingTask") });
        try {
            const response = await fetch(`/api/agent/runs/${encodeURIComponent(runId)}/tasks/${encodeURIComponent(taskId)}/retry`, { method: "POST" });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.msg || t("panel.retryFailed"));
            appendMessage(session.id, { id: assistantId, role: "assistant", text: t("panel.retrySubmitted") });
            await waitForBackendAgent(runId, session.id, assistantId);
        } catch (error) {
            appendMessage(session.id, { id: assistantId, role: "error", title: t("panel.retryFailedTitle"), text: friendlyAgentError(error, t("panel.retryFailedDetail")) });
            setIsRunning(false);
            setActiveRunId("");
        }
    };

    const addImagesToCanvas = (files: FileList | File[] | null) => {
        Array.from(files || [])
            .filter((item) => item.type.startsWith("image/"))
            .forEach((file) => onPasteImage(file));
    };

    const toggleModel = (model: CreativeAgentModelOption) => {
        setSelectedModelIds((current) => {
            const next = current.includes(model.id) ? current.filter((id) => id !== model.id) : [...current, model.id].slice(-6);
            setSmartPlanning(next.length === 0);
            return next;
        });
    };

    const enableSmartPlanning = () => {
        setSelectedModelIds([]);
        setSmartPlanning(true);
    };

    const startResize = () => {
        const move = (event: MouseEvent) => setWidth(Math.min(760, Math.max(320, window.innerWidth - event.clientX)));
        const stop = () => {
            setResizing(false);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", stop);
        };
        setResizing(true);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", stop);
    };

    const collapse = () => {
        onCollapse();
    };

    const onlineContent = (
        <>
            <AgentPanelTabs
                value={view}
                theme={theme}
                items={[
                    { value: "chat", label: t("panel.chat") },
                    { value: "history", label: t("panel.history"), icon: <History className="size-3.5" />, count: historySessions.length },
                ]}
                onChange={setView}
                right={
                    <>
                        {view === "history" ? (
                            <Tooltip title={t("panel.deleteAll")}>
                                <Button
                                    type="text"
                                    shape="circle"
                                    className="!h-8 !w-8 !min-w-8"
                                    style={iconButtonStyle}
                                    icon={<X className="size-4" />}
                                    disabled={!historySessions.length}
                                    onClick={() => setDeleteChatIds(historySessions.map((session) => session.id))}
                                />
                            </Tooltip>
                        ) : null}
                        <Tooltip title={t("panel.newChat")}>
                            <Button
                                type="text"
                                shape="circle"
                                className="!h-8 !w-8 !min-w-8"
                                style={iconButtonStyle}
                                icon={<Plus className="size-4" />}
                                disabled={!hasMessages}
                                onClick={() => {
                                    startChatSession();
                                    setView("chat");
                                }}
                            />
                        </Tooltip>
                    </>
                }
            />

            <div className="thin-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {view === "history" ? (
                    <AssistantHistory
                        sessions={historySessions}
                        activeSession={activeSession}
                        onOpen={(id) => {
                            setLocalActiveSessionId(id);
                            setView("chat");
                        }}
                        onDelete={(id) => setDeleteChatIds([id])}
                    />
                ) : messages.length ? (
                    <>
                        {messages.map((message) => (
                            <div key={message.id} className="space-y-2">
                                <AgentChatMessage
                                    item={assistantMessageToChatMessage(message)}
                                    theme={theme}
                                    user={user}
                                    onLocateNode={onLocateNode}
                                    onRetryTask={(runId, taskId) => void retryFailedTask(runId, taskId)}
                                    onEditMessage={(text) => setPrompt(text)}
                                />
                                {message.references?.length ? <MessageReferences message={message} /> : null}
                            </div>
                        ))}
                        {isRunning ? (
                            <>
                                <AgentWorkingMessage theme={theme} stage={runStage} />
                                <div className="flex justify-end gap-2">
                                    <Button size="small" icon={runPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />} onClick={() => void controlRun(runPaused ? "resume" : "pause")}>
                                        {runPaused ? t("panel.resume") : t("panel.pause")}
                                    </Button>
                                    <Button size="small" danger icon={<Square className="size-3.5" />} onClick={() => void controlRun("cancel")}>
                                        {t("panel.cancel")}
                                    </Button>
                                </div>
                            </>
                        ) : null}
                    </>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center px-1 text-center">
                        <div className="relative font-serif text-4xl font-bold italic tracking-normal" style={{ color: theme.node.text }}>
                            <span>{site.title} Canvas</span>
                            <DiaTextReveal className="absolute inset-0" colors={["#A97CF8", "#F38CB8", "#FDCC92"]} textColor="transparent" duration={1.8} startOnView={false} text={`${site.title} Canvas`} />
                        </div>
                        <div className="mt-3 font-serif text-base italic tracking-wide opacity-60">One canvas, many ideas</div>
                    </div>
                )}
            </div>

            {view === "chat" ? (
                <>
                    {selectedReferences.length ? (
                        <div className="thin-scrollbar flex max-w-full gap-1.5 overflow-x-auto px-3 pb-1">
                            {selectedReferences.map((item, index) => (
                                <AssistantReferenceChip
                                    key={item.id}
                                    item={item}
                                    label={assistantImageReferenceLabel(selectedReferences, index)}
                                    onRemove={() => {
                                        setRemovedReferenceIds((prev) => new Set(prev).add(item.id));
                                        if (selectedNodeIds.has(item.id)) onSelectNodeIds(new Set(Array.from(selectedNodeIds).filter((nodeId) => nodeId !== item.id)));
                                    }}
                                />
                            ))}
                        </div>
                    ) : null}
                    <AgentChatComposer
                        prompt={prompt}
                        sending={isRunning}
                        placeholder={t("panel.placeholder")}
                        theme={theme}
                        onPromptChange={setPrompt}
                        onSubmit={submit}
                        onAddFiles={addImagesToCanvas}
                        beforeInput={selectedSkill ? <CreativeAgentSkillCard skill={selectedSkill} onRemove={() => setSelectedSkillId(undefined)} theme={controlTheme} className="pb-1" /> : null}
                        left={
                            <>
                                <CanvasPromptLibrary onSelect={setPrompt} />
                                <CreativeAgentControls
                                    compact
                                    skills={skills}
                                    skillsLoading={skillsLoading}
                                    selectedSkill={selectedSkill}
                                    models={models}
                                    selectedModels={selectedModels}
                                    smartPlanning={smartPlanning}
                                    onSelectSkill={(skill) => setSelectedSkillId(skill.id)}
                                    onToggleModel={toggleModel}
                                    onClearModels={enableSmartPlanning}
                                    onSmartPlanningChange={(enabled) => (enabled ? enableSmartPlanning() : setSmartPlanning(false))}
                                    theme={controlTheme}
                                />
                            </>
                        }
                    />
                </>
            ) : null}

            <Modal
                title={t("panel.deleteChatsTitle")}
                open={deleteChatIds.length > 0}
                centered
                onCancel={() => setDeleteChatIds([])}
                footer={
                    <>
                        <Button onClick={() => setDeleteChatIds([])}>{t("panel.cancel")}</Button>
                        <Button
                            danger
                            type="primary"
                            onClick={() => {
                                deleteChatIds.length === historySessions.length ? clearSessions() : removeSessions(deleteChatIds);
                                setDeleteChatIds([]);
                            }}
                        >
                            {t("panel.delete")}
                        </Button>
                    </>
                }
            >
                <p className="text-sm opacity-60">{t("panel.deleteChatsDesc", { count: deleteChatIds.length })}</p>
            </Modal>
        </>
    );

    return (
        <motion.div
            className="canvas-agent-panel-frame flex shrink-0"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: closing ? 0 : width + 1, opacity: closing ? 0 : 1 }}
            transition={{ duration: resizing ? 0 : PANEL_MOTION_SECONDS, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "clip", pointerEvents: closing ? "none" : undefined }}
        >
            <motion.aside
                className="canvas-agent-panel relative flex shrink-0 flex-col border-l"
                initial={{ x: 48 }}
                animate={{ x: closing ? 28 : 0 }}
                transition={{ duration: resizing ? 0 : PANEL_MOTION_SECONDS, ease: [0.22, 1, 0.36, 1] }}
                style={{ width, background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}
            >
                <button type="button" className="canvas-agent-resize-handle absolute inset-y-0 left-0 z-40 w-4 -translate-x-1/2 cursor-col-resize" onMouseDown={startResize} aria-label={t("panel.resizePanel")} />
                <header className="flex h-14 items-center justify-between border-b px-4" style={{ borderColor: theme.node.stroke }}>
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-lg">
                            <Bot className="size-4" />
                        </span>
                        <div className="min-w-0">
                            <div className="text-base font-semibold leading-5">Agent</div>
                            <div className="truncate text-xs" style={{ color: theme.node.muted }}>
                                {t("panel.canvasAssistant")}
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Tooltip title={t("panel.collapseChat")}>
                            <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" style={iconButtonStyle} icon={<PanelRightClose className="size-4" />} onClick={collapse} />
                        </Tooltip>
                    </div>
                </header>
                {onlineContent}
            </motion.aside>
        </motion.div>
    );
}
