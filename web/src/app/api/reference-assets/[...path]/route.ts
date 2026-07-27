import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { verifyReferenceAssetSignature } from "@/lib/server/reference-asset-access";
import { createLocalMediaResponse, mediaContentDisposition } from "@/lib/server/local-media-response";
import { getLocalMediaRegistration, type LocalMediaRegistration } from "@/lib/server/local-media-registry";
import { createExternalMediaReadUrl } from "@/lib/server/object-storage-service";
import { isReferenceAssetPath, readReferenceAsset } from "@/lib/server/reference-asset-store";
import { checkLocalMediaRateLimit, getClientIp, rateLimitHeaders } from "@/lib/server/security";

import { serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ path: string[] }>;
};

/** Phase2 scheme C: permanent prompt-seed* covers are plaza-readable without login. */
export function isPublicPromptSeedCover(registration: Pick<LocalMediaRegistration, "storageClass" | "source">) {
    return registration.storageClass === "permanent" && typeof registration.source === "string" && registration.source.startsWith("prompt-seed");
}

export async function GET(request: Request, context: RouteContext) {
    const { path } = await context.params;
    const storagePath = path.join("/");
    if (!isReferenceAssetPath(storagePath)) return NextResponse.json({ error: await serverMessage("media.notFoundOrExpired") }, { status: 404 });

    const url = new URL(request.url);
    const signature = url.searchParams.get("signature") || "";
    const signed = verifyReferenceAssetSignature(storagePath, url.searchParams.get("expires"), signature);

    // Resolve auth gate: signature | prompt-seed public | login.
    let rateIdentity = `signature:${signature || "anon"}`;
    let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;
    let registration: LocalMediaRegistration | null = null;

    if (!signed) {
        registration = await getLocalMediaRegistration(storagePath);
        if (registration && isPublicPromptSeedCover(registration)) {
            // Use hop-aware client IP (never raw XFF string — spoofable).
            rateIdentity = `public-prompt-seed:${getClientIp(request)}`;
        } else {
            currentUser = await getCurrentUser();
            if (!currentUser) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
            rateIdentity = `user:${currentUser.id}`;
        }
    }

    const rate = await checkLocalMediaRateLimit(rateIdentity, request);
    if (!rate.allowed) {
        return NextResponse.json(
            { code: 429, data: null, msg: await serverMessage("common.rateLimitedFeatureRetry", { feature: await serverMessage("features.mediaAccess") }) },
            { status: 429, headers: rateLimitHeaders(rate) },
        );
    }

    if (!registration) registration = await getLocalMediaRegistration(storagePath);
    if (!registration) return NextResponse.json({ error: await serverMessage("media.notFoundOrExpired") }, { status: 404 });

    // Non-public assets still require owner/admin when not signed.
    if (!signed && !isPublicPromptSeedCover(registration)) {
        if (currentUser && currentUser.role !== "admin" && registration.ownerUserId !== currentUser.id) {
            return NextResponse.json({ code: 404, data: null, msg: await serverMessage("media.fileNotFound") }, { status: 404 });
        }
    }

    if (registration.storageProvider === "object") {
        try {
            const externalUrl = await createExternalMediaReadUrl(request, registration);
            return externalUrl ? externalMediaRedirect(externalUrl) : NextResponse.json({ error: await serverMessage("media.notFoundOrExpired") }, { status: 404 });
        } catch (error) {
            console.error("Reference object storage read failed", error);
            return NextResponse.json({ error: await serverMessage("media.externalReadFailed") }, { status: 502 });
        }
    }

    const asset = await readReferenceAsset(storagePath);
    if (!asset) return NextResponse.json({ error: await serverMessage("media.notFoundOrExpired") }, { status: 404 });

    const isPublicSeed = isPublicPromptSeedCover(registration);
    return (
        (await createLocalMediaResponse(request, asset.filePath, asset.mimeType, {
            "Cache-Control": storagePath.startsWith("permanent/") ? (isPublicSeed ? "public, max-age=86400" : "private, max-age=86400") : "private, max-age=300",
            "Content-Disposition": mediaContentDisposition("inline", registration.originalName || path.at(-1) || "media"),
        })) || NextResponse.json({ error: await serverMessage("media.notFoundOrExpired") }, { status: 404 })
    );
}

function externalMediaRedirect(url: string) {
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
}
