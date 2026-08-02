import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("create Agent home layout", () => {
    it("keeps Agent input, recent work and reusable public inspiration in one flow", async () => {
        const [page, composer, overview, inspiration, previewModal] = await Promise.all([
            readFile(resolve(process.cwd(), "src/app/(user)/create/page.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/create/components/creative-composer.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/create/components/create-workbench-overview.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/app/(user)/create/components/create-inspiration-gallery.tsx"), "utf8"),
            readFile(resolve(process.cwd(), "src/components/works/public-work-preview-modal.tsx"), "utf8"),
        ]);

        expect(page).toContain('t("heroTitleWithSite"');
        expect(page).toContain("createAgentPromptFromHash");
        expect(page).not.toContain("最近创作");
        expect(page).toContain("<CreateInspirationGallery");
        expect(page.indexOf("<CreateWorkbenchOverview")).toBeLessThan(page.indexOf("<CreateInspirationGallery"));
        expect(page).toContain("usePublicImage");
        expect(composer).toContain('centered ? "max-w-[960px]"');
        expect(composer).not.toContain("CreativeImageSizeControl");
        const pointerDownHandler = composer.slice(composer.indexOf("const onPointerDown"), composer.indexOf("const onPointerMove"));
        const pointerMoveHandler = composer.slice(composer.indexOf("const onPointerMove"), composer.indexOf("const finishDrag"));
        expect(pointerDownHandler).not.toContain("setPointerCapture");
        expect(pointerMoveHandler).toContain("setPointerCapture");
        expect(inspiration).toContain('t("inspirationTitle")');
        expect(inspiration).toContain('t("usePrompt")');
        expect(inspiration).toContain('t("copyPrompt")');
        expect(inspiration).toContain('t("useImage")');
        expect(inspiration).toContain("listPublicGallery");
        expect(inspiration).toContain("columns-2");
        expect(inspiration).toContain("xl:columns-6");
        expect(inspiration).not.toContain("max-h-[560px]");
        expect(inspiration).toContain("<Dropdown");
        expect(inspiration).toContain("<PublicWorkPreviewModal");
        expect(inspiration).toContain("<LazyMediaImage");
        expect(inspiration).toContain("<PublicWorkCardTitle");
        expect(inspiration).not.toContain("href={`/share/");
        expect(overview).toContain('aria-label={t("referenceToAgent")}');
        expect(overview.indexOf('aria-labelledby="create-assets-heading"')).toBeLessThan(overview.indexOf('aria-labelledby="create-projects-heading"'));
        expect(overview).toContain("recentAssets.slice(0, recentAssetVisibilityClasses.length)");
        expect(overview).toContain("grid-cols-2");
        expect(overview).toContain("2xl:grid-cols-6");
        expect(overview).toContain('"hidden sm:block"');
        expect(overview).not.toContain("grid-flow-col");
        expect(overview).not.toContain("overflow-x-auto");
        expect(overview).not.toContain("lg:grid-cols-5");
        expect(overview).toContain('"group grid h-32');
        expect(overview).toContain("sm:h-44");
        expect(overview).toContain('title={t("referenceToAgent")}');
        expect(overview).not.toMatch(/>\s*引用\s*</);
        expect(overview).not.toContain("absolute bottom-2 right-2");
        expect(previewModal).toContain('aria-label={t("refPromptAgent")}');
        expect(previewModal).toContain('aria-label={t("refImageAgent")}');
        expect(previewModal).not.toMatch(/>\s*引用到 Agent\s*</);
        expect(previewModal).toContain('t("copyPrompt")');
        expect(previewModal).toContain('aria-label={t("closeAria")}');
        expect(previewModal).toContain("lg:grid-cols-[minmax(0,1fr)_340px]");
        expect(previewModal).toContain("xl:grid-cols-[minmax(0,1fr)_360px]");
        expect(previewModal).toContain('asset.mediaType === "image" || asset.mediaType === "video"');
    });
});
