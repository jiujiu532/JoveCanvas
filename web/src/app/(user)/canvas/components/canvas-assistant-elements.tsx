"use client";

import { useMemo } from "react";
import { Trash2, X } from "lucide-react";
import { Button, Tooltip } from "antd";
import { useTranslations } from "next-intl";

import { modelOptionName, resolveModelChannel, selectableModelsByCapability, type AiConfig } from "@/stores/use-config-store";
import { canvasThemes } from "@/lib/canvas-theme";
import { nanoid } from "nanoid";
import { useThemeStore } from "@/stores/use-theme-store";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { ModelIcon } from "@/components/model-picker";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { formatAgentMessageText } from "@/components/agent/agent-message-format";
import type { CanvasAgentChatMessage } from "./canvas-agent-chat-ui";
import { CanvasNodeType, isCanvasImageNodeType, type CanvasAssistantMessage, type CanvasAssistantReference, type CanvasAssistantSession, type CanvasNodeData } from "../types";
import type { CanvasAgentSnapshot } from "../utils/canvas-agent-ops";

export function AgentTextModelPicker({ config, value, onChange }: { config: AiConfig; value: string; onChange: (model: string) => void }) {
    const t = useTranslations("canvas");
    const options = useMemo(() => Array.from(new Set([value, ...selectableModelsByCapability(config, "text")].filter(Boolean))), [config, value]);
    const current = value || "";
    const emptyLabel = t("assistant.selectTextModel");
    return (
        <Select value={current} onValueChange={onChange}>
            <SelectTrigger
                hideChevron
                className="h-7 min-w-0 max-w-[220px] gap-1.5 border-0 bg-transparent px-1 py-0 text-xs font-normal shadow-none hover:bg-transparent hover:opacity-75 focus-visible:border-transparent focus-visible:ring-0 data-[state=open]:ring-0 dark:bg-transparent dark:hover:bg-transparent"
                title={current ? `${modelOptionName(current)} · ${resolveModelChannel(config, current).name}` : emptyLabel}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <ModelIcon model={current} />
                <span className="min-w-0 truncate">{current ? modelOptionName(current) : emptyLabel}</span>
                {current ? <span className="shrink-0 opacity-55">{resolveModelChannel(config, current).name}</span> : null}
            </SelectTrigger>
            <SelectContent
                data-canvas-no-zoom
                className="z-[1200] w-72 max-w-[calc(100vw-24px)]"
                position="popper"
                align="start"
                side="bottom"
                sideOffset={6}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {options.length ? (
                    options.map((model) => (
                        <SelectItem key={model} value={model} textValue={`${modelOptionName(model)} ${resolveModelChannel(config, model).name}`}>
                            <span className="flex min-w-0 items-center gap-2">
                                <ModelIcon model={model} />
                                <span className="min-w-0 flex-1 truncate">{modelOptionName(model)}</span>
                                <span className="shrink-0 text-xs opacity-55">{resolveModelChannel(config, model).name}</span>
                            </span>
                        </SelectItem>
                    ))
                ) : (
                    <SelectItem value="__empty_text_model__" disabled>
                        {t("assistant.noTextModel")}
                    </SelectItem>
                )}
            </SelectContent>
        </Select>
    );
}

export function AssistantHistory({ sessions, activeSession, onOpen, onDelete }: { sessions: CanvasAssistantSession[]; activeSession: CanvasAssistantSession | null; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
    const t = useTranslations("canvas");
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <div className="space-y-3">
            <div className="text-sm" style={{ color: theme.node.muted }}>
                {sessions.length ? t("assistant.historyCount", { count: sessions.length }) : t("assistant.historyEmpty")}
            </div>
            {sessions.map((session) => (
                <div key={session.id} className="rounded-lg border px-2.5 py-1.5 transition" style={{ borderColor: session.id === activeSession?.id ? theme.node.text : theme.node.stroke, background: "transparent", color: theme.node.text }}>
                    <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                                {session.id === activeSession?.id ? (
                                    <span className="shrink-0 text-[10px] font-medium" style={{ color: theme.node.text }}>
                                        {t("assistant.current")}
                                    </span>
                                ) : null}
                                <div className="truncate text-sm font-medium leading-5">{session.title}</div>
                            </div>
                            <div className="truncate text-[11px] leading-4 opacity-65">{sessionPreview(session, t)}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <span className="text-[10px] opacity-55">{formatSessionTime(session.updatedAt || session.createdAt)}</span>
                            <Button size="small" className="!h-6 !px-2" onClick={() => onOpen(session.id)}>
                                {t("assistant.enter")}
                            </Button>
                            <Tooltip title={t("assistant.deleteRecord")}>
                                <Button size="small" danger type="text" className="!h-6 !w-6 !min-w-6" icon={<Trash2 className="size-3.5" />} onClick={() => onDelete(session.id)} />
                            </Tooltip>
                        </div>
                    </div>
                </div>
            ))}
            {!sessions.length ? (
                <div className="px-3 py-8 text-center text-sm" style={{ color: theme.node.muted }}>
                    {t("assistant.historyHint")}
                </div>
            ) : null}
        </div>
    );
}

export function MessageReferences({ message }: { message: CanvasAssistantMessage }) {
    return (
        <div className={`flex max-w-[88%] flex-wrap gap-2 ${message.role === "user" ? "ml-auto justify-end" : "ml-11 justify-start"}`}>
            {message.references?.map((item, index, references) => (
                <AssistantReferenceChip key={item.id} item={item} label={assistantImageReferenceLabel(references, index)} />
            ))}
        </div>
    );
}

export function AssistantReferenceChip({ item, label, onRemove }: { item: CanvasAssistantReference; label?: string; onRemove?: () => void }) {
    const t = useTranslations("canvas");
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const text = (item.text || item.title).replace(/\s+/g, " ").trim().slice(0, 1) || t("assistant.textFallback");
    return (
        <div className="group/chip relative inline-flex h-8 max-w-[150px] shrink-0 items-center gap-1.5 rounded-lg text-sm" style={{ color: theme.node.text }}>
            {item.dataUrl ? (
                <span className="relative block size-8 shrink-0">
                    <img src={imagePreviewUrl(item.dataUrl, 96)} alt="" className="size-8 rounded-lg object-cover" />
                    {label ? <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-medium leading-none text-white">{label}</span> : null}
                </span>
            ) : (
                <span className="grid size-8 place-items-center rounded-lg border text-sm font-medium" style={{ background: theme.node.panel, borderColor: theme.node.activeStroke }}>
                    {text}
                </span>
            )}
            {onRemove ? (
                <button
                    type="button"
                    className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border opacity-0 shadow-sm transition group-hover/chip:opacity-100"
                    style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke }}
                    onClick={onRemove}
                    aria-label={t("assistant.removeReference")}
                >
                    <X className="size-3" />
                </button>
            ) : null}
        </div>
    );
}

export function assistantImageReferenceLabel(references: CanvasAssistantReference[], index: number) {
    if (!references[index]?.dataUrl) return undefined;
    const imageIndex = references.slice(0, index + 1).filter((item) => item.dataUrl).length - 1;
    return imageIndex >= 0 ? imageReferenceLabel(imageIndex) : undefined;
}

export function assistantMessageToChatMessage(message: CanvasAssistantMessage): CanvasAgentChatMessage {
    return { id: message.id, role: message.role, title: message.title, text: formatAgentMessageText(message.text), meta: message.meta, detail: message.detail };
}

export function formatSessionTime(value?: string) {
    return value ? new Date(value).toLocaleString() : "";
}

export function sessionPreview(session: CanvasAssistantSession, t?: (key: string, values?: Record<string, string | number>) => string) {
    const last = session.messages.at(-1)?.text;
    if (last) return last;
    if (t) return t("assistant.messageCount", { count: session.messages.length });
    // 无 t 时仅返回条数，避免硬编码中文；UI 调用点应传入 t
    return String(session.messages.length);
}

export function nodeToReference(node: CanvasNodeData): CanvasAssistantReference | null {
    if (isCanvasImageNodeType(node.type) && node.metadata?.content) {
        return { id: node.id, type: node.type, title: node.title, dataUrl: node.metadata.content, storageKey: node.metadata.storageKey };
    }
    if (node.type === CanvasNodeType.Text && node.metadata?.content) {
        return { id: node.id, type: node.type, title: node.title, text: node.metadata.content };
    }
    return null;
}

export function buildAssistantReferences(nodes: CanvasNodeData[], selectedNodeIds: Set<string>) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return Array.from(selectedNodeIds)
        .map((id) => nodeById.get(id))
        .filter((node): node is CanvasNodeData => Boolean(node))
        .map(nodeToReference)
        .filter((item): item is CanvasAssistantReference => Boolean(item));
}

export function compactSnapshot(snapshot: CanvasAgentSnapshot) {
    return {
        title: snapshot.title,
        viewport: snapshot.viewport,
        selectedNodeIds: snapshot.selectedNodeIds,
        nodes: snapshot.nodes.map((node) => ({
            id: node.id,
            type: node.type,
            title: node.title,
            position: node.position,
            width: node.width,
            height: node.height,
            metadata: compactMetadata(node.metadata || {}),
        })),
        connections: snapshot.connections,
    };
}

export function compactMetadata(metadata: CanvasNodeData["metadata"]) {
    const mediaUrl = [metadata?.remoteUrl, metadata?.serverUrl].find((value) => typeof value === "string" && value && !value.startsWith("data:") && !value.startsWith("blob:"));
    return {
        content: String(metadata?.content || "").slice(0, 500),
        prompt: String(metadata?.prompt || metadata?.composerContent || "").slice(0, 500),
        status: metadata?.status,
        generationMode: metadata?.generationMode,
        model: metadata?.model,
        size: metadata?.size,
        url: mediaUrl,
    };
}

export function createSession(title?: string): CanvasAssistantSession {
    const now = new Date().toISOString();
    // 标题由调用方注入 t("panel.newChat")；无 title 时留空，避免硬编码中文
    return { id: nanoid(), title: title?.trim() || "", messages: [], createdAt: now, updatedAt: now };
}
