"use client";

import type { ReactNode } from "react";
import { Brush, Camera, Copy, FileText, Grid2x2, Lock, LockOpen, Maximize2, Scissors, Sparkles, Upload, ZoomIn } from "lucide-react";

import type { CanvasNodeData } from "../types";

type ImageNodeActionToolId = "copyPrompt" | "reversePrompt" | "replace" | "resize" | "maskEdit" | "crop" | "split" | "upscale" | "superResolve" | "angle" | "view";
export type ImageQuickToolId = "info" | "delete" | "saveAsset" | "download" | "edit" | ImageNodeActionToolId;

type ImageToolHandlers = {
    onUpload: (node: CanvasNodeData) => void;
    onToggleFreeResize: (node: CanvasNodeData) => void;
    onMaskEdit: (node: CanvasNodeData) => void;
    onCrop: (node: CanvasNodeData) => void;
    onSplit: (node: CanvasNodeData) => void;
    onUpscale: (node: CanvasNodeData) => void;
    onSuperResolve: (node: CanvasNodeData) => void;
    onAngle: (node: CanvasNodeData) => void;
    onViewImage: (node: CanvasNodeData) => void;
    onCopyPrompt: (node: CanvasNodeData) => void;
    onReversePrompt: (node: CanvasNodeData) => void;
};

type CanvasT = (key: string, values?: Record<string, string | number>) => string;

type ImageToolDefinition = {
    id: ImageNodeActionToolId;
    defaultVisible: boolean;
    panelLabel: string;
    label: string | ((node: CanvasNodeData) => string);
    title: string | ((node: CanvasNodeData) => string);
    icon: (node: CanvasNodeData) => ReactNode;
    active?: (node: CanvasNodeData) => boolean;
    run: (node: CanvasNodeData, handlers: ImageToolHandlers) => void;
};

type ImageQuickToolsConfig = {
    ids: ImageQuickToolId[];
    showLabels: boolean;
};

export const IMAGE_QUICK_TOOLS_STORAGE_KEY = "canvas-image-quick-tools-v6";

const defaultBaseToolIds: ImageQuickToolId[] = ["info", "delete", "saveAsset", "download", "edit"];

const IMAGE_TOOL_IDS: ImageNodeActionToolId[] = ["copyPrompt", "reversePrompt", "replace", "resize", "maskEdit", "crop", "split", "upscale", "superResolve", "angle", "view"];

const DEFAULT_VISIBLE_IMAGE_TOOL_IDS: ImageNodeActionToolId[] = ["copyPrompt", "reversePrompt", "replace", "maskEdit", "crop", "split", "upscale", "view"];

function buildImageToolDefinitions(t: CanvasT): ImageToolDefinition[] {
    return [
        {
            id: "copyPrompt",
            defaultVisible: true,
            panelLabel: t("actions.copyPrompt"),
            label: t("actions.copyPrompt"),
            title: t("imageTools.copyPromptTitle"),
            icon: () => <Copy className="size-4" />,
            run: (node, handlers) => handlers.onCopyPrompt(node),
        },
        {
            id: "reversePrompt",
            defaultVisible: true,
            panelLabel: t("actions.reversePrompt"),
            label: t("actions.reversePrompt"),
            title: t("imageTools.reversePromptTitle"),
            icon: () => <FileText className="size-4" />,
            run: (node, handlers) => handlers.onReversePrompt(node),
        },
        {
            id: "replace",
            defaultVisible: true,
            panelLabel: t("actions.replaceImage"),
            label: t("actions.replaceImage"),
            title: t("actions.replaceImage"),
            icon: () => <Upload className="size-4" />,
            run: (node, handlers) => handlers.onUpload(node),
        },
        {
            id: "resize",
            defaultVisible: false,
            panelLabel: t("actions.lockAspect"),
            label: (node) => (node.metadata?.freeResize ? t("actions.freeAspect") : t("actions.lockAspect")),
            title: (node) => (node.metadata?.freeResize ? t("imageTools.switchToLockAspect") : t("imageTools.switchToFreeAspect")),
            icon: (node) => (node.metadata?.freeResize ? <LockOpen className="size-4" /> : <Lock className="size-4" />),
            active: (node) => Boolean(node.metadata?.freeResize),
            run: (node, handlers) => handlers.onToggleFreeResize(node),
        },
        {
            id: "maskEdit",
            defaultVisible: true,
            panelLabel: t("actions.inpaint"),
            label: t("actions.inpaint"),
            title: t("imageTools.inpaintTitle"),
            icon: () => <Brush className="size-4" />,
            run: (node, handlers) => handlers.onMaskEdit(node),
        },
        {
            id: "crop",
            defaultVisible: true,
            panelLabel: t("actions.crop"),
            label: t("actions.crop"),
            title: t("imageTools.cropTitle"),
            icon: () => <Scissors className="size-4" />,
            run: (node, handlers) => handlers.onCrop(node),
        },
        {
            id: "split",
            defaultVisible: true,
            panelLabel: t("actions.slice"),
            label: t("actions.slice"),
            title: t("imageTools.sliceTitle"),
            icon: () => <Grid2x2 className="size-4" />,
            run: (node, handlers) => handlers.onSplit(node),
        },
        {
            id: "upscale",
            defaultVisible: true,
            panelLabel: t("actions.zoomIn"),
            label: t("actions.zoomIn"),
            title: t("imageTools.zoomResolutionTitle"),
            icon: () => <ZoomIn className="size-4" />,
            run: (node, handlers) => handlers.onUpscale(node),
        },
        {
            id: "superResolve",
            defaultVisible: false,
            panelLabel: t("actions.upscale"),
            label: t("actions.upscale"),
            title: t("imageTools.superResolveTitle"),
            icon: () => <Sparkles className="size-4" />,
            run: (node, handlers) => handlers.onSuperResolve(node),
        },
        {
            id: "angle",
            defaultVisible: false,
            panelLabel: t("actions.multiAngle"),
            label: t("actions.multiAngle"),
            title: t("imageTools.angleTitle"),
            icon: () => <Camera className="size-4" />,
            run: (node, handlers) => handlers.onAngle(node),
        },
        {
            id: "view",
            defaultVisible: true,
            panelLabel: t("actions.viewLarge"),
            label: t("actions.viewLarge"),
            title: t("imageTools.viewTitle"),
            icon: () => <Maximize2 className="size-4" />,
            run: (node, handlers) => handlers.onViewImage(node),
        },
    ];
}

export const defaultImageQuickToolIds: ImageQuickToolId[] = [...defaultBaseToolIds, ...DEFAULT_VISIBLE_IMAGE_TOOL_IDS];

export function buildImageToolbarTools(node: CanvasNodeData, handlers: ImageToolHandlers, t: CanvasT) {
    return buildImageToolDefinitions(t).map((tool) => ({
        id: tool.id,
        label: resolveToolText(tool.label, node),
        title: resolveToolText(tool.title, node),
        icon: tool.icon(node),
        active: tool.active?.(node),
        onClick: () => tool.run(node, handlers),
    }));
}

function normalizeImageQuickToolIds(value: unknown[]) {
    const allIds: ImageQuickToolId[] = [...defaultBaseToolIds, ...IMAGE_TOOL_IDS];
    const ids = new Set(allIds);
    return allIds.filter((id) => value.includes(id) && ids.has(id));
}

export function readImageQuickToolsConfig(value: unknown): ImageQuickToolsConfig {
    if (Array.isArray(value)) return { ids: normalizeImageQuickToolIds(value), showLabels: true };
    if (!value || typeof value !== "object") return { ids: defaultImageQuickToolIds, showLabels: true };
    const data = value as Partial<ImageQuickToolsConfig>;
    return {
        ids: Array.isArray(data.ids) ? normalizeImageQuickToolIds(data.ids) : defaultImageQuickToolIds,
        showLabels: data.showLabels !== false,
    };
}

function resolveToolText(value: string | ((node: CanvasNodeData) => string), node: CanvasNodeData) {
    return typeof value === "function" ? value(node) : value;
}
