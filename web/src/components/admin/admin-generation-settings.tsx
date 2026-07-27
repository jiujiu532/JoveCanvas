"use client";

import { Input, InputNumber, Select } from "antd";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AuthSettings } from "@/lib/auth/store";
import { resolveLogicalModelConfig } from "@/lib/model-routing-config";
import { LabeledControl, SectionTitle, SettingToggle } from "@/components/admin/admin-settings-controls";

type AdminTranslator = ReturnType<typeof useTranslations<"admin">>;

const settingsPanelSurfaceClass = "rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950";

export type AgentReadiness = {
    ready: boolean;
    capabilities: Array<{ type: "text" | "image" | "video" | "audio"; model: string; ready: boolean; message: string }>;
    skills: Record<"image" | "video" | "canvas" | "drama", number>;
};

export function GenerationConcurrencyPanel({ settings, onChange }: { settings: AuthSettings; onChange: (key: keyof AuthSettings["generationConcurrency"], value: number | null) => void }) {
    const t = useTranslations("admin");
    return (
        <div className={settingsPanelSurfaceClass}>
            <SectionTitle icon={<Sparkles className="size-4" />} title={t("settings.concurrency.title")} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <LabeledControl label={t("settings.concurrency.agent")}>
                    <InputNumber className="w-full" min={1} max={10} precision={0} value={settings.generationConcurrency.agent} onChange={(value) => onChange("agent", value)} />
                </LabeledControl>
                <LabeledControl label={t("settings.concurrency.image")}>
                    <InputNumber className="w-full" min={1} max={10} precision={0} value={settings.generationConcurrency.image} onChange={(value) => onChange("image", value)} />
                </LabeledControl>
                <LabeledControl label={t("settings.concurrency.video")}>
                    <InputNumber className="w-full" min={1} max={5} precision={0} value={settings.generationConcurrency.video} onChange={(value) => onChange("video", value)} />
                </LabeledControl>
                <LabeledControl label={t("settings.concurrency.audio")}>
                    <InputNumber className="w-full" min={1} max={10} precision={0} value={settings.generationConcurrency.audio} onChange={(value) => onChange("audio", value)} />
                </LabeledControl>
                <LabeledControl label={t("settings.concurrency.text")}>
                    <InputNumber className="w-full" min={1} max={20} precision={0} value={settings.generationConcurrency.text} onChange={(value) => onChange("text", value)} />
                </LabeledControl>
                <LabeledControl label={t("settings.concurrency.render")}>
                    <InputNumber className="w-full" min={1} max={5} precision={0} value={settings.generationConcurrency.render} onChange={(value) => onChange("render", value)} />
                </LabeledControl>
            </div>
            <div className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("settings.concurrency.hint")}</div>
        </div>
    );
}

export function localAgentReadiness(settings: AuthSettings, t: AdminTranslator): AgentReadiness {
    const models = { text: settings.defaultModels.textModel, image: settings.defaultModels.imageModel, video: settings.defaultModels.videoModel, audio: settings.defaultModels.audioModel } as const;
    const capabilities = Object.entries(models).map(([type, model]) => {
        const capability = type as keyof typeof models;
        const resolved = resolveLogicalModelConfig(settings.logicalModels, settings.systemChannels, capability, model);
        const message = !model ? t("settings.readiness.noDefaultModel") : !resolved ? t("settings.readiness.noChannelBinding") : t("settings.readiness.usingChannel", { channel: resolved.channel.name });
        return { type: capability, model, ready: Boolean(model && resolved), message };
    });
    const skills = { image: 0, video: 0, canvas: 0, drama: 0 };
    for (const skill of settings.agentSkills) if (skill.enabled) for (const workspace of skill.workspaces || ["image"]) skills[workspace] += 1;
    return { ready: capabilities.every((item) => item.ready), capabilities, skills };
}

export function GenerationDefaultsPanel({ settings, onChange }: { settings: AuthSettings; onChange: <K extends keyof AuthSettings["generationDefaults"]>(key: K, value: AuthSettings["generationDefaults"][K]) => void }) {
    const t = useTranslations("admin");
    return (
        <div className={settingsPanelSurfaceClass}>
            <SectionTitle icon={<SlidersHorizontal className="size-4" />} title={t("settings.defaults.title")} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <LabeledControl label={t("settings.defaults.canvasImageCount")}>
                    <InputNumber className="w-full" min={1} max={10} precision={0} value={settings.generationDefaults.canvasImageCount} onChange={(value) => onChange("canvasImageCount", value || 1)} />
                </LabeledControl>
                <LabeledControl label={t("settings.defaults.workbenchImageCount")}>
                    <InputNumber className="w-full" min={1} max={10} precision={0} value={settings.generationDefaults.imageCount} onChange={(value) => onChange("imageCount", value || 1)} />
                </LabeledControl>
                <LabeledControl label={t("settings.defaults.imageSize")}>
                    <Select
                        className="w-full"
                        value={settings.generationDefaults.imageSize}
                        options={["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"].map((value) => ({ value, label: value }))}
                        onChange={(value) => onChange("imageSize", value)}
                    />
                </LabeledControl>
                <LabeledControl label={t("settings.defaults.imageQuality")}>
                    <Select
                        className="w-full"
                        value={settings.generationDefaults.imageQuality}
                        options={[
                            { value: "auto", label: t("points.quota.imageQuality.auto") },
                            { value: "low", label: t("points.quota.imageQuality.low") },
                            { value: "medium", label: t("points.quota.imageQuality.medium") },
                            { value: "high", label: t("points.quota.imageQuality.high") },
                        ]}
                        onChange={(value) => onChange("imageQuality", value)}
                    />
                </LabeledControl>
                <LabeledControl label={t("settings.defaults.videoQuality")}>
                    <Select className="w-full" value={settings.generationDefaults.videoQuality} options={["480", "720", "1080"].map((value) => ({ value, label: value + "p" }))} onChange={(value) => onChange("videoQuality", value)} />
                </LabeledControl>
                <LabeledControl label={t("settings.defaults.videoSeconds")}>
                    <InputNumber className="w-full" min={1} max={20} precision={0} value={settings.generationDefaults.videoSeconds} onChange={(value) => onChange("videoSeconds", value || 5)} />
                </LabeledControl>
                <LabeledControl label={t("settings.defaults.audioVoice")}>
                    <Input value={settings.generationDefaults.audioVoice} onChange={(event) => onChange("audioVoice", event.target.value)} />
                </LabeledControl>
                <LabeledControl label={t("settings.defaults.audioFormat")}>
                    <Select className="w-full" value={settings.generationDefaults.audioFormat} options={["mp3", "wav", "opus", "aac", "flac"].map((value) => ({ value, label: value.toUpperCase() }))} onChange={(value) => onChange("audioFormat", value)} />
                </LabeledControl>
            </div>
            <div className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("settings.defaults.hint")}</div>
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div className="text-xs font-semibold text-stone-700 dark:text-stone-200">{t("settings.defaults.workbenchPlanning")}</div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 sm:divide-x sm:divide-zinc-200 dark:sm:divide-zinc-800">
                    <SettingToggle
                        title={t("settings.defaults.imagePlanningTitle")}
                        description={t("settings.defaults.imagePlanningDescription")}
                        checked={settings.generationDefaults.workbenchSmartPlanning.image}
                        checkedChildren={t("points.quota.freeDailyPoints.on")}
                        unCheckedChildren={t("points.quota.freeDailyPoints.off")}
                        onChange={(image) => onChange("workbenchSmartPlanning", { ...settings.generationDefaults.workbenchSmartPlanning, image })}
                    />
                    <div className="sm:pl-4">
                        <SettingToggle
                            title={t("settings.defaults.videoPlanningTitle")}
                            description={t("settings.defaults.videoPlanningDescription")}
                            checked={settings.generationDefaults.workbenchSmartPlanning.video}
                            checkedChildren={t("points.quota.freeDailyPoints.on")}
                            unCheckedChildren={t("points.quota.freeDailyPoints.off")}
                            onChange={(video) => onChange("workbenchSmartPlanning", { ...settings.generationDefaults.workbenchSmartPlanning, video })}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
