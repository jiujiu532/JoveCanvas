"use client";

import type { RefObject } from "react";
import { Button, Input, Segmented } from "antd";
import { BookOpenText, Sparkles } from "lucide-react";

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
    return (
        <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                <SectionTitle className="!mb-0" title="剧本与创作方向" description="先整理故事文本，AI 只提取可审核的内容结构，不会在这一步生成视觉提示词。" />
                <Button className="!h-9 !w-full sm:!w-auto" icon={<BookOpenText className="size-4" />} onClick={() => sourceFileInputRef.current?.click()}>
                    导入整本并分集
                </Button>
            </div>
            <input ref={sourceFileInputRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(event) => void onImportSourceBook(event.target.files?.[0])} />
            <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Input.TextArea
                    className="!h-52 !rounded-lg !bg-background !p-2.5 sm:!h-auto sm:!p-4"
                    value={episode.script}
                    onChange={(event) => onUpdateEpisode({ script: event.target.value })}
                    rows={18}
                    placeholder="粘贴或编写本集剧本，每个段落会生成一个镜头草稿…"
                />
                <div className="space-y-4 rounded-lg border border-border bg-background p-3 sm:space-y-5 sm:p-5">
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">本集名称</span>
                        <Input value={episode.title} onChange={(event) => onUpdateEpisode({ title: event.target.value })} />
                    </label>
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">故事简介</span>
                        <Input.TextArea value={project.summary} onChange={(event) => onUpdateProject({ summary: event.target.value })} rows={4} />
                    </label>
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">视觉风格</span>
                        <Input value={project.style} onChange={(event) => onUpdateProject({ style: event.target.value })} />
                    </label>
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">视频生产模式</span>
                        <Segmented
                            block
                            value={project.defaultVideoMode}
                            options={[
                                { label: "分镜驱动", value: "storyboard" },
                                { label: "直接生成", value: "direct" },
                                { label: "参考图", value: "reference" },
                            ]}
                            onChange={(value) => onUpdateProject({ defaultVideoMode: value as DramaProject["defaultVideoMode"] })}
                        />
                    </label>
                    <Button type="primary" block className="!h-11 sm:!h-9" icon={<Sparkles className="size-4" />} loading={analyzing} onClick={onAnalyzeScript}>
                        AI 提取内容结构
                    </Button>
                    <p className="pt-1 text-xs leading-5 text-muted-foreground">解析结果会进入内容审核，不会直接启动图片或视频生成。</p>
                </div>
            </div>
        </div>
    );
}
