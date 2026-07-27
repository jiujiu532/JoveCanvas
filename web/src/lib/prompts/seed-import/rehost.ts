import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { createDatedMediaPath, REFERENCE_MEDIA_ROOT } from "@/lib/server/local-media-storage";
import { registerLocalMediaAsset } from "@/lib/server/local-media-registry";
import { persistExternalMediaIfEnabled } from "@/lib/server/object-storage-service";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

export type RehostResult = { ok: true; coverUrl: string; token: string } | { ok: false; reason: string };

/** Persist external cover bytes as permanent prompt-seed media; coverUrl is unsigned /api/reference-assets path. */
export async function rehostPromptCover(originUrl: string, mediaSource: string): Promise<RehostResult> {
    const url = (originUrl || "").trim();
    if (!/^https?:\/\//i.test(url)) return { ok: false, reason: "invalid_url" };

    let bytes: Buffer;
    let mimeType: string;
    try {
        const fetched = await fetchImageBytes(url);
        bytes = fetched.bytes;
        mimeType = fetched.mimeType;
    } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : "fetch_failed" };
    }

    const ext = extensionFromMime(mimeType);
    const token = createDatedMediaPath("permanent", "image", ext);
    const registration = {
        storageKey: token,
        scope: "reference" as const,
        storageClass: "permanent" as const,
        type: "image" as const,
        ownerUserId: "system",
        source: mediaSource.startsWith("prompt-seed") ? mediaSource : `prompt-seed:${mediaSource}`,
        mimeType,
        bytes: bytes.length,
        originalName: token.split("/").pop(),
    };

    try {
        const external = await persistExternalMediaIfEnabled({ registration, bytes });
        if (external) return { ok: true, token, coverUrl: publicReferenceCoverUrl(token) };

        const filePath = resolve(REFERENCE_MEDIA_ROOT, token);
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, bytes);
        try {
            await registerLocalMediaAsset(registration);
        } catch (error) {
            await unlink(filePath).catch(() => undefined);
            throw error;
        }
        return { ok: true, token, coverUrl: publicReferenceCoverUrl(token) };
    } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : "persist_failed" };
    }
}

export function publicReferenceCoverUrl(token: string): string {
    const safe = token.replace(/^\/+/, "");
    return `/api/reference-assets/${safe}`;
}

async function fetchImageBytes(url: string): Promise<{ bytes: Buffer; mimeType: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            redirect: "follow",
            headers: { Accept: "image/*,*/*;q=0.8", "User-Agent": "vozeb-pro-prompt-seed-import/1.0" },
        });
        if (!response.ok) throw new Error(`http_${response.status}`);
        const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (contentType && !contentType.startsWith("image/")) throw new Error(`not_image:${contentType}`);
        const arrayBuffer = await response.arrayBuffer();
        const bytes = Buffer.from(arrayBuffer);
        if (!bytes.length) throw new Error("empty_body");
        if (bytes.length > MAX_IMAGE_BYTES) throw new Error("too_large");
        const mimeType = contentType && contentType.startsWith("image/") ? contentType : sniffMime(bytes);
        if (!mimeType.startsWith("image/")) throw new Error("not_image_sniff");
        return { bytes, mimeType };
    } finally {
        clearTimeout(timer);
    }
}

function extensionFromMime(mimeType: string): string {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
    return "jpg";
}

function sniffMime(bytes: Buffer): string {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes.length >= 6 && bytes.toString("ascii", 0, 6) === "GIF87a") return "image/gif";
    if (bytes.length >= 6 && bytes.toString("ascii", 0, 6) === "GIF89a") return "image/gif";
    if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    return "application/octet-stream";
}
