import type { LogicalModelCapability, SystemDefaultModels, SystemModelChannel } from "@/lib/auth/store";
import type { ChannelHealthResult } from "@/components/admin/admin-system-channel-editor";
import { channelDetectedCapabilities, normalizeDefaultModelsConfig } from "@/lib/model-routing-config";
import { channelProtocolDefinition, channelProtocolOptions } from "@/lib/channel-protocol-registry";

export type ChannelWorkspaceSettings = {
    systemChannels: SystemModelChannel[];
    logicalModels: import("@/lib/auth/store").LogicalModel[];
    defaultModels: SystemDefaultModels;
};

export type ChannelWorkspaceStatus = "healthy" | "warning" | "untested" | "draft" | "disabled";

export type ChannelBindingDraft = {
    upstreamModel: string;
    logicalId: string;
    newLogicalId: string;
    newLogicalName: string;
};

export type CapabilityLabelMap = Partial<Record<LogicalModelCapability, string>>;
export type ChannelWorkspaceStatusLabelMap = Partial<Record<ChannelWorkspaceStatus, string>>;

const DEFAULT_CAPABILITY_LABELS: Record<LogicalModelCapability, string> = { text: "文本", image: "图片", video: "视频", audio: "音频" };
const DEFAULT_STATUS_LABELS: Record<ChannelWorkspaceStatus, string> = { healthy: "正常", warning: "需检查", untested: "待检测", draft: "草稿", disabled: "已停用" };

export function channelWorkspaceStatus(channel: SystemModelChannel, healthResults: Record<string, ChannelHealthResult>): ChannelWorkspaceStatus {
    if (!channel.enabled) return channel.baseUrl.trim() ? "disabled" : "draft";
    const results = channelHealthEntries(channel.id, healthResults, channel.healthResults).map((entry) => entry.result);
    if (!results.length) return "untested";
    return results.every((result) => result.ok) ? "healthy" : "warning";
}

export function channelWorkspaceStatusLabel(status: ChannelWorkspaceStatus, labels?: ChannelWorkspaceStatusLabelMap) {
    return labels?.[status] || DEFAULT_STATUS_LABELS[status];
}

export function channelWorkspaceStatusColor(status: ChannelWorkspaceStatus) {
    return { healthy: "success", warning: "warning", untested: "processing", draft: "default", disabled: "default" }[status];
}

export function channelCapabilityLabels(channel: SystemModelChannel, labels?: CapabilityLabelMap) {
    const map = { ...DEFAULT_CAPABILITY_LABELS, ...labels };
    return Array.from(channelDetectedCapabilities(channel)).map((capability) => map[capability]);
}

export function channelProtocolLabel(channel: SystemModelChannel, t?: (key: string) => string) {
    const protocol = channel.advancedConfig?.protocol || "auto";
    if (t) return t(`channelEditor.protocols.${protocol}.label`);
    return channelProtocolDefinition(protocol).label;
}

export function channelProtocolUiOptions(t: (key: string) => string) {
    return channelProtocolOptions().map((item) => ({
        ...item,
        label: t(`channelEditor.protocols.${item.value}.label`),
        description: t(`channelEditor.protocols.${item.value}.description`),
    }));
}

export function channelProtocolUiLabel(protocol: string, t: (key: string) => string) {
    return t(`channelEditor.protocols.${protocol}.label`);
}

export function channelProtocolUiDescription(protocol: string, t: (key: string) => string) {
    return t(`channelEditor.protocols.${protocol}.description`);
}

export function channelHealthEntries(channelId: string, healthResults: Record<string, ChannelHealthResult>, persistedResults?: SystemModelChannel["healthResults"]) {
    const entries = new Map(Object.entries(persistedResults || {}).map(([kind, result]) => [`${channelId}:${kind}`, result]));
    Object.entries(healthResults).forEach(([key, result]) => {
        if (key.startsWith(`${channelId}:`)) entries.set(key, result);
    });
    return Array.from(entries, ([key, result]) => ({ key, result }));
}

export function removeChannelFromWorkspace(settings: ChannelWorkspaceSettings, channelId: string): ChannelWorkspaceSettings {
    const systemChannels = settings.systemChannels.filter((channel) => channel.id !== channelId);
    const logicalModels = settings.logicalModels.map((model) => ({ ...model, bindings: model.bindings.filter((binding) => binding.channelId !== channelId) })).filter((model) => model.bindings.length);
    const liveIds = new Set(logicalModels.map((model) => model.id));
    return {
        systemChannels,
        logicalModels,
        defaultModels: Object.fromEntries(Object.entries(settings.defaultModels).map(([key, value]) => [key, liveIds.has(value) ? value : ""])) as SystemDefaultModels,
    };
}

export function updateChannelInWorkspace(settings: ChannelWorkspaceSettings, channelId: string, patch: Partial<SystemModelChannel>): ChannelWorkspaceSettings {
    const systemChannels = settings.systemChannels.map((channel) => (channel.id === channelId ? { ...channel, ...patch } : channel));
    return {
        ...settings,
        systemChannels,
        defaultModels: normalizeDefaultModelsConfig(settings.defaultModels, settings.logicalModels, systemChannels),
    };
}

export function defaultModelField(capability: LogicalModelCapability): keyof SystemDefaultModels {
    return capability === "text" ? "textModel" : capability === "image" ? "imageModel" : capability === "video" ? "videoModel" : "audioModel";
}

export function switchChannelBindingUpstream(upstreamModel = ""): ChannelBindingDraft {
    return { upstreamModel, logicalId: "", newLogicalId: "", newLogicalName: "" };
}

export function channelBindingCount(channelId: string, settings: ChannelWorkspaceSettings) {
    return settings.logicalModels.reduce((count, model) => count + model.bindings.filter((binding) => binding.channelId === channelId).length, 0);
}

export function channelSearchText(channel: SystemModelChannel) {
    return `${channel.name} ${channel.baseUrl} ${channelProtocolLabel(channel)} ${channel.models.join(" ")}`.toLowerCase();
}
