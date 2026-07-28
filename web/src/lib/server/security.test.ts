import { describe, expect, it, vi } from "vitest";
import {
    checkGenerationRateLimit,
    checkLocalMediaRateLimit,
    checkMediaProxyRateLimit,
    checkRateLimit,
    getClientIp,
    isPublicIpAddress,
    isSafeOutboundUrl,
    rateLimitHeaders,
} from "./security";

describe("checkRateLimit", () => {
    it("blocks requests beyond the configured window limit", async () => {
        const key = `test:${crypto.randomUUID()}`;
        expect((await checkRateLimit(key, { maxRequests: 2, windowMs: 60_000 })).allowed).toBe(true);
        expect((await checkRateLimit(key, { maxRequests: 2, windowMs: 60_000 })).allowed).toBe(true);
        expect((await checkRateLimit(key, { maxRequests: 2, windowMs: 60_000 })).allowed).toBe(false);
    });

    it("only trusts the configured number of proxy hops", () => {
        const previous = process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
        delete process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
        expect(getClientIp(new Request("http://localhost", { headers: { "x-forwarded-for": "198.51.100.10" } }))).toBe("unknown");

        process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS = "2";
        expect(getClientIp(new Request("http://localhost", { headers: { "x-forwarded-for": "198.51.100.10, 203.0.113.10, 192.0.2.10" } }))).toBe("203.0.113.10");

        if (previous === undefined) delete process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
        else process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS = previous;
    });

    it("reads cf-connecting-ip and x-real-ip when trusted proxy hops is 0", () => {
        const previous = process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
        delete process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
        try {
            expect(getClientIp(new Request("http://localhost", { headers: { "cf-connecting-ip": "198.51.100.20" } }))).toBe("198.51.100.20");
            expect(getClientIp(new Request("http://localhost", { headers: { "x-real-ip": "203.0.113.20" } }))).toBe("203.0.113.20");
            expect(
                getClientIp(
                    new Request("http://localhost", {
                        headers: { "cf-connecting-ip": "198.51.100.30", "x-real-ip": "203.0.113.30", "x-forwarded-for": "192.0.2.30" },
                    }),
                ),
            ).toBe("198.51.100.30");
            expect(getClientIp(new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.40" } }))).toBe("unknown");
        } finally {
            if (previous === undefined) delete process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
            else process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS = previous;
        }
    });

    it("limits generation requests by user", async () => {
        const userId = `user:${crypto.randomUUID()}`;
        for (let index = 0; index < 6; index += 1) expect((await checkGenerationRateLimit(userId, new Request("http://localhost"), "video")).allowed).toBe(true);
        expect((await checkGenerationRateLimit(userId, new Request("http://localhost"), "video")).allowed).toBe(false);
    });

    it("limits generation requests across users sharing an IP", async () => {
        const previous = process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
        process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS = "1";
        const clientIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
        try {
            for (let index = 0; index < 24; index += 1) {
                const request = new Request("http://localhost", { headers: { "x-forwarded-for": clientIp } });
                expect((await checkGenerationRateLimit(`user:${crypto.randomUUID()}`, request, "video")).allowed).toBe(true);
            }
            const blocked = await checkGenerationRateLimit(`user:${crypto.randomUUID()}`, new Request("http://localhost", { headers: { "x-forwarded-for": clientIp } }), "video");
            expect(blocked.allowed).toBe(false);
        } finally {
            if (previous === undefined) delete process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
            else process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS = previous;
        }
    });

    it("limits repeated media proxy access", async () => {
        const userId = `media:${crypto.randomUUID()}`;
        for (let index = 0; index < 120; index += 1) expect((await checkMediaProxyRateLimit(userId, new Request("http://localhost"))).allowed).toBe(true);
        expect((await checkMediaProxyRateLimit(userId, new Request("http://localhost"))).allowed).toBe(false);
    });

    it("limits repeated local media access", async () => {
        const identity = `local-media:${crypto.randomUUID()}`;
        for (let index = 0; index < 240; index += 1) expect((await checkLocalMediaRateLimit(identity, new Request("http://localhost"))).allowed).toBe(true);
        expect((await checkLocalMediaRateLimit(identity, new Request("http://localhost"))).allowed).toBe(false);
    });

    it("uses a stricter limit for leaked signed media urls", async () => {
        const identity = `signature:${crypto.randomUUID()}`;
        for (let index = 0; index < 60; index += 1) expect((await checkLocalMediaRateLimit(identity, new Request("http://localhost"))).allowed).toBe(true);
        expect((await checkLocalMediaRateLimit(identity, new Request("http://localhost"))).allowed).toBe(false);
    });

    it("returns a Retry-After header in seconds", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
        expect(rateLimitHeaders({ allowed: false, remaining: 0, resetAt: Date.now() + 1500 })).toEqual({ "Retry-After": "2" });
        vi.useRealTimers();
    });
});

describe("isPublicIpAddress", () => {
    it("rejects private, loopback, and link-local IPv4 ranges", () => {
        expect(isPublicIpAddress("10.0.0.1")).toBe(false);
        expect(isPublicIpAddress("127.0.0.1")).toBe(false);
        expect(isPublicIpAddress("192.168.1.1")).toBe(false);
        expect(isPublicIpAddress("169.254.1.1")).toBe(false);
        expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    });

    it("rejects NAT64 well-known prefix 64:ff9b::/96", () => {
        expect(isPublicIpAddress("64:ff9b::1")).toBe(false);
        expect(isPublicIpAddress("64:ff9b:0:0:0:0:c000:201")).toBe(false);
        expect(isPublicIpAddress("2001:4860:4860::8888")).toBe(true);
    });
});

describe("isSafeOutboundUrl", () => {
    it("rejects non-http protocols and credentialed urls", async () => {
        expect(await isSafeOutboundUrl("ftp://example.com/a.png")).toBe(false);
        expect(await isSafeOutboundUrl("https://user:pass@example.com/a.png")).toBe(false);
        expect(await isSafeOutboundUrl("https://user:pass@example.com/a.png", { allowCredentials: true })).toBe(true);
    });

    it("rejects direct private and NAT64 IP hosts", async () => {
        expect(await isSafeOutboundUrl("http://127.0.0.1/x")).toBe(false);
        expect(await isSafeOutboundUrl("http://[64:ff9b::1]/x")).toBe(false);
        expect(await isSafeOutboundUrl("https://8.8.8.8/x")).toBe(true);
    });
});
