import { describe, expect, it } from "vitest";

import { agentRequirementAcknowledgement, agentRequirementAcknowledgementLabelsFromT, DEFAULT_AGENT_REQUIREMENT_ACKNOWLEDGEMENT_LABELS } from "@/lib/agent-requirement-acknowledgement";

describe("agentRequirementAcknowledgement", () => {
    it("defaults to Chinese acknowledgement copy", () => {
        expect(agentRequirementAcknowledgement("帮我做一张海报", "chat")).toBe("收到，我会按你的要求处理这次图片。");
        expect(agentRequirementAcknowledgement("生成一段视频", "chat", true)).toBe("收到，我会根据当前参考素材完成这次视频。");
        expect(agentRequirementAcknowledgement("继续创作", "drama")).toBe("收到，我会结合当前短剧项目继续创作。");
        expect(agentRequirementAcknowledgement("生成图片", "canvas", true)).toBe("收到，我会基于当前选中素材处理这次图片。");
    });

    it("uses injected English labels", () => {
        const labels = agentRequirementAcknowledgementLabelsFromT((key) => {
            const map: Record<string, string> = {
                kindVideo: "video",
                kindImage: "image",
                kindAudio: "audio",
                kindRequest: "creative request",
                canvasWithRefs: "Got it. I will handle this {kind} based on the currently selected assets.",
                canvasPlain: "Got it. I will handle this {kind} with the current canvas.",
                dramaWithRefs: "Got it. I will continue creating with the current drama project and references.",
                dramaPlain: "Got it. I will continue creating with the current drama project.",
                chatWithRefs: "Got it. I will complete this {kind} using the current references.",
                chatWithSize: "Got it. I will complete this image creation at {size}.",
                chatPlain: "Got it. I will handle this {kind} based on your request.",
            };
            return map[key] || key;
        });
        expect(agentRequirementAcknowledgement("make a video clip", "chat", false, labels)).toBe("Got it. I will handle this video based on your request.");
        expect(agentRequirementAcknowledgement("make an image", "chat", true, labels)).toBe("Got it. I will complete this image using the current references.");
        expect(agentRequirementAcknowledgement("continue", "drama", true, labels)).toBe("Got it. I will continue creating with the current drama project and references.");
        expect(Object.keys(labels)).toEqual(Object.keys(DEFAULT_AGENT_REQUIREMENT_ACKNOWLEDGEMENT_LABELS));
    });
});
