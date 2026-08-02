"use client";

import { App, Button, Modal, Pagination, Spin } from "antd";
import { Ban, Heart, UserMinus, Video } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { CompactEmptyState } from "@/components/compact-empty-state";
import { LazyMediaImage } from "@/components/media/lazy-media-image";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { userAvatarFallback } from "@/lib/user-avatar";
import { listCommunityActivity, setPublicCreatorFollow, setPublicUserBlock, setWorkLike, type CommunityActivityPage, type CommunityActivitySummary, type CommunityUser } from "@/services/api/work-community";
import type { PublicGalleryItem } from "@/services/api/work-governance";

const PAGE_SIZE = 12;

export type CommunityActivityView = "following" | "followers" | "likes";
type ActivityPage = Exclude<CommunityActivityPage, CommunityActivitySummary>;

export function CommunityActivityModal({ view, onClose, onChanged, onOpenCreator, onOpenWork }: { view?: CommunityActivityView; onClose: () => void; onChanged: () => void; onOpenCreator: (username: string) => void; onOpenWork: (slug: string) => void }) {
    const t = useTranslations("public.works.me.activity");
    const locale = useLocale();
    const { message, modal } = App.useApp();
    const [page, setPage] = useState(1);
    const [activityPage, setActivityPage] = useState<ActivityPage>();
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [actionKey, setActionKey] = useState("");

    const modalMeta = useMemo(
        () =>
            ({
                following: { title: t("followingTitle"), emptyTitle: t("followingEmptyTitle"), emptyDescription: t("followingEmptyDesc") },
                followers: { title: t("followersTitle"), emptyTitle: t("followersEmptyTitle"), emptyDescription: t("followersEmptyDesc") },
                likes: { title: t("likesTitle"), emptyTitle: t("likesEmptyTitle"), emptyDescription: t("likesEmptyDesc") },
            }) as const,
        [t],
    );

    useEffect(() => {
        if (!view) return;
        let active = true;
        setLoading(true);
        void listCommunityActivity({ view, page, pageSize: PAGE_SIZE })
            .then((result) => {
                if (active && result.view !== "summary") setActivityPage(result);
            })
            .catch((error) => {
                if (active) message.error(error instanceof Error ? error.message : t("loadFailed"));
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [message, page, refreshKey, t, view]);

    const refresh = () => {
        setRefreshKey((value) => value + 1);
        onChanged();
    };

    const unfollow = async (item: CommunityUser) => {
        const key = `unfollow:${item.username}`;
        setActionKey(key);
        try {
            await setPublicCreatorFollow(item.username, false);
            message.success(t("unfollowed"));
            refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("unfollowFailed"));
        } finally {
            setActionKey("");
        }
    };

    const unlike = async (item: PublicGalleryItem) => {
        const key = `unlike:${item.slug}`;
        setActionKey(key);
        try {
            await setWorkLike(item.slug, false);
            message.success(t("unliked"));
            refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("unlikeFailed"));
        } finally {
            setActionKey("");
        }
    };

    const confirmBlock = (item: CommunityUser) => {
        modal.confirm({
            title: t("blockTitle", { name: item.displayName || item.username }),
            content: t("blockContent"),
            okText: t("blockOk"),
            cancelText: t("cancel"),
            okButtonProps: { danger: true },
            onOk: async () => {
                const key = `block:${item.username}`;
                setActionKey(key);
                try {
                    await setPublicUserBlock(item.username, true);
                    message.success(t("blocked"));
                    refresh();
                } catch (error) {
                    message.error(error instanceof Error ? error.message : t("blockFailed"));
                    throw error;
                } finally {
                    setActionKey("");
                }
            },
        });
    };

    const openCreator = (username: string) => {
        onClose();
        onOpenCreator(username);
    };

    const openWork = (slug: string) => {
        onClose();
        onOpenWork(slug);
    };

    return (
        <Modal open={Boolean(view)} title={view ? modalMeta[view].title : t("title")} width={640} centered footer={null} destroyOnHidden onCancel={onClose} styles={{ body: { maxHeight: "min(64vh, 620px)", overflowY: "auto", padding: "12px 0 0" } }}>
            <div className="min-h-40">
                {loading && !activityPage ? (
                    <div className="grid min-h-40 place-items-center">
                        <Spin size="small" />
                    </div>
                ) : null}
                {view && activityPage?.view === view && activityPage.items.length ? (
                    view === "likes" ? (
                        <LikedWorkList items={activityPage.items as Array<PublicGalleryItem & { likedAt: string }>} actionKey={actionKey} locale={locale} onOpen={openWork} onUnlike={unlike} />
                    ) : (
                        <CommunityUserList items={activityPage.items as CommunityUser[]} relation={view} actionKey={actionKey} locale={locale} onOpenProfile={openCreator} onUnfollow={unfollow} onBlock={confirmBlock} />
                    )
                ) : null}
                {!loading && view && activityPage?.view === view && !activityPage.items.length ? <CompactEmptyState title={modalMeta[view].emptyTitle} description={modalMeta[view].emptyDescription} /> : null}
            </div>
            {view && activityPage?.view === view && activityPage.total > PAGE_SIZE ? <Pagination className="mt-4" size="small" current={page} pageSize={PAGE_SIZE} total={activityPage.total} showSizeChanger={false} onChange={setPage} /> : null}
        </Modal>
    );
}

function CommunityUserList({
    items,
    relation,
    actionKey,
    locale,
    onOpenProfile,
    onUnfollow,
    onBlock,
}: {
    items: CommunityUser[];
    relation: "following" | "followers";
    actionKey: string;
    locale: string;
    onOpenProfile: (username: string) => void;
    onUnfollow: (item: CommunityUser) => void;
    onBlock: (item: CommunityUser) => void;
}) {
    const t = useTranslations("public.works.me.activity");
    return (
        <div className="divide-y divide-border">
            {items.map((item) => {
                const identity = (
                    <>
                        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-xs font-semibold text-background">
                            {item.avatarUrl ? <img src={item.avatarUrl} alt="" className="size-full object-cover" loading="lazy" /> : userAvatarFallback(item.displayName || item.username)}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">{item.displayName || item.username}</span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                @{item.username} · {t("followerCount", { count: item.followerCount })}
                            </span>
                            {item.bio ? <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">{item.bio}</span> : null}
                        </span>
                    </>
                );
                return (
                    <div key={item.username} className="flex min-w-0 items-center gap-2 py-3 first:pt-0 last:pb-0 sm:gap-3">
                        {item.publicProfileAvailable ? (
                            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onOpenProfile(item.username)}>
                                {identity}
                            </button>
                        ) : (
                            <div className="flex min-w-0 flex-1 items-center gap-3">{identity}</div>
                        )}
                        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                            <time className="hidden text-[10px] text-muted-foreground md:block" title={relation === "following" ? t("followedAt") : t("followerSince")}>
                                {formatShortTime(item.relatedAt, locale)}
                            </time>
                            {relation === "following" ? (
                                <Button type="text" size="small" icon={<UserMinus className="size-3.5" />} loading={actionKey === `unfollow:${item.username}`} disabled={Boolean(actionKey)} onClick={() => onUnfollow(item)}>
                                    {t("unfollow")}
                                </Button>
                            ) : null}
                            <Button type="text" danger size="small" icon={<Ban className="size-3.5" />} loading={actionKey === `block:${item.username}`} disabled={Boolean(actionKey)} onClick={() => onBlock(item)}>
                                {t("block")}
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function LikedWorkList({ items, actionKey, locale, onOpen, onUnlike }: { items: Array<PublicGalleryItem & { likedAt: string }>; actionKey: string; locale: string; onOpen: (slug: string) => void; onUnlike: (item: PublicGalleryItem) => void }) {
    const t = useTranslations("public.works.me.activity");
    return (
        <div className="divide-y divide-border">
            {items.map((item) => (
                <div key={item.slug} className="flex min-w-0 items-center gap-2 py-3 first:pt-0 last:pb-0">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onOpen(item.slug)}>
                        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                            {item.preview?.mediaType === "image" ? <LazyMediaImage src={imagePreviewUrl(item.preview.url, 192)} alt="" containerClassName="size-full" imageClassName="size-full object-cover" /> : <Video className="size-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 block text-sm font-semibold leading-5 text-foreground">{item.title}</span>
                            <span className="mt-1 block truncate text-xs text-muted-foreground">{item.authorName || t("anonymousAuthor")}</span>
                            <span className="mt-1 block text-[10px] text-muted-foreground">{t("likedAt", { time: formatShortTime(item.likedAt, locale) })}</span>
                        </span>
                    </button>
                    <Button type="text" danger size="small" icon={<Heart className="size-3.5 fill-current" />} loading={actionKey === `unlike:${item.slug}`} disabled={Boolean(actionKey)} onClick={() => onUnlike(item)}>
                        {t("unlike")}
                    </Button>
                </div>
            ))}
        </div>
    );
}

function formatShortTime(value: string, locale: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "-";
    return date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
