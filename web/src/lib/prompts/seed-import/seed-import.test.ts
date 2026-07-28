import { loadSeedDrafts } from "@/lib/prompts/seed-import/adapters";
import { createEmptyDedupIndex, gateDraft, indexExistingLibrary, qualityGate } from "@/lib/prompts/seed-import/gates";
import { normalizeCoverUrl, normalizePrompt, promptContentHash } from "@/lib/prompts/seed-import/normalize";
import { mapToScene, sampleBySceneQuota } from "@/lib/prompts/seed-import/scene-map";
import type { SeedDraft } from "@/lib/prompts/seed-import/types";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

function draft(partial: Partial<SeedDraft> & Pick<SeedDraft, "stableId" | "title" | "prompt" | "coverOriginUrl">): SeedDraft {
    return {
        tags: ["test"],
        sourceKey: "youmind-skill",
        ...partial,
    };
}

describe("seed-import normalize", () => {
    it("stabilizes whitespace and latin case", () => {
        expect(normalizePrompt("  Hello\r\n\r\n  World  ")).toBe("hello\n\n world");
        expect(normalizePrompt("Hello")).toBe(normalizePrompt("hello"));
    });

    it("hashes equal after key-sorted JSON normalize without stack blow-up", () => {
        const a = '{\n  "b": 1,\n  "a": 2\n}';
        const b = '{"a":2,"b":1}';
        expect(normalizePrompt(a)).toBe('{"a":2,"b":1}');
        expect(promptContentHash(a)).toBe(promptContentHash(b));
        // Nested object must also terminate (pre-fix path re-entered full normalize forever).
        const nested = '{"z":{"y":1},"x":[2,{"b":3,"a":4}]}';
        expect(normalizePrompt(nested)).toBe('{"x":[2,{"a":4,"b":3}],"z":{"y":1}}');
    });

    it("strips utm from cover urls", () => {
        expect(normalizeCoverUrl("https://CDN.Example.com/x.jpg?utm_source=x&y=1#frag")).toBe("https://cdn.example.com/x.jpg?y=1");
    });
});

describe("seed-import quality/dedup gates", () => {
    it("skips meta prompts", () => {
        const result = qualityGate(
            draft({
                stableId: "1",
                title: "Generator",
                prompt: "Convert a user's short image request into one finished prompt. Return only the finished image prompt. " + "x".repeat(50),
                coverOriginUrl: "https://cdn.example.com/a.jpg",
            }),
        );
        expect(result.kind).toBe("skip");
        if (result.kind === "skip") expect(result.reason).toBe("quality_meta_prompt");
    });

    it("skips short prompts", () => {
        const result = qualityGate(draft({ stableId: "2", title: "Short", prompt: "too short", coverOriginUrl: "https://cdn.example.com/a.jpg" }));
        expect(result.kind).toBe("skip");
        if (result.kind === "skip") expect(result.reason).toBe("quality_prompt_short");
    });

    it("dedups by content hash against library", () => {
        const body = "A highly detailed product photo of a ceramic mug on a marble counter under soft window light.";
        const index = indexExistingLibrary([{ prompt: body, coverUrl: "https://cdn.example.com/old.jpg", title: "Old" }]);
        const result = gateDraft(
            draft({
                stableId: "3",
                title: "New title",
                prompt: body,
                coverOriginUrl: "https://cdn.example.com/new.jpg",
            }),
            index,
        );
        expect(result.kind).toBe("skip");
        if (result.kind === "skip") expect(result.reason).toBe("prompt_hash");
    });

    it("accepts fresh quality draft and commits hash", () => {
        const index = createEmptyDedupIndex();
        const body = "Extreme macro photograph of spreadsheet tabs with dust and fingerprint on the glass surface.";
        const result = gateDraft(
            draft({
                stableId: "4",
                title: "Macro Monitor",
                prompt: body,
                coverOriginUrl: "https://cms-assets.youmind.com/media/a.jpg",
            }),
            index,
        );
        expect(result.kind).toBe("accept");
        expect(index.promptHashes.has(promptContentHash(body))).toBe(true);
    });
});

describe("seed-import scene map", () => {
    it("maps youmind category hints", () => {
        expect(
            mapToScene(
                draft({
                    stableId: "5",
                    title: "x",
                    prompt: "A long enough prompt about nothing special for category mapping only here.",
                    coverOriginUrl: "https://cdn.example.com/a.jpg",
                    categoryHint: "app-web-design",
                }),
            ),
        ).toBe("ui");
    });

    it("samples rare scenes first under quota", () => {
        const pool = Array.from({ length: 20 }, (_, i) => {
            const category = i < 2 ? ("logo" as const) : ("ui" as const);
            return {
                ...draft({
                    stableId: String(i),
                    title: `Item ${i}`,
                    prompt: `Prompt body number ${i} with enough characters to pass quality later on.`,
                    coverOriginUrl: `https://cdn.example.com/${i}.jpg`,
                }),
                category,
                locale: "en" as const,
                contentHash: String(i),
                coverKey: `https://cdn.example.com/${i}.jpg`,
            };
        });
        const { accepted } = sampleBySceneQuota(pool, 5);
        expect(accepted.length).toBe(5);
        expect(accepted.filter((item) => item.category === "logo").length).toBeGreaterThan(0);
    });
});

describe("seed-import adapters against research samples", () => {
    // Optional local research fixtures (gitignored trellis path); skip when absent.
    const samplesDir = join(fileURLToPath(new URL(".", import.meta.url)), "../../../../../.trellis/tasks/07-27-prompt-en-seed-curation/research/_vendor_samples");

    it("parses youmind sample3", async () => {
        const samplePath = join(samplesDir, "youmind-app-web-design.sample3.json");
        if (!existsSync(samplePath)) return;
        const drafts = await loadSeedDrafts("youmind-skill", samplePath);
        expect(drafts.length).toBeGreaterThanOrEqual(2);
        expect(drafts.some((item) => item.title.includes("Macro"))).toBe(true);
        expect(drafts.some((item) => item.title.includes("Redphase"))).toBe(true);
    });

    it("parses gptimage2 sample3 wrapper", async () => {
        const samplePath = join(samplesDir, "gptimage2-prompts.sample3.json");
        if (!existsSync(samplePath)) return;
        const drafts = await loadSeedDrafts("gptimage2-json", samplePath);
        expect(drafts.length).toBeGreaterThanOrEqual(2);
        expect(drafts[0].coverOriginUrl.startsWith("https://")).toBe(true);
    });
});

describe("seed-import rehost SSRF guard", () => {
    it("rejects private/metadata URLs before fetch", async () => {
        const { rehostPromptCover } = await import("@/lib/prompts/seed-import/rehost");
        const result = await rehostPromptCover("http://127.0.0.1/latest/meta-data/", "prompt-seed:test");
        expect(result).toEqual({ ok: false, reason: "unsafe_url" });
    });

    it("rejects cloud metadata hostnames", async () => {
        const { rehostPromptCover } = await import("@/lib/prompts/seed-import/rehost");
        const result = await rehostPromptCover("http://metadata.google.internal/computeMetadata/v1/", "prompt-seed:test");
        expect(result).toEqual({ ok: false, reason: "unsafe_url" });
    });
});

describe("seed-import pipeline skip-if-registered", () => {
    it("returns empty prompts without loading drafts when source already registered", async () => {
        const { runSeedImport } = await import("@/lib/prompts/seed-import/pipeline");
        const report = await runSeedImport({
            sourceKey: "youmind-skill",
            inputPath: "/nonexistent",
            library: [],
            dryRun: false,
            skipRehost: false,
            skipIfSourceRegistered: true,
            registeredSeedSources: ["vozeb-pro/youmind-skill:v1"],
        });
        expect(report.accepted).toBe(0);
        expect(report.prompts).toEqual([]);
        expect(report.skipped.source_registered).toBe(1);
    });

    it("does zero rehost when skipIfSourceRegistered hits (no cover download)", async () => {
        const rehostMod = await import("@/lib/prompts/seed-import/rehost");
        const spy = vi.spyOn(rehostMod, "rehostPromptCover").mockResolvedValue({
            ok: true,
            coverUrl: "/api/reference-assets/permanent/should-not-write.png",
            token: "permanent/should-not-write.png",
        });
        try {
            const { runSeedImport } = await import("@/lib/prompts/seed-import/pipeline");
            const report = await runSeedImport({
                sourceKey: "youmind-skill",
                inputPath: "/nonexistent",
                library: [],
                dryRun: false,
                skipRehost: false,
                skipIfSourceRegistered: true,
                registeredSeedSources: ["vozeb-pro/youmind-skill:v1"],
            });
            expect(report.skipped.source_registered).toBe(1);
            expect(report.prompts).toEqual([]);
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});
