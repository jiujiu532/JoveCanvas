"use client";

import type { RefObject } from "react";
import { Button, Input, Segmented } from "antd";
import { BookOpenText, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DramaEpisode, DramaProject } from "../types";
import { SectionTitle } from "./drama-editor-elements";

export function DramaScriptPanel({
    project,
    episode,
    analyzing,
    sourceFileInputRef,
    onImportSourceBook,
    onUpdateProject,
    onUpdateEpisode,
    onAnalyzeScript,
}: {
    project: DramaProject;
    episode: DramaEpisode;
    analyzing: boolean;
    sourceFileInputRef: RefObject<HTMLInputElement | null>;
    onImportSourceBook: (file?: File) => void;
    onUpdateProject: (patch: Partial<DramaProject>) => void;
    onUpdateEpisode: (patch: Partial<DramaEpisode>) => void;
    onAnalyzeScript: () => void;
}) {
    const t = useTranslations("drama.editor");
    return (
        <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                <SectionTitle className="!mb-0" title={t("script.sectionTitle")} description={t("script.sectionDescription")} />
                <Button className="!h-9 !w-full sm:!w-auto" icon={<BookOpenText className="size-4" />} onClick={() => sourceFileInputRef.current?.click()}>
                    {t("script.importButton")}
                </Button>
            </div>
            <input ref={sourceFileInputRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(event) => void onImportSourceBook(event.target.files?.[0])} />
            <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Input.TextArea
                    className="!h-52 !rounded-lg !bg-background !p-2.5 sm:!h-auto sm:!p-4"
                    value={episode.script}
                    onChange={(event) => onUpdateEpisode({ script: event.target.value })}
                    rows={18}
                    placeholder={t("script.scriptPlaceholder")}
                />
                <div className="space-y-4 rounded-lg border border-border bg-background p-3 sm:space-y-5 sm:p-5">
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">{t("script.episodeTitleLabel")}</span>
                        <Input value={episode.title} onChange={(event) => onUpdateEpisode({ title: event.target.value })} />
                    </label>
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">{t("script.summaryLabel")}</span>
                        <Input.TextArea value={project.summary} onChange={(event) => onUpdateProject({ summary: event.target.value })} rows={4} />
                    </label>
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">{t("script.styleLabel")}</span>
                        <Input value={project.style} onChange={(event) => onUpdateProject({ style: event.target.value })} />
                    </label>
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">{t("script.videoModeLabel")}</span>
                        <Segmented
                            block
                            value={project.defaultVideoMode}
                            options={[
                                { label: t("videoModes.storyboard"), value: "storyboard" },
                                { label: t("videoModes.direct"), value: "direct" },
                                { label: t("videoModes.reference"), value: "reference" },
                            ]}
                            onChange={(value) => onUpdateProject({ defaultVideoMode: value as DramaProject["defaultVideoMode"] })}
                        />
                    </label>
                    <Button type="primary" block className="!h-11 sm:!h-9" icon={<Sparkles className="size-4" />} loading={analyzing} onClick={onAnalyzeScript}>
                        {t("script.analyzeButton")}
                    </Button>
                    <p className="pt-1 text-xs leading-5 text-muted-foreground">{t("script.analyzeHint")}</p>
                </div>
            </div>
        </div>
    );
}
