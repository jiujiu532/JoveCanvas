import { type NextRequest, NextResponse } from "next/server";

import { workPublicationError, workPublicationOk } from "@/app/api/_shared/work-publication-response";
import { listPublicGallery } from "@/lib/server/work-governance-service";
import { checkPublicMediaRateLimit, rateLimitHeaders } from "@/lib/server/security";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const rate = await checkPublicMediaRateLimit("gallery", request);
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("common.rateLimited") }, { status: 429, headers: rateLimitHeaders(rate) });

    try {
        const params = request.nextUrl.searchParams;
        return await workPublicationOk(
            await listPublicGallery({
                limit: Number(params.get("limit")) || 12,
                sort: params.get("sort"),
                category: params.get("category"),
                tag: params.get("tag"),
                keyword: params.get("keyword"),
                featured: params.get("featured"),
                cursor: params.get("cursor"),
            }),
        );
    } catch (error) {
        return await workPublicationError(error, "获取作品广场失败", "List public gallery failed");
    }
}
