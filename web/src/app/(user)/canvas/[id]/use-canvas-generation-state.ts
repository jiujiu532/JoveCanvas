"use client";

import { useRef, useState } from "react";

import type { CanvasNodeGenerationMode } from "../components/canvas-node-prompt-panel";
import type { CanvasAssistantSession } from "../types";
import type { CanvasGenerationRequest } from "./canvas-page-elements";

/** Agent 助手会话与生成任务恢复/请求状态 */
export function useCanvasGenerationState() {
    const [chatSessions, setChatSessions] = useState<CanvasAssistantSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [assistantCollapsed, setAssistantCollapsed] = useState(true);
    const [assistantMounted, setAssistantMounted] = useState(false);
    const [assistantClosing, setAssistantClosing] = useState(false);

    const generateNodeRef = useRef<((nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => Promise<void>) | null>(null);
    const agentCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoOpenedAgentRef = useRef(false);
    const generationRequestsRef = useRef(new Map<string, CanvasGenerationRequest>());
    const resumingImageTaskIdsRef = useRef(new Set<string>());
    const resumingVideoTaskIdsRef = useRef(new Set<string>());
    const resumingTextTaskIdsRef = useRef(new Set<string>());
    const resumingAudioTaskIdsRef = useRef(new Set<string>());

    return {
        chatSessions,
        setChatSessions,
        activeChatId,
        setActiveChatId,
        assistantCollapsed,
        setAssistantCollapsed,
        assistantMounted,
        setAssistantMounted,
        assistantClosing,
        setAssistantClosing,
        generateNodeRef,
        agentCloseTimerRef,
        autoOpenedAgentRef,
        generationRequestsRef,
        resumingImageTaskIdsRef,
        resumingVideoTaskIdsRef,
        resumingTextTaskIdsRef,
        resumingAudioTaskIdsRef,
    };
}

export type CanvasGenerationState = ReturnType<typeof useCanvasGenerationState>;
