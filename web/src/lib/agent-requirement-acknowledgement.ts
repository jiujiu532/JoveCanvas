import type { CreativeSurface } from "@/lib/creative-runtime-contract";
import { extractImageSizeFromPrompt } from "@/lib/image-size";

export type AgentRequirementAcknowledgementLabels = {
    kindVideo: string;
    kindImage: string;
    kindAudio: string;
    kindRequest: string;
    canvasWithRefs: string;
    canvasPlain: string;
    dramaWithRefs: string;
    dramaPlain: string;
    chatWithRefs: string;
    chatWithSize: string;
    chatPlain: string;
};

/** 默认中文回落：测试与未注入 labels 的调用点仍得到中文确认文案 */
export const DEFAULT_AGENT_REQUIREMENT_ACKNOWLEDGEMENT_LABELS: AgentRequirementAcknowledgementLabels = {
    kindVideo: "视频",
    kindImage: "图片",
    kindAudio: "音频",
    kindRequest: "创作需求",
    canvasWithRefs: "收到，我会基于当前选中素材处理这次{kind}。",
    canvasPlain: "收到，我会结合当前画布处理这次{kind}。",
    dramaWithRefs: "收到，我会结合当前短剧项目与参考素材继续创作。",
    dramaPlain: "收到，我会结合当前短剧项目继续创作。",
    chatWithRefs: "收到，我会根据当前参考素材完成这次{kind}。",
    chatWithSize: "收到，我会按 {size} 尺寸完成这次图片创作。",
    chatPlain: "收到，我会按你的要求处理这次{kind}。",
};

export function agentRequirementAcknowledgementLabelsFromT(t: (key: string) => string): AgentRequirementAcknowledgementLabels {
    return {
        kindVideo: t("kindVideo"),
        kindImage: t("kindImage"),
        kindAudio: t("kindAudio"),
        kindRequest: t("kindRequest"),
        canvasWithRefs: t("canvasWithRefs"),
        canvasPlain: t("canvasPlain"),
        dramaWithRefs: t("dramaWithRefs"),
        dramaPlain: t("dramaPlain"),
        chatWithRefs: t("chatWithRefs"),
        chatWithSize: t("chatWithSize"),
        chatPlain: t("chatPlain"),
    };
}

function fillTemplate(template: string, params: Record<string, string>) {
    return template.replace(/\{(\w+)\}/g, (matched, name: string) => (name in params ? params[name] : matched));
}

function detectRequirementKind(prompt: string): keyof Pick<AgentRequirementAcknowledgementLabels, "kindVideo" | "kindImage" | "kindAudio" | "kindRequest"> {
    if (/(?:视频|短片|动画|运镜|图生视频|\bvideo\b|\bclip\b|\banimation\b|i2v|image-to-video)/iu.test(prompt)) return "kindVideo";
    if (/(?:图片|图像|海报|封面|主视觉|生图|照片|\bimage\b|\bphoto\b|\bposter\b|\bcover\b)/iu.test(prompt)) return "kindImage";
    if (/(?:音频|配音|声音|旁白|语音|\baudio\b|\bvoice\b|\bnarrat)/iu.test(prompt)) return "kindAudio";
    return "kindRequest";
}

export function agentRequirementAcknowledgement(prompt: string, surface: CreativeSurface, hasReferences = false, labels: AgentRequirementAcknowledgementLabels = DEFAULT_AGENT_REQUIREMENT_ACKNOWLEDGEMENT_LABELS) {
    const normalized = prompt.trim();
    const size = extractImageSizeFromPrompt(normalized);
    const kindKey = detectRequirementKind(normalized);
    const kind = labels[kindKey];
    if (surface === "canvas") return fillTemplate(hasReferences ? labels.canvasWithRefs : labels.canvasPlain, { kind });
    if (surface === "drama") return hasReferences ? labels.dramaWithRefs : labels.dramaPlain;
    if (hasReferences) return fillTemplate(labels.chatWithRefs, { kind });
    if (size && kindKey === "kindImage") return fillTemplate(labels.chatWithSize, { size });
    return fillTemplate(labels.chatPlain, { kind });
}
