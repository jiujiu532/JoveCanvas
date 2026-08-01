import { type NextRequest, NextResponse } from "next/server";

import { workPublicationError, workPublicationOk } from "@/app/api/_shared/work-publication-response";
import { listCommunityRanking } from "@/lib/server/work-community-service";
import { checkPublicMediaRateLimit, rateLimitHeaders } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const rate = await checkPublicMediaRateLimit("gallery-ranking", request);
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: "访问过于频繁，请稍后重试" }, { status: 429, headers: rateLimitHeaders(rate) });

    const params = request.nextUrl.searchParams;
    try {
        return workPublicationOk(
            await listCommunityRanking({
                window: params.get("window"),
                limit: Number(params.get("limit")) || 12,
                cursor: params.get("cursor"),
            }),
        );
    } catch (error) {
        return workPublicationError(error, "获取社区热榜失败", "List community ranking failed");
    }
}
