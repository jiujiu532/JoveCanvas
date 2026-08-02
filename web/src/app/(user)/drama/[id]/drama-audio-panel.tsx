"use client";

import { Button } from "antd";
import { Captions, Download, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DramaShot } from "../types";

const generationActionButtonClass = "!h-9 !px-3 [&>span:last-child]:whitespace-nowrap";

export function DramaAudioPanel({
    audioReady,
    shots,
    onBatchAudio,
    onOpenSubtitle,
    onDownloadSubtitles,
    onOpenJianying,
}: {
    audioReady: boolean;
    shots: DramaShot[];
    onBatchAudio: () => void;
    onOpenSubtitle: () => void;
    onDownloadSubtitles: () => void;
    onOpenJianying: () => void;
}) {
    const t = useTranslations("drama");
    const hasSubtitle = shots.some((shot) => (shot.subtitle || shot.dialogue).trim());
    const hasVideo = shots.some((shot) => shot.videoUrl);
    const hasVoiceoverTarget = shots.some((shot) => shot.videoUrl && (shot.subtitle || shot.dialogue).trim());

    return (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
            <Button className={generationActionButtonClass} icon={<Volume2 className="size-4" />} disabled={!audioReady || !hasVoiceoverTarget} title={audioReady ? undefined : t("render.tooltips.audioModelMissing")} onClick={onBatchAudio}>
                {t("render.buttons.batchVoiceover")}
            </Button>
            <Button className={generationActionButtonClass} icon={<Captions className="size-4" />} disabled={!hasSubtitle} onClick={onOpenSubtitle}>
                {t("render.buttons.subtitleTimeline")}
            </Button>
            <Button className={generationActionButtonClass} icon={<Download className="size-4" />} disabled={!hasSubtitle} onClick={onDownloadSubtitles}>
                {t("render.buttons.exportSrt")}
            </Button>
            <Button className={`col-span-2 sm:col-span-1 ${generationActionButtonClass}`} icon={<Download className="size-4" />} disabled={!hasVideo} onClick={onOpenJianying}>
                {t("render.buttons.jianyingDraft")}
            </Button>
        </div>
    );
}

export { generationActionButtonClass };
