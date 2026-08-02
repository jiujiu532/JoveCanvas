import { type NextRequest, NextResponse } from "next/server";

import { workPublicationError, workPublicationOk } from "@/app/api/_shared/work-publication-response";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicCreatorPage } from "@/lib/server/work-community-service";
import { checkPublicMediaRateLimit, rateLimitHeaders } from "@/lib/server/security";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, context: Context) {
    const { userId } = await context.params;
    const rate = await checkPublicMediaRateLimit(`user:${userId}`, request);
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("common.rateLimited") }, { status: 429, headers: rateLimitHeaders(rate) });

    const viewer = await getCurrentUser();
    try {
        return await workPublicationOk(
            await getPublicCreatorPage(userId, viewer?.id, {
                limit: Number(request.nextUrl.searchParams.get("limit")) || 18,
                cursor: request.nextUrl.searchParams.get("cursor"),
            }),
        );
    } catch (error) {
        return await workPublicationError(error, "获取创作者主页失败", "Get public creator profile failed");
    }
}
