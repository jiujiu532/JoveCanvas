"use client";

import type { CSSProperties, ReactNode } from "react";
import { Modal, Tag, Timeline } from "antd";
import { useTranslations } from "next-intl";
import { useVersionCheck } from "@/hooks/use-version-check";
import { APP_VERSION } from "@/constant/env";

function getTagColor(type: string) {
    if (type === "新增") return "green";
    if (type === "修复") return "red";
    if (type === "优化") return "cyan";
    if (type === "调整") return "blue";
    if (type === "二开") return "gold";
    if (type === "致谢") return "volcano";
    if (type === "文档") return "purple";
    return "default";
}

function getReleaseTitle(version: string, unreleasedLabel: string) {
    return version === "Unreleased" ? unreleasedLabel : version;
}

type VersionReleaseModalProps = {
    className?: string;
    style?: CSSProperties;
    label?: ReactNode;
};

export function VersionReleaseModal({ className, style, label }: VersionReleaseModalProps) {
    const t = useTranslations("layout");
    const { open, setOpen, openReleaseModal, latestVersion, releases, checking, hasNewVersion, configured, checkLatestRelease } = useVersionCheck();

    return (
        <>
            <button
                type="button"
                className={className || "shrink-0 cursor-pointer text-xs font-medium text-stone-500 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-white"}
                style={style}
                onClick={openReleaseModal}
                title={t("versionModal.viewUpdates")}
            >
                {label || (
                    <span className="relative inline-flex">
                        {APP_VERSION}
                        {hasNewVersion ? <span className="absolute -right-1.5 -top-1 size-1.5 rounded-full bg-green-500" /> : null}
                    </span>
                )}
            </button>
            <Modal title={t("versionModal.title")} open={open} width={680} centered footer={null} onCancel={() => setOpen(false)}>
                <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                        <div className="text-xs text-stone-500 dark:text-stone-400">{t("versionModal.currentVersion")}</div>
                        <div className="mt-1 text-base font-semibold text-stone-950 dark:text-stone-100">{APP_VERSION}</div>
                    </div>
                    <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-stone-500 dark:text-stone-400">{t("versionModal.latestVersion")}</div>
                            <button
                                type="button"
                                disabled={!configured}
                                className="cursor-pointer bg-transparent p-0 text-[11px] font-normal text-stone-400 underline-offset-2 transition hover:text-stone-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:no-underline dark:text-stone-500 dark:hover:text-stone-300"
                                onClick={() => void checkLatestRelease(true)}
                            >
                                {configured ? (checking ? t("versionModal.checking") : t("versionModal.checkUpdate")) : t("versionModal.notConfigured")}
                            </button>
                        </div>
                        <div className="mt-1 text-base font-semibold text-stone-950 dark:text-stone-100">{configured ? latestVersion : t("versionModal.notConfiguredValue")}</div>
                    </div>
                </div>
                <div className="max-h-[56vh] overflow-y-auto pr-2">
                    <Timeline
                        items={releases.map((release) => ({
                            content: (
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-stone-950 dark:text-stone-100">{getReleaseTitle(release.version, t("versionModal.unreleased"))}</span>
                                        <span className="text-xs text-stone-500 dark:text-stone-400">{release.date}</span>
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            {release.version === latestVersion ? <Tag color="green">{t("versionModal.latestTag")}</Tag> : null}
                                            {release.version === APP_VERSION ? <Tag>{t("versionModal.currentTag")}</Tag> : null}
                                        </div>
                                    </div>
                                    <div className="mt-2 space-y-1.5">
                                        {release.items.map((item, index) => (
                                            <div key={`${release.version}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-stone-700 dark:text-stone-300">
                                                <Tag color={getTagColor(item.type)} className="m-0 mt-0.5 shrink-0 whitespace-nowrap">
                                                    {item.type}
                                                </Tag>
                                                <span className="min-w-0 flex-1">{item.content}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ),
                        }))}
                    />
                </div>
            </Modal>
        </>
    );
}
