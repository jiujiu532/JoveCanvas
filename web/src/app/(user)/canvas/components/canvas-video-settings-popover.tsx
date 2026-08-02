"use client";

import { useTranslations } from "next-intl";

import { VideoSettingsPanel, videoResolutionLabel, videoSecondsLabel, videoSizeLabel } from "@/components/video-settings-panel";
import type { AiConfig } from "@/stores/use-config-store";
import { CanvasSettingsPopoverShell, type CanvasSettingsPopoverPlacement } from "./canvas-settings-popover-shell";

type CanvasVideoSettingsPopoverProps = {
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    buttonClassName?: string;
    placement?: CanvasSettingsPopoverPlacement;
};

export function CanvasVideoSettingsPopover({ config, onConfigChange, buttonClassName, placement = "topLeft" }: CanvasVideoSettingsPopoverProps) {
    const t = useTranslations("layout");
    const sizeLabels = {
        adaptive: t("settings.video.adaptive"),
        landscape: t("settings.video.landscape"),
        portrait: t("settings.video.portrait"),
        square: t("settings.video.square"),
        wide: t("settings.video.wide"),
        tall: t("settings.video.tall"),
    };

    return (
        <CanvasSettingsPopoverShell
            label={`${videoResolutionLabel(config.vquality)} · ${videoSizeLabel(config.size, sizeLabels)} · ${videoSecondsLabel(config.videoSeconds, t("settings.video.smart"))}`}
            buttonClassName={buttonClassName}
            defaultButtonClassName="!h-8 !max-w-[170px] !justify-start !rounded-full !px-2.5"
            placement={placement}
        >
            {(theme) => <VideoSettingsPanel config={config} onConfigChange={onConfigChange} theme={theme} className="space-y-4" />}
        </CanvasSettingsPopoverShell>
    );
}
