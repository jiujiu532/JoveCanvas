import { NextResponse } from "next/server";

import { createPublicPromptImage } from "@/lib/server/public-prompt-image";
import { checkPublicMediaRateLimit, rateLimitHeaders } from "@/lib/server/security";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const rate = await checkPublicMediaRateLimit("prompt-images", request);
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("common.rateLimited") }, { status: 429, headers: rateLimitHeaders(rate) });

    const params = new URL(request.url).searchParams;
    if (!params.get("path")) return Response.json({ code: 400, data: null, msg: await serverMessage("prompts.imagePathRequired") }, { status: 400 });
    try {
        const image = await createPublicPromptImage(params.get("path"), params.get("width"));
        if (!image) return Response.json({ code: 400, data: null, msg: await serverMessage("prompts.imagePathInvalid") }, { status: 400 });
        return new Response(new Uint8Array(image), {
            headers: {
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Type": "image/webp",
                "Cross-Origin-Resource-Policy": "same-origin",
                "X-Content-Type-Options": "nosniff",
                "X-Robots-Tag": "noindex, nofollow, noarchive",
            },
        });
    } catch (error) {
        console.error("Public prompt image failed", error);
        return Response.json({ code: 502, data: null, msg: await serverMessage("prompts.imageLoadFailed") }, { status: 502 });
    }
}
