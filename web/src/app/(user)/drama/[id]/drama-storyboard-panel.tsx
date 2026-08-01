"use client";

import { Button, Empty } from "antd";

import type { DramaEpisode, DramaProject } from "../types";
import { SectionTitle } from "./drama-editor-elements";
import { DramaStoryboardShotCard } from "./drama-storyboard-shot-card";

export function DramaStoryboardPanel({ project, episode, expandedShotId, onToggleShot, onGoToScript }: { project: DramaProject; episode: DramaEpisode; expandedShotId: string; onToggleShot: (shotId: string) => void; onGoToScript: () => void }) {
    return (
        <div>
            <SectionTitle title="分镜编辑" description="视觉字段来自已审核内容；这里可以精调画面、镜头运动和模型提示词。" />
            {episode.shots.length ? (
                <div className="grid min-w-0 items-start gap-3 xl:grid-cols-2 sm:gap-5">
                    {episode.shots.map((shot) => (
                        <DramaStoryboardShotCard key={shot.id} project={project} episodeId={episode.id} shot={shot} expanded={expandedShotId === shot.id} onToggle={() => onToggleShot(shot.id)} />
                    ))}
                </div>
            ) : (
                <Empty description="还没有分镜">
                    <Button type="primary" onClick={onGoToScript}>
                        先填写剧本
                    </Button>
                </Empty>
            )}
        </div>
    );
}
