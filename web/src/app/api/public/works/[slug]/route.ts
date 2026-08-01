import { NextResponse } from "next/server";

import { getPublicWorkPublication } from "@/lib/server/work-publication-service";
import { checkPublicMediaRateLimit, rateLimitHeaders } from "@/lib/server/security";
import { workPublicationError, workPublicationOk } from "@/app/api/_shared/work-publication-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: Context) {
    const { slug } = await context.params;
    const rate = await checkPublicMediaRateLimit(`work:${slug}`, request);
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: "访问过于频繁，请稍后重试" }, { status: 429, headers: rateLimitHeaders(rate) });

    try {
        return workPublicationOk({ work: await getPublicWorkPublication(slug) });
    } catch (error) {
        return workPublicationError(error, "获取公开作品失败", "Get public work failed");
    }
}
