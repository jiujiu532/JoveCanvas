import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth/session";
import { isAuthInputError, updateOwnPassword } from "@/lib/auth/store";
import { checkRateLimit } from "@/lib/server/security";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });

    const limit = await checkRateLimit(`password-change:${currentUser.id}`, { maxRequests: 5, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ error: await serverMessage("common.rateLimited"), retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000) }, { status: 429 });

    try {
        const body = await readJsonBody<{ currentPassword?: unknown; newPassword?: unknown }>(request);
        await updateOwnPassword(currentUser.id, {
            currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
            newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
        });
        const response = NextResponse.json({ ok: true });
        clearSessionCookie(response, request);
        return response;
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Password update failed", error);
        return NextResponse.json({ error: await serverMessage("auth.changePasswordFailed") }, { status: 500 });
    }
}
