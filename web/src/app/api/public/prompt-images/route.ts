import { NextResponse } from "next/server";

import { createPublicPromptImage } from "@/lib/server/public-prompt-image";
import { checkPublicMediaRateLimit, rateLimitHeaders } from "@/lib/server/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const rate = await checkPublicMediaRateLimit("prompt-images", request);
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: "访问过于频繁，请稍后重试" }, { status: 429, headers: rateLimitHeaders(rate) });

    const params = new URL(request.url).searchParams;
    if (!params.get("path")) return Response.json({ code: 400, data: null, msg: "缺少图片路径" }, { status: 400 });
    try {
        const image = await createPublicPromptImage(params.get("path"), params.get("width"));
        if (!image) return Response.json({ code: 400, data: null, msg: "图片路径无效" }, { status: 400 });
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
        return Response.json({ code: 502, data: null, msg: "提示词图片加载失败" }, { status: 502 });
    }
}
