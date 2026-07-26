"use client";

import { Copy, Download, FileAudio, Film, PencilLine, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { App, Button, Card, Drawer, Form, Image, Input, Modal, Pagination, Select, Space, Tag, Typography } from "antd";
import { saveAs } from "file-saver";
import { useTranslations } from "next-intl";

import { useCopyText } from "@/hooks/use-copy-text";
import { CompactEmptyState } from "@/components/compact-empty-state";
import { droppedFiles, leftDropTarget, preventFileDragEvent } from "@/lib/file-drop";
import { formatBytes } from "@/lib/image-utils";
import { imagePreviewUrl, originalImageDownloadUrl, originalImageExtension } from "@/lib/media-image-url";
import { uploadImage } from "@/services/image-storage";
import { uploadMediaFile } from "@/services/file-storage";
import { cn } from "@/lib/utils";
import { useAssetStore, type Asset, type AssetKind, type AudioAsset, type ImageAsset, type VideoAsset } from "@/stores/use-asset-store";
import { useUserStore } from "@/stores/use-user-store";
import { exportAssets, readAssetPackage } from "./asset-transfer";

type AssetFormValues = {
    kind: AssetKind;
    title: string;
    coverUrl: string;
    tags: string[];
    source?: string;
    note?: string;
    content?: string;
};

type MediaDraft = ImageAsset["data"] | VideoAsset["data"] | AudioAsset["data"] | null;

import { AssetCard, AssetDrawer, assetSummary, assetSearchText } from "./asset-elements";

export default function AssetsPage() {
    const { message } = App.useApp();
    const t = useTranslations("workspace.assets");
    const kindOptions = [
        { label: t("kindAll"), value: "all" },
        { label: t("kindText"), value: "text" },
        { label: t("kindImage"), value: "image" },
        { label: t("kindVideo"), value: "video" },
        { label: t("kindAudio"), value: "audio" },
    ];
    const kindLabel = (kind: AssetKind) => (kind === "image" ? t("kindImage") : kind === "video" ? t("kindVideo") : t("kindAudio"));
    const copyText = useCopyText();
    const [form] = Form.useForm<AssetFormValues>();
    const coverInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const assetInputRef = useRef<HTMLInputElement>(null);
    const userId = useUserStore((state) => state.user?.id || "");
    const hydrated = useAssetStore((state) => state.hydrated);
    const hydratedUserId = useAssetStore((state) => state.hydratedUserId);
    const hydrate = useAssetStore((state) => state.hydrate);
    const assets = useAssetStore((state) => state.assets);
    const addAsset = useAssetStore((state) => state.addAsset);
    const updateAsset = useAssetStore((state) => state.updateAsset);
    const removeAsset = useAssetStore((state) => state.removeAsset);
    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState<AssetKind | "all">("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [isAssetOpen, setIsAssetOpen] = useState(false);
    const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
    const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
    const [isCoverDragActive, setIsCoverDragActive] = useState(false);
    const [isImageDragActive, setIsImageDragActive] = useState(false);
    const [formKind, setFormKind] = useState<AssetKind>("text");
    const [mediaDraft, setMediaDraft] = useState<MediaDraft>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [importing, setImporting] = useState(false);
    const coverUrl = Form.useWatch("coverUrl", form) || "";
    const title = Form.useWatch("title", form) || "";
    const tags = Form.useWatch("tags", form) || [];
    const content = Form.useWatch("content", form) || "";
    const validAssets = useMemo(() => assets.filter((asset) => asset.kind === "text" || asset.kind === "image" || asset.kind === "video" || asset.kind === "audio"), [assets]);
    const ready = Boolean(userId && hydrated && hydratedUserId === userId);

    useEffect(() => {
        if (userId) void hydrate();
    }, [hydrate, userId]);

    const filteredAssets = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return validAssets.filter((asset) => {
            if (kindFilter !== "all" && asset.kind !== kindFilter) return false;
            if (!query) return true;
            return assetSearchText(asset).includes(query);
        });
    }, [validAssets, keyword, kindFilter]);

    const visibleAssets = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredAssets.slice(start, start + pageSize);
    }, [filteredAssets, page, pageSize]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
        setPage((value) => Math.min(value, maxPage));
    }, [filteredAssets.length, pageSize]);

    const openCreate = () => {
        setEditingAsset(null);
        setMediaDraft(null);
        setFormKind("text");
        form.setFieldsValue({ kind: "text", title: "", coverUrl: "", tags: [], source: t("manualAdd"), note: "", content: "" });
        setIsAssetOpen(true);
    };

    const openEdit = (asset: Asset) => {
        setEditingAsset(asset);
        setFormKind(asset.kind);
        setMediaDraft(asset.kind === "text" ? null : asset.data);
        form.setFieldsValue({
            kind: asset.kind,
            title: asset.title,
            coverUrl: asset.coverUrl,
            tags: asset.tags || [],
            source: asset.source,
            note: asset.note,
            content: asset.kind === "text" ? asset.data.content : "",
        });
        setIsAssetOpen(true);
    };

    const saveAsset = async () => {
        setSaving(true);
        try {
            const values = await form.validateFields();
            let nextCover = values.coverUrl?.trim() || (values.kind === "image" && mediaDraft && "dataUrl" in mediaDraft ? mediaDraft.dataUrl : "");
            if (nextCover && !nextCover.startsWith("/api/reference-assets/")) nextCover = (await uploadImage(nextCover)).url;
            const base = {
                title: values.title.trim(),
                coverUrl: nextCover,
                tags: values.tags || [],
                source: values.source?.trim(),
                note: values.note?.trim(),
                metadata: editingAsset?.metadata || { source: "manual" },
            };

            if (values.kind === "text") {
                const asset = { ...base, kind: "text" as const, data: { content: (values.content || "").trim() } };
                await (editingAsset ? updateAsset(editingAsset.id, asset) : addAsset(asset));
            } else {
                if (!mediaDraft) throw new Error(t("selectFileRequired", { kind: kindLabel(values.kind) }));
                const asset = { ...base, kind: values.kind, data: mediaDraft } as Parameters<typeof addAsset>[0];
                await (editingAsset ? updateAsset(editingAsset.id, asset) : addAsset(asset));
            }

            message.success(editingAsset ? t("assetUpdated") : t("assetSaved"));
            setIsAssetOpen(false);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("assetSaveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const readCoverFile = async (file?: File) => {
        if (!file) return;
        const image = await uploadImage(file);
        form.setFieldValue("coverUrl", image.url);
    };

    const readMediaFile = async (file?: File) => {
        if (!file || formKind === "text" || !file.type.startsWith(`${formKind}/`)) return message.warning(t("selectFormatRequired", { kind: kindLabel(formKind) }));
        const media = formKind === "image" ? await uploadImage(file) : await uploadMediaFile(file, formKind);
        const draft: MediaDraft =
            formKind === "image"
                ? { dataUrl: media.url, storageKey: media.storageKey, serverUrl: media.url, width: media.width || 0, height: media.height || 0, bytes: media.bytes, mimeType: media.mimeType }
                : formKind === "video"
                  ? { url: media.url, storageKey: media.storageKey, serverUrl: media.url, width: media.width || 0, height: media.height || 0, bytes: media.bytes, mimeType: media.mimeType }
                  : { url: media.url, storageKey: media.storageKey, serverUrl: media.url, durationMs: "durationMs" in media ? media.durationMs : undefined, bytes: media.bytes, mimeType: media.mimeType };
        setMediaDraft(draft);
        if (formKind === "image" && !form.getFieldValue("coverUrl") && "dataUrl" in draft) form.setFieldValue("coverUrl", draft.dataUrl);
        if (!form.getFieldValue("title")) form.setFieldValue("title", file.name);
    };

    const handleCoverDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!preventFileDragEvent(event)) return;
        setIsCoverDragActive(true);
    };

    const handleCoverDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!preventFileDragEvent(event) || !leftDropTarget(event)) return;
        setIsCoverDragActive(false);
    };

    const handleCoverDrop = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!preventFileDragEvent(event)) return;
        setIsCoverDragActive(false);
        const [file] = droppedFiles(event, (item) => item.type.startsWith("image/"));
        if (file) void readCoverFile(file);
    };

    const handleImageDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!preventFileDragEvent(event)) return;
        setIsImageDragActive(true);
    };

    const handleImageDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!preventFileDragEvent(event) || !leftDropTarget(event)) return;
        setIsImageDragActive(false);
    };

    const handleImageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
        if (!preventFileDragEvent(event)) return;
        setIsImageDragActive(false);
        const [file] = droppedFiles(event, (item) => formKind !== "text" && item.type.startsWith(`${formKind}/`));
        if (file) void readMediaFile(file);
    };

    const copyAssetText = async (asset: Asset) => {
        if (asset.kind !== "text") return;
        copyText(asset.data.content, t("textCopied"));
    };

    const downloadImage = (asset: Asset) => {
        if (asset.kind === "text") return;
        const url = asset.kind === "image" ? originalImageDownloadUrl(asset.data.dataUrl) : asset.data.url;
        const extension = asset.kind === "image" ? originalImageExtension(asset.data.dataUrl) : asset.data.mimeType.split("/")[1] || (asset.kind === "audio" ? "mp3" : "mp4");
        saveAs(url, `${asset.title || "asset"}.${extension}`);
    };

    const exportAllAssets = async () => {
        if (!validAssets.length) {
            message.warning(t("noAssetsToExport"));
            return;
        }
        await exportAssets(validAssets, t("exportZipName"));
    };

    const importAssetZip = async (file?: File) => {
        if (!file) return;
        setImporting(true);
        try {
            const importedAssets = await readAssetPackage(file);
            await Promise.all(
                importedAssets.map((asset) => {
                    const payload = { ...asset } as Record<string, unknown>;
                    delete payload.id;
                    delete payload.createdAt;
                    delete payload.updatedAt;
                    return addAsset(payload as Parameters<typeof addAsset>[0]);
                }),
            );
            message.success(t("importedCount", { count: importedAssets.length }));
        } catch {
            message.error(t("importFailed"));
        } finally {
            setImporting(false);
            if (assetInputRef.current) assetInputRef.current.value = "";
        }
    };

    const confirmDelete = async () => {
        if (!deletingAsset) return;
        setDeleting(true);
        try {
            await removeAsset(deletingAsset.id);
            message.success(t("assetDeleted"));
            setDeletingAsset(null);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("assetDeleteFailed"));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-stone-900 dark:text-stone-100">
            <main className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-6 sm:py-8">
                <div className="pb-2.5 sm:pb-8">
                    <div className="mx-auto max-w-7xl">
                        <h1 className="text-xl font-semibold text-stone-950 sm:text-2xl dark:text-stone-100">{t("title")}</h1>
                        <p className="mt-1 text-xs leading-5 text-stone-500 sm:mt-3 sm:text-sm dark:text-stone-400">{t("subtitle")}</p>
                    </div>

                    <div className="mx-auto mt-2 w-full max-w-7xl sm:mt-6">
                        <Input.Search
                            className="w-full"
                            size="middle"
                            allowClear
                            prefix={<Search className="size-4 text-stone-400" />}
                            value={keyword}
                            placeholder={t("searchPlaceholder")}
                            onChange={(event) => {
                                setPage(1);
                                setKeyword(event.target.value);
                            }}
                            onSearch={(value) => {
                                setPage(1);
                                setKeyword(value);
                            }}
                        />
                    </div>

                    <div className="mx-auto mt-2 grid max-w-6xl gap-2 text-left sm:mt-6 sm:gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-center">
                                <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{t("typeLabel")}</div>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                    {kindOptions.map((option) => (
                                        <Tag.CheckableTag
                                            key={option.value}
                                            checked={kindFilter === option.value}
                                            className={cn("prompt-filter-tag", kindFilter === option.value && "is-active")}
                                            onChange={() => {
                                                setPage(1);
                                                setKindFilter(option.value as AssetKind | "all");
                                            }}
                                        >
                                            {option.label}
                                        </Tag.CheckableTag>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <button
                                    type="button"
                                    className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline dark:text-stone-300"
                                    onClick={() => void exportAllAssets()}
                                >
                                    {t("exportButton")}
                                </button>
                                <button
                                    type="button"
                                    disabled={!ready || importing}
                                    className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-300"
                                    onClick={() => assetInputRef.current?.click()}
                                >
                                    {importing ? t("importing") : t("importButton")}
                                </button>
                                <button
                                    type="button"
                                    disabled={!ready}
                                    className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-300"
                                    onClick={openCreate}
                                >
                                    {t("addButton")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mx-auto flex max-w-7xl flex-col gap-1.5 sm:gap-5">
                    <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                        {visibleAssets.map((asset) => (
                            <AssetCard key={asset.id} asset={asset} onOpen={() => setPreviewAsset(asset)} onEdit={() => openEdit(asset)} onCopy={copyAssetText} onDownload={downloadImage} onDelete={() => setDeletingAsset(asset)} />
                        ))}
                    </div>

                    {!visibleAssets.length ? <CompactEmptyState title={t("emptyTitle")} description={t("emptyDescription")} /> : null}

                    <div className="flex justify-center">
                        <Pagination
                            current={page}
                            pageSize={pageSize}
                            total={filteredAssets.length}
                            showSizeChanger
                            pageSizeOptions={[10, 20, 50, 100]}
                            onChange={(nextPage, nextPageSize) => {
                                setPage(nextPage);
                                setPageSize(nextPageSize);
                            }}
                        />
                    </div>
                </div>
            </main>

            <Modal
                title={editingAsset ? t("editModalTitle") : t("createModalTitle")}
                open={isAssetOpen}
                width={980}
                onCancel={() => setIsAssetOpen(false)}
                onOk={() => void saveAsset()}
                confirmLoading={saving}
                okText={t("save")}
                cancelText={t("cancel")}
                destroyOnHidden
            >
                <div className="grid gap-3 pt-1 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <Form form={form} layout="vertical" requiredMark={false} initialValues={{ kind: "text", tags: [] }}>
                        <Form.Item name="kind" label={t("fieldType")}>
                            <Select
                                options={[
                                    { label: t("kindText"), value: "text" },
                                    { label: t("kindImage"), value: "image" },
                                    { label: t("kindVideo"), value: "video" },
                                    { label: t("kindAudio"), value: "audio" },
                                ]}
                                onChange={(value) => {
                                    setFormKind(value);
                                    setMediaDraft(null);
                                }}
                            />
                        </Form.Item>
                        <Form.Item name="title" label={t("fieldTitle")} rules={[{ required: true, message: t("titleRequired") }]}>
                            <Input size="large" placeholder={t("titlePlaceholder")} />
                        </Form.Item>
                        <Form.Item name="coverUrl" label={t("fieldCover")}>
                            <div
                                className={cn("rounded-md transition", isCoverDragActive && "ring-2 ring-cyan-300 ring-offset-2 ring-offset-white dark:ring-cyan-500 dark:ring-offset-stone-950")}
                                onDragEnter={handleCoverDragOver}
                                onDragOver={handleCoverDragOver}
                                onDragLeave={handleCoverDragLeave}
                                onDrop={handleCoverDrop}
                            >
                                <Space.Compact className="w-full">
                                    <Input placeholder={t("coverPlaceholder")} />
                                    <Button icon={<Upload className="size-3.5" />} onClick={() => coverInputRef.current?.click()}>
                                        {t("upload")}
                                    </Button>
                                </Space.Compact>
                            </div>
                        </Form.Item>
                        <Form.Item name="tags" label={t("fieldTags")}>
                            <Select mode="tags" tokenSeparators={[",", "，"]} placeholder={t("tagsPlaceholder")} />
                        </Form.Item>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Form.Item name="source" label={t("fieldSource")}>
                                <Input placeholder={t("sourcePlaceholder")} />
                            </Form.Item>
                            <Form.Item name="note" label={t("fieldNote")}>
                                <Input placeholder={t("notePlaceholder")} />
                            </Form.Item>
                        </div>
                        {formKind === "text" ? (
                            <Form.Item name="content" label={t("fieldContent")} rules={[{ required: true, message: t("contentRequired") }]}>
                                <Input.TextArea rows={8} placeholder={t("contentPlaceholder")} />
                            </Form.Item>
                        ) : (
                            <Form.Item label={t("contentLabelWithKind", { kind: kindLabel(formKind) })} required>
                                <div
                                    className={cn(
                                        "rounded-lg border border-dashed border-stone-300 p-4 transition dark:border-stone-700",
                                        isImageDragActive && "border-cyan-400 bg-cyan-50/60 ring-1 ring-cyan-200 dark:border-cyan-400 dark:bg-cyan-500/10 dark:ring-cyan-400/25",
                                    )}
                                    onDragEnter={handleImageDragOver}
                                    onDragOver={handleImageDragOver}
                                    onDragLeave={handleImageDragLeave}
                                    onDrop={handleImageDrop}
                                >
                                    <Button icon={<Upload className="size-4" />} onClick={() => imageInputRef.current?.click()}>
                                        {t("chooseFileWithKind", { kind: kindLabel(formKind) })}
                                    </Button>
                                    {mediaDraft ? (
                                        <Typography.Text type="secondary" className="ml-3 text-xs">
                                            {"width" in mediaDraft ? `${mediaDraft.width}x${mediaDraft.height} · ` : ""}
                                            {formatBytes(mediaDraft.bytes)}
                                        </Typography.Text>
                                    ) : (
                                        <Typography.Text type="secondary" className="ml-3 text-xs">
                                            {t("noFileSelected")}
                                        </Typography.Text>
                                    )}
                                </div>
                            </Form.Item>
                        )}
                    </Form>
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950">
                        <Typography.Text strong>{t("preview")}</Typography.Text>
                        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
                            {coverUrl || (mediaDraft && "dataUrl" in mediaDraft ? mediaDraft.dataUrl : "") ? (
                                <img src={imagePreviewUrl(coverUrl || (mediaDraft && "dataUrl" in mediaDraft ? mediaDraft.dataUrl : ""), 960)} alt="" className="aspect-[4/3] w-full object-cover" />
                            ) : formKind === "video" && mediaDraft && "url" in mediaDraft ? (
                                <div className="flex aspect-[4/3] items-center justify-center bg-stone-900 text-white">
                                    <Film className="size-10" />
                                </div>
                            ) : formKind === "audio" && mediaDraft && "url" in mediaDraft ? (
                                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 text-stone-500 dark:bg-stone-900">
                                    <FileAudio className="size-10" />
                                </div>
                            ) : (
                                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 p-5 text-center text-sm text-stone-500 dark:bg-stone-900">{content || t("noCover")}</div>
                            )}
                            <div className="p-4">
                                <Typography.Text strong ellipsis className="block">
                                    {title || t("unnamedAsset")}
                                </Typography.Text>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {tags.length ? (
                                        tags.map((tag) => (
                                            <Tag key={tag} className="m-0">
                                                {tag}
                                            </Tag>
                                        ))
                                    ) : (
                                        <Tag className="m-0">{t("noTag")}</Tag>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        void readCoverFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
                <input
                    ref={imageInputRef}
                    type="file"
                    accept={formKind === "image" ? "image/*" : formKind === "video" ? "video/*" : "audio/*"}
                    className="hidden"
                    onChange={(event) => {
                        void readMediaFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
            </Modal>

            <AssetDrawer asset={previewAsset} onClose={() => setPreviewAsset(null)} onCopy={copyAssetText} onDownload={downloadImage} />

            <input ref={assetInputRef} type="file" accept="application/zip,.zip" className="hidden" onChange={(event) => void importAssetZip(event.target.files?.[0])} />

            <Modal
                title={t("deleteModalTitle")}
                open={Boolean(deletingAsset)}
                onCancel={() => setDeletingAsset(null)}
                onOk={() => void confirmDelete()}
                confirmLoading={deleting}
                okText={t("delete")}
                okButtonProps={{ danger: true }}
                cancelText={t("cancel")}
            >
                {t("deleteConfirm", { title: deletingAsset?.title || "" })}
            </Modal>
        </div>
    );
}
