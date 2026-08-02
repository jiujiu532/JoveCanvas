"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { App, Modal, Segmented, Tooltip } from "antd";
import { Download, Ellipsis, FolderPlus, Image as ImageIcon, Info, MessageSquare, Minus, Music2, Pencil, Plus, RefreshCw, Settings2, Trash2, Upload, Video } from "lucide-react";
import { useTranslations } from "next-intl";

import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes, getDataUrlByteSize } from "@/lib/image-utils";
import { useCopyText } from "@/hooks/use-copy-text";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, isCanvasImageNodeType, type CanvasNodeData, type ViewportTransform } from "../types";
import { ImageToolSettingsModal, type ImageToolbarSettingsTool } from "./canvas-image-toolbar-settings-modal";
import { IMAGE_QUICK_TOOLS_STORAGE_KEY, buildImageToolbarTools, defaultImageQuickToolIds, readImageQuickToolsConfig, type ImageQuickToolId } from "./canvas-image-toolbar-tools";

type CanvasNodeHoverToolbarProps = {
    node: CanvasNodeData | null;
    viewport: ViewportTransform;
    onKeep: (nodeId: string) => void;
    onLeave: () => void;
    onInfo: (node: CanvasNodeData) => void;
    onEditText: (node: CanvasNodeData) => void;
    onDecreaseFont: (node: CanvasNodeData) => void;
    onIncreaseFont: (node: CanvasNodeData) => void;
    onToggleDialog: (node: CanvasNodeData) => void;
    onGenerateImage: (node: CanvasNodeData) => void;
    onUpload: (node: CanvasNodeData) => void;
    onDownload: (node: CanvasNodeData) => void;
    onSaveAsset: (node: CanvasNodeData) => void;
    onMaskEdit: (node: CanvasNodeData) => void;
    onCrop: (node: CanvasNodeData) => void;
    onSplit: (node: CanvasNodeData) => void;
    onUpscale: (node: CanvasNodeData) => void;
    onSuperResolve: (node: CanvasNodeData) => void;
    onAngle: (node: CanvasNodeData) => void;
    onViewImage: (node: CanvasNodeData) => void;
    onReversePrompt: (node: CanvasNodeData) => void;
    onRetry: (node: CanvasNodeData) => void;
    onToggleFreeResize: (node: CanvasNodeData) => void;
    onDelete: (node: CanvasNodeData) => void;
};

type ToolbarTool = {
    id: string;
    title: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    active?: boolean;
    danger?: boolean;
};

export function CanvasNodeHoverToolbar({
    node,
    viewport,
    onKeep,
    onLeave,
    onInfo,
    onEditText,
    onDecreaseFont,
    onIncreaseFont,
    onToggleDialog,
    onGenerateImage,
    onUpload,
    onDownload,
    onSaveAsset,
    onMaskEdit,
    onCrop,
    onSplit,
    onUpscale,
    onSuperResolve,
    onAngle,
    onViewImage,
    onReversePrompt,
    onRetry,
    onToggleFreeResize,
    onDelete,
}: CanvasNodeHoverToolbarProps) {
    const t = useTranslations("canvas");
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [quickImageToolIds, setQuickImageToolIds] = useState<ImageQuickToolId[]>(defaultImageQuickToolIds);
    const [draftImageToolIds, setDraftImageToolIds] = useState<ImageQuickToolId[]>(defaultImageQuickToolIds);
    const [imageToolSettingsOpen, setImageToolSettingsOpen] = useState(false);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [toolbarMetrics, setToolbarMetrics] = useState({ width: 0, viewportWidth: 0 });
    const { message } = App.useApp();
    const copyText = useCopyText();

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(IMAGE_QUICK_TOOLS_STORAGE_KEY);
            if (!stored) return;
            const parsed = JSON.parse(stored) as unknown;
            const config = readImageQuickToolsConfig(parsed);
            setQuickImageToolIds(config.ids);
        } catch {
            window.localStorage.removeItem(IMAGE_QUICK_TOOLS_STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        setImageToolSettingsOpen(false);
    }, [node?.id]);

    useEffect(() => {
        const toolbar = toolbarRef.current;
        if (!toolbar || typeof window === "undefined") return;
        const sync = () => setToolbarMetrics({ width: toolbar.offsetWidth, viewportWidth: window.innerWidth });
        sync();
        const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
        resizeObserver?.observe(toolbar);
        window.addEventListener("resize", sync);
        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener("resize", sync);
        };
    }, [node?.id, quickImageToolIds, imageToolSettingsOpen]);

    if (!node) return null;

    const left = viewport.x + (node.position.x + node.width / 2) * viewport.k;
    const top = viewport.y + node.position.y * viewport.k - 14;
    const safeViewportWidth = toolbarMetrics.viewportWidth || 0;
    const safeToolbarWidth = Math.min(toolbarMetrics.width || 0, Math.max(0, safeViewportWidth - 32));
    const toolbarLeft = safeViewportWidth && safeToolbarWidth ? Math.min(Math.max(left, safeToolbarWidth / 2 + 16), safeViewportWidth - safeToolbarWidth / 2 - 16) : left;
    const isImage = isCanvasImageNodeType(node.type);
    const isPanorama = node.type === CanvasNodeType.Panorama;
    const isVideo = node.type === CanvasNodeType.Video;
    const isAudio = node.type === CanvasNodeType.Audio;
    const hasImage = isImage && Boolean(node.metadata?.content);
    const hasVideo = isVideo && Boolean(node.metadata?.content);
    const hasAudio = isAudio && Boolean(node.metadata?.content);
    const isText = node.type === CanvasNodeType.Text;
    const isConfig = node.type === CanvasNodeType.Config;
    const canOpenDialog = isText || hasImage || isVideo;
    const canRetry = node.metadata?.status === "error";
    const quickImageToolIdSet = new Set(quickImageToolIds);
    const copyImagePrompt = (target: CanvasNodeData) => {
        const prompt = target.metadata?.prompt?.trim();
        if (!prompt) {
            message.warning(t("hover.noPromptToCopy"));
            return;
        }
        copyText(prompt, t("hover.promptCopied"));
    };
    const imageTools = buildImageToolbarTools(node, { onUpload, onToggleFreeResize, onMaskEdit, onCrop, onSplit, onUpscale, onSuperResolve, onAngle, onViewImage, onCopyPrompt: copyImagePrompt, onReversePrompt }, t);

    function openImageToolSettings() {
        if (!node) return;
        onKeep(node.id);
        setDraftImageToolIds(quickImageToolIds);
        setImageToolSettingsOpen(true);
    }

    const baseToolbarTools: ToolbarTool[] = [
        { id: "info", title: t("hover.viewInfo"), label: t("actions.info"), icon: <Info className="size-4" />, onClick: () => onInfo(node) },
        { id: "delete", title: t("hover.removeNode"), label: t("actions.delete"), icon: <Trash2 className="size-4" />, onClick: () => onDelete(node), danger: true },
    ];
    const nodeToolbarTools: ToolbarTool[] = [
        ...(canRetry ? [{ id: "retry", title: t("hover.regenerate"), label: t("hover.retry"), icon: <RefreshCw className="size-4" />, onClick: () => onRetry(node) }] : []),
        ...(hasImage || hasVideo || isText ? [{ id: "saveAsset", title: t("hover.saveAsset"), label: t("hover.saveAssetShort"), icon: <FolderPlus className="size-4" />, onClick: () => onSaveAsset(node) }] : []),
        ...(hasImage || hasVideo || hasAudio
            ? [{ id: "download", title: hasAudio ? t("hover.downloadAudio") : hasVideo ? t("hover.downloadVideo") : t("hover.downloadImage"), label: t("hover.download"), icon: <Download className="size-4" />, onClick: () => onDownload(node) }]
            : []),
        ...(canOpenDialog ? [{ id: "edit", title: t("actions.edit"), label: t("actions.edit"), icon: <MessageSquare className="size-4" />, onClick: () => onToggleDialog(node) }] : []),
        ...(isText ? [{ id: "editText", title: t("hover.editText"), label: t("hover.editTextLabel"), icon: <Pencil className="size-4" />, onClick: () => onEditText(node) }] : []),
        ...(isText ? [{ id: "generateImage", title: t("actions.textToImage"), label: t("hover.generateImageShort"), icon: <ImageIcon className="size-4" />, onClick: () => onGenerateImage(node) }] : []),
        ...(isConfig ? [{ id: "config", title: t("actions.generationConfig"), label: t("actions.generationConfig"), icon: <Settings2 className="size-4" />, onClick: () => onToggleDialog(node) }] : []),
        ...(isText ? [{ id: "decreaseFont", title: t("hover.decreaseFont"), label: t("hover.decreaseFontLabel"), icon: <Minus className="size-4" />, onClick: () => onDecreaseFont(node) }] : []),
        ...(isText ? [{ id: "increaseFont", title: t("hover.increaseFont"), label: t("hover.increaseFontLabel"), icon: <Plus className="size-4" />, onClick: () => onIncreaseFont(node) }] : []),
        ...(isImage && !hasImage ? [{ id: "uploadImage", title: t("actions.uploadImage"), label: t("actions.uploadImage"), icon: <Upload className="size-4" />, onClick: () => onUpload(node) }] : []),
        ...(isVideo
            ? [{ id: "uploadVideo", title: hasVideo ? t("actions.replaceVideo") : t("actions.uploadVideo"), label: hasVideo ? t("actions.replaceVideo") : t("actions.uploadVideo"), icon: <Video className="size-4" />, onClick: () => onUpload(node) }]
            : []),
        ...(isAudio
            ? [{ id: "uploadAudio", title: hasAudio ? t("actions.replaceAudio") : t("actions.uploadAudio"), label: hasAudio ? t("actions.replaceAudio") : t("actions.uploadAudio"), icon: <Music2 className="size-4" />, onClick: () => onUpload(node) }]
            : []),
        ...(hasImage && !isPanorama ? imageTools.map((tool) => ({ id: tool.id, title: tool.title, label: tool.label, icon: tool.icon, active: tool.active, onClick: tool.onClick })) : []),
    ];
    const toolbarTools = hasImage ? [...baseToolbarTools, ...nodeToolbarTools].filter((tool) => quickImageToolIdSet.has(tool.id as ImageQuickToolId)) : [...baseToolbarTools, ...nodeToolbarTools];
    const selectableImageToolbarTools = [...baseToolbarTools, ...nodeToolbarTools].filter((tool) => tool.id !== "retry") as ImageToolbarSettingsTool[];

    const closeImageToolSettings = () => {
        setImageToolSettingsOpen(false);
        onLeave();
    };

    const setDraftImageToolVisible = (id: ImageQuickToolId, visible: boolean) => {
        setDraftImageToolIds((current) => {
            const selected = new Set(current);
            if (visible) selected.add(id);
            else selected.delete(id);
            return selectableImageToolbarTools.filter((tool) => selected.has(tool.id)).map((tool) => tool.id);
        });
    };

    const saveImageToolSettings = () => {
        const config = { ids: draftImageToolIds };
        setQuickImageToolIds(config.ids);
        window.localStorage.setItem(IMAGE_QUICK_TOOLS_STORAGE_KEY, JSON.stringify(config));
        closeImageToolSettings();
    };

    return (
        <>
            <div
                ref={toolbarRef}
                className="hide-scrollbar absolute z-[70] flex h-11 max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-full items-center overflow-x-auto overflow-y-hidden rounded-[14px] border shadow-[0_8px_28px_rgba(15,23,42,.12)]"
                style={{ left: toolbarLeft, top, background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.toolbar.item }}
                onMouseEnter={() => onKeep(node.id)}
                onMouseLeave={() => {
                    if (!imageToolSettingsOpen) onLeave();
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                {toolbarTools.map((tool) => (
                    <ToolbarAction key={tool.id} {...tool} theme={theme} />
                ))}
                {hasImage ? <ToolbarAction id="more" title={t("actions.configQuickTools")} label={t("actions.more")} icon={<Ellipsis className="size-4" />} active={imageToolSettingsOpen} onClick={openImageToolSettings} theme={theme} /> : null}
            </div>
            {hasImage ? (
                <ImageToolSettingsModal open={imageToolSettingsOpen} tools={selectableImageToolbarTools} selectedIds={draftImageToolIds} onToggle={setDraftImageToolVisible} onCancel={closeImageToolSettings} onSave={saveImageToolSettings} />
            ) : null}
        </>
    );
}

export function CanvasNodeInfoModal({ node, open, onClose }: { node: CanvasNodeData | null; open: boolean; onClose: () => void }) {
    const t = useTranslations("canvas");
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [view, setView] = useState<"info" | "json">("info");
    const imageBytes = node && isCanvasImageNodeType(node.type) && node.metadata?.content ? getDataUrlByteSize(node.metadata.content) : 0;
    const batchCount = node?.type === CanvasNodeType.Image ? node.metadata?.batchChildIds?.length || 0 : 0;
    const json = useMemo(() => {
        if (!node) return "";
        return JSON.stringify(
            node,
            (key, value) => {
                if (key === "title") return undefined;
                if (key === "content" && typeof value === "string" && value.startsWith("data:image/")) {
                    return "[base64 image]";
                }
                return value;
            },
            2,
        );
    }, [node]);

    useEffect(() => {
        if (open) setView("info");
    }, [node?.id, open]);

    const typeLabel =
        node?.type === CanvasNodeType.Text
            ? t("kind.text")
            : node?.type === CanvasNodeType.Image
              ? t("kind.image")
              : node?.type === CanvasNodeType.Panorama
                ? t("kind.panorama")
                : node?.type === CanvasNodeType.Video
                  ? t("kind.video")
                  : node?.type === CanvasNodeType.Audio
                    ? t("kind.audio")
                    : t("info.config");

    const title = (
        <div className="flex items-center justify-between gap-4 pr-12">
            <span>{t("info.title")}</span>
            <Segmented
                size="small"
                value={view}
                onChange={(value) => setView(value as "info" | "json")}
                options={[
                    { label: t("actions.info"), value: "info" },
                    { label: t("info.json"), value: "json" },
                ]}
            />
        </div>
    );

    return (
        <Modal className="canvas-node-info-modal" title={title} open={open && Boolean(node)} centered footer={null} onCancel={onClose}>
            {node ? (
                <div className="h-[48vh] min-h-60 text-sm sm:h-[56vh] sm:min-h-[360px]">
                    {view === "info" ? (
                        <div className="thin-scrollbar h-full space-y-3 overflow-auto pr-1">
                            <InfoRow label={t("info.id")} value={node.id} />
                            <InfoRow label={t("info.type")} value={typeLabel} />
                            <InfoRow label={t("info.size")} value={`${Math.round(node.width)} x ${Math.round(node.height)}`} />
                            <InfoRow label={t("info.position")} value={`${Math.round(node.position.x)}, ${Math.round(node.position.y)}`} />
                            <InfoRow label={t("info.status")} value={node.metadata?.status || "idle"} />
                            {batchCount > 1 ? <InfoRow label={t("info.imageBatch")} value={t("info.imageBatchCount", { count: batchCount })} /> : null}
                            {node.metadata?.prompt ? <InfoRow label={t("info.prompt")} value={node.metadata.prompt} /> : null}
                            {imageBytes ? <InfoRow label={t("info.imageSize")} value={formatBytes(imageBytes)} /> : null}
                            {node.metadata?.errorDetails ? (
                                <div className="rounded-lg border p-3 text-red-400" style={{ borderColor: theme.node.stroke }}>
                                    {node.metadata.errorDetails}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <pre className="thin-scrollbar h-full overflow-auto rounded-lg border p-3 text-xs leading-5" style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}>
                            {json}
                        </pre>
                    )}
                </div>
            ) : null}
        </Modal>
    );
}

function ToolbarAction({ title, icon, onClick, active = false, danger = false, theme }: ToolbarTool & { theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <Tooltip title={title} placement="top" mouseEnterDelay={0.2}>
            <button
                type="button"
                className="group relative flex size-11 shrink-0 items-center justify-center"
                style={{ color: danger ? "#ef4444" : theme.toolbar.item, "--canvas-tool-hover": theme.toolbar.itemHover } as CSSProperties}
                onClick={onClick}
                aria-label={title}
            >
                <span
                    className="flex size-8 items-center justify-center rounded-lg transition group-hover:bg-[var(--canvas-tool-hover)]"
                    style={{ background: active ? theme.toolbar.activeBg : undefined, color: active ? theme.toolbar.activeText : undefined }}
                >
                    {icon}
                </span>
            </button>
        </Tooltip>
    );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <span className="opacity-50">{label}</span>
            <span className="min-w-0 whitespace-pre-wrap break-words">{value}</span>
        </div>
    );
}
