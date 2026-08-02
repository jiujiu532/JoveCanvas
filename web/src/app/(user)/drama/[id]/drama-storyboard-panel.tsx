"use client";

import { Button, Empty } from "antd";
import { useTranslations } from "next-intl";

import type { DramaEpisode, DramaProject } from "../types";
import { SectionTitle } from "./drama-editor-elements";
import { DramaStoryboardShotCard } from "./drama-storyboard-shot-card";

export function DramaStoryboardPanel({ project, episode, expandedShotId, onToggleShot, onGoToScript }: { project: DramaProject; episode: DramaEpisode; expandedShotId: string; onToggleShot: (shotId: string) => void; onGoToScript: () => void }) {
    const t = useTranslations("drama");
    return (
        <div>
            <SectionTitle title={t("storyboard.sectionTitle")} description={t("storyboard.sectionDescription")} />
            {episode.shots.length ? (
                <div className="grid min-w-0 items-start gap-3 xl:grid-cols-2 sm:gap-5">
                    {episode.shots.map((shot) => (
                        <DramaStoryboardShotCard key={shot.id} project={project} episodeId={episode.id} shot={shot} expanded={expandedShotId === shot.id} onToggle={() => onToggleShot(shot.id)} />
                    ))}
                </div>
            ) : (
                <Empty description={t("storyboard.empty")}>
                    <Button type="primary" onClick={onGoToScript}>
                        {t("storyboard.goToScript")}
                    </Button>
                </Empty>
            )}
        </div>
    );
}
