"use client";

import { Check, Download, Pencil, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "antd";
import { useLocale, useTranslations } from "next-intl";

import { useCanvasStore, type CanvasProject } from "../stores/use-canvas-store";
import { useCanvasUiStore } from "../stores/use-canvas-ui-store";
import { exportCanvasProjects } from "../utils/canvas-export";
import { resolveCanvasProjectPrefix } from "@/lib/site-brand";
import { usePublicSessionStore } from "@/stores/use-public-session-store";

export function CanvasProjectCard({ project }: { project: CanvasProject }) {
    const t = useTranslations("canvas");
    const locale = useLocale();
    const router = useRouter();
    const searchParams = useSearchParams();
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { title: "JoveCanvas", canvasProjectPrefix: "" };
    const canvasProjectPrefix = resolveCanvasProjectPrefix(site);
    const renameProject = useCanvasStore((state) => state.renameProject);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const editingId = useCanvasUiStore((state) => state.editingProjectId);
    const editingTitle = useCanvasUiStore((state) => state.editingProjectTitle);
    const startEditing = useCanvasUiStore((state) => state.startEditingProject);
    const setEditingTitle = useCanvasUiStore((state) => state.setEditingProjectTitle);
    const stopEditing = useCanvasUiStore((state) => state.stopEditingProject);
    const toggleSelected = useCanvasUiStore((state) => state.toggleSelectedProjectId);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);
    const editing = editingId === project.id;
    const selected = selectedIds.includes(project.id);
    const open = () => router.push(`/canvas/${project.id}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`);
    const saveTitle = () => {
        renameProject(project.id, editingTitle);
        stopEditing();
    };

    return (
        <article
            className="group flex min-h-0 cursor-pointer flex-col justify-between rounded-lg border border-border bg-card p-2.5 text-card-foreground transition hover:border-foreground/20 hover:bg-accent/35 sm:min-h-44 sm:p-5"
            onClick={() => !editing && open()}
        >
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    checked={selected}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => toggleSelected(project.id, event.target.checked)}
                    className="mt-1 size-4 accent-stone-950 dark:accent-stone-100"
                    aria-label={t("list.card.selectAria", { title: project.title })}
                />
                {editing ? (
                    <Input className="min-w-0" value={editingTitle} onClick={(event) => event.stopPropagation()} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveTitle()} autoFocus />
                ) : (
                    <button
                        type="button"
                        className="min-w-0 cursor-pointer text-left"
                        onClick={(event) => {
                            event.stopPropagation();
                            open();
                        }}
                    >
                        <h2 className="truncate text-base font-semibold text-stone-950 sm:text-xl dark:text-stone-100">{project.title}</h2>
                        <p className="mt-1.5 text-xs leading-5 text-stone-600 sm:mt-3 sm:text-sm sm:leading-6 dark:text-stone-400">{t("list.card.nodesConnections", { nodes: project.nodes.length, connections: project.connections.length })}</p>
                    </button>
                )}
            </div>
            <div className="mt-2 flex items-end justify-between gap-3 sm:mt-8">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                    {t("list.card.updatedAt", { date: new Date(project.updatedAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) })}
                </p>
                <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                    {editing ? (
                        <>
                            <Button type="text" size="small" shape="circle" icon={<Check className="size-4" />} onClick={saveTitle} aria-label={t("list.card.saveTitleAria")} />
                            <Button type="text" size="small" shape="circle" icon={<X className="size-4" />} onClick={stopEditing} aria-label={t("list.card.cancelRenameAria")} />
                        </>
                    ) : (
                        <>
                            <Button
                                type="text"
                                size="small"
                                shape="circle"
                                icon={<Download className="size-4" />}
                                onClick={() => void exportCanvasProjects([project], project.title || t("list.card.defaultExportName", { prefix: canvasProjectPrefix }))}
                                aria-label={t("list.card.exportAria")}
                            />
                            <Button type="text" size="small" shape="circle" icon={<Pencil className="size-4" />} onClick={() => startEditing(project.id, project.title)} aria-label={t("list.card.renameAria")} />
                            <Button type="text" size="small" shape="circle" icon={<Trash2 className="size-4" />} onClick={() => setDeleteIds([project.id])} aria-label={t("list.card.deleteAria")} />
                        </>
                    )}
                </div>
            </div>
        </article>
    );
}
