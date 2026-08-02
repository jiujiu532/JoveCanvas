import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import dramaMessages from "../../../../../messages/zh/drama.json";
import { DramaMediaThumbnail } from "./drama-media-preview";

describe("drama media thumbnail", () => {
    it.each([
        { type: "image" as const, title: "镜头起始帧" },
        { type: "video" as const, title: "镜头生成视频" },
    ])("renders $type results as an accessible preview button", ({ type, title }) => {
        const onOpen = vi.fn();
        const media = { type, title, url: `/media/${type}` };
        const markup = renderToStaticMarkup(
            <NextIntlClientProvider locale="zh" messages={{ drama: dramaMessages }}>
                <DramaMediaThumbnail media={media} onOpen={onOpen} />
            </NextIntlClientProvider>,
        );

        expect(markup).toContain(`<button type="button"`);
        expect(markup).toContain(`aria-label="查看${type === "image" ? "图片" : "视频"}：${title}"`);
        expect(markup).toContain(type === "image" ? "<img" : "<video");
        expect(markup).toContain(`/media/${type}`);
    });
});
