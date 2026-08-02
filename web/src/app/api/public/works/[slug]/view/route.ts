import { NextResponse } from "next/server";

import { checkPublicMediaRateLimit, rateLimitHeaders } from "@/lib/server/security";
import { recordPublicWorkPublicationView } from "@/lib/server/work-publication-service";
import { workPublicationError, workPublicationOk } from "@/app/api/_shared/work-publication-response";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: Context) {
    const { slug } = await context.params;
    const rate = await checkPublicMediaRateLimit(`work-view:${slug}`, request);
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("common.rateLimited") }, { status: 429, headers: rateLimitHeaders(rate) });
    try {
        return await workPublicationOk({ viewCount: await recordPublicWorkPublicationView(slug) });
    } catch (error) {
        return await workPublicationError(error, "记录作品访问失败", "Record public work view failed");
    }
}
