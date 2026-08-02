"use client";

import { useMemo, useState } from "react";
import { App, Button, Checkbox, Input, Select, Tag } from "antd";
import { FileSearch, WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { LabeledControl } from "@/components/admin/admin-settings-controls";
import { applyChannelProtocol, channelProtocolDefinition, channelProtocolOptions } from "@/lib/channel-protocol-registry";
import type { ChannelProtocolDraft } from "@/lib/channel-protocol-draft";
import type { LogicalModelCapability, SystemChannelAdvancedConfig, SystemChannelAuthMode, SystemChannelProtocol, SystemModelChannel } from "@/lib/auth/store";
import { normalizeModelId } from "@/lib/model-capability";
import { createAdminChannelProtocolDraft } from "@/services/api/admin-channel-protocol";
import { channelDetectedCapabilities } from "@/lib/model-routing-config";

export function AdminChannelProtocolSetup({ channel, protocolLocked = false, onChange }: { channel: SystemModelChannel; protocolLocked?: boolean; onChange: (patch: Partial<SystemModelChannel>) => void }) {
    const t = useTranslations("admin");
    const { message } = App.useApp();
    const protocol = channel.advancedConfig?.protocol || "auto";
    const definition = channelProtocolDefinition(protocol);
    const detectedCapabilities = channelDetectedCapabilities(channel);
    const [documentationUrl, setDocumentationUrl] = useState(channel.advancedConfig?.documentationUrl || "");
    const [documentationText, setDocumentationText] = useState("");
    const [examples, setExamples] = useState("");
    const [useTextModel, setUseTextModel] = useState(true);
    const [loading, setLoading] = useState(false);
    const [draft, setDraft] = useState<ChannelProtocolDraft | null>(null);

    const capabilityOptions = useMemo(
        () =>
            (["text", "image", "video", "audio"] as LogicalModelCapability[]).map((value) => ({
                label: t(`channelEditor.kinds.${value}` as never),
                value,
            })),
        [t],
    );
    const authModeOptions = useMemo(
        () =>
            [
                { label: t("protocolSetup.auth.none"), value: "none" as const },
                { label: "Bearer Token", value: "bearer" as const },
                { label: "X-API-Key", value: "x-api-key" as const },
                { label: t("protocolSetup.auth.customHeader"), value: "custom-header" as const },
            ] satisfies Array<{ label: string; value: SystemChannelAuthMode }>,
        [t],
    );

    const selectProtocol = (value: SystemChannelProtocol) => {
        setDraft(null);
        onChange(applyChannelProtocol(channel, value));
    };
    const analyze = async () => {
        setLoading(true);
        try {
            const next = await createAdminChannelProtocolDraft({ documentationUrl, documentationText, examples, useTextModel });
            setDraft(next);
            message.success(next.assisted ? t("protocolSetup.analyzeAssisted") : t("protocolSetup.analyzeExtracted"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("protocolSetup.analyzeFailed"));
        } finally {
            setLoading(false);
        }
    };
    const applyDraft = () => {
        if (!draft) return;
        const advanced = channel.advancedConfig || applyChannelProtocol(channel, "custom").advancedConfig!;
        const modelCapabilities = { ...(advanced.modelCapabilities || {}) };
        const modelConfigs = { ...(advanced.modelConfigs || {}) };
        const operationConfigs = { ...(advanced.operationConfigs || {}) };
        const discoveredModels: string[] = [];
        draft.operations.forEach((operation) => {
            operationConfigs[operation.capability] = operation.config;
            operation.models.forEach((model) => {
                const key = normalizeModelId(model);
                if (!key) return;
                discoveredModels.push(model);
                modelCapabilities[key] = operation.capability;
                modelConfigs[key] = operation.config;
            });
        });
        const nextAdvanced: SystemChannelAdvancedConfig = {
            ...advanced,
            protocol: "custom",
            authMode: draft.authMode,
            authHeader: draft.authHeader,
            authPrefix: draft.authPrefix,
            documentationUrl: draft.documentationUrl || documentationUrl,
            modelCatalogPaths: Array.from(new Set([...(advanced.modelCatalogPaths || []), ...draft.modelCatalogPaths])),
            modelCapabilities,
            modelConfigs,
            operationConfigs,
        };
        onChange({
            baseUrl: draft.baseUrl || channel.baseUrl,
            apiFormat: draft.apiFormat,
            models: Array.from(new Set([...channel.models, ...discoveredModels])),
            advancedConfig: nextAdvanced,
        });
        message.success(t("protocolSetup.applied"));
    };
    const updateAuth = (patch: Partial<SystemChannelAdvancedConfig>) => onChange({ advancedConfig: { ...channel.advancedConfig!, ...patch } });

    return (
        <section className="mt-3 border-y border-stone-200 bg-stone-50/70 px-3 py-3 dark:border-stone-800 dark:bg-stone-900/35">
            {!protocolLocked ? (
                <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)] lg:items-end">
                    <LabeledControl label={t("channelEditor.protocol")}>
                        <Select
                            className="w-full"
                            value={protocol}
                            optionLabelProp="label"
                            options={channelProtocolOptions().map((item) => ({
                                value: item.value,
                                label: item.label,
                                title: item.description,
                            }))}
                            optionRender={(option) => (
                                <div className="py-1">
                                    <div className="font-medium text-stone-900 dark:text-stone-100">{option.data.label}</div>
                                    <div className="mt-0.5 whitespace-normal text-xs leading-5 text-stone-500 dark:text-stone-400">{option.data.title}</div>
                                </div>
                            )}
                            onChange={selectProtocol}
                        />
                    </LabeledControl>
                    <div className="min-w-0 pb-0.5 text-xs leading-5 text-stone-500 dark:text-stone-400">
                        <div>
                            {t("protocolSetup.protocolLine", { label: definition.label })}
                            {detectedCapabilities.size
                                ? t("protocolSetup.detectedCapabilities", {
                                      labels: Array.from(detectedCapabilities)
                                          .map((item) => capabilityOptions.find((option) => option.value === item)?.label)
                                          .join("、"),
                                  })
                                : t("protocolSetup.needModels")}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {definition.capabilities
                                .filter((item) => detectedCapabilities.has(item))
                                .map((item) => (
                                    <Tag key={item} className="m-0">
                                        {capabilityOptions.find((option) => option.value === item)?.label}
                                    </Tag>
                                ))}
                            {!detectedCapabilities.size ? <Tag className="m-0">{t("protocolSetup.awaitModels")}</Tag> : null}
                            {definition.strict ? <Tag className="m-0">{t("protocolSetup.strictPath")}</Tag> : null}
                            {definition.builtInModels?.length ? <Tag className="m-0">{t("protocolSetup.builtInModels", { count: definition.builtInModels.length })}</Tag> : null}
                        </div>
                    </div>
                </div>
            ) : null}
            {protocol === "custom" ? (
                <div className={protocolLocked ? "" : "mt-3 border-t border-stone-200 pt-3 dark:border-stone-800"}>
                    {!protocolLocked ? (
                        <div className="mb-3 grid gap-3 sm:grid-cols-2">
                            <LabeledControl label={t("protocolSetup.authMode")}>
                                <Select
                                    className="w-full"
                                    value={channel.advancedConfig?.authMode || "bearer"}
                                    options={authModeOptions}
                                    onChange={(value: SystemChannelAuthMode) => updateAuth({ authMode: value, ...(value !== "custom-header" ? { authHeader: "", authPrefix: "" } : {}) })}
                                />
                            </LabeledControl>
                            {channel.advancedConfig?.authMode === "custom-header" ? (
                                <>
                                    <LabeledControl label={t("protocolSetup.authHeader")}>
                                        <Input value={channel.advancedConfig.authHeader} placeholder={t("protocolSetup.authHeaderPlaceholder")} onChange={(event) => updateAuth({ authHeader: event.target.value })} />
                                    </LabeledControl>
                                    <LabeledControl label={t("protocolSetup.authPrefix")}>
                                        <Input value={channel.advancedConfig.authPrefix} placeholder={t("protocolSetup.authPrefixPlaceholder")} onChange={(event) => updateAuth({ authPrefix: event.target.value })} />
                                    </LabeledControl>
                                </>
                            ) : null}
                        </div>
                    ) : null}
                    <div className="flex items-start gap-2">
                        <FileSearch className="mt-0.5 size-4 shrink-0 text-stone-500 dark:text-stone-400" />
                        <div>
                            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">{t("protocolSetup.assistantTitle")}</div>
                            <div className="mt-0.5 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("protocolSetup.assistantDesc")}</div>
                        </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <LabeledControl label={t("protocolSetup.docUrl")}>
                                <Input value={documentationUrl} placeholder="https://provider.example.com/docs/api" onChange={(event) => setDocumentationUrl(event.target.value)} />
                            </LabeledControl>
                        </div>
                        <div className="sm:col-span-2">
                            <LabeledControl label={t("protocolSetup.docText")}>
                                <Input.TextArea rows={4} value={documentationText} placeholder={t("protocolSetup.docTextPlaceholder")} onChange={(event) => setDocumentationText(event.target.value)} />
                            </LabeledControl>
                        </div>
                        <div className="sm:col-span-2">
                            <LabeledControl label={t("protocolSetup.examples")}>
                                <Input.TextArea rows={6} value={examples} placeholder={t("protocolSetup.examplesPlaceholder")} onChange={(event) => setExamples(event.target.value)} />
                            </LabeledControl>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <Checkbox checked={useTextModel} onChange={(event) => setUseTextModel(event.target.checked)}>
                            {t("protocolSetup.useTextModel")}
                        </Checkbox>
                        <Button type="primary" icon={<WandSparkles className="size-4" />} loading={loading} onClick={() => void analyze()}>
                            {t("protocolSetup.analyzeAll")}
                        </Button>
                    </div>
                    {draft ? (
                        <div className="mt-3 border-l-2 border-stone-400 pl-3 text-xs leading-5 text-stone-600 dark:border-stone-600 dark:text-stone-300">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="mr-1 font-semibold text-stone-900 dark:text-stone-100">{t("protocolSetup.resultTitle")}</span>
                                <Tag className="m-0">{t("protocolSetup.catalogCount", { count: draft.modelCatalogPaths.length })}</Tag>
                                <Tag className="m-0">{t("protocolSetup.capabilityCount", { count: draft.operations.length })}</Tag>
                                <Tag className="m-0">{t("protocolSetup.modelCount", { count: new Set(draft.operations.flatMap((item) => item.models.map(normalizeModelId))).size })}</Tag>
                            </div>
                            {draft.modelCatalogPaths.length ? <div className="mt-2 break-all">{t("protocolSetup.catalogPaths", { paths: draft.modelCatalogPaths.join("、") })}</div> : null}
                            <div className="mt-2 divide-y divide-stone-200 border-y border-stone-200 dark:divide-stone-800 dark:border-stone-800">
                                {draft.operations.map((operation) => (
                                    <div key={operation.capability} className="py-2">
                                        <div className="font-medium text-stone-900 dark:text-stone-100">
                                            {capabilityOptions.find((item) => item.value === operation.capability)?.label} ·{" "}
                                            {operation.models.length ? t("protocolSetup.recognizedModels", { count: operation.models.length }) : t("protocolSetup.autoMatchModels")}
                                        </div>
                                        <div className="mt-0.5 break-all">
                                            {t("protocolSetup.create")} {operation.config.createPath}
                                            {operation.config.editPath ? ` · ${t("protocolSetup.edit")} ${operation.config.editPath}` : ""}
                                            {operation.config.imageToVideoPath ? ` · ${t("protocolSetup.imageToVideo")} ${operation.config.imageToVideoPath}` : ""}
                                            {operation.config.queryPath ? ` · ${t("protocolSetup.query")} ${operation.config.queryPath}` : ""}
                                            {operation.config.cancelPath ? ` · ${t("protocolSetup.cancel")} ${operation.config.cancelMethod || "POST"} ${operation.config.cancelPath}` : ""}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Button className="mt-2" type="primary" size="small" onClick={applyDraft}>
                                {t("protocolSetup.applyAll")}
                            </Button>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
