import { LIBRARY_SEED_SOURCE_WHITELIST, isLibrarySeedSourceRegistered, replaceLibrarySeedBatch, type StoredPromptExport } from "@/lib/prompts/store";
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
    hasSeedSource: vi.fn(),
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
        mocks.createRepos.mockReturnValue({
            prompts: { replaceSeededPrompts: mocks.replaceSeeded, hasSeedSource: mocks.hasSeedSource },
        });
        mocks.hasSeedSource.mockResolvedValue(false);
        mocks.replaceSeeded.mockResolvedValue({ claimed: true });
        mocks.withTx.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn({}));
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

    it("skips when the same versioned source is already registered (file)", async () => {
        mocks.readJson.mockResolvedValue({
            version: 1,
            prompts: [samplePrompt("youmind-skill-1", "vozeb-pro/youmind-skill:v1")],
            seedSources: ["vozeb-pro/youmind-skill:v1"],
        });
        const result = await replaceLibrarySeedBatch({
            sourcePrefix: "vozeb-pro/youmind-skill",
            source: "vozeb-pro/youmind-skill:v1",
            prompts: [samplePrompt("youmind-skill-2", "vozeb-pro/youmind-skill:v1")],
        });
        expect(result).toEqual({ written: 0, skipped: true });
        expect(mocks.writeJson).not.toHaveBeenCalled();
    });

    it("reports registration via isLibrarySeedSourceRegistered without writing", async () => {
        mocks.readJson.mockResolvedValue({
            version: 1,
            prompts: [],
            seedSources: ["vozeb-pro/youmind-skill:v1"],
        });
        await expect(isLibrarySeedSourceRegistered("vozeb-pro/youmind-skill:v1")).resolves.toBe(true);
        await expect(isLibrarySeedSourceRegistered("vozeb-pro/youmind-skill:v2")).resolves.toBe(false);
        expect(mocks.writeJson).not.toHaveBeenCalled();
    });

    describe("postgres path (transactional claim)", () => {
        beforeEach(() => {
            mocks.isPostgres.mockReturnValue(true);
            mocks.hasSeedSource.mockResolvedValue(false);
            mocks.replaceSeeded.mockResolvedValue({ claimed: true });
        });

        it("fast-path skips without opening replace when source already registered", async () => {
            mocks.hasSeedSource.mockResolvedValue(true);
            const result = await replaceLibrarySeedBatch({
                sourcePrefix: "vozeb-pro/youmind-skill",
                source: "vozeb-pro/youmind-skill:v1",
                prompts: [samplePrompt("youmind-skill-1", "vozeb-pro/youmind-skill:v1")],
            });
            expect(result).toEqual({ written: 0, skipped: true });
            expect(mocks.withTx).not.toHaveBeenCalled();
            expect(mocks.replaceSeeded).not.toHaveBeenCalled();
        });

        it("writes via claim-and-replace inside a transaction", async () => {
            const prompts = [samplePrompt("youmind-skill-1", "vozeb-pro/youmind-skill:v1")];
            const result = await replaceLibrarySeedBatch({
                sourcePrefix: "vozeb-pro/youmind-skill",
                source: "vozeb-pro/youmind-skill:v1",
                prompts,
            });
            expect(result).toEqual({ written: 1 });
            expect(mocks.withTx).toHaveBeenCalledTimes(1);
            expect(mocks.replaceSeeded).toHaveBeenCalledTimes(1);
            const [prefix, source, records] = mocks.replaceSeeded.mock.calls[0];
            expect(prefix).toBe("vozeb-pro/youmind-skill");
            expect(source).toBe("vozeb-pro/youmind-skill:v1");
            expect(records).toHaveLength(1);
            expect(records[0].id).toBe("youmind-skill-1");
        });

        it("returns skipped when transactional claim loses (claimed: false) without counting writes", async () => {
            // Outer fast-path says free; in-tx claim loses to a concurrent writer.
            mocks.hasSeedSource.mockResolvedValue(false);
            mocks.replaceSeeded.mockResolvedValue({ claimed: false });
            const result = await replaceLibrarySeedBatch({
                sourcePrefix: "vozeb-pro/youmind-skill",
                source: "vozeb-pro/youmind-skill:v1",
                prompts: [samplePrompt("youmind-skill-1", "vozeb-pro/youmind-skill:v1")],
            });
            expect(result).toEqual({ written: 0, skipped: true });
            expect(mocks.withTx).toHaveBeenCalledTimes(1);
            expect(mocks.replaceSeeded).toHaveBeenCalledTimes(1);
        });
    });
});

describe("PromptsRepository.replaceSeededPrompts claim order", () => {
    it("claims first; on conflict returns claimed false and never DELETEs", async () => {
        const queries: Array<{ sql: string; params: unknown[] }> = [];
        const db = {
            query: vi.fn(async (sql: string, params: unknown[] = []) => {
                queries.push({ sql, params });
                if (sql.includes("INSERT INTO prompt_seed_sources") && sql.includes("RETURNING")) {
                    return { rows: [] }; // conflict → no row
                }
                return { rows: [], rowCount: 0 };
            }),
        };
        const { PromptsRepository } = await import("@/lib/server/database/content-repository");
        const repo = new PromptsRepository(db as never);
        const result = await repo.replaceSeededPrompts("vozeb-pro/youmind-skill", "vozeb-pro/youmind-skill:v1", []);
        expect(result).toEqual({ claimed: false });
        expect(queries).toHaveLength(1);
        expect(queries[0].sql).toMatch(/INSERT INTO prompt_seed_sources/);
        expect(queries.some((item) => item.sql.includes("DELETE"))).toBe(false);
    });

    it("on successful claim deletes prefix prompts/sources then upserts", async () => {
        const queries: string[] = [];
        const db = {
            query: vi.fn(async (sql: string, _params: unknown[] = []) => {
                queries.push(sql);
                if (sql.includes("INSERT INTO prompt_seed_sources") && sql.includes("RETURNING")) {
                    return { rows: [{ source: "vozeb-pro/youmind-skill:v1" }] };
                }
                if (sql.includes("INSERT INTO prompts")) {
                    return {
                        rows: [
                            {
                                id: "youmind-skill-1",
                                scope: "library",
                                owner_user_id: null,
                                title: "t",
                                cover_url: "/x.png",
                                prompt: "body",
                                tags: [],
                                category: "ui",
                                preview: "t",
                                github_url: null,
                                source: "vozeb-pro/youmind-skill:v1",
                                locale: "en",
                                created_at: "2026-07-27T00:00:00.000Z",
                                updated_at: "2026-07-27T00:00:00.000Z",
                            },
                        ],
                    };
                }
                return { rows: [], rowCount: 0 };
            }),
        };
        const { PromptsRepository } = await import("@/lib/server/database/content-repository");
        const repo = new PromptsRepository(db as never);
        const result = await repo.replaceSeededPrompts("vozeb-pro/youmind-skill", "vozeb-pro/youmind-skill:v1", [
            {
                id: "youmind-skill-1",
                scope: "library",
                ownerUserId: "",
                title: "t",
                coverUrl: "/x.png",
                prompt: "body",
                tags: [],
                category: "ui",
                preview: "t",
                githubUrl: "",
                source: "vozeb-pro/youmind-skill:v1",
                locale: "en",
                createdAt: "2026-07-27T00:00:00.000Z",
                updatedAt: "2026-07-27T00:00:00.000Z",
            },
        ]);
        expect(result).toEqual({ claimed: true });
        expect(queries[0]).toMatch(/INSERT INTO prompt_seed_sources/);
        expect(queries[1]).toMatch(/DELETE FROM prompts WHERE source LIKE/);
        expect(queries[2]).toMatch(/DELETE FROM prompt_seed_sources WHERE source LIKE/);
        expect(queries[2]).toMatch(/source <>/);
        expect(queries.some((sql) => sql.includes("INSERT INTO prompts"))).toBe(true);
    });
});

describe("listPrompts all-sentinel normalization (PG)", () => {
    const list = vi.fn();
    const facets = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isPostgres.mockReturnValue(true);
        mocks.ensureSchema.mockResolvedValue(undefined);
        // Short-circuit ensurePostgresPromptSeeds so list path does not import original-author seeds.
        mocks.hasSeedSource.mockResolvedValue(true);
        list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
        facets.mockResolvedValue({ tags: [], categories: [], scopeTotal: 0 });
        mocks.createRepos.mockReturnValue({
            prompts: {
                list,
                facets,
                hasSeedSource: mocks.hasSeedSource,
                replaceSeededPrompts: mocks.replaceSeeded,
            },
        });
    });

    it.each(["__all__", "全部", "all", "All", "", undefined])("passes empty category to repository for sentinel %j", async (category) => {
        const { listPrompts } = await import("@/lib/prompts/store");
        await listPrompts({ scope: "library", category: category as string | undefined, page: 1, pageSize: 20 });
        expect(list).toHaveBeenCalled();
        const listArg = list.mock.calls[0][0] as { category: string };
        expect(listArg.category).toBe("");
        expect(facets).toHaveBeenCalled();
        const facetArg = facets.mock.calls[0][0] as { category: string };
        expect(facetArg.category).toBe("");
    });

    it("keeps real category filter", async () => {
        const { listPrompts } = await import("@/lib/prompts/store");
        await listPrompts({ scope: "library", category: "ui", page: 1, pageSize: 20 });
        expect(list.mock.calls[0][0].category).toBe("ui");
        expect(facets.mock.calls[0][0].category).toBe("ui");
    });
});
