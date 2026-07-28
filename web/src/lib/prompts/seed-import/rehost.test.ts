import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    isSafeOutboundUrl: vi.fn(async () => true),
    persistExternalMediaIfEnabled: vi.fn(async () => null),
    registerLocalMediaAsset: vi.fn(async () => undefined),
    createDatedMediaPath: vi.fn(() => "permanent/image/2026/07/28/test.jpg"),
}));

vi.mock("@/lib/server/security", () => ({
    isSafeOutboundUrl: mocks.isSafeOutboundUrl,
}));

vi.mock("@/lib/server/object-storage-service", () => ({
    persistExternalMediaIfEnabled: mocks.persistExternalMediaIfEnabled,
}));

vi.mock("@/lib/server/local-media-registry", () => ({
    registerLocalMediaAsset: mocks.registerLocalMediaAsset,
}));

vi.mock("@/lib/server/local-media-storage", () => ({
    REFERENCE_MEDIA_ROOT: "/tmp/vozeb-pro-reference-test",
    createDatedMediaPath: mocks.createDatedMediaPath,
}));

import { rehostPromptCover } from "./rehost";

describe("rehostPromptCover svg rejection", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
        mocks.isSafeOutboundUrl.mockResolvedValue(true);
    });

    it("rejects image/svg+xml content-type", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("<svg xmlns='http://www.w3.org/2000/svg'></svg>", { status: 200, headers: { "content-type": "image/svg+xml" } })),
        );

        const result = await rehostPromptCover("https://cdn.example.com/cover.svg", "prompt-seed:test");
        expect(result).toEqual({ ok: false, reason: "svg_not_allowed" });
        expect(mocks.persistExternalMediaIfEnabled).not.toHaveBeenCalled();
    });

    it("rejects SVG bodies even when content-type is image/png", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(
                async () =>
                    new Response("  \n<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", {
                        status: 200,
                        headers: { "content-type": "image/png" },
                    }),
            ),
        );

        const result = await rehostPromptCover("https://cdn.example.com/fake.png", "prompt-seed:test");
        expect(result).toEqual({ ok: false, reason: "svg_not_allowed" });
        expect(mocks.persistExternalMediaIfEnabled).not.toHaveBeenCalled();
    });
});
