import { unauthorized, workPublicationError, workPublicationOk } from "@/app/api/_shared/work-publication-response";
import { getCurrentUser } from "@/lib/auth/session";
import { markUserNotificationRead } from "@/lib/server/work-community-service";
import { checkRateLimit, rateLimitHeaders } from "@/lib/server/security";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return await unauthorized();
    const rate = await checkRateLimit(`interaction-notification-read:${user.id}`, { maxRequests: 80, windowMs: 60_000 });
    if (!rate.allowed) return Response.json({ code: 429, data: null, msg: await serverMessage("common.rateLimitedFeatureAgain") }, { status: 429, headers: rateLimitHeaders(rate) });
    try {
        return await workPublicationOk({ item: await markUserNotificationRead(user.id, (await context.params).id) }, "通知已读");
    } catch (error) {
        return await workPublicationError(error, "更新通知失败", "Read interaction notification failed");
    }
}
