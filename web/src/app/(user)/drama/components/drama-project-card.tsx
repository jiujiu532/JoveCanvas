"use client";

import { App, Button, Popconfirm, Tag } from "antd";
import { Clapperboard, Share2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import type { DramaProjectSummary } from "../types";
import { useDramaStore } from "../stores/use-drama-store";

export function DramaProjectCard({ project }: { project: DramaProjectSummary }) {
    const router = useRouter();
    const { message } = App.useApp();
    const t = useTranslations("drama");
    const deleteProject = useDramaStore((state) => state.deleteProject);
    const pendingCount = project.pendingTaskCount;
    const failedCount = project.failedTaskCount;
    return (
        <article className="rounded-lg border border-border bg-card p-3 text-card-foreground transition hover:border-foreground/20 hover:shadow-sm sm:p-4">
            <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground text-background">
                    <Clapperboard className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold sm:text-[17px]">{project.title}</h2>
                    <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-muted-foreground">{project.summary || t("card.noSummary")}</p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {pendingCount ? (
                        <span className="inline-flex h-6 items-center rounded-md border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-300">
                            {t("card.pendingTag", { count: pendingCount })}
                        </span>
                    ) : null}
                    {failedCount ? (
                        <Tag color="error" className="m-0">
                            {t("card.failedTag", { count: failedCount })}
                        </Tag>
                    ) : null}
                    <Tag className="m-0">{project.ratio}</Tag>
                </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="text-xs leading-5 text-muted-foreground">
                    {t("card.stats", { episodes: project.episodeCount, characters: project.characterCount, scenes: project.sceneCount, shots: project.shotCount })}
                </div>
                <div className="flex justify-end gap-2">
                    <Popconfirm title={t("card.deleteConfirmTitle")} onConfirm={() => deleteProject(project.id).catch((error) => message.error(error instanceof Error ? error.message : t("card.deleteFailed")))}>
                        <Button type="text" shape="circle" danger className="!size-8" icon={<Trash2 className="size-4" />} aria-label={t("card.deleteAria")} />
                    </Popconfirm>
                    <Button className="!h-8 !px-3" icon={<Share2 className="size-3.5" />} onClick={() => router.push(`/works?sourceType=drama&sourceId=${encodeURIComponent(project.id)}`)}>
                        {t("card.publishButton")}
                    </Button>
                    <Button type="primary" className="!h-8 !px-3" onClick={() => router.push(`/drama/${project.id}`)}>
                        {t("card.continueButton")}
                    </Button>
                </div>
            </div>
        </article>
    );
}
