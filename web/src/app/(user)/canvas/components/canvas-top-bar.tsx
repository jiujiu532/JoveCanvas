"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dropdown, Modal } from "antd";
import { BookOpen, Bot, Images, Menu, Plus, Redo2, Sparkles, Trash2, Undo2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserStatusActions } from "@/components/layout/user-status-actions";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

export function CanvasTopBar({
    title,
    titleDraft,
    isTitleEditing,
    onTitleDraftChange,
    onStartTitleEditing,
    onFinishTitleEditing,
    onCancelTitleEditing,
    canUndo,
    canRedo,
    onWorkbench,
    onProjects,
    onCreateProject,
    onDeleteProject,
    onImportImage,
    onUndo,
    onRedo,
    agentOpen,
    compactAgentStatus,
    onToggleAgent,
}: {
    title: string;
    titleDraft: string;
    isTitleEditing: boolean;
    onTitleDraftChange: (value: string) => void;
    onStartTitleEditing: () => void;
    onFinishTitleEditing: () => void;
    onCancelTitleEditing: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onWorkbench: () => void;
    onProjects: () => void;
    onCreateProject: () => void;
    onDeleteProject: () => void;
    onImportImage: () => void;
    onUndo: () => void;
    onRedo: () => void;
    agentOpen: boolean;
    compactAgentStatus?: { connected: boolean; enabled: boolean; activity: string };
    onToggleAgent: () => void;
}) {
    const t = useTranslations("canvas");
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const titleRef = useRef<HTMLDivElement>(null);
    const menuTriggerRef = useRef<HTMLButtonElement>(null);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        if (!isTitleEditing) return;
        const close = (event: PointerEvent) => {
            if (!titleRef.current?.contains(event.target as Node)) onFinishTitleEditing();
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [isTitleEditing, onFinishTitleEditing]);

    useEffect(() => {
        if (!menuOpen) return;
        const close = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (menuTriggerRef.current?.contains(target)) return;
            if (target instanceof Element && target.closest(".ant-dropdown, .ant-dropdown-menu, .ant-dropdown-menu-submenu, .ant-dropdown-menu-submenu-popup")) return;
            setMenuOpen(false);
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [menuOpen]);

    return (
        <>
            <div className="canvas-topbar pointer-events-none absolute left-0 right-0 top-0 z-50 flex h-16 items-center justify-between gap-2 px-4">
                <div className="canvas-topbar-left pointer-events-auto flex min-w-0 items-center gap-3">
                    <Dropdown
                        open={menuOpen}
                        onOpenChange={setMenuOpen}
                        trigger={["click"]}
                        menu={{
                            onClick: () => setMenuOpen(false),
                            items: [
                                { key: "workbench", icon: <Sparkles className="size-4" />, label: t("topbar.workbench"), onClick: onWorkbench },
                                { key: "docs", icon: <BookOpen className="size-4" />, label: t("topbar.help"), onClick: () => window.location.assign("/help?section=canvas") },
                                { key: "projects", icon: <Images className="size-4" />, label: t("topbar.myCanvases"), onClick: onProjects },
                                { type: "divider" },
                                { key: "new", icon: <Plus className="size-4" />, label: t("topbar.newCanvas"), onClick: onCreateProject },
                                { key: "delete", danger: true, icon: <Trash2 className="size-4" />, label: t("topbar.deleteCurrentCanvas"), onClick: onDeleteProject },
                                { type: "divider" },
                                { key: "import", icon: <Upload className="size-4" />, label: t("topbar.importAsset"), onClick: onImportImage },
                                { type: "divider" },
                                { key: "undo", disabled: !canUndo, icon: <Undo2 className="size-4" />, label: <MenuLabel text={t("actions.undo")} shortcut="⌘ Z" />, onClick: onUndo },
                                { key: "redo", disabled: !canRedo, icon: <Redo2 className="size-4" />, label: <MenuLabel text={t("actions.redo")} shortcut="⌘ ⇧ Z / ⌘ Y" />, onClick: onRedo },
                            ],
                        }}
                    >
                        <button ref={menuTriggerRef} type="button" className="grid size-9 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }} aria-label={t("topbar.openMenu")}>
                            <Menu className="size-5" />
                        </button>
                    </Dropdown>

                    <div ref={titleRef} className="canvas-topbar-title flex min-w-0 items-center gap-2">
                        {isTitleEditing ? (
                            <input
                                autoFocus
                                value={titleDraft}
                                onChange={(event) => onTitleDraftChange(event.target.value)}
                                onBlur={onFinishTitleEditing}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") onFinishTitleEditing();
                                    if (event.key === "Escape") onCancelTitleEditing();
                                }}
                                className="w-[min(280px,48vw)] max-w-[280px] bg-transparent p-0 text-left text-lg font-semibold tracking-normal outline-none"
                                style={{ color: theme.node.text }}
                            />
                        ) : (
                            <button
                                type="button"
                                className="canvas-topbar-title-button max-w-[280px] truncate border-b border-dashed border-transparent text-left text-lg font-semibold tracking-normal transition hover:border-current"
                                onDoubleClick={onStartTitleEditing}
                                title={t("topbar.renameHint")}
                            >
                                {title}
                            </button>
                        )}
                    </div>
                </div>

                <div className="canvas-topbar-actions pointer-events-auto flex min-w-0 items-center gap-1.5">
                    {compactAgentStatus ? <CompactAgentStatus status={compactAgentStatus} onClick={onToggleAgent} /> : null}
                    <UserStatusActions variant="canvas" onOpenShortcuts={() => setShortcutsOpen(true)} />
                    <span className="canvas-topbar-divider h-6 w-px" style={{ background: theme.toolbar.border }} />
                    <Button
                        type="text"
                        className="canvas-agent-button !font-medium"
                        style={{
                            background: agentOpen ? theme.toolbar.activeBg : theme.toolbar.panel,
                            borderColor: agentOpen ? theme.toolbar.activeBg : theme.toolbar.border,
                            borderStyle: "solid",
                            borderWidth: 1,
                            borderRadius: 14,
                            color: agentOpen ? theme.toolbar.activeText : theme.toolbar.item,
                            height: 40,
                            minHeight: 40,
                            paddingInline: 12,
                            boxShadow: colorTheme === "dark" ? "0 10px 30px rgba(0,0,0,.28)" : "0 10px 24px rgba(28,25,23,.08)",
                        }}
                        icon={<Bot className="size-4" />}
                        onClick={onToggleAgent}
                        aria-label={t("topbar.agentChat")}
                    >
                        {t("topbar.agentChat")}
                    </Button>
                </div>
            </div>
            <Modal title={t("actions.shortcuts")} open={shortcutsOpen} onCancel={() => setShortcutsOpen(false)} footer={null} centered>
                <div className="space-y-2 border-t pt-4 text-sm" style={{ borderColor: theme.node.stroke }}>
                    <Shortcut keys={[t("actions.panCanvas")]} value={t("actions.panView")} />
                    <Shortcut keys={[t("actions.wheel")]} value={t("actions.zoomCanvas")} />
                    <Shortcut keys={[t("topbar.zoomSlider")]} value={t("topbar.preciseZoom")} />
                    <Shortcut keys={["Ctrl / Cmd", t("topbar.drag")]} value={t("actions.boxSelect")} />
                    <Shortcut keys={["Shift / Ctrl / Cmd", t("topbar.click")]} value={t("actions.appendSelect")} />
                    <Shortcut keys={["Ctrl / Cmd", "A"]} value={t("topbar.selectAllNodes")} />
                    <Shortcut keys={["Ctrl / Cmd", "C / V"]} value={t("topbar.copyPasteClipboard")} />
                    <Shortcut keys={["Ctrl / Cmd", "Z"]} value={t("actions.undo")} />
                    <Shortcut keys={["Ctrl / Cmd", "Shift", "Z"]} value={t("actions.redo")} />
                    <Shortcut keys={["Ctrl / Cmd", "Y"]} value={t("actions.redo")} />
                    <Shortcut keys={["Delete / Backspace"]} value={t("actions.deleteSelected")} />
                    <Shortcut keys={["Esc"]} value={t("topbar.clearSelection")} />
                    <Shortcut keys={[t("topbar.dropMedia")]} value={t("topbar.uploadToCanvas")} />
                </div>
            </Modal>
        </>
    );
}

function MenuLabel({ text, shortcut }: { text: string; shortcut: string }) {
    return (
        <span className="flex min-w-36 items-center justify-between gap-8">
            <span>{text}</span>
            <span className="text-xs opacity-45">{shortcut}</span>
        </span>
    );
}

function CompactAgentStatus({ status, onClick }: { status: { connected: boolean; enabled: boolean; activity: string }; onClick: () => void }) {
    const t = useTranslations("canvas");
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const label = status.connected ? t("topbar.codexConnected") : status.enabled ? status.activity || t("topbar.codexConnecting") : t("topbar.codexConnectingInitial");
    const dotColor = status.connected ? "#22c55e" : status.enabled ? "#f59e0b" : theme.node.muted;
    return (
        <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition hover:opacity-85"
            style={{ background: theme.toolbar.panel, color: theme.node.text, boxShadow: "0 10px 30px rgba(28,25,23,.10)" }}
            onClick={onClick}
            title={t("topbar.openCodexPanel")}
        >
            <span className="size-2 rounded-full" style={{ background: dotColor }} />
            <span className="max-w-[180px] truncate">{label}</span>
        </button>
    );
}

function Shortcut({ keys, value }: { keys: string[]; value: string }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-6 rounded-lg px-1 py-1.5">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {keys.map((key, index) => (
                    <span key={`${key}-${index}`} className="flex items-center gap-1.5">
                        {index ? <span className="text-xs opacity-35">+</span> : null}
                        <kbd
                            className="min-w-9 rounded-md border px-2.5 py-1.5 text-center text-xs font-medium leading-none shadow-[inset_0_-1px_0_rgba(0,0,0,.08),0_1px_2px_rgba(0,0,0,.06)]"
                            style={{ borderColor: "rgba(120,113,108,.28)", background: "linear-gradient(#fff, rgba(245,245,244,.92))", color: "rgb(68,64,60)" }}
                        >
                            {key}
                        </kbd>
                    </span>
                ))}
            </span>
            <span className="text-right text-sm opacity-55">{value}</span>
        </div>
    );
}
