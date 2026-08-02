"use client";

import { Button, Empty, Progress, Tag } from "antd";
import { Film, Pause, Play, RefreshCw, ScanSearch, Send, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { mediaDownloadFileName } from "@/lib/media-file";
import { originalMediaDownloadUrl } from "@/lib/media-image-url";
import type { DramaCostSummary, DramaEpisode, DramaProject, DramaRenderTask, DramaShot } from "../types";
import { AudioTag, GenerationTag, SectionTitle, StoryboardTag } from "./drama-editor-elements";
import { DramaAudioPanel, generationActionButtonClass } from "./drama-audio-panel";
import { DramaMediaThumbnail, type DramaPreviewMedia } from "./drama-media-preview";
import { estimateEpisodePoints } from "./drama-shot-generation-utils";
import type { useEffectiveConfig } from "@/stores/use-config-store";

export function shotNeedsVoiceover(shot: DramaShot) {
    return shot.audioMode === "voiceover" && Boolean((shot.subtitle || shot.dialogue || shot.narration).trim());
}

export function DramaShotsPanel({
    project,
    episode,
    config,
    costSummary,
    renderReady,
    renderTask,
    audioReady,
    reviewingVisuals,
    onCreateRender,
    onCancelRender,
    onReviewVisuals,
    onQueueShots,
    onQueueAudio,
    onCancelShot,
    onCancelAudio,
    onSendToVideo,
    onOpenSubtitle,
    onDownloadSubtitles,
    onOpenJianying,
    onPreviewMedia,
}: {
    project: DramaProject;
    episode: DramaEpisode;
    config: ReturnType<typeof useEffectiveConfig>;
    costSummary: DramaCostSummary | null;
    renderReady: boolean | null;
    renderTask: DramaRenderTask | null;
    audioReady: boolean;
    reviewingVisuals: boolean;
    onCreateRender: () => void;
    onCancelRender: () => void;
    onReviewVisuals: () => void;
    onQueueShots: (shotIds: string[]) => void;
    onQueueAudio: (shotIds: string[]) => void;
    onCancelShot: (shotId: string, taskId?: string, storyboardTaskId?: string, storyboardEndTaskId?: string) => void;
    onCancelAudio: (shot: DramaShot) => void;
    onSendToVideo: (shot: DramaShot) => void;
    onOpenSubtitle: () => void;
    onDownloadSubtitles: () => void;
    onOpenJianying: () => void;
    onPreviewMedia: (media: DramaPreviewMedia) => void;
}) {
    const t = useTranslations("drama");
    return (
        <div>
            {episode.reviewStatus !== "visual_ready" ? (
                <p className="mb-4 border-l-2 border-amber-400 pl-3 text-sm leading-5 text-amber-700 sm:mb-6 sm:leading-6 dark:text-amber-200">
                    {t("render.needReviewHint", { stage: t("editor.stages.review") })}
                </p>
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
                            disabled={!renderReady || !episode.shots.length || !episode.shots.every((shot) => shot.videoUrl && (!shotNeedsVoiceover(shot) || shot.audioUrl)) || Boolean(renderTask && ["pending", "running"].includes(renderTask.status))}
                            title={!renderReady ? t("render.tooltips.ffmpegMissing") : t("render.tooltips.allShotsRequired")}
                            onClick={onCreateRender}
                        >
                            {renderReady === null ? t("render.buttons.checking") : renderReady ? t("render.buttons.renderAll") : t("render.buttons.ffmpegNotReady")}
                        </Button>
                        <Button className={generationActionButtonClass} icon={<ScanSearch className="size-4" />} loading={reviewingVisuals} disabled={!episode.shots.some((shot) => shot.storyboardImageUrl)} onClick={onReviewVisuals}>
                            {t("render.buttons.reviewVisuals")}
                        </Button>
                        <Button
                            type="primary"
                            className={`col-span-2 sm:col-span-1 ${generationActionButtonClass}`}
                            icon={<Play className="size-4" />}
                            disabled={!episode.shots.length || episode.reviewStatus !== "visual_ready"}
                            onClick={() => onQueueShots(episode.shots.filter((shot) => shot.generationStatus !== "success").map((shot) => shot.id))}
                        >
                            {t("render.buttons.batchGenerate")}
                        </Button>
                    </div>
                    <DramaAudioPanel
                        audioReady={audioReady}
                        shots={episode.shots}
                        onBatchAudio={() => onQueueAudio(episode.shots.filter((shot) => shot.audioStatus !== "success").map((shot) => shot.id))}
                        onOpenSubtitle={onOpenSubtitle}
                        onDownloadSubtitles={onDownloadSubtitles}
                        onOpenJianying={onOpenJianying}
                    />
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
                                    {typeof episode.visualReview.score === "number" ? (
                                        <span className="text-sm tabular-nums text-muted-foreground">{t("render.review.scoreValue", { score: episode.visualReview.score })}</span>
                                    ) : null}
                                </div>
                                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{episode.visualReview.summary}</p>
                            </div>
                            {episode.visualReview.retryTaskIds.length ? (
                                <Button className="!h-9 shrink-0" icon={<RefreshCw className="size-4" />} onClick={() => onQueueShots(episode.visualReview!.retryTaskIds)}>
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
                            <Button danger className="!h-11 sm:!h-9" onClick={onCancelRender}>
                                {t("render.task.cancelButton")}
                            </Button>
                        ) : null}
                    </div>
                    {["pending", "running"].includes(renderTask.status) ? <Progress className="mt-3" percent={70} status="active" showInfo={false} /> : null}
                    {renderTask.result?.url ? (
                        <div className="mt-4">
                            <video className="max-h-[520px] w-full rounded-2xl bg-black" src={renderTask.result.url} controls preload="metadata" />
                            <a
                                className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:underline dark:text-cyan-300"
                                href={originalMediaDownloadUrl(renderTask.result.url)}
                                download={mediaDownloadFileName(renderTask.id, "video/mp4", renderTask.result.url)}
                            >
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
                            className="grid min-w-0 gap-3 overflow-hidden border-b border-border/70 p-3.5 transition-colors last:border-b-0 hover:bg-muted/25 [content-visibility:visible] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-4 sm:py-4 sm:[content-visibility:auto]"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                    <h3 className="min-w-0 shrink truncate font-semibold">{shot.title || t("render.shotTitleFallback", { order: String(shot.order).padStart(2, "0") })}</h3>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <StoryboardTag status={shot.storyboardStatus} />
                                        {shot.storyboardFrameMode === "first_last" ? (
                                            <span
                                                className={`inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium leading-none ${
                                                    shot.storyboardEndStatus === "running" || shot.storyboardEndStatus === "queued"
                                                        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-300"
                                                        : shot.storyboardEndStatus === "error"
                                                          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-300"
                                                          : "border-border bg-muted/60 text-muted-foreground"
                                                }`}
                                            >
                                                {t("storyboard.endFrameTag")}
                                            </span>
                                        ) : null}
                                        <GenerationTag status={shot.generationStatus} />
                                        {shot.audioMode === "voiceover" ? <AudioTag status={shot.audioStatus} /> : <Tag>{shot.audioMode === "mute" ? t("storyboard.audioModes.mute") : t("storyboard.audioModes.source")}</Tag>}
                                    </div>
                                </div>
                                <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground sm:leading-6">{shot.videoPrompt}</p>
                                {shot.generationStatus === "running" ? <Progress className="mt-2 max-w-sm" percent={60} status="active" showInfo={false} /> : null}
                                {shot.storyboardStatus === "running" || shot.storyboardEndStatus === "running" ? <Progress className="mt-2 max-w-sm" percent={shot.storyboardEndStatus === "running" ? 55 : 35} status="active" showInfo={false} /> : null}
                                {shot.storyboardError ? <p className="mt-2 text-xs text-red-500">{shot.storyboardError}</p> : null}
                                {shot.storyboardEndError ? <p className="mt-2 text-xs text-red-500">{shot.storyboardEndError}</p> : null}
                                {shot.generationError ? <p className="mt-2 text-xs text-red-500">{shot.generationError}</p> : null}
                                {shot.storyboardImageUrl ? (
                                    <div className="mt-4 flex max-w-xl gap-2 overflow-x-auto">
                                        <DramaMediaThumbnail media={{ type: "image", url: shot.storyboardImageUrl, title: t("render.mediaTitles.startFrame", { title: shot.title }) }} onOpen={onPreviewMedia} />
                                        {shot.storyboardEndImageUrl ? <DramaMediaThumbnail media={{ type: "image", url: shot.storyboardEndImageUrl, title: t("render.mediaTitles.endFrame", { title: shot.title }) }} onOpen={onPreviewMedia} /> : null}
                                    </div>
                                ) : null}
                                {shot.videoUrl ? (
                                    <div className="mt-4">
                                        <DramaMediaThumbnail media={{ type: "video", url: shot.videoUrl, title: t("render.mediaTitles.generatedVideo", { title: shot.title }) }} onOpen={onPreviewMedia} />
                                    </div>
                                ) : null}
                                {shot.subtitle || shot.dialogue ? <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">{t("render.subtitleLinePrefix", { text: shot.subtitle || shot.dialogue })}</p> : null}
                                {shot.audioError ? <p className="mt-2 text-xs text-red-500">{shot.audioError}</p> : null}
                                {shot.audioUrl ? <audio className="mt-4 h-10 w-full max-w-sm" src={shot.audioUrl} controls preload="metadata" /> : null}
                            </div>
                            <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:max-w-[420px] sm:flex-wrap sm:justify-end">
                                {shot.audioStatus === "running" || shot.audioStatus === "queued" ? (
                                    <Button className={generationActionButtonClass} icon={<Pause className="size-4" />} onClick={() => onCancelAudio(shot)}>
                                        {t("render.buttons.cancelVoiceover")}
                                    </Button>
                                ) : shot.subtitle || shot.dialogue ? (
                                    <Button className={generationActionButtonClass} disabled={!audioReady} title={audioReady ? undefined : t("render.tooltips.audioModelMissing")} icon={<Volume2 className="size-4" />} onClick={() => onQueueAudio([shot.id])}>
                                        {shot.audioStatus === "error" ? t("render.buttons.retryVoiceover") : shot.audioMode === "voiceover" ? t("render.buttons.generateVoiceover") : t("render.buttons.switchToAiVoiceover")}
                                    </Button>
                                ) : null}
                                {shot.storyboardStatus === "running" ||
                                shot.storyboardStatus === "queued" ||
                                shot.storyboardEndStatus === "running" ||
                                shot.storyboardEndStatus === "queued" ||
                                shot.generationStatus === "running" ||
                                shot.generationStatus === "queued" ? (
                                    <Button className={generationActionButtonClass} icon={<Pause className="size-4" />} onClick={() => void onCancelShot(shot.id, shot.generationTaskId, shot.storyboardTaskId, shot.storyboardEndTaskId)}>
                                        {t("render.buttons.cancelGeneration")}
                                    </Button>
                                ) : (
                                    <Button className={generationActionButtonClass} disabled={episode.reviewStatus !== "visual_ready"} icon={<RefreshCw className="size-4" />} onClick={() => onQueueShots([shot.id])}>
                                        {shot.storyboardStatus === "error" || shot.storyboardEndStatus === "error" || shot.generationStatus === "error" ? t("render.buttons.retryGenerate") : t("render.buttons.generateShot")}
                                    </Button>
                                )}
                                <Button
                                    type="text"
                                    disabled={!shot.videoPrompt}
                                    className={`${shot.subtitle || shot.dialogue ? "col-span-2" : ""} !bg-muted/60 hover:!bg-muted sm:col-span-1 ${generationActionButtonClass}`}
                                    icon={<Send className="size-4" />}
                                    onClick={() => onSendToVideo(shot)}
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
    );
}
