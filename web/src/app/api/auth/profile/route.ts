import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser, serializeCurrentUser } from "@/lib/auth/session";
import { isAuthInputError, updateOwnProfile } from "@/lib/auth/store";
import { checkRateLimit } from "@/lib/server/security";

import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });

    const limit = await checkRateLimit(`profile-update:${currentUser.id}`, { maxRequests: 10, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ error: await serverMessage("common.rateLimitedFeatureRetry", { feature: "操作" }), retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000) }, { status: 429 });

    try {
        const body = await readJsonBody<{ displayName?: unknown; email?: unknown; emailCode?: unknown }>(request);
        const user = await updateOwnProfile(currentUser.id, {
            displayName: typeof body.displayName === "string" ? body.displayName : undefined,
            email: typeof body.email === "string" ? body.email : undefined,
            emailCode: typeof body.emailCode === "string" ? body.emailCode : undefined,
        });
        return NextResponse.json({ user: serializeCurrentUser(user) });
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Profile update failed", error);
        return NextResponse.json({ error: "更新个人资料失败" }, { status: 500 });
    }
}
