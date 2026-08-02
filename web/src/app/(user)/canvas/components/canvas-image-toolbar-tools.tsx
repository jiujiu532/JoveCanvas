"use client";

import type { ReactNode } from "react";
import { Brush, Camera, Copy, FileText, Grid2x2, Lock, LockOpen, Maximize2, Scissors, Sparkles, Upload, ZoomIn } from "lucide-react";
import type { useTranslations } from "next-intl";

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

type CanvasT = ReturnType<typeof useTranslations<"canvas">>;

type ImageToolDefinition = {
    id: ImageNodeActionToolId;
    defaultVisible: boolean;
    panelLabel: (t: CanvasT) => string;
    label: string | ((node: CanvasNodeData, t: CanvasT) => string);
    title: string | ((node: CanvasNodeData, t: CanvasT) => string);
    icon: (node: CanvasNodeData) => ReactNode;
    active?: (node: CanvasNodeData) => boolean;
    run: (node: CanvasNodeData, handlers: ImageToolHandlers) => void;
};

type ImageQuickToolsConfig = {
    ids: ImageQuickToolId[];
};

export const IMAGE_QUICK_TOOLS_STORAGE_KEY = "canvas-image-quick-tools-v6";

const defaultBaseToolIds: ImageQuickToolId[] = ["info", "delete", "saveAsset", "download", "edit"];

const imageToolDefinitions: ImageToolDefinition[] = [
    {
        id: "copyPrompt",
        defaultVisible: true,
        panelLabel: (t) => t("actions.copyPrompt"),
        label: (_node, t) => t("actions.copyPrompt"),
        title: (_node, t) => t("imageTools.copyPromptTitle"),
        icon: () => <Copy className="size-4" />,
        run: (node, handlers) => handlers.onCopyPrompt(node),
    },
    {
        id: "reversePrompt",
        defaultVisible: true,
        panelLabel: (t) => t("actions.reversePrompt"),
        label: (_node, t) => t("actions.reversePrompt"),
        title: (_node, t) => t("imageTools.reversePromptTitle"),
        icon: () => <FileText className="size-4" />,
        run: (node, handlers) => handlers.onReversePrompt(node),
    },
    {
        id: "replace",
        defaultVisible: true,
        panelLabel: (t) => t("actions.replaceImage"),
        label: (_node, t) => t("actions.replaceImage"),
        title: (_node, t) => t("actions.replaceImage"),
        icon: () => <Upload className="size-4" />,
        run: (node, handlers) => handlers.onUpload(node),
    },
    {
        id: "resize",
        defaultVisible: false,
        panelLabel: (t) => t("actions.lockAspect"),
        label: (node, t) => (node.metadata?.freeResize ? t("actions.freeAspect") : t("actions.lockAspect")),
        title: (node, t) => (node.metadata?.freeResize ? t("imageTools.switchToLockAspect") : t("imageTools.switchToFreeAspect")),
        icon: (node) => (node.metadata?.freeResize ? <LockOpen className="size-4" /> : <Lock className="size-4" />),
        active: (node) => Boolean(node.metadata?.freeResize),
        run: (node, handlers) => handlers.onToggleFreeResize(node),
    },
    {
        id: "maskEdit",
        defaultVisible: true,
        panelLabel: (t) => t("actions.inpaint"),
        label: (_node, t) => t("actions.inpaint"),
        title: (_node, t) => t("imageTools.inpaintTitle"),
        icon: () => <Brush className="size-4" />,
        run: (node, handlers) => handlers.onMaskEdit(node),
    },
    {
        id: "crop",
        defaultVisible: true,
        panelLabel: (t) => t("actions.crop"),
        label: (_node, t) => t("actions.crop"),
        title: (_node, t) => t("imageTools.cropTitle"),
        icon: () => <Scissors className="size-4" />,
        run: (node, handlers) => handlers.onCrop(node),
    },
    {
        id: "split",
        defaultVisible: true,
        panelLabel: (t) => t("actions.slice"),
        label: (_node, t) => t("actions.slice"),
        title: (_node, t) => t("imageTools.sliceTitle"),
        icon: () => <Grid2x2 className="size-4" />,
        run: (node, handlers) => handlers.onSplit(node),
    },
    {
        id: "upscale",
        defaultVisible: true,
        panelLabel: (t) => t("hover.zoom"),
        label: (_node, t) => t("hover.zoom"),
        title: (_node, t) => t("imageTools.zoomResolutionTitle"),
        icon: () => <ZoomIn className="size-4" />,
        run: (node, handlers) => handlers.onUpscale(node),
    },
    {
        id: "superResolve",
        defaultVisible: false,
        panelLabel: (t) => t("actions.upscale"),
        label: (_node, t) => t("actions.upscale"),
        title: (_node, t) => t("imageTools.superResolveTitle"),
        icon: () => <Sparkles className="size-4" />,
        run: (node, handlers) => handlers.onSuperResolve(node),
    },
    {
        id: "angle",
        defaultVisible: false,
        panelLabel: (t) => t("actions.multiAngle"),
        label: (_node, t) => t("actions.multiAngle"),
        title: (_node, t) => t("imageTools.angleTitle"),
        icon: () => <Camera className="size-4" />,
        run: (node, handlers) => handlers.onAngle(node),
    },
    {
        id: "view",
        defaultVisible: true,
        panelLabel: (t) => t("actions.viewLarge"),
        label: (_node, t) => t("actions.viewLarge"),
        title: (_node, t) => t("imageTools.viewTitle"),
        icon: () => <Maximize2 className="size-4" />,
        run: (node, handlers) => handlers.onViewImage(node),
    },
];

export const defaultImageQuickToolIds: ImageQuickToolId[] = [...defaultBaseToolIds, ...imageToolDefinitions.filter((tool) => tool.defaultVisible).map((tool) => tool.id)];

export function buildImageToolbarTools(node: CanvasNodeData, handlers: ImageToolHandlers, t: CanvasT) {
    return imageToolDefinitions.map((tool) => ({
        id: tool.id,
        label: resolveToolText(tool.label, node, t),
        title: resolveToolText(tool.title, node, t),
        icon: tool.icon(node),
        active: tool.active?.(node),
        onClick: () => tool.run(node, handlers),
    }));
}

function normalizeImageQuickToolIds(value: unknown[]) {
    const allIds: ImageQuickToolId[] = [...defaultBaseToolIds, ...imageToolDefinitions.map((tool) => tool.id)];
    const ids = new Set(allIds);
    return allIds.filter((id) => value.includes(id) && ids.has(id));
}

export function readImageQuickToolsConfig(value: unknown): ImageQuickToolsConfig {
    if (Array.isArray(value)) return { ids: normalizeImageQuickToolIds(value) };
    if (!value || typeof value !== "object") return { ids: defaultImageQuickToolIds };
    const data = value as Partial<ImageQuickToolsConfig>;
    return {
        ids: Array.isArray(data.ids) ? normalizeImageQuickToolIds(data.ids) : defaultImageQuickToolIds,
    };
}

function resolveToolText(value: string | ((node: CanvasNodeData, t: CanvasT) => string), node: CanvasNodeData, t: CanvasT) {
    return typeof value === "function" ? value(node, t) : value;
}
