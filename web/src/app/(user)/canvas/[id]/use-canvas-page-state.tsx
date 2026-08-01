"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { preloadOnIdle } from "@/lib/preload-on-idle";
import { useAssetStore } from "@/stores/use-asset-store";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { App } from "antd";

import type { Position } from "../types";
import { useCanvasStore } from "../stores/use-canvas-store";
import { useCanvasConnectionsState } from "./use-canvas-connections-state";
import { useCanvasGenerationState } from "./use-canvas-generation-state";
import { useCanvasInteractionState } from "./use-canvas-interaction-state";
import { useCanvasNodesState } from "./use-canvas-nodes-state";
import { useCanvasViewportState } from "./use-canvas-viewport-state";

const loadAssetPickerModal = () => import("../components/asset-picker-modal").then((mod) => mod.AssetPickerModal);

/**
 * 画布页状态组合入口。
 * 按功能域拆分到 use-canvas-*-state hooks，此处仅聚合 store / 路由 / refs 与各域状态。
 */
export function useCanvasPageState() {
    const { message, modal } = App.useApp();
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const projectId = params.id;

    useEffect(() => {
        return preloadOnIdle(() => {
            void loadAssetPickerModal();
        });
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const uploadTargetRef = useRef<{ nodeId?: string; position?: Position } | null>(null);

    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const addAsset = useAssetStore((state) => state.addAsset);
    const userId = useUserStore((state) => state.user?.id || "");
    const hydrated = useCanvasStore((state) => state.hydrated);
    const hydratedUserId = useCanvasStore((state) => state.hydratedUserId);
    const hydrate = useCanvasStore((state) => state.hydrate);
    const loadProject = useCanvasStore((state) => state.loadProject);
    const createProject = useCanvasStore((state) => state.createProject);
    const updateProject = useCanvasStore((state) => state.updateProject);
    const renameProject = useCanvasStore((state) => state.renameProject);
    const deleteProjects = useCanvasStore((state) => state.deleteProjects);
    const currentProject = useCanvasStore((state) => state.projects.find((project) => project.id === projectId));
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    // 功能域状态（顺序：节点 → 连接 → 视口 → 交互 → 生成/Agent）
    const nodesState = useCanvasNodesState();
    const connectionsState = useCanvasConnectionsState();
    const viewportState = useCanvasViewportState();
    const interactionState = useCanvasInteractionState();
    const generationState = useCanvasGenerationState();

    return {
        message,
        modal,
        params,
        router,
        projectId,
        containerRef,
        imageInputRef,
        uploadTargetRef,
        effectiveConfig,
        isAiConfigReady,
        openConfigDialog,
        addAsset,
        userId,
        hydrated,
        hydratedUserId,
        hydrate,
        loadProject,
        createProject,
        updateProject,
        renameProject,
        deleteProjects,
        currentProject,
        theme,
        ...nodesState,
        ...connectionsState,
        ...viewportState,
        ...interactionState,
        ...generationState,
    };
}

export type CanvasPageState = ReturnType<typeof useCanvasPageState>;
