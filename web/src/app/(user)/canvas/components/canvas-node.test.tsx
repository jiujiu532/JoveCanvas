import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import canvasMessages from "../../../../../messages/zh/canvas.json";
import { CanvasNodeType, type CanvasNodeData } from "../types";
import { CanvasNode } from "./canvas-node";

function readNested(dict: unknown, key: string): string | undefined {
    let current: unknown = dict;
    for (const part of key.split(".")) {
        if (typeof current !== "object" || current === null) return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return typeof current === "string" ? current : undefined;
}

// 子组件通过 useTranslations("canvas") 取文案；用 zh 字典 mock 避免依赖 NextIntlClientProvider。
vi.mock("next-intl", () => ({
    useTranslations: (namespace?: string) => (key: string, params?: Record<string, string | number>) => {
        const fullKey = namespace && namespace !== "canvas" ? `${namespace}.${key}` : key;
        const template = readNested(canvasMessages, fullKey) ?? key;
        if (!params) return template;
        return template.replace(/\{(\w+)\}/g, (matched, name: string) => (name in params ? String(params[name]) : matched));
    },
    useLocale: () => "zh",
}));

const imageNode: CanvasNodeData = {
    id: "generated-image",
    type: CanvasNodeType.Image,
    title: "生成图片",
    position: { x: 120, y: 80 },
    width: 320,
    height: 320,
    metadata: { content: "/generated-image.webp" },
};

const noop = () => undefined;

function renderImageNode(overrides: Partial<React.ComponentProps<typeof CanvasNode>> = {}) {
    return renderToStaticMarkup(
        <CanvasNode
            data={imageNode}
            scale={1}
            isSelected={false}
            isRelated={false}
            isFocusRelated={false}
            isConnectionTarget={false}
            isConnecting={false}
            showPanel={false}
            showImageInfo={false}
            onMouseDown={noop}
            onHoverStart={noop}
            onHoverEnd={noop}
            onConnectStart={noop}
            onResize={noop}
            onContentChange={noop}
            onContextMenu={noop}
            {...overrides}
        />,
    );
}

describe("CanvasNode image border", () => {
    beforeEach(() => useThemeStore.setState({ theme: "light" }));

    it("uses the themed card border for an idle generated image", () => {
        const markup = renderImageNode();

        expect(markup).toContain(`border-color:${canvasThemes.light.node.stroke}`);
        expect(markup).toContain("rounded-3xl border-2");
        expect(markup).toContain("overflow-hidden rounded-3xl");
    });

    it("keeps the blue active border when the image is selected", () => {
        expect(renderImageNode({ isSelected: true })).toContain("border-color:#2f80ff");
    });

    it("keeps the muted highlight for a related image", () => {
        expect(renderImageNode({ isRelated: true })).toContain(`border-color:${canvasThemes.light.node.muted}`);
    });

    it("does not apply the related highlight to a batch child", () => {
        const batchChild = { ...imageNode, metadata: { ...imageNode.metadata, batchRootId: "batch-root" } };

        const markup = renderImageNode({ data: batchChild, isRelated: true });

        expect(markup).toContain(`class="relative h-full w-full overflow-visible rounded-3xl border-2" style="background:transparent;border-color:${canvasThemes.light.node.stroke}"`);
    });
});
