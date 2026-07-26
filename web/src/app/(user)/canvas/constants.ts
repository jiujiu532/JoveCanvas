import { CanvasNodeType } from "./types";
import type { CanvasNodeMetadata } from "./types";
import { PANORAMA_NODE_SIZE } from "./utils/canvas-panorama";
import type { CanvasTranslate } from "./[id]/canvas-page-utils";

type CanvasNodeSpec = {
    width: number;
    height: number;
    title: string;
    metadata?: CanvasNodeMetadata;
};

// title 为内部兜底值，实际展示文案由 getNodeSpec 传入的翻译函数覆盖（见 node.type.* 字典）
export const NODE_DEFAULT_SIZE = {
    [CanvasNodeType.Image]: { width: 340, height: 240, title: "New Generation" },
    [CanvasNodeType.Panorama]: { ...PANORAMA_NODE_SIZE, title: "Panorama" },
    [CanvasNodeType.Text]: { width: 340, height: 240, title: "Note" },
    [CanvasNodeType.Config]: { width: 340, height: 240, title: "Generation Config" },
    [CanvasNodeType.Video]: { width: 420, height: 236, title: "Video" },
    [CanvasNodeType.Audio]: { width: 340, height: 120, title: "Audio" },
    [CanvasNodeType.Brief]: { width: 380, height: 280, title: "Creative Brief" },
    [CanvasNodeType.Task]: { width: 340, height: 210, title: "Agent Task" },
    [CanvasNodeType.BrandKit]: { width: 340, height: 240, title: "Brand Kit" },
} satisfies Record<CanvasNodeType, { width: number; height: number; title: string }>;

const NODE_TITLE_KEYS: Partial<Record<CanvasNodeType, string>> = {
    [CanvasNodeType.Panorama]: "node.type.panorama",
    [CanvasNodeType.Config]: "node.type.config",
    [CanvasNodeType.Brief]: "node.type.brief",
    [CanvasNodeType.Task]: "node.type.task",
    [CanvasNodeType.BrandKit]: "node.type.brandKit",
};

const NODE_SPECS = {
    [CanvasNodeType.Image]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Image],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Panorama]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Panorama],
        metadata: { content: "", status: "idle", size: "2048x1024", panoramaProjection: "equirectangular" },
    },
    [CanvasNodeType.Text]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Text],
        metadata: { content: "", status: "idle", fontSize: 14 },
    },
    [CanvasNodeType.Config]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Config],
        metadata: { content: "", status: "idle", generationMode: "image" },
    },
    [CanvasNodeType.Video]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Video],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Audio]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Audio],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Brief]: { ...NODE_DEFAULT_SIZE[CanvasNodeType.Brief], metadata: { status: "idle" } },
    [CanvasNodeType.Task]: { ...NODE_DEFAULT_SIZE[CanvasNodeType.Task], metadata: { status: "idle", agentTaskStatus: "pending", agentTaskAttempts: 0 } },
    [CanvasNodeType.BrandKit]: { ...NODE_DEFAULT_SIZE[CanvasNodeType.BrandKit], metadata: { status: "idle" } },
} satisfies Record<CanvasNodeType, CanvasNodeSpec>;

export function getNodeSpec(type: CanvasNodeType) {
    return NODE_SPECS[type];
}
