import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    ensurePostgresSchema: vi.fn(),
    getDatabaseProvider: vi.fn(),
    postgresQuery: vi.fn(),
    readJsonDataFile: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({
    ensurePostgresSchema: mocks.ensurePostgresSchema,
    getDatabaseProvider: mocks.getDatabaseProvider,
    postgresQuery: mocks.postgresQuery,
}));
vi.mock("@/lib/server/data-adapter", () => ({ readJsonDataFile: mocks.readJsonDataFile }));

import { countLocalMediaReferences } from "./local-media-references";

describe("countLocalMediaReferences", () => {
    beforeEach(() => vi.clearAllMocks());

    it("counts all requested keys with one PostgreSQL query including prompts.cover_url", async () => {
        mocks.getDatabaseProvider.mockReturnValue("postgres");
        mocks.postgresQuery.mockResolvedValue({
            rows: [
                { storage_key: "permanent/one.png", total: "2" },
                { storage_key: "permanent/two.png", total: 0 },
            ],
        });

        const result = await countLocalMediaReferences(["permanent/one.png", "permanent/two.png", "permanent/one.png"]);

        expect(result).toEqual(
            new Map([
                ["permanent/one.png", 2],
                ["permanent/two.png", 0],
            ]),
        );
        expect(mocks.postgresQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = mocks.postgresQuery.mock.calls[0] as [string, string[][]];
        expect(sql).toContain("unnest($1::text[])");
        expect(sql).toMatch(/JOIN prompts p ON position\(r\.storage_key in COALESCE\(p\.cover_url, ''\)\) > 0/i);
        expect(params).toEqual([["permanent/one.png", "permanent/two.png"]]);
    });

    it("counts prompt cover references in file provider prompts.json", async () => {
        mocks.getDatabaseProvider.mockReturnValue("file");
        mocks.readJsonDataFile.mockImplementation(async (file: string) => {
            if (file === "prompts.json") {
                return {
                    version: 1,
                    prompts: [{ id: "seed-1", coverUrl: "/api/reference-assets/permanent/seed-cover.png" }],
                    seedSources: [],
                };
            }
            return {};
        });

        const result = await countLocalMediaReferences(["permanent/seed-cover.png", "permanent/unused.png"]);

        expect(result.get("permanent/seed-cover.png")).toBe(1);
        expect(result.get("permanent/unused.png")).toBe(0);
        expect(mocks.readJsonDataFile).toHaveBeenCalledWith("prompts.json", {});
    });
});
