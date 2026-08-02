import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { isAuthInputError, resetPasswordByEmail } from "@/lib/auth/store";
import { checkRateLimit, getClientIp } from "@/lib/server/security";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const body = await readJsonBody<{ email?: unknown; code?: unknown; newPassword?: unknown }>(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const limit = await checkRateLimit(`reset:${getClientIp(request)}:${email}`, { maxRequests: 10, windowMs: 60 * 60 * 1000 });
        if (!limit.allowed) return NextResponse.json({ error: await serverMessage("common.rateLimited"), retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000) }, { status: 429 });
        await resetPasswordByEmail({
            email: typeof body.email === "string" ? body.email : "",
            code: typeof body.code === "string" ? body.code : "",
            newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Password reset failed", error);
        return NextResponse.json({ error: await serverMessage("auth.resetPasswordFailed") }, { status: 500 });
    }
}
