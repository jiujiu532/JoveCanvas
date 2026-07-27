"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { App, Button, Empty, Input, Progress, Segmented, Tabs, Tag } from "antd";
import { ArrowLeft, BookOpenText, Captions, Clapperboard, Download, Film, ImageIcon, Pause, Play, RefreshCw, Save, ScanSearch, Send, Sparkles, Volume2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createImageGenerationTask, waitForImageGenerationTask } from "@/services/api/image";
import { createServerVideoGenerationTask } from "@/services/api/video";
import { syncUserPointsFromHeaders } from "@/services/api/points";
import { exportDramaJianyingDraft, getDramaProjectCosts, reviewDramaEpisode } from "@/services/api/drama-projects";
import { compileDramaShotPrompts } from "@/lib/drama-prompt-compiler";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { splitDramaSource } from "@/lib/drama-source-splitter";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { dramaT } from "../stores/drama-i18n-runtime";
import { useDramaStore } from "../stores/use-drama-store";
import type { DramaContentAnalysis, DramaCostSummary, DramaProject, DramaProjectVersion, DramaRenderTask, DramaShot, DramaVisualAnalysis } from "../types";
import { buildSrt } from "../subtitle";
import { cancelDramaAudioTask, useDramaAudioQueue } from "./use-drama-audio-queue";
import { DramaAgentPanel } from "./drama-agent-panel";
import { DramaAssetsPanel } from "./drama-assets-panel";
import { DramaReviewPanel } from "./drama-review-panel";
import { DramaStoryboardShotCard } from "./drama-storyboard-shot-card";
import { DramaJianyingModal, DramaSubtitleModal, DramaVersionModal } from "./drama-project-modals";
import { estimateEpisodePoints, estimateTaskPoints, referenceImage, shotReferenceImages, storyboardReferenceImages } from "./drama-shot-generation-utils";

type Stage = "script" | "review" | "assets" | "storyboard" | "generate";

function shotNeedsVoiceover(shot: DramaShot) {
    return shot.audioMode === "voiceover" && Boolean((shot.subtitle || shot.dialogue || shot.narration).trim());
}
function getStages(t: ReturnType<typeof useTranslations<"drama">>) {
    return [
        { value: "script" as const, label: t("editor.stages.script"), shortLabel: t("editor.stages.scriptShort"), icon: Clapperboard },
        { value: "review" as const, label: t("editor.stages.review"), shortLabel: t("editor.stages.reviewShort"), icon: Save },
        { value: "assets" as const, label: t("editor.stages.assets"), shortLabel: t("editor.stages.assetsShort"), icon: Sparkles },
        { value: "storyboard" as const, label: t("editor.stages.storyboard"), shortLabel: t("editor.stages.storyboardShort"), icon: Film },
        { value: "generate" as const, label: t("editor.stages.generate"), shortLabel: t("editor.stages.generateShort"), icon: Sparkles },
    ];
}
const generationActionButtonClass = "!h-9 !px-3 [&>span:last-child]:whitespace-nowrap";
import { SectionTitle, GenerationTag, StoryboardTag, AudioTag, stableTaskUrl } from "./drama-editor-elements";

export default function DramaProjectPage() {
    const t = useTranslations("drama");
    const router = useRouter();
    const projectId = String(useParams<{ id: string }>().id || "");
    const loadProject = useDramaStore((state) => state.loadProject);
    const project = useDramaStore((state) => state.projects.find((item) => item.id === projectId));
    const userId = useUserStore((state) => state.user?.id || "");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    useEffect(() => {
        let active = true;
        setLoading(true);
        setLoadError("");
        void loadProject(projectId)
            .catch((error) => active && setLoadError(error instanceof Error ? error.message : t("store.projectLoadFailed")))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [loadProject, projectId, t, userId]);
    if (loading && !project) return <main className="grid h-full place-items-center bg-background text-sm text-muted-foreground">{t("editor.loading")}</main>;
    if (!project)
        return (
            <main className="grid h-full place-items-center bg-background">
                <Empty description={loadError || t("editor.notFound")}>
                    <Button onClick={() => router.push("/drama")}>{t("editor.backToList")}</Button>
                </Empty>
            </main>
        );
    return <DramaProjectEditor project={project} />;
}

function DramaProjectEditor({ project }: { project: DramaProject }) {
    const t = useTranslations("drama");
    const tc = useTranslations("common");
    const stages = getStages(t);
    const { message, modal } = App.useApp();
    const router = useRouter();
    const updateProject = useDramaStore((state) => state.updateProject);
    const updateEpisode = useDramaStore((state) => state.updateEpisode);
    const addEpisode = useDramaStore((state) => state.addEpisode);
    const importEpisodes = useDramaStore((state) => state.importEpisodes);
    const deleteEpisode = useDramaStore((state) => state.deleteEpisode);
    const selectEpisode = useDramaStore((state) => state.selectEpisode);
    const updateShot = useDramaStore((state) => state.updateShot);
    const queueShots = useDramaStore((state) => state.queueShots);
    const applyContentAnalysis = useDramaStore((state) => state.applyContentAnalysis);
    const applyVisualAnalysis = useDramaStore((state) => state.applyVisualAnalysis);
    const createVersion = useDramaStore((state) => state.createVersion);
    const listVersions = useDramaStore((state) => state.listVersions);
    const restoreVersion = useDramaStore((state) => state.restoreVersion);
    const queueAudio = useDramaStore((state) => state.queueAudio);
    const config = useEffectiveConfig();
    const startingShotRef = useRef("");
    const storyboardTaskRef = useRef("");
    const sourceFileInputRef = useRef<HTMLInputElement>(null);
    const [stage, setStage] = useState<Stage>("script");
    const [analyzing, setAnalyzing] = useState(false);
    const [designing, setDesigning] = useState(false);
    const [versionsOpen, setVersionsOpen] = useState(false);
    const [versions, setVersions] = useState<DramaProjectVersion[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [costSummary, setCostSummary] = useState<DramaCostSummary | null>(null);
    const [jianyingOpen, setJianyingOpen] = useState(false);
    const [jianyingPath, setJianyingPath] = useState("");
    const [jianyingVersion, setJianyingVersion] = useState<"5" | "6">("6");
    const [jianyingExporting, setJianyingExporting] = useState(false);
    const [subtitleOpen, setSubtitleOpen] = useState(false);
    const [renderReady, setRenderReady] = useState<boolean | null>(null);
    const [reviewingVisuals, setReviewingVisuals] = useState(false);
    const [expandedStoryboardShotId, setExpandedStoryboardShotId] = useState("");
    const audioReady = Boolean(config.audioModel.trim());

    const episode = project.episodes.find((item) => item.id === project.activeEpisodeId) || project.episodes[0];
    const renderTask = episode.renderTask || null;
    useDramaAudioQueue(project, episode, config, updateShot);
    useEffect(() => {
        if (stage !== "generate" || renderReady !== null) return;
        void fetch("/api/drama/render-capability", { cache: "no-store" })
            .then((response) => response.json())
            .then((payload: { data?: { available?: boolean } }) => setRenderReady(Boolean(payload.data?.available)))
            .catch(() => setRenderReady(false));
    }, [renderReady, stage]);
    useEffect(() => {
        if (stage !== "generate") return;
        let active = true;
        const load = () =>
            void getDramaProjectCosts(project.id)
                .then((value) => active && setCostSummary(value))
                .catch(() => active && setCostSummary(null));
        load();
        const timer = window.setInterval(load, 5000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [project.id, stage]);
    useEffect(() => {
        if (!renderTask?.id || !["pending", "running"].includes(renderTask.status)) return;
        const timer = window.setInterval(async () => {
            const response = await fetch(`/api/drama/render/${encodeURIComponent(renderTask.id)}`, { cache: "no-store" });
            const payload = (await response.json().catch(() => ({}))) as { data?: DramaRenderTask; msg?: string };
            if (response.ok && payload.data) updateEpisode(project.id, episode.id, { renderTask: payload.data });
        }, 2500);
        return () => window.clearInterval(timer);
    }, [episode.id, project.id, renderTask, updateEpisode]);
    const analyzeScript = async () => {
        if (!episode.script.trim()) return message.warning(t("editor.script.needScript"));
        setAnalyzing(true);
        try {
            const response = await fetch("/api/drama/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phase: "content", script: episode.script, summary: project.summary, style: project.style }) });
            syncUserPointsFromHeaders(response.headers, "system");
            const payload = (await response.json().catch(() => ({}))) as { data?: DramaContentAnalysis; msg?: string };
            if (!response.ok || !payload.data) throw new Error(payload.msg || t("editor.script.analyzeFailed"));
            await createVersion(project, t("editor.versionReasons.beforeContentAnalysis"));
            applyContentAnalysis(project.id, episode.id, payload.data);
            setStage("review");
            message.success(t("editor.script.analyzeSuccess", { characters: payload.data.characters.length, scenes: payload.data.scenes.length, shots: payload.data.shots.length }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("editor.script.analyzeFailed"));
        } finally {
            setAnalyzing(false);
        }
    };
    const importSourceBook = async (file?: File) => {
        if (!file) return;
        try {
            const drafts = splitDramaSource(await file.text());
            if (!drafts.length) return message.warning(t("editor.script.importEmpty"));
            modal.confirm({
                title: t("editor.script.importConfirmTitle", { count: drafts.length }),
                content: t("editor.script.importConfirmContent"),
                okText: t("editor.script.importConfirmOk"),
                cancelText: tc("cancel"),
                onOk: async () => {
                    await createVersion(project, t("editor.versionReasons.beforeImport"));
                    importEpisodes(project.id, drafts);
                    setStage("script");
                    message.success(t("editor.script.importSuccess", { count: drafts.length }));
                },
            });
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("editor.script.importFailed"));
        } finally {
            if (sourceFileInputRef.current) sourceFileInputRef.current.value = "";
        }
    };
    const designVisuals = async () => {
        if (!episode.shots.length) return message.warning(t("review.needContent"));
        updateEpisode(project.id, episode.id, { reviewStatus: "approved" });
        setDesigning(true);
        try {
            const response = await fetch("/api/drama/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phase: "visual", summary: project.summary, style: project.style, episode, characters: project.characters, scenes: project.scenes, props: project.props, clues: project.clues, shots: episode.shots }),
            });
            syncUserPointsFromHeaders(response.headers, "system");
            const payload = (await response.json().catch(() => ({}))) as { data?: DramaVisualAnalysis; msg?: string };
            if (!response.ok || !payload.data) throw new Error(payload.msg || t("review.designFailed"));
            await createVersion(project, t("editor.versionReasons.beforeVisualDesign"));
            applyVisualAnalysis(project.id, episode.id, payload.data);
            setStage("storyboard");
            message.success(t("review.designSuccess"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("review.designFailed"));
        } finally {
            setDesigning(false);
        }
    };
    const openVersions = async () => {
        setVersionsOpen(true);
        setVersionsLoading(true);
        try {
            setVersions(await listVersions(project.id));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("modals.version.loadFailed"));
        } finally {
            setVersionsLoading(false);
        }
    };
    const restore = async (version: DramaProjectVersion) => {
        try {
            await restoreVersion(project.id, version.id);
            setVersionsOpen(false);
            setStage("review");
            message.success(t("modals.version.restoreSuccess", { version: version.version }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("modals.version.restoreFailed"));
        }
    };
    const sendToVideo = (shot: DramaShot) => {
        const prompt = compileDramaShotPrompts(project, episode, shot).videoPrompt;
        router.push(`/video?source=drama&projectId=${encodeURIComponent(project.id)}&prompt=${encodeURIComponent(prompt)}&size=${encodeURIComponent(project.ratio)}`);
    };

    useEffect(() => {
        const runningEnd = episode.shots.find((shot) => shot.storyboardEndStatus === "running" && shot.storyboardEndTaskId);
        if (runningEnd) {
            const key = `${episode.id}:${runningEnd.id}:${runningEnd.storyboardEndTaskId}`;
            if (storyboardTaskRef.current === key) return;
            storyboardTaskRef.current = key;
            const imageConfig = { ...config, model: config.imageModel || config.model, imageModel: config.imageModel || config.model, size: project.ratio, count: "1" };
            void waitForImageGenerationTask(imageConfig, { id: runningEnd.storyboardEndTaskId!, kind: "generation", model: imageConfig.model })
                .then((result) => {
                    const imageUrl = stableTaskUrl(result.remoteUrl, result.serverUrl, result.dataUrl);
                    if (!imageUrl) throw new Error(dramaT()("storyboard.endFrameNoUrl"));
                    updateShot(project.id, episode.id, runningEnd.id, {
                        storyboardEndStatus: "success",
                        storyboardEndImageUrl: imageUrl,
                        storyboardEndError: undefined,
                        generationStatus: "queued",
                    });
                })
                .catch((error) => updateShot(project.id, episode.id, runningEnd.id, { storyboardEndStatus: "error", storyboardEndError: error instanceof Error ? error.message : dramaT()("storyboard.endFrameGenerateFailed") }))
                .finally(() => {
                    storyboardTaskRef.current = "";
                });
            return;
        }
        const running = episode.shots.find((shot) => shot.storyboardStatus === "running" && shot.storyboardTaskId);
        if (running) {
            const key = `${episode.id}:${running.id}:${running.storyboardTaskId}`;
            if (storyboardTaskRef.current === key) return;
            storyboardTaskRef.current = key;
            const imageConfig = { ...config, model: config.imageModel || config.model, imageModel: config.imageModel || config.model, size: project.ratio, count: "1" };
            void waitForImageGenerationTask(imageConfig, { id: running.storyboardTaskId!, kind: "generation", model: imageConfig.model })
                .then((result) => {
                    const imageUrl = stableTaskUrl(result.remoteUrl, result.serverUrl, result.dataUrl);
                    if (!imageUrl) throw new Error(dramaT()("storyboard.imageNoUrl"));
                    const hasEndFrame = running.storyboardFrameMode === "first_last" && running.storyboardEndStatus === "success" && Boolean(running.storyboardEndImageUrl);
                    updateShot(project.id, episode.id, running.id, {
                        storyboardStatus: "success",
                        storyboardImageUrl: imageUrl,
                        storyboardError: undefined,
                        storyboardEndStatus: running.storyboardFrameMode === "first_last" ? (hasEndFrame ? "success" : "queued") : "idle",
                        generationStatus: running.storyboardFrameMode === "first_last" && !hasEndFrame ? "idle" : "queued",
                    });
                })
                .catch((error) => updateShot(project.id, episode.id, running.id, { storyboardStatus: "error", storyboardError: error instanceof Error ? error.message : dramaT()("storyboard.imageGenerateFailed") }))
                .finally(() => {
                    storyboardTaskRef.current = "";
                });
            return;
        }
        const nextEnd = episode.shots.find((shot) => shot.storyboardEndStatus === "queued" && shot.storyboardImageUrl);
        if (nextEnd && !storyboardTaskRef.current) {
            storyboardTaskRef.current = `${episode.id}:${nextEnd.id}:creating-end`;
            const imageConfig = { ...config, model: config.imageModel || config.model, imageModel: config.imageModel || config.model, size: project.ratio, count: "1" };
            const prompt = compileDramaShotPrompts(project, episode, nextEnd).endFramePrompt;
            const references = [referenceImage(`storyboard-start-${nextEnd.id}`, `${nextEnd.title}-${dramaT()("storyboard.startFrameFileSuffix")}.png`, nextEnd.storyboardImageUrl!)];
            void createImageGenerationTask(imageConfig, prompt, references, undefined, {
                logSource: "drama",
                logTitle: `${project.title} · ${nextEnd.title}${dramaT()("storyboard.endFrameLogSuffix")}`,
                conversationId: project.creativeConversationId,
                surface: "drama",
                projectId: project.id,
                episodeId: episode.id,
                shotId: nextEnd.id,
                estimatedPoints: estimateTaskPoints(config, "image"),
                attemptNo: nextEnd.storyboardEndAttempt || 1,
                clientRequestId: `drama-storyboard-end:${project.id}:${episode.id}:${nextEnd.id}:attempt-${nextEnd.storyboardEndAttempt || 1}`,
            })
                .then((task) => updateShot(project.id, episode.id, nextEnd.id, { storyboardEndStatus: "running", storyboardEndTaskId: task.id, storyboardEndError: undefined }))
                .catch((error) => updateShot(project.id, episode.id, nextEnd.id, { storyboardEndStatus: "error", storyboardEndError: error instanceof Error ? error.message : dramaT()("storyboard.endFrameTaskCreateFailed") }))
                .finally(() => {
                    storyboardTaskRef.current = "";
                });
            return;
        }
        const next = episode.shots.find((shot) => shot.storyboardStatus === "queued");
        if (!next || storyboardTaskRef.current) return;
        storyboardTaskRef.current = `${episode.id}:${next.id}:creating`;
        const imageConfig = { ...config, model: config.imageModel || config.model, imageModel: config.imageModel || config.model, size: project.ratio, count: "1" };
        const prompts = compileDramaShotPrompts(project, episode, next);
        void createImageGenerationTask(imageConfig, prompts.imagePrompt, [], undefined, {
            logSource: "drama",
            logTitle: `${project.title} · ${next.title}`,
            conversationId: project.creativeConversationId,
            surface: "drama",
            projectId: project.id,
            episodeId: episode.id,
            shotId: next.id,
            estimatedPoints: estimateTaskPoints(config, "image"),
            attemptNo: next.storyboardAttempt || 1,
            clientRequestId: `drama-storyboard:${project.id}:${episode.id}:${next.id}:attempt-${next.storyboardAttempt || 1}`,
        })
            .then((task) => updateShot(project.id, episode.id, next.id, { storyboardStatus: "running", storyboardTaskId: task.id, storyboardError: undefined }))
            .catch((error) => updateShot(project.id, episode.id, next.id, { storyboardStatus: "error", storyboardError: error instanceof Error ? error.message : dramaT()("storyboard.imageTaskCreateFailed") }))
            .finally(() => {
                storyboardTaskRef.current = "";
            });
    }, [config, episode.id, episode.shots, project.id, project.ratio, project.title, updateShot]);

    useEffect(() => {
        const running = episode.shots.find((shot) => shot.generationStatus === "running" && shot.generationTaskId);
        if (!running) return;
        const timer = window.setInterval(async () => {
            const response = await fetch(`/api/video-tasks/${encodeURIComponent(running.generationTaskId!)}`, { cache: "no-store" });
            syncUserPointsFromHeaders(response.headers, "system");
            const payload = (await response.json().catch(() => ({}))) as { task?: { status?: string; result?: { url?: string }; error?: string }; error?: string };
            if (!response.ok) return updateShot(project.id, episode.id, running.id, { generationStatus: "error", generationError: payload.error || dramaT()("render.videoQueryFailed") });
            if (payload.task?.status === "success")
                updateShot(project.id, episode.id, running.id, {
                    generationStatus: "success",
                    videoUrl: payload.task.result?.url,
                    generationError: undefined,
                    ...(running.audioMode === "voiceover" && (running.subtitle || running.dialogue).trim() && audioReady ? { audioStatus: "queued" as const, audioError: undefined } : {}),
                });
            if (payload.task?.status === "error" || payload.task?.status === "cancelled") updateShot(project.id, episode.id, running.id, { generationStatus: payload.task.status, generationError: payload.task.error });
        }, 2500);
        return () => window.clearInterval(timer);
    }, [audioReady, episode.id, episode.shots, project.id, updateShot]);

    useEffect(() => {
        if (episode.shots.some((shot) => shot.generationStatus === "running")) return;
        const next = episode.shots.find((shot) => shot.generationStatus === "queued");
        if (!next || startingShotRef.current === next.id) return;
        startingShotRef.current = next.id;
        const mode = next.videoMode || project.defaultVideoMode;
        const references = mode === "reference" ? shotReferenceImages(project, next) : storyboardReferenceImages(next);
        const prompts = compileDramaShotPrompts(project, episode, next);
        if (mode === "reference" && !references.length) {
            updateShot(project.id, episode.id, next.id, { generationStatus: "error", generationError: dramaT()("render.referenceModeRequired") });
            startingShotRef.current = "";
            return;
        }
        void createServerVideoGenerationTask(
            { ...config, model: config.videoModel || config.model, size: project.ratio, videoSeconds: String(next.duration), videoGenerateAudio: String((next.audioMode || "source") === "source") },
            prompts.videoPrompt,
            references,
            [],
            [],
            {
                conversationId: project.creativeConversationId,
                surface: "drama",
                projectId: project.id,
                episodeId: episode.id,
                shotId: next.id,
                estimatedPoints: estimateTaskPoints(config, "video", next.duration),
                parentTaskId: next.storyboardTaskId,
                attemptNo: next.generationAttempt || 1,
                clientRequestId: `drama-video:${project.id}:${episode.id}:${next.id}:attempt-${next.generationAttempt || 1}`,
            },
        )
            .then((task) => updateShot(project.id, episode.id, next.id, { generationStatus: "running", generationTaskId: task.serverTaskId || task.id, generationError: undefined }))
            .catch((error) => updateShot(project.id, episode.id, next.id, { generationStatus: "error", generationError: error instanceof Error ? error.message : dramaT()("render.videoCreateFailed") }))
            .finally(() => {
                startingShotRef.current = "";
            });
    }, [config, episode.id, episode.shots, project, updateShot]);

    const cancelShot = async (shotId: string, taskId?: string, storyboardTaskId?: string, storyboardEndTaskId?: string) => {
        if (storyboardTaskId) await fetch(`/api/image-tasks/${encodeURIComponent(storyboardTaskId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) }).catch(() => undefined);
        if (storyboardEndTaskId) await fetch(`/api/image-tasks/${encodeURIComponent(storyboardEndTaskId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) }).catch(() => undefined);
        if (taskId) await fetch(`/api/video-tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) }).catch(() => undefined);
        updateShot(project.id, episode.id, shotId, storyboardTaskId || storyboardEndTaskId ? { storyboardStatus: "cancelled", storyboardEndStatus: "cancelled", generationStatus: "cancelled" } : { generationStatus: "cancelled" });
    };
    const downloadSubtitles = () => {
        const content = buildSrt(episode.shots);
        if (!content) return message.warning(t("render.subtitleEmpty"));
        const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: "application/x-subrip;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${project.title.trim().replace(/[\\/:*?"<>|]/g, "-") || t("render.subtitleFileNameFallback")}.srt`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        message.success(t("render.subtitleExported"));
    };
    const exportJianying = async () => {
        if (!jianyingPath.trim()) return message.warning(t("modals.jianying.pathRequired"));
        setJianyingExporting(true);
        try {
            const result = await exportDramaJianyingDraft(project.id, { episodeId: episode.id, draftPath: jianyingPath.trim(), version: jianyingVersion });
            const url = URL.createObjectURL(result.blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = result.fileName;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setJianyingOpen(false);
            message.success(t("modals.jianying.exported"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("modals.jianying.exportFailed"));
        } finally {
            setJianyingExporting(false);
        }
    };
    const createRender = async () => {
        const response = await fetch("/api/drama/render", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                projectId: project.id,
                conversationId: project.creativeConversationId,
                title: project.title,
                ratio: project.ratio,
                shots: episode.shots.map((shot) => ({ videoUrl: shot.videoUrl, audioMode: shot.audioMode || "source", audioUrl: shot.audioUrl, subtitle: shot.subtitle || shot.dialogue, duration: shot.duration })),
            }),
        });
        const payload = (await response.json().catch(() => ({}))) as { data?: DramaRenderTask; msg?: string };
        if (!response.ok || !payload.data) return message.error(payload.msg || t("render.createFailed"));
        updateEpisode(project.id, episode.id, { renderTask: payload.data });
        message.success(t("render.createSuccess"));
    };
    const cancelRender = async () => {
        if (!renderTask?.id) return;
        await fetch(`/api/drama/render/${encodeURIComponent(renderTask.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
        updateEpisode(project.id, episode.id, { renderTask: { ...renderTask, status: "cancelled" } });
    };
    const reviewVisuals = async () => {
        if (!episode.shots.some((shot) => shot.storyboardImageUrl)) return message.warning(t("render.reviewNeedShot"));
        setReviewingVisuals(true);
        try {
            const review = await reviewDramaEpisode(project, episode);
            updateEpisode(project.id, episode.id, { visualReview: review });
            if (review.status === "passed") message.success(t("render.reviewPassed"));
            else if (review.status === "needs_revision") message.warning(t("render.reviewNeedsRevision"));
            else message.info(review.summary);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("render.reviewFailed"));
        } finally {
            setReviewingVisuals(false);
        }
    };

    return (
        <main className="h-full overflow-x-hidden overflow-y-auto bg-background text-foreground">
            <div className="relative mx-auto w-full max-w-[1500px] px-2.5 py-2.5 sm:px-6 sm:py-8">
                <header className="overflow-hidden rounded-lg border border-border bg-card p-3 sm:p-6">
                    <div className="flex flex-col gap-3 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-2.5 sm:gap-4">
                            <Button type="text" shape="circle" className="!size-9 sm:!size-9" icon={<ArrowLeft className="size-4" />} onClick={() => router.push("/drama")} aria-label={t("editor.backAria")} />
                            <div className="min-w-0">
                                <Input variant="borderless" className="!p-0 !text-xl !font-semibold sm:!text-2xl" value={project.title} onChange={(event) => updateProject(project.id, { title: event.target.value })} />
                                <p className="mt-1.5 text-sm leading-5 text-muted-foreground sm:mt-3 sm:leading-6">{project.summary || t("editor.summaryFallback")}</p>
                            </div>
                        </div>
                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
                            <Tag className="!m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={project.style}>
                                {project.style}
                            </Tag>
                            <Tag className="!m-0">{project.ratio}</Tag>
                            <Tag className="!m-0">{t("editor.shotsCountTag", { count: episode.shots.length })}</Tag>
                            <Button className="!h-9" icon={<Save className="size-4" />} onClick={() => void openVersions()}>
                                {t("editor.versionsButton")}
                            </Button>
                        </div>
                    </div>
                    <Tabs
                        className="mt-2.5 sm:mt-6"
                        type="editable-card"
                        activeKey={episode.id}
                        items={project.episodes.map((item) => ({ key: item.id, label: item.title, closable: project.episodes.length > 1 }))}
                        onChange={(episodeId) => selectEpisode(project.id, episodeId)}
                        onEdit={(targetKey, action) => {
                            if (action === "add") {
                                addEpisode(project.id);
                                setStage("script");
                                return;
                            }
                            const removing = project.episodes.find((item) => item.id === String(targetKey));
                            if (!removing) return;
                            modal.confirm({
                                title: t("editor.deleteEpisodeConfirmTitle", { title: removing.title }),
                                content: t("editor.deleteEpisodeConfirmContent"),
                                okText: tc("delete"),
                                okButtonProps: { danger: true },
                                cancelText: tc("cancel"),
                                onOk: () => deleteEpisode(project.id, removing.id),
                            });
                        }}
                    />
                    <div className="mt-3 grid grid-cols-5 gap-1.5 sm:mt-6 sm:gap-3">
                        {stages.map((item, index) => {
                            const Icon = item.icon;
                            const active = stage === item.value;
                            return (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setStage(item.value)}
                                    aria-label={`${String(index + 1).padStart(2, "0")} ${item.label}`}
                                    className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center transition sm:min-h-12 sm:flex-row sm:gap-3 sm:px-4 sm:py-3.5 sm:text-left ${active ? "border-foreground bg-foreground !text-background" : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:bg-accent hover:text-foreground"}`}
                                >
                                    <span className="hidden text-xs opacity-60 sm:inline">0{index + 1}</span>
                                    <Icon className="size-4" />
                                    <span className="whitespace-nowrap text-[11px] font-medium leading-none sm:text-sm">
                                        <span className="sm:hidden">{item.shortLabel}</span>
                                        <span className="hidden sm:inline">{item.label}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </header>

                <div className="mt-3 grid min-h-0 min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_380px] sm:mt-5 sm:gap-5">
                    <section className="min-w-0 rounded-lg border border-border bg-card p-3 sm:p-6">
                        {stage === "script" ? (
                            <div>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                                    <SectionTitle className="!mb-0" title={t("editor.script.sectionTitle")} description={t("editor.script.sectionDescription")} />
                                    <Button className="!h-9 !w-full sm:!w-auto" icon={<BookOpenText className="size-4" />} onClick={() => sourceFileInputRef.current?.click()}>
                                        {t("editor.script.importButton")}
                                    </Button>
                                </div>
                                <input ref={sourceFileInputRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(event) => void importSourceBook(event.target.files?.[0])} />
                                <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                                    <Input.TextArea
                                        className="!h-52 !rounded-lg !bg-background !p-2.5 sm:!h-auto sm:!p-4"
                                        value={episode.script}
                                        onChange={(event) => updateEpisode(project.id, episode.id, { script: event.target.value })}
                                        rows={18}
                                        placeholder={t("editor.script.scriptPlaceholder")}
                                    />
                                    <div className="space-y-4 rounded-lg border border-border bg-background p-3 sm:space-y-5 sm:p-5">
                                        <label className="block space-y-2.5">
                                            <span className="text-sm font-medium">{t("editor.script.episodeTitleLabel")}</span>
                                            <Input value={episode.title} onChange={(event) => updateEpisode(project.id, episode.id, { title: event.target.value })} />
                                        </label>
                                        <label className="block space-y-2.5">
                                            <span className="text-sm font-medium">{t("editor.script.summaryLabel")}</span>
                                            <Input.TextArea value={project.summary} onChange={(event) => updateProject(project.id, { summary: event.target.value })} rows={4} />
                                        </label>
                                        <label className="block space-y-2.5">
                                            <span className="text-sm font-medium">{t("editor.script.styleLabel")}</span>
                                            <Input value={project.style} onChange={(event) => updateProject(project.id, { style: event.target.value })} />
                                        </label>
                                        <label className="block space-y-2.5">
                                            <span className="text-sm font-medium">{t("editor.script.videoModeLabel")}</span>
                                            <Segmented
                                                block
                                                value={project.defaultVideoMode}
                                                options={[
                                                    { label: t("editor.videoModes.storyboard"), value: "storyboard" },
                                                    { label: t("editor.videoModes.direct"), value: "direct" },
                                                    { label: t("editor.videoModes.reference"), value: "reference" },
                                                ]}
                                                onChange={(value) => updateProject(project.id, { defaultVideoMode: value as DramaProject["defaultVideoMode"] })}
                                            />
                                        </label>
                                        <Button type="primary" block className="!h-11 sm:!h-9" icon={<Sparkles className="size-4" />} loading={analyzing} onClick={() => void analyzeScript()}>
                                            {t("editor.script.analyzeButton")}
                                        </Button>
                                        <p className="pt-1 text-xs leading-5 text-muted-foreground">{t("editor.script.analyzeHint")}</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {stage === "review" ? <DramaReviewPanel project={project} episode={episode} designing={designing} onDesignVisuals={() => void designVisuals()} /> : null}

                        {stage === "assets" ? <DramaAssetsPanel project={project} /> : null}

                        {stage === "storyboard" ? (
                            <div>
                                <SectionTitle title={t("storyboard.sectionTitle")} description={t("storyboard.sectionDescription")} />
                                {episode.shots.length ? (
                                    <div className="grid min-w-0 items-start gap-3 xl:grid-cols-2 sm:gap-5">
                                        {episode.shots.map((shot) => (
                                            <DramaStoryboardShotCard
                                                key={shot.id}
                                                project={project}
                                                episodeId={episode.id}
                                                shot={shot}
                                                expanded={expandedStoryboardShotId === shot.id}
                                                onToggle={() => setExpandedStoryboardShotId((current) => (current === shot.id ? "" : shot.id))}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <Empty description={t("storyboard.empty")}>
                                        <Button type="primary" onClick={() => setStage("script")}>
                                            {t("storyboard.goToScript")}
                                        </Button>
                                    </Empty>
                                )}
                            </div>
                        ) : null}

                        {stage === "generate" ? (
                            <div>
                                {episode.reviewStatus !== "visual_ready" ? (
                                    <p className="mb-4 border-l-2 border-amber-400 pl-3 text-sm leading-5 text-amber-700 sm:mb-6 sm:leading-6 dark:text-amber-200">{t("render.needReviewHint", { stage: t("editor.stages.review") })}</p>
                                ) : null}
                                <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:mb-6 sm:grid-cols-4">
                                    {[
                                        [t("render.stats.estimatedLabel"), t("render.stats.pointsValue", { value: estimateEpisodePoints(config, project, episode.shots) })],
                                        [t("render.stats.actualLabel"), t("render.stats.pointsValue", { value: costSummary?.actualPoints || 0 })],
                                        [t("render.stats.taskCountLabel"), String(costSummary?.taskCount || 0)],
                                        [t("render.stats.failedLabel"), String(costSummary?.failedCount || 0)],
                                    ].map(([label, value]) => (
                                        <div key={label} className="bg-background px-3 py-2.5 sm:px-4 sm:py-3">
                                            <div className="text-xs text-muted-foreground">{label}</div>
                                            <div className="mt-1 font-semibold">{value}</div>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <SectionTitle className="!mb-4 sm:!mb-5" title={t("render.queue.title")} description={t("render.queue.description")} />
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                            <Button
                                                className={generationActionButtonClass}
                                                icon={<Film className="size-4" />}
                                                loading={renderTask?.status === "pending" || renderTask?.status === "running"}
                                                disabled={
                                                    !renderReady ||
                                                    !episode.shots.length ||
                                                    !episode.shots.every((shot) => shot.videoUrl && (!shotNeedsVoiceover(shot) || shot.audioUrl)) ||
                                                    Boolean(renderTask && ["pending", "running"].includes(renderTask.status))
                                                }
                                                title={!renderReady ? t("render.tooltips.ffmpegMissing") : t("render.tooltips.allShotsRequired")}
                                                onClick={() => void createRender()}
                                            >
                                                {renderReady === null ? t("render.buttons.checking") : renderReady ? t("render.buttons.renderAll") : t("render.buttons.ffmpegNotReady")}
                                            </Button>
                                            <Button
                                                className={generationActionButtonClass}
                                                icon={<Volume2 className="size-4" />}
                                                disabled={!audioReady || !episode.shots.some((shot) => shot.videoUrl && (shot.subtitle || shot.dialogue).trim())}
                                                title={audioReady ? undefined : t("render.tooltips.audioModelMissing")}
                                                onClick={() =>
                                                    queueAudio(
                                                        project.id,
                                                        episode.id,
                                                        episode.shots.filter((shot) => shot.audioStatus !== "success").map((shot) => shot.id),
                                                    )
                                                }
                                            >
                                                {t("render.buttons.batchVoiceover")}
                                            </Button>
                                            <Button
                                                className={generationActionButtonClass}
                                                icon={<ScanSearch className="size-4" />}
                                                loading={reviewingVisuals}
                                                disabled={!episode.shots.some((shot) => shot.storyboardImageUrl)}
                                                onClick={() => void reviewVisuals()}
                                            >
                                                {t("render.buttons.reviewVisuals")}
                                            </Button>
                                            <Button
                                                type="primary"
                                                className={`col-span-2 sm:col-span-1 ${generationActionButtonClass}`}
                                                icon={<Play className="size-4" />}
                                                disabled={!episode.shots.length || episode.reviewStatus !== "visual_ready"}
                                                onClick={() =>
                                                    queueShots(
                                                        project.id,
                                                        episode.id,
                                                        episode.shots.filter((shot) => shot.generationStatus !== "success").map((shot) => shot.id),
                                                    )
                                                }
                                            >
                                                {t("render.buttons.batchGenerate")}
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                                            <Button className={generationActionButtonClass} icon={<Captions className="size-4" />} disabled={!episode.shots.some((shot) => (shot.subtitle || shot.dialogue).trim())} onClick={() => setSubtitleOpen(true)}>
                                                {t("render.buttons.subtitleTimeline")}
                                            </Button>
                                            <Button className={generationActionButtonClass} icon={<Download className="size-4" />} disabled={!episode.shots.some((shot) => (shot.subtitle || shot.dialogue).trim())} onClick={downloadSubtitles}>
                                                {t("render.buttons.exportSrt")}
                                            </Button>
                                            <Button className={`col-span-2 sm:col-span-1 ${generationActionButtonClass}`} icon={<Download className="size-4" />} disabled={!episode.shots.some((shot) => shot.videoUrl)} onClick={() => setJianyingOpen(true)}>
                                                {t("render.buttons.jianyingDraft")}
                                            </Button>
                                        </div>
                                    </div>
                                    {episode.visualReview ? (
                                        <div className="mt-4 border-y border-border py-3 sm:mt-5 sm:py-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-semibold">{t("render.review.title")}</span>
                                                        <Tag color={episode.visualReview.status === "passed" ? "success" : episode.visualReview.status === "needs_revision" ? "warning" : "default"}>
                                                            {episode.visualReview.status === "passed"
                                                                ? t("render.review.status.passed")
                                                                : episode.visualReview.status === "needs_revision"
                                                                  ? t("render.review.status.needsRevision")
                                                                  : t("render.review.status.pending")}
                                                        </Tag>
                                                        {typeof episode.visualReview.score === "number" ? <span className="text-sm tabular-nums text-muted-foreground">{t("render.review.scoreValue", { score: episode.visualReview.score })}</span> : null}
                                                    </div>
                                                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{episode.visualReview.summary}</p>
                                                </div>
                                                {episode.visualReview.retryTaskIds.length ? (
                                                    <Button className="!h-9 shrink-0" icon={<RefreshCw className="size-4" />} onClick={() => queueShots(project.id, episode.id, episode.visualReview!.retryTaskIds)}>
                                                        {t("render.review.retryButton")}
                                                    </Button>
                                                ) : null}
                                            </div>
                                            {episode.visualReview.issues.length ? (
                                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                    {episode.visualReview.issues.map((issue, index) => {
                                                        const shot = episode.shots.find((item) => item.id === issue.taskId);
                                                        return (
                                                            <div key={`${issue.taskId || "general"}-${index}`} className="border-l-2 border-amber-400 pl-3 text-sm">
                                                                <div className="font-medium">{shot?.title || issue.category}</div>
                                                                <p className="mt-1 leading-5 text-muted-foreground">{issue.message}</p>
                                                                {issue.correction ? <p className="mt-1 leading-5">{t("render.review.correctionPrefix", { correction: issue.correction })}</p> : null}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                                {!audioReady ? <p className="mt-6 border-l-2 border-amber-400 pl-3 text-sm leading-6 text-amber-700 dark:border-amber-300 dark:text-amber-200">{t("render.audioUnavailableHint")}</p> : null}
                                {renderTask ? (
                                    <div className="mt-4 rounded-xl border border-border/80 bg-background/65 p-4 sm:mt-6 sm:rounded-2xl sm:p-6">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 font-semibold">
                                                    <Film className="size-4" />
                                                    {t("render.task.title")}
                                                </div>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {renderTask.status === "success"
                                                        ? t("render.task.status.success")
                                                        : renderTask.status === "error"
                                                          ? renderTask.error || t("render.task.status.error")
                                                          : renderTask.status === "cancelled"
                                                            ? t("render.task.status.cancelled")
                                                            : t("render.task.status.inProgress")}
                                                </p>
                                            </div>
                                            {["pending", "running"].includes(renderTask.status) ? (
                                                <Button danger className="!h-11 sm:!h-9" onClick={() => void cancelRender()}>
                                                    {t("render.task.cancelButton")}
                                                </Button>
                                            ) : null}
                                        </div>
                                        {["pending", "running"].includes(renderTask.status) ? <Progress className="mt-3" percent={70} status="active" showInfo={false} /> : null}
                                        {renderTask.result?.url ? (
                                            <div className="mt-4">
                                                <video className="max-h-[520px] w-full rounded-2xl bg-black" src={renderTask.result.url} controls preload="metadata" />
                                                <a className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:underline dark:text-cyan-300" href={renderTask.result.url} download={`${project.title}.mp4`}>
                                                    {t("render.task.downloadLink")}
                                                </a>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                                {episode.shots.length ? (
                                    <div className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-background sm:mt-5">
                                        {episode.shots.map((shot) => (
                                            <article
                                                key={shot.id}
                                                className="grid gap-3 border-b border-border/70 p-3.5 transition-colors last:border-b-0 hover:bg-muted/25 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-4 sm:py-4 [content-visibility:auto]"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                                        <h3 className="min-w-0 shrink truncate font-semibold">{shot.title || t("render.shotTitleFallback", { order: String(shot.order).padStart(2, "0") })}</h3>
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <StoryboardTag status={shot.storyboardStatus} />
                                                            {shot.storyboardFrameMode === "first_last" ? (
                                                                <Tag color={shot.storyboardEndStatus === "running" || shot.storyboardEndStatus === "queued" ? "processing" : shot.storyboardEndStatus === "error" ? "error" : "default"}>
                                                                    {t("storyboard.endFrameTag")}
                                                                </Tag>
                                                            ) : null}
                                                            <GenerationTag status={shot.generationStatus} />
                                                            {shot.audioMode === "voiceover" ? <AudioTag status={shot.audioStatus} /> : <Tag>{shot.audioMode === "mute" ? t("storyboard.audioModes.mute") : t("storyboard.audioModes.source")}</Tag>}
                                                        </div>
                                                    </div>
                                                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground sm:leading-6">{shot.videoPrompt}</p>
                                                    {shot.generationStatus === "running" ? <Progress className="mt-2 max-w-sm" percent={60} status="active" showInfo={false} /> : null}
                                                    {shot.storyboardStatus === "running" || shot.storyboardEndStatus === "running" ? (
                                                        <Progress className="mt-2 max-w-sm" percent={shot.storyboardEndStatus === "running" ? 55 : 35} status="active" showInfo={false} />
                                                    ) : null}
                                                    {shot.storyboardError ? <p className="mt-2 text-xs text-red-500">{shot.storyboardError}</p> : null}
                                                    {shot.storyboardEndError ? <p className="mt-2 text-xs text-red-500">{shot.storyboardEndError}</p> : null}
                                                    {shot.generationError ? <p className="mt-2 text-xs text-red-500">{shot.generationError}</p> : null}
                                                    {shot.storyboardImageUrl ? (
                                                        <div className="mt-4 flex max-w-xl gap-2 overflow-x-auto">
                                                            <img className="aspect-video w-44 shrink-0 rounded-md object-cover" src={imagePreviewUrl(shot.storyboardImageUrl, 640)} alt={`${shot.title}${t("storyboard.startFrame")}`} />
                                                            {shot.storyboardEndImageUrl ? (
                                                                <img className="aspect-video w-44 shrink-0 rounded-md object-cover" src={imagePreviewUrl(shot.storyboardEndImageUrl, 640)} alt={`${shot.title}${t("storyboard.endFrame")}`} />
                                                            ) : null}
                                                        </div>
                                                    ) : null}
                                                    {shot.videoUrl ? <video className="mt-4 max-h-52 w-full max-w-sm rounded-xl bg-black" src={shot.videoUrl} controls preload="metadata" /> : null}
                                                    {shot.subtitle || shot.dialogue ? <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">{t("render.subtitleLinePrefix", { text: shot.subtitle || shot.dialogue })}</p> : null}
                                                    {shot.audioError ? <p className="mt-2 text-xs text-red-500">{shot.audioError}</p> : null}
                                                    {shot.audioUrl ? <audio className="mt-4 h-10 w-full max-w-sm" src={shot.audioUrl} controls preload="metadata" /> : null}
                                                </div>
                                                <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:max-w-[420px] sm:flex-wrap sm:justify-end">
                                                    {shot.audioStatus === "running" || shot.audioStatus === "queued" ? (
                                                        <Button
                                                            className={generationActionButtonClass}
                                                            icon={<Pause className="size-4" />}
                                                            onClick={() => void cancelDramaAudioTask(shot.audioTaskId).finally(() => updateShot(project.id, episode.id, shot.id, { audioStatus: "cancelled" }))}
                                                        >
                                                            {t("render.buttons.cancelVoiceover")}
                                                        </Button>
                                                    ) : shot.subtitle || shot.dialogue ? (
                                                        <Button
                                                            className={generationActionButtonClass}
                                                            disabled={!audioReady}
                                                            title={audioReady ? undefined : t("render.tooltips.audioModelMissing")}
                                                            icon={<Volume2 className="size-4" />}
                                                            onClick={() => queueAudio(project.id, episode.id, [shot.id])}
                                                        >
                                                            {shot.audioStatus === "error" ? t("render.buttons.retryVoiceover") : shot.audioMode === "voiceover" ? t("render.buttons.generateVoiceover") : t("render.buttons.switchToAiVoiceover")}
                                                        </Button>
                                                    ) : null}
                                                    {shot.storyboardStatus === "running" ||
                                                    shot.storyboardStatus === "queued" ||
                                                    shot.storyboardEndStatus === "running" ||
                                                    shot.storyboardEndStatus === "queued" ||
                                                    shot.generationStatus === "running" ||
                                                    shot.generationStatus === "queued" ? (
                                                        <Button className={generationActionButtonClass} icon={<Pause className="size-4" />} onClick={() => void cancelShot(shot.id, shot.generationTaskId, shot.storyboardTaskId, shot.storyboardEndTaskId)}>
                                                            {t("render.buttons.cancelGeneration")}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            className={generationActionButtonClass}
                                                            disabled={episode.reviewStatus !== "visual_ready"}
                                                            icon={<RefreshCw className="size-4" />}
                                                            onClick={() => queueShots(project.id, episode.id, [shot.id])}
                                                        >
                                                            {shot.storyboardStatus === "error" || shot.storyboardEndStatus === "error" || shot.generationStatus === "error" ? t("render.buttons.retryGenerate") : t("render.buttons.generateShot")}
                                                        </Button>
                                                    )}
                                                    <Button
                                                        type="text"
                                                        disabled={!shot.videoPrompt}
                                                        className={`${shot.subtitle || shot.dialogue ? "col-span-2" : ""} !bg-muted/60 hover:!bg-muted sm:col-span-1 ${generationActionButtonClass}`}
                                                        icon={<Send className="size-4" />}
                                                        onClick={() => sendToVideo(shot)}
                                                    >
                                                        {t("render.buttons.sendToVideoWorkbench")}
                                                    </Button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <Empty className="!my-6 sm:!my-12" description={t("render.emptyNeedStoryboard")} />
                                )}
                            </div>
                        ) : null}
                    </section>
                    <DramaAgentPanel project={project} episode={episode} onConversationChange={(creativeConversationId) => updateProject(project.id, { creativeConversationId })} />
                </div>
            </div>
            <DramaVersionModal
                open={versionsOpen}
                loading={versionsLoading}
                versions={versions}
                onClose={() => setVersionsOpen(false)}
                onSave={() => void createVersion(project, t("editor.versionReasons.manualSave")).then(() => openVersions())}
                onRestore={(version) => void restore(version)}
            />
            <DramaJianyingModal
                open={jianyingOpen}
                path={jianyingPath}
                version={jianyingVersion}
                exporting={jianyingExporting}
                onClose={() => setJianyingOpen(false)}
                onExport={() => void exportJianying()}
                onPathChange={setJianyingPath}
                onVersionChange={setJianyingVersion}
            />
            <DramaSubtitleModal open={subtitleOpen} shots={episode.shots} onClose={() => setSubtitleOpen(false)} />
        </main>
    );
}
