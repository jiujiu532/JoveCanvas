"use client";

import { App, Button, Drawer, Input, Modal, Segmented, Select } from "antd";
import { ImagePlus, Link2, LoaderCircle, MessageSquareText, RotateCcw, Send, Square, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SiteLogo } from "@/components/layout/site-logo";
import type { TextAreaRef } from "antd/es/input/TextArea";

import type { AgentMediaDownload } from "@/components/agent/agent-media-download";
import { CreativeAgentControls, CreativeAgentSkillCard, type CreativeAgentModelOption } from "@/components/agent/creative-agent-controls";
import { AgentMessageActions } from "@/components/agent/agent-message-actions";
import { AgentMarkdown } from "@/components/agent/agent-markdown";
import { agentMessageFormatLabelsFromT, formatAgentMessageText, friendlyAgentError } from "@/components/agent/agent-message-format";
import { useTranslations } from "next-intl";
import { AgentMediaPreview } from "@/components/agent/agent-media-preview";
import { clipboardImageFiles } from "@/lib/clipboard-image-files";
import type { CreativeAsset, CreativeMessage } from "@/lib/creative-runtime-contract";
import { CREATIVE_UPLOAD_MAX_BYTES, isCreativeUploadMimeType } from "@/lib/creative-upload";
import type { DramaAssetReference, DramaEpisode, DramaProject } from "@/lib/drama-project-contract";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { useCreativeAgentOptions } from "@/hooks/use-creative-agent-options";
import { controlCreativeAgentRun, createCreativeAgentRun, createCreativeConversation, listCreativeAssets, listCreativeMessages, uploadCreativeAsset, watchCreativeAgentRun } from "@/services/api/creative";
import { usePublicSessionStore } from "@/stores/use-public-session-store";
import { useDramaStore } from "../stores/use-drama-store";
import { agentRequirementAcknowledgement, agentRequirementAcknowledgementLabelsFromT } from "@/lib/agent-requirement-acknowledgement";

type PendingDramaSubmission = {
    clientRequestId: string;
    conversationId?: string;
    content: string;
    assetIds: string[];
    skillIds: string[];
    modelIds: string[];
    temporaryUserId: string;
    temporaryAssistantId: string;
    snapshot: ReturnType<typeof dramaSnapshot>;
};

export function DramaAgentPanel({ project, episode, onConversationChange }: { project: DramaProject; episode: DramaEpisode; onConversationChange: (conversationId: string) => void }) {
    const t = useTranslations("drama");
    const [mobileOpen, setMobileOpen] = useState(false);
    return (
        <>
            <aside className="hidden min-h-0 min-w-0 xl:block">
                <div className="sticky top-6 h-[calc(100dvh-3rem)] overflow-hidden rounded-lg border border-border bg-card">
                    <DramaAgentContent project={project} episode={episode} onConversationChange={onConversationChange} />
                </div>
            </aside>
            <Button type="primary" shape="circle" className="!fixed !bottom-20 !right-4 !z-30 !size-11 sm:!bottom-4 xl:!hidden" icon={<MessageSquareText className="size-4.5" />} aria-label={t("agent.openMobileAria")} onClick={() => setMobileOpen(true)} />
            <Drawer title={t("agent.title")} placement="right" width="min(100vw, 420px)" open={mobileOpen} destroyOnHidden onClose={() => setMobileOpen(false)} styles={{ body: { padding: 0 } }}>
                {mobileOpen ? <DramaAgentContent project={project} episode={episode} onConversationChange={onConversationChange} /> : null}
            </Drawer>
        </>
    );
}

function DramaAgentContent({ project, episode, onConversationChange }: { project: DramaProject; episode: DramaEpisode; onConversationChange: (conversationId: string) => void }) {
    const t = useTranslations("drama");
    const acknowledgementLabels = agentRequirementAcknowledgementLabelsFromT(useTranslations("drama.agent.ack"));
    const formatLabels = agentMessageFormatLabelsFromT(useTranslations("layout"));
    const { message } = App.useApp();
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { logoUrl: "/logo.svg" };
    const { skills, skillsLoading, models } = useCreativeAgentOptions("drama");
    const [messages, setMessages] = useState<CreativeMessage[]>([]);
    const [assets, setAssets] = useState<CreativeAsset[]>([]);
    const [prompt, setPrompt] = useState("");
    const [selectedSkillId, setSelectedSkillId] = useState<string>();
    const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
    const [smartPlanning, setSmartPlanning] = useState(true);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [runId, setRunId] = useState<string>();
    const streamRef = useRef<(() => void) | null>(null);
    const submittingRef = useRef(false);
    const failedSubmissionsRef = useRef(new Map<string, PendingDramaSubmission>());
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<TextAreaRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const activeConversationIdRef = useRef(project.creativeConversationId);
    const selectedSkill = skills.find((skill) => skill.id === selectedSkillId);
    const selectedModels = models.filter((model) => selectedModelIds.includes(model.id));
    const selectedAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));

    useEffect(() => {
        if (project.creativeConversationId) activeConversationIdRef.current = project.creativeConversationId;
    }, [project.creativeConversationId]);

    const refresh = useCallback(async (conversationId = activeConversationIdRef.current) => {
        if (!conversationId) return;
        const [nextMessages, nextAssets] = await Promise.all([listCreativeMessages(conversationId), listCreativeAssets(conversationId)]);
        setMessages(nextMessages);
        setAssets(nextAssets);
    }, []);

    useEffect(() => {
        setLoading(true);
        void refresh().finally(() => setLoading(false));
        return () => streamRef.current?.();
    }, [refresh]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" });
    }, [assets.length, messages.at(-1)?.id]);

    const assetsByRun = useMemo(() => {
        const map = new Map<string, CreativeAsset[]>();
        for (const asset of assets) {
            const key = asset.messageId || asset.sourceRunId;
            if (key) map.set(key, [...(map.get(key) || []), asset]);
        }
        return map;
    }, [assets]);
    const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);

    const ensureConversation = async () => {
        if (activeConversationIdRef.current) return activeConversationIdRef.current;
        const conversation = await createCreativeConversation({ surface: "drama", source: "drama", projectId: project.id, title: t("agent.conversationTitle", { title: project.title || t("agent.fallbackProjectTitle") }) });
        activeConversationIdRef.current = conversation.id;
        onConversationChange(conversation.id);
        return conversation.id;
    };

    const uploadImages = async (files: File[]) => {
        const unsupported = files.find((file) => !isCreativeUploadMimeType(file.type) || !file.type.startsWith("image/"));
        if (unsupported) return message.error(t("agent.upload.unsupportedFormat", { name: unsupported.name }));
        const oversized = files.find((file) => file.size > CREATIVE_UPLOAD_MAX_BYTES);
        if (oversized) return message.error(t("agent.upload.tooLarge", { name: oversized.name }));
        if (!files.length || uploading) return;
        setUploading(true);
        try {
            const conversationId = await ensureConversation();
            const uploaded: CreativeAsset[] = [];
            for (const file of files.slice(0, 6)) uploaded.push(await uploadCreativeAsset(conversationId, file));
            setAssets((current) => [...current, ...uploaded.filter((asset) => !current.some((item) => item.id === asset.id))]);
            setSelectedAssetIds((current) => Array.from(new Set([...current, ...uploaded.map((asset) => asset.id)])).slice(-20));
            message.success(t("agent.upload.success", { count: uploaded.length }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("agent.upload.failed"));
        } finally {
            setUploading(false);
        }
    };

    const executeSubmission = async (submission: PendingDramaSubmission) => {
        try {
            const result = await createCreativeAgentRun({
                clientRequestId: submission.clientRequestId,
                surface: "drama",
                conversationId: submission.conversationId,
                projectId: project.id,
                prompt: submission.content,
                assetIds: submission.assetIds,
                skillIds: submission.skillIds,
                modelIds: submission.modelIds,
                snapshot: submission.snapshot,
            });
            failedSubmissionsRef.current.delete(submission.temporaryAssistantId);
            activeConversationIdRef.current = result.run.conversationId;
            if (result.run.conversationId !== project.creativeConversationId) onConversationChange(result.run.conversationId);
            setRunId(result.run.id);
            setMessages((current) =>
                current.map((item) => {
                    if (item.id === submission.temporaryUserId) return { ...item, id: result.run.inputMessageId, conversationId: result.run.conversationId, runId: result.run.id };
                    if (item.id === submission.temporaryAssistantId) return { ...item, id: result.run.assistantMessageId, conversationId: result.run.conversationId, runId: result.run.id };
                    return item;
                }),
            );
            await refresh(result.run.conversationId);
            streamRef.current?.();
            streamRef.current = watchCreativeAgentRun(result.run.id, {
                onProgress: () => void refresh(),
                onTaskCompleted: () => void refresh(),
                onStatus: () => undefined,
                onProjectHandoff: () => undefined,
                onConnectionError: () => {
                    setSending(false);
                    submittingRef.current = false;
                    setRunId(undefined);
                    void refresh();
                },
                onTerminal: () => {
                    setSending(false);
                    submittingRef.current = false;
                    setRunId(undefined);
                    streamRef.current = null;
                    void refresh();
                },
            });
            return true;
        } catch (error) {
            failedSubmissionsRef.current.set(submission.temporaryAssistantId, submission);
            const content = friendlyAgentError(error, t("agent.requestFailed"), formatLabels);
            setMessages((current) => current.map((item) => (item.id === submission.temporaryAssistantId ? { ...item, content, status: "failed", updatedAt: Date.now() } : item)));
            setSending(false);
            submittingRef.current = false;
            setRunId(undefined);
            return false;
        }
    };

    const submit = async () => {
        const content = prompt.trim();
        if (!content || sending || submittingRef.current || uploading) return;
        submittingRef.current = true;
        setPrompt("");
        setSending(true);
        const now = Date.now();
        const sequence = messages.reduce((highest, item) => Math.max(highest, item.sequence), 0) + 1;
        const temporaryUserId = `message-${nanoid()}`;
        const temporaryAssistantId = `message-${nanoid()}`;
        const assetIds = selectedAssetIds.slice(-20);
        const submission: PendingDramaSubmission = {
            clientRequestId: `drama-agent-${nanoid()}`,
            conversationId: activeConversationIdRef.current,
            content,
            assetIds,
            skillIds: selectedSkillId ? [selectedSkillId] : [],
            modelIds: smartPlanning ? [] : selectedModelIds,
            temporaryUserId,
            temporaryAssistantId,
            snapshot: dramaSnapshot(project, episode),
        };
        setMessages((current) => [
            ...current,
            { id: temporaryUserId, conversationId: submission.conversationId || "pending", sequence, role: "user", status: "completed", content, metadata: { assetIds }, createdAt: now, updatedAt: now },
            {
                id: temporaryAssistantId,
                conversationId: submission.conversationId || "pending",
                sequence: sequence + 1,
                role: "assistant",
                status: "running",
                content: agentRequirementAcknowledgement(content, "drama", assetIds.length > 0, acknowledgementLabels),
                metadata: {},
                createdAt: now,
                updatedAt: now,
            },
        ]);
        setSelectedSkillId(undefined);
        setSelectedAssetIds((current) => current.filter((id) => !assetIds.includes(id)));
        return executeSubmission(submission);
    };

    const retrySubmission = async (assistantMessageId: string) => {
        const submission = failedSubmissionsRef.current.get(assistantMessageId);
        if (!submission || sending || submittingRef.current) return false;
        submittingRef.current = true;
        setSending(true);
        setMessages((current) => current.map((item) => (item.id === assistantMessageId ? { ...item, content: t("agent.resubmitting"), status: "running", updatedAt: Date.now() } : item)));
        return executeSubmission(submission);
    };

    const toggleModel = (model: CreativeAgentModelOption) => {
        setSelectedModelIds((current) => {
            const next = current.includes(model.id) ? current.filter((id) => id !== model.id) : [...current, model.id].slice(-6);
            setSmartPlanning(next.length === 0);
            return next;
        });
    };

    const enableSmartPlanning = () => {
        setSelectedModelIds([]);
        setSmartPlanning(true);
    };

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-2 font-medium">
                    <SiteLogo logoUrl={site.logoUrl} className="size-5" />
                    <span className="truncate">{t("agent.title")}</span>
                </div>
                <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{t("agent.subtitle")}</p>
            </div>
            <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-4 py-4">
                {loading ? <div className="py-5 text-center text-sm text-muted-foreground sm:py-8">{t("agent.loadingConversation")}</div> : null}
                {!loading && !messages.length ? (
                    <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                        <span className="grid size-9 place-items-center rounded-md border border-border bg-muted/35">
                            <MessageSquareText className="size-4" />
                        </span>
                        <span className="text-sm font-medium text-foreground">{t("agent.emptyConversation")}</span>
                    </div>
                ) : null}
                {messages.map((message) => {
                    const referencedAssets = message.role === "user" ? messageAssetIds(message).flatMap((id) => assetById.get(id) || []) : [];
                    const messageAssets = [...(assetsByRun.get(message.id) || []), ...(message.runId ? assetsByRun.get(message.runId) || [] : [])].filter((asset, index, list) => list.findIndex((item) => item.id === asset.id) === index);
                    const displayContent = formatAgentMessageText(message.content, formatLabels);
                    return (
                        <div key={message.id} className={`group/message min-w-0 ${message.role === "user" ? "pl-8 text-right" : "pr-2"}`}>
                            {referencedAssets.length ? <DramaMessageReferences assets={referencedAssets} /> : null}
                            <div className={`min-w-0 break-words text-sm leading-6 [overflow-wrap:anywhere] ${message.status === "failed" ? "text-red-500" : "text-foreground"}`}>
                                {message.status === "running" ? <LoaderCircle className="mr-1 inline size-3.5 animate-spin" /> : null}
                                {message.role === "assistant" && message.status === "completed" ? <AgentMarkdown>{displayContent}</AgentMarkdown> : <span className="whitespace-pre-wrap">{displayContent}</span>}
                            </div>
                            {messageAssets.length ? <DramaAgentAssets assets={messageAssets} project={project} episode={episode} /> : null}
                            {message.role === "assistant" && message.status === "failed" && !message.runId ? (
                                <Button
                                    type="text"
                                    size="small"
                                    className="!mt-1 !h-7 !px-1.5 !text-xs !text-red-600 hover:!bg-red-50 hover:!text-red-700 dark:!text-red-300 dark:hover:!bg-red-950/30 dark:hover:!text-red-200"
                                    icon={<RotateCcw className="size-3.5" />}
                                    onClick={() => void retrySubmission(message.id)}
                                    aria-label={t("agent.retryAria")}
                                >
                                    {t("agent.retryButton")}
                                </Button>
                            ) : null}
                            {message.status !== "running" ? (
                                <AgentMessageActions
                                    text={displayContent}
                                    downloads={agentAssetDownloads(messageAssets, t)}
                                    onEdit={
                                        message.role === "user" && !sending
                                            ? (text) => {
                                                  setPrompt(text);
                                                  setSelectedAssetIds(
                                                      messageAssetIds(message)
                                                          .filter((id) => assets.some((asset) => asset.id === id))
                                                          .slice(-20),
                                                  );
                                                  window.requestAnimationFrame(() => inputRef.current?.focus());
                                              }
                                            : undefined
                                    }
                                    align={message.role === "user" ? "end" : "start"}
                                />
                            ) : null}
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>
            <div className="m-3 min-w-0 shrink-0 rounded-lg border border-border bg-background p-2 shadow-[0_8px_24px_rgba(15,23,42,.08)]">
                {selectedSkill ? <CreativeAgentSkillCard skill={selectedSkill} onRemove={() => setSelectedSkillId(undefined)} className="pb-1" /> : null}
                {selectedAssets.length ? (
                    <div className="thin-scrollbar flex gap-2 overflow-x-auto px-1 pb-2">
                        {selectedAssets.map((asset) => {
                            const url = asset.serverUrl || asset.remoteUrl || "";
                            return (
                                <div key={asset.id} className="group relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                                    {url ? <AgentMediaPreview type="image" url={url} title={asset.title || t("agent.referenceImageFallback")} className="size-full" /> : <ImagePlus className="m-auto size-4 text-muted-foreground" />}
                                    <button
                                        type="button"
                                        className="absolute right-1 top-1 z-10 grid size-5 place-items-center rounded bg-background/90 text-muted-foreground shadow-sm hover:text-foreground"
                                        onClick={() => setSelectedAssetIds((current) => current.filter((id) => id !== asset.id))}
                                        aria-label={t("agent.removeReferenceAria", { title: asset.title })}
                                    >
                                        <X className="size-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
                <Input.TextArea
                    ref={inputRef}
                    value={prompt}
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    placeholder={t("agent.inputPlaceholder")}
                    disabled={sending}
                    variant="borderless"
                    className="!min-w-0 !bg-transparent !px-2 !shadow-none"
                    onChange={(event) => setPrompt(event.target.value)}
                    onPaste={(event) => {
                        const files = clipboardImageFiles(event.clipboardData);
                        if (!files.length) return;
                        event.preventDefault();
                        void uploadImages(files);
                    }}
                    onPressEnter={(event) => {
                        if (!event.shiftKey) {
                            event.preventDefault();
                            void submit();
                        }
                    }}
                />
                <div className="mt-1 flex min-w-0 items-center justify-between gap-2 border-t border-border pt-2">
                    <div className="flex min-w-0 items-center gap-1">
                        <input
                            ref={fileInputRef}
                            hidden
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            multiple
                            onChange={(event) => {
                                void uploadImages(Array.from(event.target.files || []));
                                event.target.value = "";
                            }}
                        />
                        <Button type="text" shape="circle" className="!size-8 !min-w-8" icon={<ImagePlus className="size-4" />} loading={uploading} disabled={sending} onClick={() => fileInputRef.current?.click()} aria-label={t("agent.uploadAria")} />
                        <CreativeAgentControls
                            compact
                            skills={skills}
                            skillsLoading={skillsLoading}
                            selectedSkill={selectedSkill}
                            models={models}
                            selectedModels={selectedModels}
                            smartPlanning={smartPlanning}
                            onSelectSkill={(skill) => setSelectedSkillId(skill.id)}
                            onToggleModel={toggleModel}
                            onClearModels={enableSmartPlanning}
                            onSmartPlanningChange={(enabled) => (enabled ? enableSmartPlanning() : setSmartPlanning(false))}
                        />
                    </div>
                    {sending && runId ? (
                        <Button danger shape="circle" icon={<Square className="size-3.5" />} onClick={() => void controlCreativeAgentRun(runId, "cancel")} aria-label={t("agent.stopAria")} />
                    ) : (
                        <Button type="primary" shape="circle" icon={<Send className="size-3.5" />} disabled={!prompt.trim() || uploading} onClick={() => void submit()} aria-label={t("agent.sendAria")} />
                    )}
                </div>
            </div>
        </div>
    );
}

function DramaMessageReferences({ assets }: { assets: CreativeAsset[] }) {
    const t = useTranslations("drama");
    let imageIndex = 0;
    return (
        <div className="mb-1.5 flex max-w-full flex-wrap justify-end gap-1.5" aria-label={t("agent.roundReferencesAria")}>
            {assets.flatMap((asset) => {
                const url = asset.serverUrl || asset.remoteUrl || "";
                if (asset.type !== "image" || !url) return [];
                return (
                    <div key={asset.id} className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted" title={asset.title || t("agent.referenceImageFallback")}>
                        <AgentMediaPreview type="image" url={url} title={asset.title || t("agent.referenceImageFallback")} className="size-full" />
                        <span className="absolute left-1 top-1 rounded bg-black/65 px-1 py-0.5 text-[9px] font-medium leading-none text-white">{imageReferenceLabel(imageIndex++)}</span>
                    </div>
                );
            })}
        </div>
    );
}

function messageAssetIds(message: CreativeMessage) {
    const value = message.metadata.assetIds;
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

function DramaAgentAssets({ assets, project, episode }: { assets: CreativeAsset[]; project: DramaProject; episode: DramaEpisode }) {
    const { message } = App.useApp();
    const t = useTranslations("drama");
    const tc = useTranslations("common");
    const updateShot = useDramaStore((state) => state.updateShot);
    const updateAsset = useDramaStore((state) => state.updateAsset);
    const addCharacter = useDramaStore((state) => state.addCharacter);
    const addScene = useDramaStore((state) => state.addScene);
    const addProp = useDramaStore((state) => state.addProp);
    const addClue = useDramaStore((state) => state.addClue);
    const [referenceAsset, setReferenceAsset] = useState<CreativeAsset>();
    const [visualAsset, setVisualAsset] = useState<CreativeAsset>();
    const [shotId, setShotId] = useState(episode.shots[0]?.id || "");
    const [frameKind, setFrameKind] = useState<"start" | "end">("start");
    const [visualKind, setVisualKind] = useState<VisualAssetKind>("characters");
    const [visualAssetId, setVisualAssetId] = useState("");
    const [newVisualAssetName, setNewVisualAssetName] = useState("");
    const applyReference = () => {
        const shot = episode.shots.find((item) => item.id === shotId);
        const url = referenceAsset?.serverUrl || referenceAsset?.remoteUrl || "";
        if (!shot || !url) return;
        updateShot(project.id, episode.id, shot.id, {
            ...(frameKind === "start"
                ? { storyboardStatus: "success" as const, storyboardTaskId: undefined, storyboardError: undefined, storyboardImageUrl: url, storyboardImageWidth: referenceAsset?.width, storyboardImageHeight: referenceAsset?.height }
                : {
                      storyboardFrameMode: "first_last" as const,
                      storyboardEndStatus: "success" as const,
                      storyboardEndTaskId: undefined,
                      storyboardEndError: undefined,
                      storyboardEndImageUrl: url,
                      storyboardEndImageWidth: referenceAsset?.width,
                      storyboardEndImageHeight: referenceAsset?.height,
                  }),
            generationStatus: "idle",
            generationTaskId: undefined,
            generationError: undefined,
            videoUrl: undefined,
            audioStatus: "idle",
            audioTaskId: undefined,
            audioError: undefined,
            audioUrl: undefined,
        });
        setReferenceAsset(undefined);
        message.success(t("agent.reference.appliedSuccess", { title: shot.title, frame: frameKind === "start" ? t("storyboard.startFrame") : t("storyboard.endFrame") }));
    };

    const applyVisualAsset = () => {
        const sourceAsset = visualAsset;
        const url = sourceAsset?.serverUrl || sourceAsset?.remoteUrl || "";
        if (!sourceAsset || !url) return;
        const reference: DramaAssetReference = {
            id: `reference-${nanoid()}`,
            url,
            storageKey: sourceAsset.storageKey,
            source: "generated",
            label: sourceAsset.title || t("agent.visualAsset.generatedImageFallback"),
            width: sourceAsset.width,
            height: sourceAsset.height,
            createdAt: new Date().toISOString(),
        };
        const selected = project[visualKind].find((item) => item.id === visualAssetId);
        const name = newVisualAssetName.trim() || sourceAsset.title.trim() || t("agent.visualAsset.referenceNameFallback", { kind: t(`agent.visualAssetKinds.${visualKind}`) });
        if (selected) {
            const references = [...(selected.references || []), reference].slice(-12);
            updateAsset(project.id, visualKind, selected.id, { references, primaryReferenceId: reference.id, referenceImageUrl: reference.url, referenceStorageKey: reference.storageKey });
            message.success(t("agent.visualAsset.addedToExisting", { name: selected.name }));
        } else if (visualKind === "characters") {
            addCharacter(project.id, {
                name,
                description: t("agent.visualAsset.autoDescription"),
                profile: emptyAssetProfile(),
                references: [reference],
                primaryReferenceId: reference.id,
                referenceImageUrl: reference.url,
                referenceStorageKey: reference.storageKey,
            });
            message.success(t("agent.visualAsset.createdCharacter", { name }));
        } else if (visualKind === "scenes") {
            addScene(project.id, {
                name,
                description: t("agent.visualAsset.autoDescription"),
                profile: emptyAssetProfile(),
                references: [reference],
                primaryReferenceId: reference.id,
                referenceImageUrl: reference.url,
                referenceStorageKey: reference.storageKey,
            });
            message.success(t("agent.visualAsset.createdScene", { name }));
        } else if (visualKind === "props") {
            addProp(project.id, {
                name,
                description: t("agent.visualAsset.autoDescription"),
                profile: emptyAssetProfile(),
                references: [reference],
                primaryReferenceId: reference.id,
                referenceImageUrl: reference.url,
                referenceStorageKey: reference.storageKey,
            });
            message.success(t("agent.visualAsset.createdProp", { name }));
        } else {
            addClue(project.id, {
                name,
                description: t("agent.visualAsset.autoDescription"),
                payoff: "",
                profile: emptyAssetProfile(),
                references: [reference],
                primaryReferenceId: reference.id,
                referenceImageUrl: reference.url,
                referenceStorageKey: reference.storageKey,
            });
            message.success(t("agent.visualAsset.createdClue", { name }));
        }
        setVisualAsset(undefined);
        setVisualAssetId("");
        setNewVisualAssetName("");
    };

    return (
        <>
            <div className="mt-3 grid gap-2">
                {assets
                    .filter((asset) => asset.type !== "text")
                    .map((asset) => {
                        const url = asset.serverUrl || asset.remoteUrl || "";
                        if (!url) return null;
                        return (
                            <div key={asset.id} className="min-w-0">
                                <AgentMediaPreview
                                    type={asset.type}
                                    url={url}
                                    title={asset.title || t("agent.generatedMediaFallback")}
                                    className={asset.type === "image" ? "max-h-64 rounded-md" : asset.type === "video" ? "aspect-video rounded-md" : undefined}
                                />
                                {asset.type === "image" ? (
                                    <div className="mt-2 flex min-w-0 items-center rounded-lg border border-border/70 bg-muted/30 p-1">
                                        <Button
                                            type="text"
                                            className="!h-7 !min-w-0 !flex-1 !justify-center !px-2 !text-xs !text-foreground hover:!bg-background/80"
                                            size="small"
                                            icon={<Link2 className="size-3.5" />}
                                            disabled={!episode.shots.length}
                                            onClick={() => setReferenceAsset(asset)}
                                        >
                                            {t("agent.referenceToShotButton")}
                                        </Button>
                                        <span className="h-4 w-px shrink-0 bg-border" />
                                        <Button
                                            type="text"
                                            className="!h-7 !min-w-0 !flex-1 !justify-center !px-2 !text-xs !text-foreground hover:!bg-background/80"
                                            size="small"
                                            icon={<ImagePlus className="size-3.5" />}
                                            onClick={() => setVisualAsset(asset)}
                                        >
                                            {t("agent.addToVisualAssetButton")}
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
            </div>
            <Modal
                title={t("agent.referenceModal.title")}
                open={Boolean(referenceAsset)}
                width={420}
                centered
                destroyOnHidden
                okText={t("agent.referenceModal.ok")}
                cancelText={tc("cancel")}
                okButtonProps={{ disabled: !shotId }}
                onCancel={() => setReferenceAsset(undefined)}
                onOk={applyReference}
            >
                <div className="grid gap-4 pt-2">
                    <label className="grid gap-1.5 text-sm">
                        <span className="font-medium">{t("agent.referenceModal.targetShotLabel")}</span>
                        <Select
                            value={shotId || undefined}
                            placeholder={t("agent.referenceModal.targetShotPlaceholder")}
                            optionFilterProp="label"
                            options={episode.shots.map((shot) => ({ value: shot.id, label: `${String(shot.order).padStart(2, "0")} · ${shot.title}` }))}
                            onChange={setShotId}
                        />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                        <span className="font-medium">{t("agent.referenceModal.positionLabel")}</span>
                        <Segmented
                            block
                            value={frameKind}
                            options={[
                                { label: t("storyboard.startFrame"), value: "start" },
                                { label: t("storyboard.endFrame"), value: "end" },
                            ]}
                            onChange={(value) => setFrameKind(value as "start" | "end")}
                        />
                    </label>
                    <p className="text-xs leading-5 text-muted-foreground">{t("agent.referenceModal.hint")}</p>
                </div>
            </Modal>
            <Modal
                title={t("agent.visualAssetModal.title")}
                open={Boolean(visualAsset)}
                width={460}
                centered
                destroyOnHidden
                okText={t("agent.visualAssetModal.ok")}
                cancelText={tc("cancel")}
                okButtonProps={{ disabled: !visualAsset || (!visualAssetId && !newVisualAssetName.trim()) }}
                onCancel={() => {
                    setVisualAsset(undefined);
                    setVisualAssetId("");
                    setNewVisualAssetName("");
                }}
                onOk={applyVisualAsset}
            >
                <div className="grid gap-4 pt-2">
                    <p className="text-sm leading-6 text-muted-foreground">{t("agent.visualAssetModal.hint")}</p>
                    <label className="grid gap-1.5 text-sm">
                        <span className="font-medium">{t("agent.visualAssetModal.kindLabel")}</span>
                        <Segmented
                            block
                            value={visualKind}
                            options={visualAssetKinds.map((item) => ({ label: t(item.labelKey), value: item.value }))}
                            onChange={(value) => {
                                setVisualKind(value as VisualAssetKind);
                                setVisualAssetId("");
                            }}
                        />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                        <span className="font-medium">{t("agent.visualAssetModal.existingLabel")}</span>
                        <Select
                            allowClear
                            value={visualAssetId || undefined}
                            placeholder={t("agent.visualAssetModal.existingPlaceholder")}
                            options={project[visualKind].map((item) => ({ value: item.id, label: item.name }))}
                            onChange={(value) => {
                                setVisualAssetId(value || "");
                                if (value) setNewVisualAssetName("");
                            }}
                        />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                        <span className="font-medium">{t("agent.visualAssetModal.newNameLabel")}</span>
                        <Input
                            value={newVisualAssetName}
                            onChange={(event) => {
                                setNewVisualAssetName(event.target.value);
                                if (event.target.value.trim()) setVisualAssetId("");
                            }}
                            placeholder={t("agent.visualAssetModal.newNamePlaceholder", { example: t(visualAssetKinds.find((item) => item.value === visualKind)?.exampleKey || "agent.visualAssetKinds.fallbackExample") })}
                        />
                    </label>
                </div>
            </Modal>
        </>
    );
}

type VisualAssetKind = "characters" | "scenes" | "props" | "clues";

const visualAssetKinds: Array<{ value: VisualAssetKind; labelKey: string; exampleKey: string }> = [
    { value: "characters", labelKey: "agent.visualAssetKinds.characters", exampleKey: "agent.visualAssetKinds.characterExample" },
    { value: "scenes", labelKey: "agent.visualAssetKinds.scenes", exampleKey: "agent.visualAssetKinds.sceneExample" },
    { value: "props", labelKey: "agent.visualAssetKinds.props", exampleKey: "agent.visualAssetKinds.propExample" },
    { value: "clues", labelKey: "agent.visualAssetKinds.clues", exampleKey: "agent.visualAssetKinds.clueExample" },
];

function emptyAssetProfile() {
    return { visualIdentity: "", styling: "", colorPalette: "", consistencyRules: "" };
}

function dramaSnapshot(project: DramaProject, episode: DramaEpisode) {
    return {
        project: { id: project.id, title: project.title, summary: project.summary, style: project.style, ratio: project.ratio },
        episode: { id: episode.id, title: episode.title, script: episode.script.slice(0, 80_000) },
        characters: project.characters.slice(0, 50),
        scenes: project.scenes.slice(0, 50),
        shots: episode.shots.slice(0, 200).map((shot) => ({
            id: shot.id,
            title: shot.title,
            description: shot.description,
            dialogue: shot.dialogue,
            imagePrompt: shot.imagePrompt,
            videoPrompt: shot.videoPrompt,
            duration: shot.duration,
            storyboardImageUrl: shot.storyboardImageUrl,
            videoUrl: shot.videoUrl,
            audioUrl: shot.audioUrl,
        })),
    };
}

function agentAssetDownloads(assets: CreativeAsset[], t: (key: string) => string): AgentMediaDownload[] {
    return assets.flatMap((asset) => {
        const url = asset.serverUrl || asset.remoteUrl || "";
        return url && (asset.type === "image" || asset.type === "video") ? [{ type: asset.type, url, title: asset.title || t(asset.type === "video" ? "agent.downloadFallback.video" : "agent.downloadFallback.image"), mimeType: asset.mimeType }] : [];
    });
}
