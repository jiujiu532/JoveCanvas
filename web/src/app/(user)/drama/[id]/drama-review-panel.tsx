"use client";

import { Button, Empty, Input, InputNumber } from "antd";
import { Check, ChevronDown, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { DramaEpisode, DramaProject } from "@/lib/drama-project-contract";
import { useDramaStore } from "../stores/use-drama-store";
import { SectionTitle } from "./drama-editor-elements";
import { DramaShotDialogueEditor } from "./drama-shot-dialogue-editor";

export function DramaReviewPanel({ project, episode, onDesignVisuals, designing }: { project: DramaProject; episode: DramaEpisode; onDesignVisuals: () => void; designing: boolean }) {
    const t = useTranslations("drama");
    const updateEpisode = useDramaStore((state) => state.updateEpisode);
    const updateShot = useDramaStore((state) => state.updateShot);
    const [expandedShotIds, setExpandedShotIds] = useState<Set<string>>(() => new Set(episode.shots.slice(0, 1).map((shot) => shot.id)));
    useEffect(() => {
        setExpandedShotIds(new Set(episode.shots.slice(0, 1).map((shot) => shot.id)));
    }, [episode.id]);
    const updateContentShot = (shotId: string, patch: Parameters<typeof updateShot>[3]) => {
        updateShot(project.id, episode.id, shotId, patch);
        if (episode.reviewStatus !== "content_review") updateEpisode(project.id, episode.id, { reviewStatus: "content_review" });
    };
    const toggleShot = (shotId: string) => {
        setExpandedShotIds((current) => {
            const next = new Set(current);
            if (next.has(shotId)) next.delete(shotId);
            else next.add(shotId);
            return next;
        });
    };
    const fieldDefs = [
        ["outline", "review.fields.outline.label", "review.fields.outline.placeholder"],
        ["sourceRange", "review.fields.sourceRange.label", "review.fields.sourceRange.placeholder"],
        ["hook", "review.fields.hook.label", "review.fields.hook.placeholder"],
        ["nextPreview", "review.fields.nextPreview.label", "review.fields.nextPreview.placeholder"],
    ] as const;
    return (
        <div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-5">
                <SectionTitle className="!mb-0" title={t("review.sectionTitle")} description={t("review.sectionDescription")} />
                <Button type="primary" className="!h-11 !w-full sm:!h-9 sm:!w-auto" icon={<Check className="size-4" />} loading={designing} disabled={!episode.shots.length} onClick={onDesignVisuals}>
                    {t("review.confirmButton")}
                </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2">
                {fieldDefs.map(([key, labelKey, placeholderKey]) => (
                    <label key={key} className="block space-y-2">
                        <span className="text-sm font-medium">{t(labelKey)}</span>
                        <Input.TextArea
                            value={episode[key as "outline" | "sourceRange" | "hook" | "nextPreview"]}
                            onChange={(event) => updateEpisode(project.id, episode.id, { [key]: event.target.value })}
                            autoSize={{ minRows: 2, maxRows: 4 }}
                            placeholder={t(placeholderKey)}
                        />
                    </label>
                ))}
            </div>
            {episode.shots.length ? (
                <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
                    {episode.shots.map((shot) => {
                        const expanded = expandedShotIds.has(shot.id);
                        const dialogueCount = shot.utterances.filter((item) => item.type === "dialogue").length || shot.dialogue.split(/\n+/).filter((line) => line.trim()).length;
                        const sourcePreview = compactReviewText(shot.sourceText || shot.description || t("review.noSourceText"));
                        return (
                            <article key={shot.id} className="rounded-lg border border-border bg-background p-3 sm:p-4">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="grid size-8 place-items-center rounded-md bg-muted text-xs font-semibold">{String(shot.order).padStart(2, "0")}</span>
                                    <Input variant="borderless" className="!min-w-0 !flex-1 !p-0 !font-semibold" value={shot.title} onChange={(event) => updateContentShot(shot.id, { title: event.target.value })} />
                                    <span className="hidden shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground sm:inline-flex">
                                        <span className="size-1.5 rounded-full bg-foreground/60" />
                                        {t("review.editableBadge")}
                                    </span>
                                    <Button
                                        size="small"
                                        className="!h-8 !shrink-0 !rounded-md !border-border/80 !px-2 !text-xs"
                                        icon={<ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />}
                                        iconPosition="end"
                                        aria-expanded={expanded}
                                        onClick={() => toggleShot(shot.id)}
                                    >
                                        {expanded ? t("shared.collapse") : t("shared.expand")}
                                    </Button>
                                </div>
                                {expanded ? (
                                    <>
                                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                            <label className="block space-y-2 xl:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">{t("review.sourceTextLabel")}</span>
                                                <Input.TextArea
                                                    value={shot.sourceText}
                                                    onChange={(event) => updateContentShot(shot.id, { sourceText: event.target.value })}
                                                    autoSize={{ minRows: 2, maxRows: 5 }}
                                                    placeholder={t("review.sourceTextPlaceholder")}
                                                />
                                            </label>
                                            <label className="block space-y-2">
                                                <span className="text-xs font-medium text-muted-foreground">{t("review.shotFactsLabel")}</span>
                                                <Input.TextArea
                                                    value={shot.description}
                                                    onChange={(event) => updateContentShot(shot.id, { description: event.target.value })}
                                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                                    placeholder={t("review.shotFactsPlaceholder")}
                                                />
                                            </label>
                                            <label className="block space-y-2">
                                                <span className="text-xs font-medium text-muted-foreground">{t("review.shotBoundaryLabel")}</span>
                                                <Input.TextArea
                                                    value={shot.shotBoundary}
                                                    onChange={(event) => updateContentShot(shot.id, { shotBoundary: event.target.value })}
                                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                                    placeholder={t("review.shotBoundaryPlaceholder")}
                                                />
                                            </label>
                                            <div className="min-w-0">
                                                <DramaShotDialogueEditor projectId={project.id} episodeId={episode.id} shot={shot} />
                                            </div>
                                            <label className="block space-y-2">
                                                <span className="text-xs font-medium text-muted-foreground">{t("review.narrationLabel")}</span>
                                                <Input.TextArea
                                                    value={shot.narration}
                                                    onChange={(event) => updateContentShot(shot.id, { narration: event.target.value, subtitle: [shot.dialogue, event.target.value].filter(Boolean).join("\n") })}
                                                    autoSize={{ minRows: 2, maxRows: 5 }}
                                                    placeholder={t("review.narrationPlaceholder")}
                                                />
                                            </label>
                                        </div>
                                        <div className="mt-3 grid grid-cols-[auto_72px_auto] items-center gap-2 text-sm text-muted-foreground sm:grid-cols-[auto_88px_auto_minmax(0,1fr)]">
                                            <span className="whitespace-nowrap">{t("review.shotDurationLabel")}</span>
                                            <InputNumber className="!h-9 !w-[72px] sm:!w-[88px]" min={1} max={20} value={shot.duration} onChange={(value) => updateContentShot(shot.id, { duration: Number(value) || 5 })} />
                                            <span>{t("shared.secondsUnit")}</span>
                                            <span className="hidden min-w-0 text-right text-xs sm:block">{t("review.promptHint")}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                                        <span className="min-w-0 max-w-full truncate">{t("review.sourcePreviewPrefix", { text: sourcePreview })}</span>
                                        <span>{dialogueCount ? t("review.dialogueCountLabel", { count: dialogueCount }) : t("review.noDialogue")}</span>
                                        <span>{t("review.durationValue", { count: shot.duration })}</span>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            ) : (
                <Empty className="!my-7 sm:!my-16" image={<FileText className="mx-auto size-8 text-muted-foreground sm:size-10" />} description={t("review.empty")} />
            )}
        </div>
    );
}

function compactReviewText(value: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 72 ? `${normalized.slice(0, 72)}…` : normalized;
}
