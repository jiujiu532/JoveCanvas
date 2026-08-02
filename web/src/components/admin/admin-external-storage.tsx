"use client";

import { App, Button, Checkbox, Form, Image, Input, Modal, Popconfirm, Select, Switch, Table, Tag, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { Cloud, DatabaseBackup, Download, Eye, File, FileAudio, Film, RefreshCw, Save, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { AdminMediaTypeTabs } from "@/components/admin/admin-media-type-tabs";
import { Panel, PanelHeader } from "@/components/admin/admin-panel";
import { AdminAccountId, AdminUserSearchSelect } from "@/components/admin/admin-user-identity";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { managedMediaTypeLabel, mediaSourceGroupOptions, mediaSourceLabel } from "@/lib/media-management-contract";
import type { ExternalStorageFile, ExternalStorageFilesPayload, ObjectStorageMigrationResult, ObjectStorageSettings, ObjectStorageSettingsUpdate } from "@/lib/object-storage-contract";
import { deleteExternalStorageFiles, getExternalStorageFiles, getObjectStorageSettings, migrateLocalMedia, saveObjectStorageSettings, testObjectStorageSettings } from "@/services/api/object-storage";

const PAGE_SIZE = 30;

export function AdminExternalStorage() {
    const t = useTranslations("admin");
    const { message } = App.useApp();
    const [form] = Form.useForm<ObjectStorageSettingsUpdate>();
    const enabled = Form.useWatch("enabled", form);
    const [settings, setSettings] = useState<ObjectStorageSettings>();
    const [files, setFiles] = useState<ExternalStorageFilesPayload>();
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<ObjectStorageMigrationResult>();
    const [deleting, setDeleting] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [preview, setPreview] = useState<ExternalStorageFile>();
    const [prefix, setPrefix] = useState("");
    const [prefixInput, setPrefixInput] = useState("");
    const [type, setType] = useState("");
    const [source, setSource] = useState("");
    const [ownerUserId, setOwnerUserId] = useState("");
    const [cursor, setCursor] = useState("");
    const [cursorHistory, setCursorHistory] = useState<string[]>([]);

    const loadFiles = useCallback(
        async (targetCursor: string, targetPrefix: string, targetType: string, targetSource: string, targetOwnerUserId: string) => {
            setLoadingFiles(true);
            try {
                setFiles(await getExternalStorageFiles({ prefix: targetPrefix, cursor: targetCursor, limit: PAGE_SIZE, type: targetType, source: targetSource, ownerUserId: targetOwnerUserId }));
                setSelectedKeys([]);
            } catch (error) {
                message.error(error instanceof Error ? error.message : t("externalStorage.loadFilesFailed"));
            } finally {
                setLoadingFiles(false);
            }
        },
        [message, t],
    );

    useEffect(() => {
        let active = true;
        void getObjectStorageSettings()
            .then((value) => {
                if (!active) return;
                setSettings(value);
                form.setFieldsValue({
                    enabled: value.enabled,
                    endpoint: value.endpoint,
                    region: value.region,
                    bucket: value.bucket,
                    prefix: value.prefix,
                    forcePathStyle: value.forcePathStyle,
                    accessKeyId: "",
                    secretAccessKey: "",
                });
            })
            .catch((error) => message.error(error instanceof Error ? error.message : t("externalStorage.loadSettingsFailed")))
            .finally(() => active && setLoadingSettings(false));
        return () => {
            active = false;
        };
    }, [form, message]);

    useEffect(() => {
        if (settings?.bucket) void loadFiles(cursor, prefix, type, source, ownerUserId);
        else setFiles(undefined);
    }, [cursor, loadFiles, ownerUserId, prefix, settings?.bucket, settings?.updatedAt, source, type]);

    const save = async (values: ObjectStorageSettingsUpdate) => {
        setSaving(true);
        try {
            const next = await saveObjectStorageSettings(values);
            setSettings(next);
            form.setFieldsValue({ accessKeyId: "", secretAccessKey: "" });
            message.success(t("externalStorage.saveSuccess"));
            setCursor("");
            setCursorHistory([]);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("externalStorage.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const testConnection = async () => {
        setTesting(true);
        try {
            await testObjectStorageSettings();
            message.success(t("externalStorage.testSuccess"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("externalStorage.testFailed"));
        } finally {
            setTesting(false);
        }
    };

    const migrate = async () => {
        setSyncing(true);
        const total: ObjectStorageMigrationResult = { migrated: 0, skipped: 0, failed: 0, remaining: 0, errors: [] };
        try {
            for (let batch = 0; batch < 200; batch += 1) {
                const result = await migrateLocalMedia(PAGE_SIZE);
                total.migrated += result.migrated;
                total.skipped = Math.max(total.skipped, result.skipped);
                total.failed += result.failed;
                total.remaining = result.remaining;
                total.errors.push(...result.errors.slice(0, 5));
                setSyncResult({ ...total, errors: [...total.errors] });
                if (!result.remaining || !result.migrated) break;
            }
            if (total.failed) message.warning(t("externalStorage.migratePartial", { migrated: total.migrated, failed: total.failed }));
            else message.success(t("externalStorage.migrateSuccess", { migrated: total.migrated }));
            if (cursor) {
                setCursor("");
                setCursorHistory([]);
            } else {
                await loadFiles("", prefix, type, source, ownerUserId);
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("externalStorage.migrateFailed"));
        } finally {
            setSyncing(false);
        }
    };

    const remove = useCallback(
        async (keys: string[]) => {
            setDeleting(true);
            try {
                const result = await deleteExternalStorageFiles(keys);
                if (result.blocked.length) message.warning(t("externalStorage.deleteBlocked", { count: result.blocked.length }));
                else message.success(t("externalStorage.deleteSuccess", { count: result.deleted }));
                await loadFiles(cursor, prefix, type, source, ownerUserId);
            } catch (error) {
                message.error(error instanceof Error ? error.message : t("externalStorage.deleteFailed"));
            } finally {
                setDeleting(false);
            }
        },
        [cursor, loadFiles, message, ownerUserId, prefix, source, type],
    );

    const columns = useMemo<TableColumnsType<ExternalStorageFile>>(
        () => [
            {
                title: t("externalStorage.table.object"),
                render: (_, file) => (
                    <div className="flex min-w-0 items-center gap-3">
                        <MediaThumbnail file={file} onPreview={setPreview} />
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={file.originalName || file.name}>
                                {file.originalName || file.name}
                            </div>
                            <div className="mt-1 truncate text-xs text-zinc-500">
                                {managedMediaTypeLabel(file.type)} · {file.key}
                            </div>
                        </div>
                    </div>
                ),
            },
            { title: t("externalStorage.table.size"), width: 110, render: (_, file) => formatBytes(file.bytes) },
            {
                title: t("externalStorage.table.registry"),
                width: 150,
                render: (_, file) => (
                    <div className="space-y-1 text-xs">
                        <Tag color={file.storageKey ? "green" : "default"}>{file.storageKey ? t("externalStorage.table.businessMedia") : file.variant ? t("externalStorage.table.previewVariant") : t("externalStorage.table.standalone")}</Tag>
                        {file.referenceCount ? <div className="text-zinc-500">{t("externalStorage.table.references", { count: file.referenceCount })}</div> : null}
                    </div>
                ),
            },
            {
                title: t("externalStorage.table.userSource"),
                width: 180,
                render: (_, file) => (
                    <div className="text-xs text-zinc-500">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="truncate text-zinc-800 dark:text-zinc-200">{file.ownerDisplayName || file.ownerUsername || (file.ownerUserId ? t("externalStorage.userUnavailable") : t("externalStorage.table.unregistered"))}</span>
                            <AdminAccountId accountId={file.ownerAccountId} className="shrink-0" />
                        </div>
                        <div className="mt-1 truncate">{mediaSourceLabel(file.source)}</div>
                    </div>
                ),
            },
            { title: t("externalStorage.table.updatedAt"), width: 180, render: (_, file) => formatTime(file.lastModified) },
            {
                title: t("externalStorage.table.actions"),
                width: 128,
                align: "right",
                render: (_, file) => (
                    <div className="flex justify-end gap-1">
                        <Button type="text" shape="circle" aria-label={t("externalStorage.previewAria")} icon={<Eye className="size-4" />} onClick={() => setPreview(file)} />
                        <Button type="text" shape="circle" aria-label={t("externalStorage.downloadAria")} icon={<Download className="size-4" />} href={file.downloadUrl} target="_blank" />
                        <Popconfirm title={t("externalStorage.deleteTitle")} description={t("externalStorage.deleteDesc")} okText={t("externalStorage.delete")} cancelText={t("externalStorage.cancel")} onConfirm={() => void remove([file.key])}>
                            <Button danger type="text" shape="circle" aria-label={t("externalStorage.deleteAria")} icon={<Trash2 className="size-4" />} />
                        </Popconfirm>
                    </div>
                ),
            },
        ],
        [remove, t],
    );

    const applyPrefixFilter = (value: string) => {
        const next = value.trim();
        const unchanged = next === prefix && !cursor;
        setPrefix(next);
        setCursor("");
        setCursorHistory([]);
        if (unchanged) void loadFiles("", next, type, source, ownerUserId);
    };

    return (
        <div className="grid gap-4 sm:gap-6">
            <Panel>
                <PanelHeader
                    title={t("externalStorage.configTitle")}
                    description={t("externalStorage.configDesc")}
                    actions={
                        <>
                            <Tooltip title={t("externalStorage.testConnection")}>
                                <Button aria-label={t("externalStorage.testConnectionAria")} className="!w-8 !px-0 sm:!w-auto sm:!px-3" icon={<ShieldCheck className="size-4" />} loading={testing} disabled={!settings?.bucket} onClick={() => void testConnection()}>
                                    <span className="hidden sm:inline">{t("externalStorage.testConnection")}</span>
                                </Button>
                            </Tooltip>
                            <Tooltip title={t("externalStorage.saveConfig")}>
                                <Button type="primary" aria-label={t("externalStorage.saveConfigAria")} className="!w-8 !px-0 sm:!w-auto sm:!px-3" icon={<Save className="size-4" />} loading={saving} onClick={() => form.submit()}>
                                    <span className="hidden sm:inline">{t("externalStorage.save")}</span>
                                </Button>
                            </Tooltip>
                        </>
                    }
                />
                <Form<ObjectStorageSettingsUpdate> form={form} layout="vertical" requiredMark={false} disabled={loadingSettings} onFinish={save}>
                    <div className="px-4 py-5 sm:px-5 sm:py-6">
                        <div className="max-w-[1080px]">
                            <div className="mb-5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                                <Cloud className={enabled ? "size-4 text-emerald-600 dark:text-emerald-400" : "size-4 text-zinc-400"} />
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("externalStorage.writeLocation")}</span>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{enabled ? t("externalStorage.external") : t("externalStorage.local")}</span>
                                <Form.Item name="enabled" valuePropName="checked" className="!mb-0">
                                    <Switch size="small" aria-label={t("externalStorage.toggleAria")} />
                                </Form.Item>
                                <span className="text-xs text-zinc-400 dark:text-zinc-500">{t("externalStorage.newFilesOnly")}</span>
                            </div>

                            <div className="grid gap-x-4 md:grid-cols-2 xl:grid-cols-6">
                                <Form.Item label="Endpoint" name="endpoint" className="!mb-5 xl:col-span-2" extra={t("externalStorage.endpointExtra")}>
                                    <Input placeholder="https://s3.example.com" />
                                </Form.Item>
                                <Form.Item label="Region" name="region" className="!mb-5 xl:col-span-2" rules={[{ required: true, message: t("externalStorage.regionRequired") }]}>
                                    <Input placeholder="us-east-1 / auto" />
                                </Form.Item>
                                <Form.Item label="Bucket" name="bucket" className="!mb-5 xl:col-span-2" rules={[{ required: enabled, message: t("externalStorage.bucketRequired") }]}>
                                    <Input placeholder="media-bucket" />
                                </Form.Item>
                                <Form.Item label={t("externalStorage.prefix")} name="prefix" className="!mb-5 xl:col-span-3" rules={[{ required: true, message: t("externalStorage.prefixRequired") }]}>
                                    <Input placeholder="vozeb-pro" />
                                </Form.Item>
                                <Form.Item label={t("externalStorage.pathStyle")} name="forcePathStyle" valuePropName="checked" className="!mb-5 xl:col-span-3">
                                    <Switch size="small" aria-label={t("externalStorage.pathStyleAria")} />
                                </Form.Item>
                                <Form.Item label="Access Key" name="accessKeyId" className="!mb-0 xl:col-span-3" extra={settings?.hasAccessKeyId ? t("externalStorage.secretSaved") : undefined}>
                                    <Input.Password autoComplete="new-password" placeholder={settings?.hasAccessKeyId ? t("externalStorage.configured") : "Access Key ID"} />
                                </Form.Item>
                                <Form.Item label="Secret Key" name="secretAccessKey" className="!mb-0 xl:col-span-3" extra={settings?.hasSecretAccessKey ? t("externalStorage.secretSaved") : undefined}>
                                    <Input.Password autoComplete="new-password" placeholder={settings?.hasSecretAccessKey ? t("externalStorage.configured") : "Secret Access Key"} />
                                </Form.Item>
                            </div>
                        </div>
                    </div>
                </Form>
            </Panel>

            <Panel>
                <PanelHeader
                    title={t("externalStorage.filesTitle")}
                    description={files ? `${files.bucket} / ${files.prefix}` : t("externalStorage.filesDescEmpty")}
                    actions={
                        <>
                            <Popconfirm title={t("externalStorage.migrateTitle")} description={t("externalStorage.migrateDesc")} okText={t("externalStorage.migrateStart")} cancelText={t("externalStorage.cancel")} onConfirm={() => void migrate()}>
                                <Tooltip title={t("externalStorage.migrateLocal")}>
                                    <Button aria-label={t("externalStorage.migrateLocalAria")} className="!w-8 !px-0 sm:!w-auto sm:!px-3" icon={<DatabaseBackup className="size-4" />} loading={syncing} disabled={!settings?.enabled}>
                                        <span className="hidden sm:inline">{t("externalStorage.migrateLocal")}</span>
                                    </Button>
                                </Tooltip>
                            </Popconfirm>
                            <Tooltip title={t("externalStorage.refresh")}>
                                <Button
                                    aria-label={t("externalStorage.refreshAria")}
                                    className="!w-8 !px-0 sm:!w-auto sm:!px-3"
                                    icon={<RefreshCw className="size-4" />}
                                    loading={loadingFiles}
                                    disabled={!settings?.bucket}
                                    onClick={() => void loadFiles(cursor, prefix, type, source, ownerUserId)}
                                >
                                    <span className="hidden sm:inline">{t("externalStorage.refresh")}</span>
                                </Button>
                            </Tooltip>
                            <Popconfirm title={t("externalStorage.bulkDeleteTitle", { count: selectedKeys.length })} description={t("externalStorage.bulkDeleteDesc")} okText={t("externalStorage.bulkDelete")} cancelText={t("externalStorage.cancel")} onConfirm={() => void remove(selectedKeys)}>
                                <Tooltip title={t("externalStorage.bulkDeleteTooltip")}>
                                    <Button danger aria-label={t("externalStorage.bulkDeleteAria")} className="!w-8 !px-0 sm:!w-auto sm:!px-3" icon={<Trash2 className="size-4" />} disabled={!selectedKeys.length} loading={deleting}>
                                        <span className="hidden sm:inline">{t("externalStorage.bulkDelete")}</span>
                                    </Button>
                                </Tooltip>
                            </Popconfirm>
                        </>
                    }
                />
                <div className="p-4 sm:p-5">
                    {syncResult ? (
                        <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-md border border-zinc-200 text-center sm:grid-cols-4 dark:border-zinc-800">
                            <StatusMetric label={t("externalStorage.migrated")} value={syncResult.migrated} />
                            <StatusMetric label={t("externalStorage.failed")} value={syncResult.failed} />
                            <StatusMetric label={t("externalStorage.skipped")} value={syncResult.skipped} />
                            <StatusMetric label={t("externalStorage.remaining")} value={syncResult.remaining} />
                        </div>
                    ) : null}
                    <div>
                        <AdminMediaTypeTabs
                            value={type}
                            disabled={!settings?.bucket}
                            onChange={(value) => {
                                setCursor("");
                                setCursorHistory([]);
                                setType(value);
                            }}
                        />
                        <div className="grid max-w-[1180px] grid-cols-[minmax(0,1fr)_40px] gap-3 xl:grid-cols-[minmax(260px,1fr)_40px_190px_220px]">
                            <Input
                                value={prefixInput}
                                allowClear
                                placeholder={t("externalStorage.filterPrefixPlaceholder")}
                                disabled={!settings?.bucket}
                                onChange={(event) => {
                                    const next = event.target.value;
                                    setPrefixInput(next);
                                    if (!next && prefix) applyPrefixFilter("");
                                }}
                                onPressEnter={(event) => applyPrefixFilter(event.currentTarget.value)}
                            />
                            <Tooltip title={t("externalStorage.filter")}>
                                <Button aria-label={t("externalStorage.filterAria")} className="!w-10 !px-0" icon={<Search className="size-4" />} disabled={!settings?.bucket} onClick={() => applyPrefixFilter(prefixInput)} />
                            </Tooltip>
                            <div className="col-span-2 min-w-0 xl:col-span-1">
                                <Select
                                    className="w-full"
                                    value={source}
                                    disabled={!settings?.bucket}
                                    options={mediaSourceGroupOptions.map((option) => ({ ...option }))}
                                    onChange={(value) => {
                                        setCursor("");
                                        setCursorHistory([]);
                                        setSource(value);
                                    }}
                                />
                            </div>
                            <div className="col-span-2 min-w-0 xl:col-span-1">
                                <AdminUserSearchSelect
                                    value={ownerUserId || undefined}
                                    placeholder={t("externalStorage.filterUserPlaceholder")}
                                    onChange={(value) => {
                                        setCursor("");
                                        setCursorHistory([]);
                                        setOwnerUserId(value || "");
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 hidden overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 md:block">
                        <Table
                            rowKey="key"
                            size="middle"
                            loading={loadingFiles}
                            columns={columns}
                            dataSource={files?.items || []}
                            pagination={false}
                            rowSelection={{ selectedRowKeys: selectedKeys, onChange: (keys) => setSelectedKeys(keys.map(String)) }}
                        />
                    </div>
                    <div className="mt-4 space-y-2 md:hidden">
                        <Checkbox
                            checked={Boolean(files?.items.length) && files!.items.every((file) => selectedKeys.includes(file.key))}
                            indeterminate={Boolean(files?.items.some((file) => selectedKeys.includes(file.key))) && !files?.items.every((file) => selectedKeys.includes(file.key))}
                            onChange={(event) => setSelectedKeys(event.target.checked ? (files?.items || []).map((file) => file.key) : [])}
                        >
                            {t("externalStorage.selectPage")}
                        </Checkbox>
                        {(files?.items || []).map((file) => (
                            <div key={file.key} className="flex min-w-0 items-center gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                                <Checkbox
                                    checked={selectedKeys.includes(file.key)}
                                    aria-label={t("externalStorage.selectObjectAria")}
                                    onChange={(event) => setSelectedKeys((current) => (event.target.checked ? [...current, file.key] : current.filter((key) => key !== file.key)))}
                                />
                                <MediaThumbnail file={file} onPreview={setPreview} />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">{file.originalName || file.name}</div>
                                    <div className="mt-1 text-xs text-zinc-500">
                                        {managedMediaTypeLabel(file.type)} · {formatBytes(file.bytes)} · {file.storageKey ? t("externalStorage.table.references", { count: file.referenceCount }) : file.variant ? t("externalStorage.table.previewVariant") : t("externalStorage.table.standalone")}
                                    </div>
                                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                                        <span className="truncate">{file.ownerDisplayName || file.ownerUsername || (file.ownerUserId ? t("externalStorage.userUnavailable") : t("externalStorage.table.unregistered"))}</span>
                                        <AdminAccountId accountId={file.ownerAccountId} className="shrink-0" />
                                        <span className="truncate">{mediaSourceLabel(file.source)}</span>
                                    </div>
                                    <div className="mt-1 truncate font-mono text-[11px] text-zinc-500">{file.key}</div>
                                </div>
                                <div className="flex shrink-0 flex-col gap-0.5">
                                    <Button type="text" shape="circle" aria-label={t("externalStorage.downloadAria")} icon={<Download className="size-4" />} href={file.downloadUrl} target="_blank" />
                                    <Popconfirm title={t("externalStorage.deleteTitle")} description={t("externalStorage.deleteDesc")} okText={t("externalStorage.delete")} cancelText={t("externalStorage.cancel")} onConfirm={() => void remove([file.key])}>
                                        <Button danger type="text" shape="circle" aria-label={t("externalStorage.deleteAria")} icon={<Trash2 className="size-4" />} />
                                    </Popconfirm>
                                </div>
                            </div>
                        ))}
                        {!loadingFiles && !files?.items.length ? <div className="py-10 text-center text-sm text-zinc-500">{t("externalStorage.empty")}</div> : null}
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                        <Button
                            disabled={!cursorHistory.length || loadingFiles}
                            onClick={() => {
                                const previous = cursorHistory.at(-1) || "";
                                setCursorHistory((history) => history.slice(0, -1));
                                setCursor(previous);
                            }}
                        >
                            {t("externalStorage.prevPage")}
                        </Button>
                        <Button
                            disabled={!files?.nextCursor || loadingFiles}
                            onClick={() => {
                                const next = files?.nextCursor || "";
                                setCursorHistory((current) => [...current, cursor]);
                                setCursor(next);
                            }}
                        >
                            {t("externalStorage.nextPage")}
                        </Button>
                    </div>
                </div>
            </Panel>

            <Modal
                title={preview?.originalName || preview?.name || t("externalStorage.previewTitle")}
                open={Boolean(preview)}
                footer={
                    preview ? (
                        <Button icon={<Download className="size-4" />} href={preview.downloadUrl} target="_blank">
                            {t("externalStorage.downloadOriginal")}
                        </Button>
                    ) : null
                }
                width={860}
                centered
                destroyOnHidden
                onCancel={() => setPreview(undefined)}
            >
                {preview ? <MediaViewer file={preview} /> : null}
            </Modal>
        </div>
    );
}

function MediaThumbnail({ file, onPreview }: { file: ExternalStorageFile; onPreview: (file: ExternalStorageFile) => void }) {
    const t = useTranslations("admin");
    return (
        <button
            type="button"
            className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:text-white"
            aria-label={t("externalStorage.previewObjectAria")}
            onClick={() => onPreview(file)}
        >
            {file.type === "image" ? (
                <Image preview={false} src={imagePreviewUrl(file.previewUrl, 256)} alt="" width={48} height={48} className="size-12 object-cover" />
            ) : file.type === "video" ? (
                <Film className="size-5" />
            ) : file.type === "audio" ? (
                <FileAudio className="size-5" />
            ) : (
                <File className="size-5" />
            )}
        </button>
    );
}

function MediaViewer({ file }: { file: ExternalStorageFile }) {
    const t = useTranslations("admin");
    if (file.type === "image") return <Image src={imagePreviewUrl(file.previewUrl, 1920)} alt={file.originalName || file.name} className="max-h-[70dvh] w-full object-contain" />;
    if (file.type === "video") return <video src={file.previewUrl} controls className="max-h-[70dvh] w-full rounded-md bg-black" />;
    if (file.type === "audio") return <audio src={file.previewUrl} controls className="w-full" />;
    return <div className="py-12 text-center text-sm text-zinc-500">{t("externalStorage.previewUnsupported")}</div>;
}

function StatusMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className="border-zinc-200 p-3 odd:border-r nth-[-n+2]:border-b sm:nth-[-n+2]:border-b-0 sm:[&:not(:last-child)]:border-r dark:border-zinc-800">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</div>
        </div>
    );
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatTime(value?: string) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString("zh-CN", { hour12: false }) : "-";
}
