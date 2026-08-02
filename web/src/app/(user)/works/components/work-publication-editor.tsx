"use client";

import { App, Button, Checkbox, Form, Input, Modal, Segmented, Select, Tag } from "antd";
import { Check, Film, Image as ImageIcon, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { formatBytes } from "@/lib/image-utils";
import {
    createWorkPublication,
    getWorkPublication,
    getWorkPublicationSource,
    listWorkPublicationSources,
    updateWorkPublication,
    type WorkPublication,
    type WorkPublicationAuthorDisplay,
    type WorkPublicationDraftInput,
    type WorkPublicationSource,
    type WorkPublicationSourceGroups,
    type WorkPublicationSourceType,
    type WorkPublicationVisibility,
} from "@/services/api/work-publications";
import { sourceTypeLabels, visibilityLabels, workCategoryOptions } from "../work-publication-values";

type EditorValues = {
    sourceType: WorkPublicationSourceType;
    sourceId: string;
    title: string;
    description: string;
    publicPrompt: string;
    category: string;
    tags: string[];
    visibility: WorkPublicationVisibility;
    authorDisplay: WorkPublicationAuthorDisplay;
    authorName?: string;
};

const EMPTY_SOURCES: WorkPublicationSourceGroups = { media: [], canvas: [], drama: [] };
const DEFAULT_CATEGORY = "其他";

export function WorkPublicationEditor({
    open,
    workId,
    initialSource,
    onCancel,
    onSaved,
}: {
    open: boolean;
    workId?: string;
    initialSource?: { sourceType: WorkPublicationSourceType; sourceId: string };
    onCancel: () => void;
    onSaved: (work: WorkPublication) => void;
}) {
    const t = useTranslations("public.works.myWorks");
    const { message } = App.useApp();
    const [form] = Form.useForm<EditorValues>();
    const sourceType = Form.useWatch("sourceType", form) || "media";
    const authorDisplay = Form.useWatch("authorDisplay", form) || "profile";
    const visibility = Form.useWatch("visibility", form) || "public";
    const [sources, setSources] = useState<WorkPublicationSourceGroups>(EMPTY_SOURCES);
    const [source, setSource] = useState<WorkPublicationSource | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [coverKey, setCoverKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [sourceLoading, setSourceLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const sourceLabels = useMemo(() => sourceTypeLabels(t), [t]);
    const visibilityLabelMap = useMemo(() => visibilityLabels(t), [t]);
    const categoryOptions = useMemo(() => workCategoryOptions(t), [t]);

    useEffect(() => {
        if (!open) return;
        let active = true;
        setLoading(true);
        setSource(null);
        setSelectedKeys([]);
        setCoverKey("");
        void (async () => {
            try {
                const [sourceGroups, work] = await Promise.all([listWorkPublicationSources(), workId ? getWorkPublication(workId) : Promise.resolve(undefined)]);
                if (!active) return;
                setSources(sourceGroups);
                const nextType = work?.sourceType || initialSource?.sourceType || "media";
                const nextSourceId = work?.sourceId || initialSource?.sourceId || "";
                form.setFieldsValue({
                    sourceType: nextType,
                    sourceId: nextSourceId,
                    title: work?.currentVersion?.title || "",
                    description: work?.currentVersion?.description || "",
                    publicPrompt: work?.currentVersion?.publicPrompt || "",
                    category: work?.currentVersion?.category || DEFAULT_CATEGORY,
                    tags: work?.currentVersion?.tags || [],
                    visibility: work?.currentVersion?.visibility || "public",
                    authorDisplay: work?.currentVersion?.authorDisplay || "profile",
                    authorName: work?.currentVersion?.authorName,
                });
                if (!nextSourceId) return;
                const detail = await getWorkPublicationSource(nextType, nextSourceId);
                if (!active) return;
                setSource(detail);
                const currentAssets = work?.currentAssets || [];
                setSelectedKeys(currentAssets.filter((asset) => asset.role === "content").map((asset) => asset.storageKey));
                setCoverKey(currentAssets.find((asset) => asset.role === "cover")?.storageKey || "");
                if (!work?.currentVersion?.title) form.setFieldValue("title", detail.title);
                if (!work?.currentVersion?.publicPrompt?.trim() && detail.suggestedPrompt) form.setFieldValue("publicPrompt", detail.suggestedPrompt);
            } catch (error) {
                if (active) message.error(error instanceof Error ? error.message : t("editorLoadFailed"));
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [form, initialSource?.sourceId, initialSource?.sourceType, message, open, t, workId]);

    const sourceOptions = useMemo(
        () =>
            sources[sourceType].map((item) => {
                const kindLabel = item.kind ? (item.kind === "image" ? t("editorMediaImage") : t("editorMediaVideo")) : "";
                return {
                    value: item.id,
                    label: item.kind ? t("editorSourceOptionKind", { title: item.title, source: sourceLabels.media, kind: kindLabel }) : item.title,
                };
            }),
        [sourceLabels.media, sourceType, sources, t],
    );

    const selectSource = async (nextType: WorkPublicationSourceType, sourceId: string) => {
        form.setFieldValue("sourceId", sourceId);
        setSource(null);
        setSelectedKeys([]);
        setCoverKey("");
        if (!sourceId) return;
        setSourceLoading(true);
        try {
            const detail = await getWorkPublicationSource(nextType, sourceId);
            setSource(detail);
            const keys = detail.candidates.slice(0, 12).map((candidate) => candidate.storageKey);
            setSelectedKeys(keys);
            setCoverKey(detail.candidates.find((candidate) => candidate.mediaType === "image")?.storageKey || "");
            if (!form.getFieldValue("title")) form.setFieldValue("title", detail.title);
            if (!form.getFieldValue("publicPrompt")?.trim() && detail.suggestedPrompt) form.setFieldValue("publicPrompt", detail.suggestedPrompt);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("editorSourceLoadFailed"));
        } finally {
            setSourceLoading(false);
        }
    };

    const save = async (values: EditorValues) => {
        if (!source || !selectedKeys.length) return message.warning(t("editorSelectMediaWarning"));
        setSaving(true);
        try {
            const input: WorkPublicationDraftInput = {
                ...values,
                sourceType: source.sourceType,
                sourceId: source.sourceId,
                title: values.title.trim(),
                description: values.description?.trim() || "",
                publicPrompt: values.publicPrompt.trim(),
                tags: values.tags || [],
                authorName: values.authorName?.trim() || undefined,
                coverStorageKey: coverKey || undefined,
                assetStorageKeys: selectedKeys,
            };
            const work = workId ? await updateWorkPublication(workId, input) : await createWorkPublication(input);
            message.success(workId ? t("editorDraftSaved") : t("editorDraftCreated"));
            onSaved(work);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("editorSaveFailed"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title={workId ? t("editorEditTitle") : t("editorCreateTitle")}
            open={open}
            width={900}
            okText={t("editorSaveDraft")}
            cancelText={t("cancel")}
            confirmLoading={saving}
            okButtonProps={{ disabled: loading || sourceLoading || !source || !selectedKeys.length }}
            mask={{ closable: !saving }}
            keyboard={!saving}
            destroyOnHidden
            onOk={() => form.submit()}
            onCancel={onCancel}
        >
            {loading ? (
                <div className="grid min-h-72 place-items-center text-sm text-stone-500 dark:text-stone-400">
                    <span className="flex items-center gap-2">
                        <LoaderCircle className="size-4 animate-spin" /> {t("editorLoading")}
                    </span>
                </div>
            ) : (
                <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => void save(values)}>
                    <div className="max-h-[min(70dvh,760px)] min-w-0 space-y-4 overflow-y-auto pr-1">
                        <section className="rounded-lg border border-stone-200 p-3 sm:p-4 dark:border-stone-800">
                            <div className="mb-3 text-sm font-semibold text-stone-950 dark:text-stone-100">{t("editorSelectSourceSection")}</div>
                            <div className="grid gap-x-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                                <Form.Item label={t("editorSourceType")} name="sourceType" rules={[{ required: true }]}>
                                    <Segmented
                                        block
                                        disabled={Boolean(workId)}
                                        options={Object.entries(sourceLabels).map(([value, label]) => ({ value, label }))}
                                        onChange={(value) => {
                                            const nextType = value as WorkPublicationSourceType;
                                            form.setFieldsValue({ sourceType: nextType, sourceId: "" });
                                            setSource(null);
                                            setSelectedKeys([]);
                                            setCoverKey("");
                                        }}
                                    />
                                </Form.Item>
                                <Form.Item label={t("editorSourceItem")} name="sourceId" rules={[{ required: true, message: t("editorSelectSourceRequired") }]}>
                                    <Select
                                        showSearch
                                        disabled={Boolean(workId)}
                                        loading={sourceLoading}
                                        optionFilterProp="label"
                                        placeholder={sourceOptions.length ? t("editorSelectSourcePlaceholder") : t("editorNoSourcesPlaceholder")}
                                        options={sourceOptions}
                                        onChange={(value) => void selectSource(sourceType, value)}
                                    />
                                </Form.Item>
                            </div>
                        </section>

                        <section className="rounded-lg border border-stone-200 p-3 sm:p-4 dark:border-stone-800">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("editorMediaSection")}</div>
                                    <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t("editorSelectedCount", { count: selectedKeys.length })}</div>
                                </div>
                                {sourceLoading ? <LoaderCircle className="size-4 animate-spin text-stone-400" /> : null}
                            </div>
                            {source?.candidates.length ? (
                                <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                    {source.candidates.map((candidate) => {
                                        const selected = selectedKeys.includes(candidate.storageKey);
                                        const cover = coverKey === candidate.storageKey;
                                        return (
                                            <article key={candidate.storageKey} className={`min-w-0 overflow-hidden rounded-md border ${selected ? "border-stone-950 dark:border-stone-100" : "border-stone-200 dark:border-stone-800"}`}>
                                                <div className="relative aspect-[4/3] overflow-hidden bg-stone-100 dark:bg-stone-900">
                                                    {candidate.mediaType === "image" ? (
                                                        <img src={candidate.previewUrl} alt={candidate.originalName} className="size-full object-cover" loading="lazy" />
                                                    ) : candidate.mediaType === "video" ? (
                                                        <video src={candidate.previewUrl} className="size-full object-cover" preload="metadata" muted />
                                                    ) : null}
                                                    <Checkbox
                                                        className="!absolute !left-2 !top-2 !m-0 [&_.ant-checkbox-inner]:!size-5 [&_.ant-checkbox-inner]:!border-white/90 [&_.ant-checkbox-inner]:!bg-white/95 [&_.ant-checkbox-checked_.ant-checkbox-inner]:!border-stone-950 [&_.ant-checkbox-checked_.ant-checkbox-inner]:!bg-stone-950 dark:[&_.ant-checkbox-inner]:!border-stone-700 dark:[&_.ant-checkbox-inner]:!bg-stone-900 dark:[&_.ant-checkbox-checked_.ant-checkbox-inner]:!border-white dark:[&_.ant-checkbox-checked_.ant-checkbox-inner]:!bg-white dark:[&_.ant-checkbox-checked_.ant-checkbox-inner]:after:!border-stone-950"
                                                        checked={selected}
                                                        aria-label={t("editorSelectCandidateAria", { name: candidate.originalName })}
                                                        onChange={(event) => setSelectedKeys((keys) => (event.target.checked ? [...new Set([...keys, candidate.storageKey])] : keys.filter((key) => key !== candidate.storageKey)))}
                                                    />
                                                    <Tag className="!absolute !bottom-1.5 !right-1.5 !m-0 !border-0 !bg-black/65 !text-[10px] !text-white">
                                                        {candidate.mediaType === "image" ? <ImageIcon className="mr-1 inline size-3" /> : candidate.mediaType === "video" ? <Film className="mr-1 inline size-3" /> : null}
                                                        {formatBytes(candidate.bytes)}
                                                    </Tag>
                                                </div>
                                                <div className="min-w-0 p-2">
                                                    <div className="truncate text-xs font-medium text-stone-800 dark:text-stone-200" title={candidate.originalName}>
                                                        {candidate.originalName}
                                                    </div>
                                                    {candidate.mediaType === "image" ? (
                                                        <Button type={cover ? "primary" : "text"} size="small" className="!mt-1.5 !h-7 !w-full" icon={cover ? <Check className="size-3.5" /> : undefined} onClick={() => setCoverKey(candidate.storageKey)}>
                                                            {cover ? t("editorCurrentCover") : t("editorSetCover")}
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="mt-3 grid min-h-24 place-items-center rounded-md border border-dashed border-stone-300 px-3 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">{t("editorSelectSourceForMedia")}</div>
                            )}
                        </section>

                        <section className="rounded-lg border border-stone-200 p-3 sm:p-4 dark:border-stone-800">
                            <div className="grid gap-x-4 sm:grid-cols-2">
                                <Form.Item label={t("editorTitleLabel")} name="title" rules={[{ required: true, message: t("editorTitleRequired") }, { max: 100 }]}>
                                    <Input placeholder={t("editorTitlePlaceholder")} maxLength={100} />
                                </Form.Item>
                                <Form.Item label={t("editorCategoryLabel")} name="category" rules={[{ required: true }]}>
                                    <Select options={categoryOptions} />
                                </Form.Item>
                            </div>
                            <Form.Item label={t("editorDescriptionLabel")} name="description" rules={[{ max: 2000 }]}>
                                <Input.TextArea rows={4} maxLength={2000} showCount placeholder={t("editorDescriptionPlaceholder")} />
                            </Form.Item>
                            <Form.Item label={t("editorPublicPromptLabel")} name="publicPrompt" rules={[{ required: true, whitespace: true, message: t("editorPublicPromptRequired") }, { max: 8000 }]} extra={t("editorPublicPromptExtra")}>
                                <Input.TextArea rows={5} maxLength={8000} showCount placeholder={t("editorPublicPromptPlaceholder")} />
                            </Form.Item>
                            <Form.Item label={t("editorTagsLabel")} name="tags">
                                <Select mode="tags" maxCount={10} maxTagCount="responsive" tokenSeparators={[",", "，"]} placeholder={t("editorTagsPlaceholder")} />
                            </Form.Item>
                            <div className="grid gap-x-4 sm:grid-cols-2">
                                <Form.Item label={t("editorVisibilityLabel")} name="visibility" rules={[{ required: true }]}>
                                    <Select options={Object.entries(visibilityLabelMap).map(([value, label]) => ({ value, label }))} />
                                </Form.Item>
                                <Form.Item label={t("editorAuthorDisplayLabel")} name="authorDisplay" rules={[{ required: true }]}>
                                    <Select
                                        options={[
                                            { value: "profile", label: t("editorAuthorProfile") },
                                            { value: "custom", label: t("editorAuthorCustom") },
                                            { value: "hidden", label: t("editorAuthorHidden") },
                                        ]}
                                    />
                                </Form.Item>
                            </div>
                            <p className={`-mt-2 mb-4 text-xs leading-5 ${visibility === "public" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                                {visibility === "public" ? t("editorVisibilityPublicHint") : visibility === "unlisted" ? t("editorVisibilityUnlistedHint") : t("editorVisibilityPrivateHint")}
                            </p>
                            {authorDisplay === "custom" ? (
                                <Form.Item label={t("editorAuthorNameLabel")} name="authorName" rules={[{ required: true, message: t("editorAuthorNameRequired") }, { max: 80 }]}>
                                    <Input maxLength={80} placeholder={t("editorAuthorNamePlaceholder")} />
                                </Form.Item>
                            ) : null}
                        </section>
                    </div>
                </Form>
            )}
        </Modal>
    );
}
