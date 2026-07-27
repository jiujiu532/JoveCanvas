import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import layoutMessages from "../../../messages/zh/layout.json";
import { WorkbenchGenerationActivity, WorkbenchGenerationPlaceholder } from "./workbench-generation-placeholder";

function readNested(dict: unknown, key: string): string | undefined {
    let current: unknown = dict;
    for (const part of key.split(".")) {
        if (typeof current !== "object" || current === null) return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return typeof current === "string" ? current : undefined;
}

vi.mock("next-intl", () => ({
    useTranslations: () => (key: string, params?: Record<string, string | number>) => {
        const template = readNested(layoutMessages, key) ?? key;
        if (!params) return template;
        return template.replace(/\{(\w+)\}/g, (matched, name: string) => (name in params ? String(params[name]) : matched));
    },
}));

describe("workbench generation placeholders", () => {
    it("keeps generation status accessible without visible status copy", () => {
        const placeholder = renderToStaticMarkup(<WorkbenchGenerationPlaceholder kind="image" />);
        const activity = renderToStaticMarkup(<WorkbenchGenerationActivity kind="video" count={2} />);

        expect(placeholder).toContain('aria-label="图片正在生成"');
        expect(placeholder).toContain('class="sr-only">图片正在生成</span>');
        expect(activity).toContain('aria-label="2 个视频任务正在生成"');
        expect(activity).toContain('class="sr-only">2 个视频任务正在生成</span>');
        expect(activity).not.toContain(">生成中<");
    });
});
