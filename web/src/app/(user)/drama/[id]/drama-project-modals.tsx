"use client";

import { Button, Empty, Input, Modal, Segmented, Spin } from "antd";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { buildSubtitleCues, formatTimelineTime } from "../subtitle";
import type { DramaProjectVersion, DramaShot } from "../types";

export function DramaVersionModal({ open, loading, versions, onClose, onSave, onRestore }: { open: boolean; loading: boolean; versions: DramaProjectVersion[]; onClose: () => void; onSave: () => void; onRestore: (version: DramaProjectVersion) => void }) {
    const t = useTranslations("drama.modals");
    return (
        <Modal title={t("version.title")} open={open} onCancel={onClose} footer={<Button onClick={onClose}>{t("close")}</Button>} width={640}>
            <div className="space-y-3 pt-3">
                <div className="flex flex-col items-stretch gap-2.5 border-b border-border pb-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span>{t("version.hint")}</span>
                    <Button icon={<Save className="size-4" />} onClick={onSave}>
                        {t("version.saveButton")}
                    </Button>
                </div>
                {loading ? (
                    <div className="grid min-h-24 place-items-center sm:min-h-40">
                        <Spin />
                    </div>
                ) : versions.length ? (
                    versions.map((version) => (
                        <div key={version.id} className="flex flex-col items-stretch gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
                            <div className="min-w-0">
                                <div className="font-medium">{t("version.versionLabel", { version: version.version })}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {version.reason} · {new Date(version.createdAt).toLocaleString()}
                                </div>
                            </div>
                            <Button className="!w-full sm:!w-auto" onClick={() => onRestore(version)}>
                                {t("version.restoreButton")}
                            </Button>
                        </div>
                    ))
                ) : (
                    <Empty className="!my-6 sm:!my-10" description={t("version.empty")} />
                )}
            </div>
        </Modal>
    );
}

export function DramaJianyingModal({
    open,
    path,
    version,
    exporting,
    onClose,
    onExport,
    onPathChange,
    onVersionChange,
}: {
    open: boolean;
    path: string;
    version: "5" | "6";
    exporting: boolean;
    onClose: () => void;
    onExport: () => void;
    onPathChange: (value: string) => void;
    onVersionChange: (value: "5" | "6") => void;
}) {
    const t = useTranslations("drama.modals");
    const tCommon = useTranslations("common");
    return (
        <Modal title={t("jianying.title")} open={open} onCancel={onClose} onOk={onExport} okText={t("jianying.exportButton")} cancelText={tCommon("cancel")} confirmLoading={exporting}>
            <div className="space-y-5 pt-3">
                <label className="block space-y-2">
                    <span className="text-sm font-medium">{t("jianying.pathLabel")}</span>
                    <Input value={path} onChange={(event) => onPathChange(event.target.value)} placeholder={t("jianying.pathPlaceholder")} />
                </label>
                <label className="block space-y-2">
                    <span className="text-sm font-medium">{t("jianying.versionLabel")}</span>
                    <Segmented
                        block
                        value={version}
                        options={[
                            { label: "6.0+", value: "6" },
                            { label: "5.x", value: "5" },
                        ]}
                        onChange={(value) => onVersionChange(value as "5" | "6")}
                    />
                </label>
            </div>
        </Modal>
    );
}

export function DramaSubtitleModal({ open, shots, onClose }: { open: boolean; shots: DramaShot[]; onClose: () => void }) {
    const t = useTranslations("drama.modals");
    return (
        <Modal title={t("subtitle.title")} open={open} footer={<Button onClick={onClose}>{t("close")}</Button>} onCancel={onClose} width={720}>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pt-3">
                {buildSubtitleCues(shots).map((cue) => (
                    <div key={cue.index} className="grid gap-2 rounded-lg border border-border/80 bg-background/65 p-3 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-3 sm:rounded-2xl sm:p-4">
                        <div className="text-xs font-medium text-muted-foreground">
                            {formatTimelineTime(cue.startMs)}–{formatTimelineTime(cue.endMs)}
                        </div>
                        <div className="text-sm leading-6 text-foreground">{cue.text}</div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}
