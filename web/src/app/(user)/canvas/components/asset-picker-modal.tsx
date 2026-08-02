"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Input, Modal, Pagination, Spin, Tag } from "antd";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import { useUserStore } from "@/stores/use-user-store";

export type InsertAssetPayload =
    | { kind: "text"; content: string; title: string }
    | { kind: "image"; dataUrl: string; title: string; storageKey?: string; remoteUrl?: string; serverUrl?: string }
    | { kind: "video"; url: string; title: string; storageKey?: string; remoteUrl?: string; serverUrl?: string; width?: number; height?: number }
    | { kind: "audio"; url: string; title: string; storageKey?: string; remoteUrl?: string; serverUrl?: string; durationMs?: number };

type Props = {
    open: boolean;
    defaultTab?: string;
    onInsert: (payload: InsertAssetPayload) => void;
    onClose: () => void;
};

export function AssetPickerModal({ open, onInsert, onClose }: Props) {
    const t = useTranslations("canvas");
    return (
        <Modal
            title={t("assets.selectTitle")}
            open={open}
            onCancel={onClose}
            footer={null}
            width="min(760px, calc(100vw - 24px))"
            destroyOnHidden
            styles={{ body: { maxHeight: "min(620px, calc(100dvh - 140px))", overflowY: "auto", padding: "0 clamp(12px, 3vw, 24px) clamp(12px, 3vw, 24px)" } }}
        >
            <MyAssetsTab open={open} onInsert={onInsert} />
        </Modal>
    );
}

const PAGE_SIZE = 8;

function PickerCard({ title, kind, cover, onClick }: { title: string; kind: string; cover: string; onClick: () => void }) {
    const t = useTranslations("canvas");
    const kindLabel = kind === "image" ? t("kind.image") : kind === "video" ? t("kind.video") : kind === "audio" ? t("kind.audio") : t("kind.text");
    return (
        <button
            type="button"
            className="group relative cursor-pointer overflow-hidden rounded-lg border border-stone-200 bg-white text-left transition hover:border-stone-400 hover:shadow-md dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-500"
            onClick={onClick}
        >
            {cover ? (
                <img src={imagePreviewUrl(cover, 480)} alt={title} className="aspect-[4/3] w-full object-cover" />
            ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 p-3 text-center text-xs leading-5 text-stone-500 dark:bg-stone-800 dark:text-stone-400">{title}</div>
            )}
            <div className="p-2.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-xs font-medium text-stone-800 dark:text-stone-200">{title}</span>
                    <Tag className="m-0 shrink-0 text-[10px]">{kindLabel}</Tag>
                </div>
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-stone-950/55 group-hover:opacity-100">{t("assets.insert")}</div>
        </button>
    );
}

function MyAssetsTab({ open, onInsert }: { open: boolean; onInsert: (payload: InsertAssetPayload) => void }) {
    const t = useTranslations("canvas");
    const userId = useUserStore((state) => state.user?.id || "");
    const assets = useAssetStore((state) => state.assets);
    const hydrated = useAssetStore((state) => state.hydrated);
    const hydratedUserId = useAssetStore((state) => state.hydratedUserId);
    const syncError = useAssetStore((state) => state.syncError);
    const hydrate = useAssetStore((state) => state.hydrate);
    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState("all");
    const [page, setPage] = useState(1);
    const kindOptions = [
        { label: t("assets.kindAll"), value: "all" },
        { label: t("kind.text"), value: "text" },
        { label: t("kind.image"), value: "image" },
        { label: t("kind.video"), value: "video" },
        { label: t("kind.audio"), value: "audio" },
    ];

    const filtered = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return assets
            .filter((a) => a.kind === "text" || a.kind === "image" || a.kind === "video" || a.kind === "audio")
            .filter((a) => kindFilter === "all" || a.kind === kindFilter)
            .filter((a) => !query || [a.title, ...(a.tags || [])].join(" ").toLowerCase().includes(query));
    }, [assets, keyword, kindFilter]);

    const visible = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
    const ready = Boolean(userId && hydrated && hydratedUserId === userId);

    useEffect(() => {
        if (open && userId) void hydrate(true);
    }, [hydrate, open, userId]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        setPage((v) => Math.min(v, maxPage));
    }, [filtered.length]);

    const handleInsert = (asset: Asset) => {
        if (asset.kind === "text") {
            onInsert({ kind: "text", content: asset.data.content, title: asset.title });
        } else {
            if (asset.kind === "video")
                onInsert({ kind: "video", url: asset.data.url, storageKey: asset.data.storageKey, remoteUrl: asset.data.remoteUrl, serverUrl: asset.data.serverUrl, title: asset.title, width: asset.data.width, height: asset.data.height });
            else if (asset.kind === "audio") onInsert({ kind: "audio", url: asset.data.url, storageKey: asset.data.storageKey, remoteUrl: asset.data.remoteUrl, serverUrl: asset.data.serverUrl, title: asset.title, durationMs: asset.data.durationMs });
            else onInsert({ kind: "image", dataUrl: asset.data.dataUrl, storageKey: asset.data.storageKey, remoteUrl: asset.data.remoteUrl, serverUrl: asset.data.serverUrl, title: asset.title });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <Input
                    className="w-full sm:w-56"
                    size="small"
                    prefix={<Search className="size-3.5 text-stone-400" />}
                    placeholder={t("assets.searchPlaceholder")}
                    value={keyword}
                    allowClear
                    onChange={(e) => {
                        setPage(1);
                        setKeyword(e.target.value);
                    }}
                />
                <div className="hide-scrollbar flex max-w-full gap-1.5 overflow-x-auto pb-0.5">
                    {kindOptions.map((opt) => (
                        <Tag.CheckableTag
                            key={opt.value}
                            checked={kindFilter === opt.value}
                            className={cn("prompt-filter-tag", kindFilter === opt.value && "is-active")}
                            onChange={() => {
                                setPage(1);
                                setKindFilter(opt.value);
                            }}
                        >
                            {opt.label}
                        </Tag.CheckableTag>
                    ))}
                </div>
            </div>

            {!ready && !syncError ? (
                <div className="grid min-h-32 place-items-center sm:min-h-56">
                    <Spin size="small" description={t("assets.loading")} />
                </div>
            ) : syncError ? (
                <Alert
                    type="error"
                    showIcon
                    message={t("assets.loadFailed")}
                    description={syncError}
                    action={
                        <Button size="small" onClick={() => void hydrate(true)}>
                            {t("assets.retry")}
                        </Button>
                    }
                />
            ) : visible.length ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                    {visible.map((asset) => (
                        <PickerCard key={asset.id} title={asset.title} kind={asset.kind} cover={asset.coverUrl || (asset.kind === "image" ? asset.data.dataUrl : "")} onClick={() => handleInsert(asset)} />
                    ))}
                </div>
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("assets.empty")} className="!my-6 sm:!my-8" />
            )}

            {filtered.length > PAGE_SIZE && (
                <div className="flex justify-center">
                    <Pagination size="small" current={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} showSizeChanger={false} />
                </div>
            )}
        </div>
    );
}
