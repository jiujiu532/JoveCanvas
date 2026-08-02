import { type NextRequest, NextResponse } from "next/server";

import { workPublicationError, workPublicationOk } from "@/app/api/_shared/work-publication-response";
import { listCommunityRanking } from "@/lib/server/work-community-service";
import { checkPublicMediaRateLimit, rateLimitHeaders } from "@/lib/server/security";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const rate = await checkPublicMediaRateLimit("gallery-ranking", request);
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("common.rateLimited") }, { status: 429, headers: rateLimitHeaders(rate) });

    const params = request.nextUrl.searchParams;
    try {
        return await workPublicationOk(
            await listCommunityRanking({
                window: params.get("window"),
                limit: Number(params.get("limit")) || 12,
                cursor: params.get("cursor"),
            }),
        );
    } catch (error) {
        return await workPublicationError(error, "获取社区热榜失败", "List community ranking failed");
    }
}
