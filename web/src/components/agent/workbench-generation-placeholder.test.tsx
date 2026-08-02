import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import layoutMessages from "../../../messages/zh/layout.json";
import { GENERATION_PLACEHOLDER_TILE_COUNT, WorkbenchGenerationActivity, WorkbenchGenerationPlaceholder } from "./workbench-generation-placeholder";

function renderWithIntl(node: ReactNode) {
    return renderToStaticMarkup(
        <NextIntlClientProvider locale="zh" messages={{ layout: layoutMessages }}>
            {node}
        </NextIntlClientProvider>,
    );
}

describe("workbench generation placeholders", () => {
    it("keeps generation status accessible without visible status copy", () => {
        const placeholder = renderWithIntl(<WorkbenchGenerationPlaceholder kind="image" />);
        const activity = renderWithIntl(<WorkbenchGenerationActivity kind="video" count={2} />);

        expect(placeholder).toContain('aria-label="图片正在生成"');
        expect(placeholder).toContain('aria-busy="true"');
        expect(placeholder).not.toContain("animate-spin");
        expect(placeholder).not.toContain("bg-background/80");
        expect(placeholder).not.toContain(">图片正在生成<");
        expect(activity).toContain('aria-label="2 个视频任务正在生成"');
        expect(activity).toContain('class="sr-only">2 个视频任务正在生成</span>');
        expect(activity).not.toContain(">生成中<");
    });

    it("fills the card with a 12 by 8 animated GPT-style tile field and no logo", () => {
        const placeholder = renderWithIntl(<WorkbenchGenerationPlaceholder kind="image" />);
        const stylesheet = readFileSync(resolve(process.cwd(), "src/components/agent/workbench-generation-placeholder.module.css"), "utf8");

        expect(placeholder).toContain("bg-muted");
        expect(placeholder.match(/--cube-index:/g)).toHaveLength(GENERATION_PLACEHOLDER_TILE_COUNT);
        expect(placeholder.match(/--cube-base:/g)).toHaveLength(GENERATION_PLACEHOLDER_TILE_COUNT);
        expect(placeholder).toContain("#d9f4ee");
        expect(placeholder).toContain("#5b9cf5");
        expect(placeholder).not.toContain("/logo.svg");
        expect(stylesheet).toContain("grid-template-columns: repeat(12, minmax(0, 1fr))");
        expect(stylesheet).toContain("grid-template-rows: repeat(8, minmax(0, 1fr))");
        expect(stylesheet).toContain("@keyframes cube-rise");
        expect(stylesheet).toContain("translateY(-4px)");
        expect(stylesheet).toContain("cube-rise-dark");
        expect(stylesheet).toContain("prefers-reduced-motion");
    });
});
