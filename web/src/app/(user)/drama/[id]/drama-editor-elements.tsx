"use client";

import type { ReactNode } from "react";
import { Tag } from "antd";
import { useTranslations } from "next-intl";

const compactTagClass = "!m-0 !inline-flex !h-6 !min-w-max !shrink-0 !items-center !whitespace-nowrap !rounded-md !border-0 !px-2 !text-xs !leading-6";

export function SectionTitle({ title, description, className = "" }: { title: string; description: string; className?: string }) {
    return (
        <div className={`mb-4 sm:mb-8 ${className}`}>
            <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground sm:mt-2 sm:leading-6">{description}</p>
        </div>
    );
}
export function GenerationTag({ status = "idle" }: { status?: string }) {
    const t = useTranslations("drama");
    const colors: Record<string, string> = { idle: "default", queued: "blue", running: "processing", success: "success", error: "error", cancelled: "default" };
    const key = colors[status] ? status : "idle";
    return (
        <Tag bordered={false} className={compactTagClass} color={colors[key]}>
            {t(`storyboard.status.generation.${key}`)}
        </Tag>
    );
}
export function StoryboardTag({ status = "idle" }: { status?: string }) {
    const t = useTranslations("drama");
    const colors: Record<string, string> = { idle: "default", queued: "geekblue", running: "processing", success: "success", error: "error", cancelled: "default" };
    const key = colors[status] ? status : "idle";
    return (
        <Tag bordered={false} className={compactTagClass} color={colors[key]}>
            {t(`storyboard.status.storyboard.${key}`)}
        </Tag>
    );
}
export function AudioTag({ status = "idle" }: { status?: string }) {
    const t = useTranslations("drama");
    const colors: Record<string, string> = { idle: "default", queued: "cyan", running: "processing", success: "success", error: "error", cancelled: "default" };
    const key = colors[status] ? status : "idle";
    return (
        <Tag bordered={false} className={compactTagClass} color={colors[key]}>
            {t(`storyboard.status.audio.${key}`)}
        </Tag>
    );
}
export function AssetPanel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-border bg-background p-3 sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center gap-3 font-semibold sm:mb-6">
                {icon}
                {title}
            </div>
            {children}
        </section>
    );
}
export function AssetList({ items }: { items: Array<{ id: string; name: string; description: string }> }) {
    const t = useTranslations("drama");
    return items.length ? (
        <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
            {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-card p-3 sm:p-4">
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="mt-2 text-xs leading-5 text-muted-foreground">{item.description || t("assets.noDescription")}</div>
                </div>
            ))}
        </div>
    ) : (
        <p className="mt-6 text-sm text-muted-foreground">{t("assets.notAddedYet")}</p>
    );
}

export function stableTaskUrl(...values: Array<string | undefined>) {
    return values.find((value) => Boolean(value && !value.startsWith("data:") && !value.startsWith("blob:"))) || "";
}
