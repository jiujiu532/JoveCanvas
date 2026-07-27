import { LIBRARY_SEED_SOURCE_WHITELIST, replaceLibrarySeedBatch, type StoredPromptExport } from "@/lib/prompts/store";
import { AuthInputError } from "@/lib/auth/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    isPostgres: vi.fn(() => false),
    ensureSchema: vi.fn(),
    withTx: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn({})),
    createRepos: vi.fn(),
    readJson: vi.fn(),
    writeJson: vi.fn(),
    replaceSeeded: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({
    isPostgresDatabaseEnabled: mocks.isPostgres,
    ensurePostgresSchema: mocks.ensureSchema,
    withPostgresTransaction: mocks.withTx,
    createPostgresRepositories: mocks.createRepos,
    postgresQuery: vi.fn(),
}));

vi.mock("@/lib/server/data-adapter", () => ({
    readJsonDataFile: mocks.readJson,
    writeJsonDataFile: mocks.writeJson,
}));

function samplePrompt(id: string, source: string): StoredPromptExport {
    return {
        id,
        scope: "library",
        title: "t",
        coverUrl: "/api/reference-assets/permanent/x.png",
        prompt: "A detailed product shot with enough characters for a seed prompt body here.",
        tags: ["ui"],
        category: "ui",
        preview: "t",
        source,
        locale: "en",
        createdAt: "2026-07-27T00:00:00.000Z",
        updatedAt: "2026-07-27T00:00:00.000Z",
    };
}

describe("replaceLibrarySeedBatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isPostgres.mockReturnValue(false);
        mocks.readJson.mockResolvedValue({
            version: 1,
            prompts: [
                samplePrompt("original-1", "vozeb-pro/original-author-prompts:v4"),
                samplePrompt("youmind-skill-old", "vozeb-pro/youmind-skill:v0"),
            ],
            seedSources: ["vozeb-pro/original-author-prompts:v4", "vozeb-pro/youmind-skill:v0"],
        });
        mocks.writeJson.mockResolvedValue(undefined);
        mocks.createRepos.mockReturnValue({ prompts: { replaceSeededPrompts: mocks.replaceSeeded } });
    });

    it("exposes independent whitelist prefixes only", () => {
        expect(LIBRARY_SEED_SOURCE_WHITELIST).toContain("vozeb-pro/youmind-skill");
        expect(LIBRARY_SEED_SOURCE_WHITELIST).toContain("vozeb-pro/gptimage2-json");
        expect(LIBRARY_SEED_SOURCE_WHITELIST as readonly string[]).not.toContain("vozeb-pro/original-author-prompts");
    });

    it("rejects original-author prefix", async () => {
        await expect(
            replaceLibrarySeedBatch({
                sourcePrefix: "vozeb-pro/original-author-prompts",
                source: "vozeb-pro/original-author-prompts:v5",
                prompts: [samplePrompt("x", "vozeb-pro/original-author-prompts:v5")],
            }),
        ).rejects.toBeInstanceOf(AuthInputError);
    });

    it("replaces only matching file-store prefix and keeps original seeds", async () => {
        const next = [samplePrompt("youmind-skill-1", "vozeb-pro/youmind-skill:v1")];
        const result = await replaceLibrarySeedBatch({
            sourcePrefix: "vozeb-pro/youmind-skill",
            source: "vozeb-pro/youmind-skill:v1",
            prompts: next,
        });
        expect(result.written).toBe(1);
        expect(mocks.writeJson).toHaveBeenCalled();
        const written = mocks.writeJson.mock.calls[0][1] as { prompts: StoredPromptExport[]; seedSources: string[] };
        expect(written.prompts.some((item) => item.id === "original-1")).toBe(true);
        expect(written.prompts.some((item) => item.id === "youmind-skill-old")).toBe(false);
        expect(written.prompts.some((item) => item.id === "youmind-skill-1")).toBe(true);
        expect(written.seedSources).toContain("vozeb-pro/original-author-prompts:v4");
        expect(written.seedSources).toContain("vozeb-pro/youmind-skill:v1");
        expect(written.seedSources).not.toContain("vozeb-pro/youmind-skill:v0");
    });
});
