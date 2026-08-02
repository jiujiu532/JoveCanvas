"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { App, Button } from "antd";
import { Download, FileUp, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { readZip } from "@/lib/zip";
import { APP_EXPORT_ID } from "@/lib/storage-keys";
import { uploadMediaFile } from "@/services/file-storage";
import { uploadImage } from "@/services/image-storage";
import { CanvasDeleteProjectsDialog } from "./components/canvas-delete-projects-dialog";
import { CanvasProjectCard } from "./components/canvas-project-card";
import type { CanvasExportFile } from "./export-types";
import { useCanvasStore } from "./stores/use-canvas-store";
import { useCanvasUiStore } from "./stores/use-canvas-ui-store";
import { useUserStore } from "@/stores/use-user-store";
import { exportCanvasProjects } from "./utils/canvas-export";

export default function CanvasPage() {
    const t = useTranslations("canvas");
    const { message } = App.useApp();
    const router = useRouter();
    const searchParams = useSearchParams();
    const inputRef = useRef<HTMLInputElement>(null);
    const autoOpenRef = useRef(false);
    const [creating, setCreating] = useState(false);
    const [exporting, setExporting] = useState(false);
    const userId = useUserStore((state) => state.user?.id || "");
    const hydrated = useCanvasStore((state) => state.hydrated);
    const hydratedUserId = useCanvasStore((state) => state.hydratedUserId);
    const syncError = useCanvasStore((state) => state.syncError);
    const hydrate = useCanvasStore((state) => state.hydrate);
    const projects = useCanvasStore((state) => state.summaries);
    const loadProject = useCanvasStore((state) => state.loadProject);
    const createProject = useCanvasStore((state) => state.createProject);
    const importProject = useCanvasStore((state) => state.importProject);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);
    const ready = Boolean(userId && hydrated && hydratedUserId === userId);

    const mode = searchParams.get("mode");
    const agentMode = mode === "new" || mode === "recent" || mode === "choose";
    const agentQuery = agentMode ? `?${searchParams.toString()}` : "";
    const defaultProjectName = (index: number) => t("list.defaultProjectName", { prefix: "JoveCanvas", index });
    const enterProject = (id: string) => {
        router.push(`/canvas/${id}${agentQuery}`);
    };
    const createAndEnter = async () => {
        if (creating) return;
        setCreating(true);
        try {
            enterProject(await createProject(defaultProjectName(projects.length + 1)));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("list.createFailed"));
        } finally {
            setCreating(false);
        }
    };
    const importCanvas = async (file?: File) => {
        if (!file) return;
        try {
            const zip = await readZip(file);
            const projectFile = zip.get("projects.json");
            if (!projectFile) throw new Error("missing projects.json");
            const data = JSON.parse(await projectFile.text()) as CanvasExportFile;
            if (data.app !== APP_EXPORT_ID) throw new Error(t("list.notCurrentAppPackage"));
            await Promise.all(
                data.projects.map(async (item) => {
                    const uploaded = new Map<string, { storageKey: string; url: string }>();
                    await Promise.all(
                        item.files.map(async (file) => {
                            const blob = zip.get(file.path);
                            if (!blob) return;
                            const typedBlob = blob.type ? blob : blob.slice(0, blob.size, file.mimeType);
                            const media = file.mimeType.startsWith("image/") ? await uploadImage(typedBlob) : await uploadMediaFile(typedBlob, file.mimeType.startsWith("audio/") ? "audio" : "video");
                            uploaded.set(file.storageKey, media);
                        }),
                    );
                    await importProject(remapImportedProjectMedia(item.project, uploaded));
                }),
            );
            message.success(t("list.importedCount", { count: data.projects.length }));
        } catch {
            message.error(t("list.importFailed"));
        } finally {
            if (inputRef.current) inputRef.current.value = "";
        }
    };
    const exportSelectedProjects = async () => {
        if (!selectedIds.length || exporting) return;
        setExporting(true);
        try {
            const selected = await Promise.all(selectedIds.map((id) => loadProject(id)));
            await exportCanvasProjects(selected);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("list.exportFailed"));
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        void hydrate();
    }, [hydrate, userId]);

    useEffect(() => {
        if (!ready || autoOpenRef.current || (mode !== "new" && mode !== "recent")) return;
        autoOpenRef.current = true;
        void (async () => {
            try {
                const id = mode === "new" ? await createProject(defaultProjectName(projects.length + 1)) : projects[0]?.id || (await createProject(defaultProjectName(projects.length + 1)));
                enterProject(id);
            } catch (error) {
                autoOpenRef.current = false;
                message.error(error instanceof Error ? error.message : t("list.openFailed"));
            }
        })();
    }, [createProject, message, mode, projects, ready, t]);

    if (ready && (mode === "new" || mode === "recent")) return <main className="flex h-full items-center justify-center bg-background text-sm text-stone-500">{t("list.opening")}</main>;

    return (
        <main className="h-full overflow-auto bg-background text-stone-950 dark:text-stone-100">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-2 py-2 sm:gap-6 sm:px-6 sm:py-8">
                <header className="flex flex-wrap items-end justify-between gap-2.5 border-b border-border pb-3 sm:gap-4 sm:pb-5">
                    <div>
                        <p className="text-xs text-stone-500">{t("list.projectsHeading")}</p>
                        <h1 className="mt-1 text-xl font-semibold sm:mt-2 sm:text-2xl">{t("list.title")}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedIds.length ? (
                            <>
                                <Button disabled={!ready} loading={exporting} icon={<Download className="size-4" />} onClick={() => void exportSelectedProjects()}>
                                    {t("list.exportSelected")}
                                </Button>
                                <Button disabled={!ready} onClick={() => setDeleteIds(selectedIds)}>
                                    {t("list.deleteSelected")}
                                </Button>
                            </>
                        ) : null}
                        {projects.length ? (
                            <Button disabled={!ready} onClick={() => setDeleteIds(projects.map((project) => project.id))}>
                                {t("list.deleteAll")}
                            </Button>
                        ) : null}
                        <Button disabled={!ready} icon={<FileUp className="size-4" />} onClick={() => inputRef.current?.click()}>
                            {t("list.import")}
                        </Button>
                        <Button disabled={!ready} loading={creating} type="primary" icon={<Plus className="size-4" />} onClick={() => void createAndEnter()}>
                            {t("list.create")}
                        </Button>
                    </div>
                </header>

                {!ready ? (
                    <section className="flex min-h-24 flex-col items-center justify-center gap-3 border-y border-stone-200 px-4 text-center text-sm text-stone-500 sm:min-h-48 dark:border-stone-800">
                        <span>{syncError || t("list.loading")}</span>
                        {syncError ? (
                            <Button size="small" onClick={() => void hydrate(true)}>
                                {t("list.reload")}
                            </Button>
                        ) : null}
                    </section>
                ) : projects.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                        {projects.map((project) => (
                            <CanvasProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                ) : (
                    <section className="flex min-h-24 flex-col items-center justify-center border-y border-stone-200 px-3 py-5 text-center sm:min-h-56 sm:py-8 dark:border-stone-800">
                        <h2 className="text-lg font-medium sm:text-xl">{t("list.emptyTitle")}</h2>
                        <p className="mt-1.5 text-xs text-stone-500 sm:mt-3 sm:text-sm">{t("list.emptyDesc")}</p>
                        <Button type="primary" size="small" className="mt-3 sm:mt-5" loading={creating} icon={<Plus className="size-4" />} onClick={() => void createAndEnter()}>
                            {t("list.create")}
                        </Button>
                    </section>
                )}
            </div>

            <input ref={inputRef} type="file" accept="application/zip,.zip" className="hidden" onChange={(event) => void importCanvas(event.target.files?.[0])} />
            <CanvasDeleteProjectsDialog />
        </main>
    );
}

function remapImportedProjectMedia(project: CanvasExportFile["projects"][number]["project"], uploaded: Map<string, { storageKey: string; url: string }>) {
    const visit = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(visit);
        if (!value || typeof value !== "object") return value;
        const source = value as Record<string, unknown>;
        const next = Object.fromEntries(Object.entries(source).map(([key, item]) => [key, visit(item)]));
        const media = typeof source.storageKey === "string" ? uploaded.get(source.storageKey) : undefined;
        if (!media) return next;
        next.storageKey = media.storageKey;
        next.serverUrl = media.url;
        delete next.remoteUrl;
        if ("content" in source) next.content = media.url;
        if ("dataUrl" in source) next.dataUrl = media.url;
        if ("url" in source) next.url = media.url;
        return next;
    };
    return visit(project) as typeof project;
}
