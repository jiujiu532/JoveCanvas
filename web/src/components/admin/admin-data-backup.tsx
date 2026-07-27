"use client";

import { useRef, useState } from "react";
import { App, Button } from "antd";
import { saveAs } from "file-saver";
import { DatabaseBackup, Download, FileJson2, HardDrive, ShieldCheck, TriangleAlert, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Panel, PanelHeader } from "@/components/admin/admin-panel";
import { ADMIN_BACKUP_MAX_BYTES, downloadAdminBackup, importAdminBackup } from "@/services/api/admin-backup";

export function AdminDataBackup() {
    const t = useTranslations("admin");
    const { message, modal } = App.useApp();
    const inputRef = useRef<HTMLInputElement>(null);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [lastImported, setLastImported] = useState<string[]>([]);

    const sectionLabels: Record<string, string> = {
        auth: t("dataBackup.sectionAuth"),
        prompts: t("dataBackup.sectionPrompts"),
        generationLogs: t("dataBackup.sectionGenerationLogs"),
    };

    const exportBackup = async () => {
        setExporting(true);
        try {
            const backup = await downloadAdminBackup();
            saveAs(backup.blob, backup.fileName);
            message.success(t("dataBackup.exportSuccess"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("dataBackup.exportFailed"));
        } finally {
            setExporting(false);
        }
    };

    const selectBackup = (file?: File) => {
        if (inputRef.current) inputRef.current.value = "";
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".json")) {
            message.error(t("dataBackup.selectJson"));
            return;
        }
        if (file.size > ADMIN_BACKUP_MAX_BYTES) {
            message.error(t("dataBackup.fileTooLarge"));
            return;
        }
        modal.confirm({
            title: t("dataBackup.restoreTitle"),
            icon: <TriangleAlert className="size-5 text-amber-500" />,
            content: (
                <div className="space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    <p>{t("dataBackup.restoreContent1", { fileName: file.name })}</p>
                    <p>{t("dataBackup.restoreContent2")}</p>
                </div>
            ),
            okText: t("dataBackup.confirmRestore"),
            cancelText: t("common.cancel"),
            okButtonProps: { danger: true },
            onOk: async () => {
                setImporting(true);
                try {
                    const result = await importAdminBackup(file);
                    setLastImported(result.imported);
                    message.success(t("dataBackup.restoreSuccess"));
                } catch (error) {
                    message.error(error instanceof Error ? error.message : t("dataBackup.importFailed"));
                    throw error;
                } finally {
                    setImporting(false);
                }
            },
        });
    };

    return (
        <Panel>
            <PanelHeader
                title={t("nav.sections.backup.label")}
                description={t("nav.sections.backup.description")}
                actions={
                    <Button type="primary" icon={<Download className="size-4" />} loading={exporting} onClick={() => void exportBackup()}>
                        {t("dataBackup.export")}
                    </Button>
                }
            />
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                <section className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="flex min-w-0 gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            <FileJson2 className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{t("dataBackup.crossProviderTitle")}</h3>
                            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{t("dataBackup.crossProviderDesc")}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                        {t("dataBackup.redactedExport")}
                    </div>
                </section>

                <section className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="flex min-w-0 gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            <DatabaseBackup className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{t("dataBackup.restoreSectionTitle")}</h3>
                            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{t("dataBackup.restoreSectionDesc")}</p>
                            {lastImported.length ? <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">{t("dataBackup.lastRestored", { sections: lastImported.map((key) => sectionLabels[key] || key).join("、") })}</p> : null}
                        </div>
                    </div>
                    <Button icon={<Upload className="size-4" />} loading={importing} onClick={() => inputRef.current?.click()}>
                        {t("dataBackup.import")}
                    </Button>
                    <input ref={inputRef} className="hidden" type="file" accept="application/json,.json" onChange={(event) => selectBackup(event.target.files?.[0])} />
                </section>

                <section className="grid gap-4 bg-zinc-50/70 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center dark:bg-zinc-900/35">
                    <div className="flex min-w-0 gap-3">
                        <HardDrive className="mt-0.5 size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{t("dataBackup.fullBackupTitle")}</h3>
                            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{t("dataBackup.fullBackupDesc")}</p>
                        </div>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("dataBackup.fullBackupNote")}</span>
                </section>
            </div>
        </Panel>
    );
}
